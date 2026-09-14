from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from app.models.lot import LotStatus


class LotCreate(BaseModel):
    lot_number: int = Field(..., gt=0)
    block: Optional[str] = None
    area_sqm: float = Field(..., gt=0)
    price_per_sqm: float = Field(default=1000.0, gt=0)
    map_coordinates: Optional[str] = None


class LotUpdate(BaseModel):
    lot_number: Optional[int] = None
    block: Optional[str] = None
    area_sqm: Optional[float] = None
    price_per_sqm: Optional[float] = None
    status: Optional[LotStatus] = None
    map_coordinates: Optional[str] = None


class LotResponse(BaseModel):
    id: int
    project_id: int
    lot_number: int
    block: Optional[str] = None
    area_sqm: float
    price_per_sqm: float
    total_price: float
    status: LotStatus
    map_coordinates: Optional[str] = None
    sold_to_client_id: Optional[int] = None
    sold_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LotBulkCreate(BaseModel):
    lots: list[LotCreate]
