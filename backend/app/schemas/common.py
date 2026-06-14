"""Shared pagination and response schemas."""

from __future__ import annotations

from typing import Any, Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PaginationMeta(BaseModel):
    page: int
    per_page: int
    total: int
    total_pages: int


class PaginatedResponse(BaseModel, Generic[T]):
    data: list[Any]
    pagination: PaginationMeta


class ApiResponse(BaseModel, Generic[T]):
    data: Any
    meta: dict[str, Any] | None = None
