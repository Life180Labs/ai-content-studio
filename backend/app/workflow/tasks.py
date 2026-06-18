"""
Celery tasks for executing LangGraph workflows in the background.
"""

from __future__ import annotations

import asyncio
import sys
from typing import Any

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
import structlog
from celery import shared_task
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import async_session_factory
from app.repositories.ai_preference import AIPreferenceRepository
from app.services.ai_preference import AIPreferenceService
from app.workflow.graph import workflow
from app.workflow.state import PipelineGraphState

logger = structlog.get_logger("workflow.tasks")
settings = get_settings()


async def _run_graph_async(
    project_id: str,
    user_id: str,
    script: str,
    node: str = "generate_storyboard",
    **kwargs: Any
) -> dict:
    """Async wrapper to run the graph with a Postgres Checkpointer."""
    
    # In a real distributed setup we'd connect using asyncpg directly
    # For now we use the main database URL
    db_url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgres://")
    
    async with async_session_factory() as session:
        pref_repo = AIPreferenceRepository(session)
        pref_service = AIPreferenceService(session)
        pref = await pref_repo.get_by_user_id(user_id)
        
        if not pref:
            return {"error": "No AI preferences found."}
            
        keys = pref_service.get_decrypted_keys(pref)
        
        # Build initial state
        initial_state = PipelineGraphState(
            project_id=project_id,
            user_id=user_id,
            provider_keys=keys,
            default_provider=pref.default_provider,
            default_model=pref.default_model,
            fallback_enabled=pref.fallback_enabled,
            fallback_action=pref.fallback_action,
            fallback_provider=pref.fallback_provider,
            fallback_model=pref.fallback_model,
            retry_count=pref.retry_count,
            task_overrides=pref.task_overrides or {},
            script=script,
            storyboard_scenes=kwargs.get("storyboard_scenes", []),
            selected_voice_id=kwargs.get("selected_voice_id"),
            voice_audio_paths=kwargs.get("voice_audio_paths", {}),
            selected_avatar_id=kwargs.get("selected_avatar_id"),
            avatar_video_ids=kwargs.get("avatar_video_ids", {}),
            use_custom_voice=kwargs.get("use_custom_voice", True),
            current_node=node,
            error_message=None,
            retry_attempts={},
            messages=[],
        )

    # Use checkpointer
    from psycopg_pool import AsyncConnectionPool
    
    async with AsyncConnectionPool(
        conninfo=db_url,
        max_size=20,
        kwargs={
            "autocommit": True,
            "prepare_threshold": 0,
        },
    ) as pool:
        checkpointer = AsyncPostgresSaver(pool)
        
        # We need to call setup once, usually outside, but this works for development
        await checkpointer.setup()
        
        graph = workflow.compile(checkpointer=checkpointer)
        
        config = {"configurable": {"thread_id": project_id}}
        
        logger.info("invoking_graph", project_id=project_id, node=node)
        
        # If we are resuming, we update the state first, but here we just stream
        # If the thread exists, it resumes.
        
        # Update the state to start from a specific node if needed, 
        # but invoke will just run from where it paused or START.
        # Actually, if we pass initial_state, it updates the state.
        try:
            result = await graph.ainvoke(initial_state, config)
        except Exception as e:
            logger.error("graph_execution_failed", error=str(e), exc_info=True)
            result = {
                "error_message": f"Pipeline crashed unexpectedly: {str(e)}",
                "current_node": node,
            }
        
        # Save output to PipelineRun so the frontend polling endpoint sees it
        async with async_session_factory() as run_session:
            from app.models.pipeline_run import PipelineRun
            import uuid
            
            if result.get("error_message"):
                stage_map = {
                    "generate_storyboard": "storyboard",
                    "generate_assets": "voice-avatar"
                }
                run = PipelineRun(
                    project_id=uuid.UUID(project_id),
                    stage=stage_map.get(node, "unknown"),
                    input_data={"node": node},
                    output_data={},
                    provider="langgraph",
                    model="pipeline",
                    status="error",
                    error_message=result.get("error_message")
                )
                run_session.add(run)
                await run_session.commit()
            elif node == "generate_storyboard" and not result.get("error_message"):
                run = PipelineRun(
                    project_id=uuid.UUID(project_id),
                    stage="storyboard",
                    input_data={"script": script[:500]},
                    output_data={"scenes": result.get("storyboard_scenes", [])},
                    provider="langgraph",
                    model="pipeline",
                    status="success"
                )
                run_session.add(run)
                await run_session.commit()
            elif node == "generate_assets" and not result.get("error_message"):
                run = PipelineRun(
                    project_id=uuid.UUID(project_id),
                    stage="video",
                    input_data={
                        "voice_id": kwargs.get("selected_voice_id"),
                        "avatar_id": kwargs.get("selected_avatar_id"),
                        "use_custom_voice": kwargs.get("use_custom_voice", True)
                    },
                    output_data={
                        "audio_paths": result.get("voice_audio_paths", {}),
                        "videos": result.get("avatar_video_ids", {})
                    },
                    provider="langgraph",
                    model="pipeline",
                    status="success"
                )
                run_session.add(run)
                await run_session.commit()

        return {
            "current_node": result.get("current_node"),
            "error_message": result.get("error_message"),
            "storyboard_scenes": result.get("storyboard_scenes", []),
            "voice_audio_paths": result.get("voice_audio_paths", {}),
            "avatar_video_ids": result.get("avatar_video_ids", {}),
        }


@shared_task(name="app.workflow.tasks.start_storyboard_generation")
def start_storyboard_generation(project_id: str, user_id: str, script: str) -> dict:
    """Celery task to start storyboard generation."""
    logger.info("celery_task_started", task="start_storyboard", project_id=project_id)
    return asyncio.run(_run_graph_async(project_id, user_id, script, node="generate_storyboard"))


@shared_task(name="app.workflow.tasks.start_assets_generation")
def start_assets_generation(
    project_id: str, user_id: str, selected_voice_id: str, selected_avatar_id: str, 
    use_custom_voice: bool = True, storyboard_scenes: list[dict] | None = None, 
    video_settings: dict | None = None
) -> dict:
    """Celery task to resume workflow and generate voice and avatar video."""
    logger.info("celery_task_started", task="start_assets", project_id=project_id)
    
    kwargs = {
        "selected_voice_id": selected_voice_id,
        "selected_avatar_id": selected_avatar_id,
        "use_custom_voice": use_custom_voice,
    }
    if storyboard_scenes is not None:
        kwargs["storyboard_scenes"] = storyboard_scenes
    if video_settings is not None:
        kwargs["aspect_ratio"] = video_settings.get("frame_size", "16:9")
        kwargs["video_quality"] = video_settings.get("quality", "1080p")

    return asyncio.run(_run_graph_async(
        project_id, 
        user_id, 
        script="", 
        node="generate_assets", 
        **kwargs
    ))
