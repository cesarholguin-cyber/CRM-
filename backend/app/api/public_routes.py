from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone, timedelta

from app.core.database import get_db
from app.models.lot import Lot, LotStatus
from app.models.client import Client, ClientStatus
from app.models.sale import Sale, SaleStatus

router = APIRouter(prefix="/public", tags=["Public"])


class ReserveRequest(BaseModel):
    lot_id: int
    full_name: str
    email: str | None = None
    phone: str | None = None

    @field_validator("full_name")
    @classmethod
    def name_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("full_name is required")
        return v.strip()

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        if v and "@" not in v:
            raise ValueError("Invalid email")
        return v


class ReserveResponse(BaseModel):
    success: bool
    message: str
    client_id: int | None = None
    sale_id: int | None = None
    lot_number: int | None = None


@router.post("/reserve", response_model=ReserveResponse)
async def public_reserve(
    data: ReserveRequest,
    db: AsyncSession = Depends(get_db),
):
    # 1. Find the lot
    result = await db.execute(select(Lot).where(Lot.id == data.lot_id))
    lot = result.scalar_one_or_none()
    if not lot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lote no encontrado")

    if lot.status != LotStatus.AVAILABLE:
        return ReserveResponse(
            success=False,
            message=f"El lote #{lot.lot_number} ya no está disponible ({lot.status.value})",
        )

    # 2. Find or create client
    result = await db.execute(
        select(Client).where(Client._email == data.email)
    )
    client = result.scalar_one_or_none()

    if not client:
        client = Client(
            full_name=data.full_name,
            email=data.email,
            phone=data.phone,
            status=ClientStatus.RESERVATION,
            lead_source="website",
            notes="Apartado desde la página web (Floresta Campestre)",
        )
        db.add(client)
        await db.flush()

    # 3. Calculate price
    sale_price = lot.area_sqm * lot.price_per_sqm
    down_payment = sale_price * 0.30
    financing_amount = sale_price - down_payment

    # 4. Create sale as RESERVED with 15-day expiry
    sale = Sale(
        client_id=client.id,
        lot_id=lot.id,
        sale_price=sale_price,
        down_payment=down_payment,
        financing_amount=financing_amount,
        status=SaleStatus.RESERVED,
        reservation_expires_at=datetime.now(timezone.utc) + timedelta(days=15),
        notes=f"Apartado desde web por {data.full_name} - {data.email or data.phone or ''}",
    )
    db.add(sale)

    # 5. Update lot status
    lot.status = LotStatus.RESERVED
    lot.sold_to_client_id = client.id

    await db.commit()
    await db.refresh(sale)
    await db.refresh(lot)

    return ReserveResponse(
        success=True,
        message=f"¡Lote #{lot.lot_number} apartado con éxito! Tienes 15 días para formalizar tu compra.",
        client_id=client.id,
        sale_id=sale.id,
        lot_number=lot.lot_number,
    )
