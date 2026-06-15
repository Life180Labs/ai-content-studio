from pydantic import BaseModel
import uuid
from datetime import datetime

class RecentProjectResponse(BaseModel):
    id: uuid.UUID
    title: str
    status: str
    created_at: datetime
    updated_at: datetime

class DashboardStatsResponse(BaseModel):
    total_projects: int
    generated_assets: int
    total_cost_usd: float
    total_tokens: int
    success_rate: float
    recent_projects: list[RecentProjectResponse]
