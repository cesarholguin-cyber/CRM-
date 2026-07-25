from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text as sa_text, func
from pydantic import BaseModel

from app.core.database import get_db
from app.models.lot import Lot, LotStatus
from app.models.sale import Sale, SaleStatus, PaymentPlan, Payment
from app.models.client import Client, ClientInteraction
from app.models.project import Project, ProjectStatus
from app.api.deps import get_current_admin

router = APIRouter(prefix="/admin", tags=["Admin"])

# Complete lot area data for Floresta Campestre (271 lots)
LOT_AREAS = {
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
    # 121-271: default 200 m2 each
}
for n in range(121, 272):
    LOT_AREAS[n] = 200

DEFAULT_PRICE_PER_SQM = 1000.0
TOTAL_LOTS = 271


class ResetResult(BaseModel):
    message: str
    lots_created: int
    total_lots: int
    available_lots: int
    reserved_lots: int
    sold_lots: int
    sales_deleted: int
    clients_deleted: int
    payments_deleted: int


@router.post("/reset-lots", response_model=ResetResult)
async def reset_lots(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_admin),
):
    # 1. Delete all operational data (order matters for FK constraints)
    result = await db.execute(select(func.count(Payment.id)))
    payments_deleted = result.scalar() or 0
    await db.execute(sa_text("DELETE FROM payments"))

    result = await db.execute(select(func.count(PaymentPlan.id)))
    plans_deleted = result.scalar() or 0
    await db.execute(sa_text("DELETE FROM payment_plans"))

    result = await db.execute(select(func.count(Sale.id)))
    sales_deleted = result.scalar() or 0
    await db.execute(sa_text("DELETE FROM sales"))

    await db.execute(sa_text("DELETE FROM client_interactions"))

    result = await db.execute(select(func.count(Client.id)))
    clients_deleted = result.scalar() or 0
    await db.execute(sa_text("DELETE FROM clients"))

    # Reset lots FK references first
    await db.execute(sa_text("UPDATE lots SET sold_to_client_id = NULL, status = 'available' WHERE status != 'available'"))

    await db.execute(sa_text("DELETE FROM lots"))

    # 2. Find or create the project
    result = await db.execute(select(Project).where(Project.slug == "floresta-campestre"))
    project = result.scalar_one_or_none()
    if not project:
        project = Project(
            name="Floresta Campestre",
            slug="floresta-campestre",
            description="Desarrollo residencial campestre",
            price_per_sqm=DEFAULT_PRICE_PER_SQM,
            status=ProjectStatus.ACTIVE,
        )
        db.add(project)
        await db.flush()

    # 3. Seed 271 lots
    lots_created = 0
    for lot_number in range(1, TOTAL_LOTS + 1):
        area = LOT_AREAS.get(lot_number, 200)
        lot = Lot(
            project_id=project.id,
            lot_number=lot_number,
            area_sqm=area,
            price_per_sqm=DEFAULT_PRICE_PER_SQM,
            total_price=area * DEFAULT_PRICE_PER_SQM,
            status=LotStatus.AVAILABLE,
        )
        db.add(lot)
        lots_created += 1

    # 4. Update project counters
    project.total_lots = TOTAL_LOTS
    project.available_lots = TOTAL_LOTS
    project.sold_lots = 0

    await db.commit()

    return ResetResult(
        message=f"Base de datos reiniciada. {TOTAL_LOTS} lotes creados como disponibles.",
        lots_created=lots_created,
        total_lots=TOTAL_LOTS,
        available_lots=TOTAL_LOTS,
        reserved_lots=0,
        sold_lots=0,
        sales_deleted=sales_deleted,
        clients_deleted=clients_deleted,
        payments_deleted=payments_deleted,
    )
