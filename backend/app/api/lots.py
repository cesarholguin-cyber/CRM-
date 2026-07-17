from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.core.database import get_db
from app.core.audit import write_audit_log
from app.models.project import Project
from app.models.lot import Lot, LotStatus
from app.schemas.lot import LotCreate, LotUpdate, LotResponse, LotBulkCreate
from app.api.deps import get_current_user, get_current_superuser, get_request_info

router = APIRouter(prefix="/projects/{project_id}/lots", tags=["Lots"])


async def _get_project(project_id: int, db: AsyncSession) -> Project:
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


async def _get_lot(lot_id: int, project_id: int, db: AsyncSession) -> Lot:
    result = await db.execute(
        select(Lot).where(Lot.id == lot_id, Lot.project_id == project_id)
    )
    lot = result.scalar_one_or_none()
    if not lot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lot not found")
    return lot


@router.get("/", response_model=list[LotResponse])
async def list_lots(
    project_id: int,
    status: str | None = Query(None),
    block: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, db)
    query = select(Lot).where(Lot.project_id == project_id).order_by(Lot.block, Lot.lot_number)

    if status:
        try:
            ls = LotStatus(status)
            query = query.where(Lot.status == ls)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status")

    if block:
        query = query.where(Lot.block == block)

    result = await db.execute(query)
    return [LotResponse.model_validate(l) for l in result.scalars().all()]


@router.get("/{lot_id}", response_model=LotResponse)
async def get_lot(
    project_id: int,
    lot_id: int,
    db: AsyncSession = Depends(get_db),
):
    lot = await _get_lot(lot_id, project_id, db)
    return LotResponse.model_validate(lot)


@router.post("/", response_model=LotResponse, status_code=status.HTTP_201_CREATED)
async def create_lot(
    project_id: int,
    lot_data: LotCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_superuser),
):
    project = await _get_project(project_id, db)

    # Check duplicate lot number
    result = await db.execute(
        select(Lot).where(Lot.project_id == project_id, Lot.lot_number == lot_data.lot_number)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Lot number already exists in this project")

    lot = Lot(
        project_id=project_id,
        lot_number=lot_data.lot_number,
        block=lot_data.block,
        area_sqm=lot_data.area_sqm,
        price_per_sqm=lot_data.price_per_sqm,
        total_price=lot_data.area_sqm * lot_data.price_per_sqm,
        map_coordinates=lot_data.map_coordinates,
    )
    db.add(lot)

    # Update project counters
    project.total_lots += 1
    project.available_lots += 1

    await db.commit()
    await db.refresh(lot)

    write_audit_log(
        current_user.id, current_user.email, "LOT_CREATED", "lot", lot.id,
        new_values=lot_data.model_dump(), **get_request_info(request),
    )
    return LotResponse.model_validate(lot)


@router.post("/bulk", response_model=list[LotResponse], status_code=status.HTTP_201_CREATED)
async def bulk_create_lots(
    project_id: int,
    bulk_data: LotBulkCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_superuser),
):
    project = await _get_project(project_id, db)
    created = []

    for lot_data in bulk_data.lots:
        lot = Lot(
            project_id=project_id,
            lot_number=lot_data.lot_number,
            block=lot_data.block,
            area_sqm=lot_data.area_sqm,
            price_per_sqm=lot_data.price_per_sqm,
            total_price=lot_data.area_sqm * lot_data.price_per_sqm,
            map_coordinates=lot_data.map_coordinates,
        )
        db.add(lot)
        created.append(lot)

    project.total_lots += len(created)
    project.available_lots += len(created)
    await db.commit()

    for lot in created:
        await db.refresh(lot)

    write_audit_log(
        current_user.id, current_user.email, "LOTS_BULK_CREATED", "lot", None,
        details={"count": len(created)}, **get_request_info(request),
    )
    return [LotResponse.model_validate(l) for l in created]


@router.put("/{lot_id}", response_model=LotResponse)
async def update_lot(
    project_id: int,
    lot_id: int,
    lot_data: LotUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_superuser),
):
    lot = await _get_lot(lot_id, project_id, db)
    old_values = {}

    for field, value in lot_data.model_dump(exclude_unset=True).items():
        old_values[field] = getattr(lot, field)
        setattr(lot, field, value)

    # Recalculate total price if area or price changed
    if "area_sqm" in lot_data.model_dump(exclude_unset=True) or "price_per_sqm" in lot_data.model_dump(exclude_unset=True):
        lot.total_price = lot.area_sqm * lot.price_per_sqm

    await db.commit()
    await db.refresh(lot)

    write_audit_log(
        current_user.id, current_user.email, "LOT_UPDATED", "lot", lot_id,
        old_values=old_values, new_values=lot_data.model_dump(exclude_unset=True),
        **get_request_info(request),
    )
    return LotResponse.model_validate(lot)


@router.delete("/{lot_id}")
async def delete_lot(
    project_id: int,
    lot_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_superuser),
):
    lot = await _get_lot(lot_id, project_id, db)
    if lot.status != LotStatus.AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete lot with status '{lot.status.value}'",
        )

    project = await _get_project(project_id, db)
    project.total_lots -= 1
    project.available_lots -= 1

    await db.delete(lot)
    await db.commit()

    write_audit_log(
        current_user.id, current_user.email, "LOT_DELETED", "lot", lot_id,
        **get_request_info(request),
    )
    return {"message": "Lot deleted successfully"}
