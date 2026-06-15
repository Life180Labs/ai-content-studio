import asyncio
from app.db.session import async_session_factory
from app.models.pipeline_run import PipelineRun
from sqlalchemy import select

async def run():
    async with async_session_factory() as session:
        result = await session.execute(
            select(PipelineRun).order_by(PipelineRun.created_at.desc()).limit(5)
        )
        for r in result.scalars():
            print(f"Stage: {r.stage}, Status: {r.status}, Error: {r.error_message}")

asyncio.run(run())
