from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from app.models.sale import SaleStatus


class SaleCreate(BaseModel):
    client_id: int
    lot_id: int
    agent_id: Optional[int] = None
    sale_price: float = Field(..., gt=0)
    down_payment: float = Field(default=0, ge=0)
    financing_amount: float = Field(default=0, ge=0)
    interest_rate: Optional[float] = None
    payment_terms_months: Optional[int] = None
    monthly_payment: Optional[float] = None
    notes: Optional[str] = None
    commission_percentage: Optional[float] = None


class SaleUpdate(BaseModel):
    status: Optional[SaleStatus] = None
    sale_price: Optional[float] = None
    down_payment: Optional[float] = None
    financing_amount: Optional[float] = None
    interest_rate: Optional[float] = None
    payment_terms_months: Optional[int] = None
    monthly_payment: Optional[float] = None
    notes: Optional[str] = None
    commission_percentage: Optional[float] = None


class SaleResponse(BaseModel):
    id: int
    client_id: int
    lot_id: int
    agent_id: Optional[int] = None
    sale_price: float
    down_payment: float
    financing_amount: float
    interest_rate: Optional[float] = None
    payment_terms_months: Optional[int] = None
    monthly_payment: Optional[float] = None
    status: SaleStatus
    notes: Optional[str] = None
    reservation_expires_at: Optional[datetime] = None
    commission_percentage: Optional[float] = None
    commission_amount: Optional[float] = None
    created_at: datetime
    updated_at: datetime
    closed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PaymentPlanResponse(BaseModel):
    id: int
    sale_id: int
    client_id: int
    installment_number: int
    due_date: datetime
    amount: float
    paid_amount: Optional[float] = 0
    is_paid: bool
    paid_at: Optional[datetime] = None
    late_fee: Optional[float] = 0
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PaymentCreate(BaseModel):
    sale_id: int
    payment_plan_id: Optional[int] = None
    amount: float = Field(..., gt=0)
    payment_method: Optional[str] = None
    reference_number: Optional[str] = None
    receipt_url: Optional[str] = None
    notes: Optional[str] = None
    paid_by: Optional[str] = None


class PaymentResponse(BaseModel):
    id: int
    sale_id: int
    payment_plan_id: Optional[int] = None
    amount: float
    payment_method: Optional[str] = None
    reference_number: Optional[str] = None
    receipt_url: Optional[str] = None
    notes: Optional[str] = None
    paid_by: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class QuoteRequest(BaseModel):
    lot_id: int
    down_payment_percentage: float = Field(default=30, ge=0, le=100)
    payment_terms_months: int = Field(default=24, gt=0)
    interest_rate: float = Field(default=12.0, ge=0)


class QuoteResponse(BaseModel):
    lot_number: int
    block: Optional[str] = None
    area_sqm: float
    price_per_sqm: float
    total_price: float
    down_payment: float
    down_payment_percentage: float
    financing_amount: float
    interest_rate: float
    payment_terms_months: int
    monthly_payment: float
    total_interest: float
    total_to_pay: float
