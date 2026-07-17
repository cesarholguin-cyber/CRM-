from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta

from app.core.database import get_db
from app.models.lot import Lot, LotStatus
from app.models.sale import Sale, SaleStatus
from app.models.client import Client, ClientStatus
from app.models.project import Project
from app.models.user import User
from app.api.deps import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


class DashboardStats(BaseModel):
    total_projects: int
    total_lots: int
    available_lots: int
    reserved_lots: int
    sold_lots: int
    total_clients: int
    active_leads: int
    total_sales: int
    active_sales: int
    total_revenue: float
    sales_this_month: int
    revenue_this_month: float
    agents_count: int


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    # Projects
    result = await db.execute(select(func.count(Project.id)))
    total_projects = result.scalar() or 0

    # Lots
    result = await db.execute(select(func.count(Lot.id)))
    total_lots = result.scalar() or 0

    result = await db.execute(
        select(func.count(Lot.id)).where(Lot.status == LotStatus.AVAILABLE)
    )
    available_lots = result.scalar() or 0

    result = await db.execute(
        select(func.count(Lot.id)).where(Lot.status == LotStatus.RESERVED)
    )
    reserved_lots = result.scalar() or 0

    result = await db.execute(
        select(func.count(Lot.id)).where(Lot.status == LotStatus.SOLD)
    )
    sold_lots = result.scalar() or 0

    # Clients
    result = await db.execute(select(func.count(Client.id)))
    total_clients = result.scalar() or 0

    result = await db.execute(
        select(func.count(Client.id)).where(
            Client.status.in_([ClientStatus.LEAD, ClientStatus.CONTACTED, ClientStatus.INTERESTED])
        )
    )
    active_leads = result.scalar() or 0

    # Sales — only count PAID sales as real sales
    result = await db.execute(
        select(func.count(Sale.id)).where(Sale.status == SaleStatus.PAID)
    )
    total_sales = result.scalar() or 0

    result = await db.execute(
        select(func.count(Sale.id)).where(
            Sale.status.in_([SaleStatus.RESERVED, SaleStatus.OPTION_SIGNED, SaleStatus.FINANCING])
        )
    )
    active_sales = result.scalar() or 0

    # Revenue — only from PAID sales
    result = await db.execute(
        select(func.coalesce(func.sum(Sale.sale_price), 0)).where(Sale.status == SaleStatus.PAID)
    )
    total_revenue = float(result.scalar() or 0)

    # This month — only PAID
    start_of_month = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    result = await db.execute(
        select(func.count(Sale.id)).where(Sale.created_at >= start_of_month, Sale.status == SaleStatus.PAID)
    )
    sales_this_month = result.scalar() or 0

    result = await db.execute(
        select(func.coalesce(func.sum(Sale.sale_price), 0)).where(Sale.created_at >= start_of_month, Sale.status == SaleStatus.PAID)
    )
    revenue_this_month = float(result.scalar() or 0)

    # Agents
    from app.models.user import UserRole
    result = await db.execute(
        select(func.count(User.id)).where(User.role.in_([UserRole.AGENT, UserRole.COORDINATOR]), User.is_active == True)
    )
    agents_count = result.scalar() or 0

    return DashboardStats(
        total_projects=total_projects,
        total_lots=total_lots,
        available_lots=available_lots,
        reserved_lots=reserved_lots,
        sold_lots=sold_lots,
        total_clients=total_clients,
        active_leads=active_leads,
        total_sales=total_sales,
        active_sales=active_sales,
        total_revenue=total_revenue,
        sales_this_month=sales_this_month,
        revenue_this_month=revenue_this_month,
        agents_count=agents_count,
    )


class PipelineData(BaseModel):
    stage: str
    count: int
    value: float


@router.get("/pipeline", response_model=list[PipelineData])
async def get_pipeline_data(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    stages_data = []
    for status in SaleStatus:
        result = await db.execute(
            select(func.count(Sale.id), func.coalesce(func.sum(Sale.sale_price), 0))
            .where(Sale.status == status)
        )
        row = result.one()
        stages_data.append(PipelineData(
            stage=status.value,
            count=row[0] or 0,
            value=float(row[1] or 0),
        ))
    return stages_data
