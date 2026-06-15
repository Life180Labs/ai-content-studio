import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, Float, cast

from app.models.project import Project
from app.models.pipeline_run import PipelineRun
from app.schemas.dashboard import DashboardStatsResponse, RecentProjectResponse

class DashboardService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_workspace_stats(self, workspace_id: uuid.UUID) -> DashboardStatsResponse:
        # 1. Total projects
        total_projects = await self.session.scalar(
            select(func.count()).select_from(Project).where(Project.workspace_id == workspace_id, Project.deleted_at.is_(None))
        ) or 0

        # 2. Recent projects (top 5)
        recent_projects_result = await self.session.execute(
            select(Project)
            .where(Project.workspace_id == workspace_id, Project.deleted_at.is_(None))
            .order_by(Project.updated_at.desc())
            .limit(5)
        )
        recent_projects = recent_projects_result.scalars().all()

        # 3. Pipeline Metrics (Cost, Tokens, Success Rate)
        # We join PipelineRun with Project to filter by workspace
        metrics_query = (
            select(
                func.sum(PipelineRun.cost_usd).label("total_cost"),
                func.sum(PipelineRun.input_tokens + PipelineRun.output_tokens).label("total_tokens"),
                func.count(PipelineRun.id).label("total_runs"),
                func.sum(cast(PipelineRun.status == 'success', Float)).label("success_runs"),
            )
            .join(Project, Project.id == PipelineRun.project_id)
            .where(Project.workspace_id == workspace_id, Project.deleted_at.is_(None))
        )
        metrics_result = await self.session.execute(metrics_query)
        metrics = metrics_result.one()

        total_cost_usd = metrics.total_cost or 0.0
        total_tokens = metrics.total_tokens or 0
        total_runs = metrics.total_runs or 0
        success_runs = metrics.success_runs or 0.0
        
        success_rate = 0.0
        if total_runs > 0:
            success_rate = (success_runs / total_runs) * 100.0

        # 4. Generated Assets (Count of successful video/voice runs)
        assets_query = (
            select(func.count(PipelineRun.id))
            .join(Project, Project.id == PipelineRun.project_id)
            .where(
                Project.workspace_id == workspace_id,
                Project.deleted_at.is_(None),
                PipelineRun.status == 'success',
                PipelineRun.stage.in_(['video', 'voice'])
            )
        )
        generated_assets = await self.session.scalar(assets_query) or 0

        return DashboardStatsResponse(
            total_projects=total_projects,
            generated_assets=generated_assets,
            total_cost_usd=float(total_cost_usd),
            total_tokens=int(total_tokens),
            success_rate=float(success_rate),
            recent_projects=[
                RecentProjectResponse(
                    id=p.id,
                    title=p.title,
                    status=p.status,
                    created_at=p.created_at,
                    updated_at=p.updated_at
                ) for p in recent_projects
            ]
        )
