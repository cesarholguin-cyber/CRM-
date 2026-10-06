"""Atomic inventory transitions shared by reservation and website-request actions."""
from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy import select, update, func
from app.models.sale import Sale, SaleStatus
from app.models.lot import Lot, LotStatus
from app.models.project import Project

INACTIVE = (SaleStatus.CANCELLED, SaleStatus.REVERSED)

async def lock_lot(db, lot_id):
    # SQLite ignores FOR UPDATE. A write acquires its transaction lock before
    # checking ownership; on PostgreSQL the row lock supplies the same ordering.
    if db.bind.dialect.name == 'sqlite':
        await db.execute(update(Lot).where(Lot.id == lot_id).values(id=Lot.id))
    lot = (await db.execute(select(Lot).where(Lot.id == lot_id)
                           .with_for_update().execution_options(populate_existing=True))).scalar_one_or_none()
    if not lot:
        raise HTTPException(404, 'Lote no encontrado.')
    return lot

async def recount_project(db, project_id):
    project = (await db.execute(select(Project).where(Project.id == project_id).with_for_update())).scalar_one()
    await db.flush()
    counts = dict((await db.execute(select(Lot.status, func.count()).where(
        Lot.project_id == project_id).group_by(Lot.status))).all())
    project.total_lots = sum(counts.values())
    project.available_lots = counts.get(LotStatus.AVAILABLE, 0)
    project.sold_lots = counts.get(LotStatus.SOLD, 0)

async def locked_sale(db, sale_id):
    lot_id = await db.scalar(select(Sale.lot_id).where(Sale.id == sale_id))
    if lot_id is None:
        raise HTTPException(404, 'Apartado no encontrado.')
    lot = await lock_lot(db, lot_id)
    sale = (await db.execute(select(Sale).where(Sale.id == sale_id).with_for_update()
                            .execution_options(populate_existing=True))).scalar_one()
    return sale, lot

async def change_sale_status(db, sale, lot, new_status):
    old_status = sale.status
    if new_status == old_status:
        return
    if old_status in INACTIVE:
        raise HTTPException(409, 'Este apartado ya está cerrado. Crea uno nuevo si el lote está disponible.')
    other = await db.scalar(select(Sale.id).where(Sale.lot_id == lot.id, Sale.id != sale.id,
                                                  Sale.status.notin_(INACTIVE)).limit(1))
    if other or lot.sold_to_client_id not in (None, sale.client_id):
        raise HTTPException(409, 'El lote tiene otra operación activa. Actualiza el inventario antes de continuar.')
    if new_status in INACTIVE:
        if old_status == SaleStatus.PAID or lot.status == LotStatus.SOLD:
            raise HTTPException(409, 'Este lote ya está vendido. No puede liberarse cancelando un apartado.')
        if lot.status not in (LotStatus.RESERVED, LotStatus.AVAILABLE):
            raise HTTPException(409, 'El lote está bloqueado. Revisa el inventario antes de cancelar.')
        lot.status = LotStatus.AVAILABLE
        lot.sold_to_client_id = None
        lot.sold_at = None
        sale.reservation_expires_at = None
        sale.closed_at = datetime.now(timezone.utc)
    elif new_status == SaleStatus.PAID:
        if lot.status == LotStatus.BLOCKED:
            raise HTTPException(409, 'El lote está bloqueado. Revisa el inventario antes de venderlo.')
        lot.status = LotStatus.SOLD
        lot.sold_to_client_id = sale.client_id
        lot.sold_at = datetime.now(timezone.utc)
        sale.closed_at = datetime.now(timezone.utc)
        sale.reservation_expires_at = None
    else:
        if old_status == SaleStatus.PAID or lot.status in (LotStatus.SOLD, LotStatus.BLOCKED):
            raise HTTPException(409, 'El lote ya no admite un cambio de apartado.')
        lot.status = LotStatus.RESERVED
        lot.sold_to_client_id = sale.client_id
    sale.status = new_status
    await recount_project(db, lot.project_id)
