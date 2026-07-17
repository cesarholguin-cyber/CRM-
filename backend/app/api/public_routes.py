from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from datetime import datetime, timezone, timedelta

from app.core.database import get_db
from app.models.lot import Lot, LotStatus
from app.models.project import Project, ProjectStatus
from app.models.client import Client, ClientStatus
from app.models.sale import Sale, SaleStatus

router = APIRouter(prefix="/public", tags=["Public"])

# Default areas for Floresta Campestre lots (from the website)
DEFAULT_LOT_AREAS = {
    1: 255.518, 2: 224.260, 3: 223.278, 4: 222.296, 5: 221.313,
    6: 220.331, 7: 219.349, 8: 218.367, 9: 217.385, 10: 216.402,
    11: 214.242, 12: 216.259, 13: 216.278, 14: 211.295, 15: 210.313,
    16: 209.331, 17: 208.349, 18: 207.366, 19: 206.384, 20: 205.402,
    21: 204.420, 22: 203.438, 23: 202.456, 24: 201.473, 25: 214.604,
    26: 286.027, 27: 200, 28: 200, 29: 200, 30: 200,
    31: 200, 32: 200, 33: 200, 34: 200, 35: 200,
    36: 200, 37: 200, 38: 200, 39: 200, 40: 200,
    41: 200, 42: 200, 43: 200, 44: 200, 45: 200,
    46: 220, 47: 240, 48: 214.593, 49: 325.121, 50: 200,
    51: 200, 52: 200, 53: 200, 54: 200, 55: 200,
    56: 200, 57: 200, 58: 200, 59: 200, 60: 200,
    61: 200, 62: 200, 63: 200, 64: 200, 65: 200,
    66: 200, 67: 200, 68: 200, 69: 200, 70: 220,
    71: 240, 72: 242.819, 73: 181.808, 74: 200, 75: 200,
    76: 200, 77: 200, 78: 200, 79: 200, 80: 200,
    81: 200, 82: 200, 83: 200, 84: 200, 85: 200,
    86: 200, 87: 200, 88: 200, 89: 200, 90: 200,
    91: 220, 92: 220, 93: 200, 94: 200, 95: 200,
    96: 200, 97: 200, 98: 200, 99: 200, 100: 200,
    101: 200, 102: 200, 103: 192.421, 104: 200, 105: 200,
    106: 200, 107: 200, 108: 200, 109: 200, 110: 220,
    111: 220, 112: 200, 113: 200, 114: 200, 115: 200,
    116: 200, 117: 200, 118: 200, 119: 200, 120: 331.508,
}


class ReserveRequest(BaseModel):
    lot_id: int = 0
    full_name: str
    email: str | None = None
    phone: str | None = None
    lot_number: int | None = None
    area_sqm: float | None = None
    project_slug: str = "floresta-campestre"

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
    # 1. Find or create the project
    result = await db.execute(select(Project).where(Project.slug == data.project_slug))
    project = result.scalar_one_or_none()
    if not project:
        project = Project(
            name="Floresta Campestre",
            slug=data.project_slug,
            description="Desarrollo residencial campestre",
            price_per_sqm=1000.0,
            status=ProjectStatus.ACTIVE,
        )
        db.add(project)
        await db.flush()

    # 2. Find the lot by id or by lot_number
    lot = None
    if data.lot_id and data.lot_id > 0:
        result = await db.execute(select(Lot).where(Lot.id == data.lot_id))
        lot = result.scalar_one_or_none()

    if not lot and data.lot_number:
        result = await db.execute(
            select(Lot).where(
                Lot.project_id == project.id,
                Lot.lot_number == data.lot_number,
            )
        )
        lot = result.scalar_one_or_none()

    # 3. Auto-create lot if it doesn't exist
    if not lot and data.lot_number:
        area = data.area_sqm or DEFAULT_LOT_AREAS.get(data.lot_number, 200)
        lot = Lot(
            project_id=project.id,
            lot_number=data.lot_number,
            area_sqm=area,
            price_per_sqm=project.price_per_sqm,
            total_price=area * project.price_per_sqm,
            status=LotStatus.AVAILABLE,
        )
        db.add(lot)
        project.total_lots += 1
        project.available_lots += 1
        await db.flush()

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


class CleanupRequest(BaseModel):
    secret: str


class CleanupResponse(BaseModel):
    deleted_sales: int
    deleted_lots: int
    deleted_clients: int
    deleted_lot_numbers: list[int]


@router.post("/cleanup-bad-lots", response_model=CleanupResponse)
async def cleanup_bad_lots(
    data: CleanupRequest,
    db: AsyncSession = Depends(get_db),
):
    if data.secret != "rf-cleanup-2026":
        raise HTTPException(status_code=403, detail="Invalid secret")

    # Bad lot numbers to delete: 43200, 44200, 67200, 68200
    bad_numbers = [43200, 44200, 67200, 68200]

    # Get the project
    result = await db.execute(select(Project).where(Project.slug == "floresta-campestre"))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get the bad lots
    result = await db.execute(
        select(Lot).where(
            Lot.project_id == project.id,
            Lot.lot_number.in_(bad_numbers),
        )
    )
    bad_lots = result.scalars().all()
    bad_lot_ids = [l.id for l in bad_lots]
    deleted_lot_numbers = [l.lot_number for l in bad_lots]

    # Delete sales for these lots
    if bad_lot_ids:
        result = await db.execute(
            select(Sale).where(Sale.lot_id.in_(bad_lot_ids))
        )
        sales = result.scalars().all()
        sale_ids = [s.id for s in sales]
        client_ids = list(set(s.client_id for s in sales))

        for s in sales:
            await db.delete(s)
        await db.flush()

        # Delete the lots
        for l in bad_lots:
            await db.delete(l)
        await db.flush()

        # Delete orphan clients (those with no other sales)
        for cid in client_ids:
            result = await db.execute(
                select(Sale).where(Sale.client_id == cid)
            )
            remaining = result.scalars().all()
            if not remaining:
                result = await db.execute(select(Client).where(Client.id == cid))
                client = result.scalar_one_or_none()
                if client:
                    await db.delete(client)
        await db.flush()

    # Update project counters
    total_bad = len(bad_lots)
    if total_bad > 0:
        project.total_lots -= total_bad
        project.available_lots -= total_bad

    await db.commit()

    return CleanupResponse(
        deleted_sales=len(sales) if bad_lot_ids else 0,
        deleted_lots=total_bad,
        deleted_clients=len(client_ids) if bad_lot_ids else 0,
        deleted_lot_numbers=deleted_lot_numbers,
    )
