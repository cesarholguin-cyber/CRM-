"""Reconcile the supplied plan. Default is read-only. Never overwrites legacy lots."""
import argparse
import asyncio
import json
import sys
from pathlib import Path

from sqlalchemy import select, func
from app.core.database import async_session_factory
from app.models.project import Project, ProjectStatus
from app.models.lot import Lot, LotStatus
from app.api.web_requests import normalize_block

async def seed(apply=False):
    source=json.loads((Path(__file__).resolve().parents[1]/'data/floresta-lots.json').read_text())
    async with async_session_factory() as db:
        project=(await db.execute(select(Project).where(Project.slug=='floresta-campestre'))).scalar_one_or_none()
        existing=(await db.execute(select(Lot).where(Lot.project_id==project.id))).scalars().all() if project else []
        grouped={}
        for lot in existing: grouped.setdefault((normalize_block(lot.block),lot.lot_number),[]).append(lot)
        if any(len(rows)>1 for key,rows in grouped.items() if key[0]):raise RuntimeError('Hay lotes duplicados por manzana. Revisa el inventario antes de importar.')
        conflicts=[]
        for row in source:
            for current in grouped.get((row['m'],row['n']),[]):
                if abs(current.area_sqm-row['a'])>.02:conflicts.append(f"{row['m']}-{row['n']}: superficie diferente")
        if conflicts:raise RuntimeError('No se aplicó nada: '+', '.join(conflicts))
        missing=[r for r in source if (r['m'],r['n']) not in grouped]
        print(json.dumps({'mode':'apply' if apply else 'dry-run','source_lots':len(source),'new_lots':len(missing),'preserved_existing':len(existing),'legacy_without_block':sum(not l.block for l in existing)}))
        if not apply:return
        if not project:
            project=Project(name='Floresta Campestre',slug='floresta-campestre',price_per_sqm=800,status=ProjectStatus.ACTIVE,total_lots=0,available_lots=0,sold_lots=0)
            db.add(project);await db.flush()
        for row in missing:
            db.add(Lot(project_id=project.id,block=row['m'],lot_number=row['n'],area_sqm=row['a'],price_per_sqm=800,total_price=row['t'],status=LotStatus.SOLD if row['s'] else LotStatus.AVAILABLE))
        await db.flush()
        counts=dict((await db.execute(select(Lot.status,func.count()).where(Lot.project_id==project.id).group_by(Lot.status))).all())
        project.total_lots=sum(counts.values());project.available_lots=counts.get(LotStatus.AVAILABLE,0);project.sold_lots=counts.get(LotStatus.SOLD,0)
        other = (await db.execute(select(Project).where(Project.slug=='campestre-el-triunfo'))).scalar_one_or_none()
        if not other:
            db.add(Project(name='Campestre El Triunfo', slug='campestre-el-triunfo', price_per_sqm=0,
                           status=ProjectStatus.ACTIVE, total_lots=0, available_lots=0, sold_lots=0))
        await db.commit()

