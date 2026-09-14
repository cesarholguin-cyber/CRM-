from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from app.models.client import ClientStatus, LeadSource


class ClientCreate(BaseModel):
    project_id: Optional[int] = None
    full_name: str = Field(..., min_length=1, max_length=255)
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    status: ClientStatus = ClientStatus.LEAD
    lead_source: LeadSource = LeadSource.WEBSITE
    notes: Optional[str] = None
    budget_range: Optional[str] = None
    preferred_lot_size: Optional[float] = None


class ClientUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    status: Optional[ClientStatus] = None
    lead_source: Optional[LeadSource] = None
    notes: Optional[str] = None
    budget_range: Optional[str] = None
    preferred_lot_size: Optional[float] = None
    assigned_agent_id: Optional[int] = None


class ClientResponse(BaseModel):
    id: int
    project_id: Optional[int] = None
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    status: ClientStatus
    lead_source: LeadSource
    notes: Optional[str] = None
    budget_range: Optional[str] = None
    preferred_lot_size: Optional[float] = None
    assigned_agent_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InteractionCreate(BaseModel):
    client_id: int
    interaction_type: str = Field(..., max_length=50)
    notes: Optional[str] = None
    channel: Optional[str] = None
    metadata_json: Optional[str] = None


class InteractionResponse(BaseModel):
    id: int
    client_id: int
    user_id: Optional[int] = None
    interaction_type: str
    notes: Optional[str] = None
    channel: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
