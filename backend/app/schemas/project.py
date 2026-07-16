from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from app.models.project import ProjectStatus


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=255, pattern=r"^[a-z0-9-]+$")
    description: Optional[str] = None
    location: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    price_per_sqm: float = Field(default=1000.0, gt=0)
    total_lots: int = Field(default=0, ge=0)
    cover_image_url: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    price_per_sqm: Optional[float] = None
    status: Optional[ProjectStatus] = None
    cover_image_url: Optional[str] = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    slug: str
    description: Optional[str] = None
    location: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: str
    price_per_sqm: float
    total_lots: int
    available_lots: int
    sold_lots: int
    status: ProjectStatus
    cover_image_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
