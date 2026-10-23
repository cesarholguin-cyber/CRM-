"""Maculí's supplied commercial terms and additive inventory import."""
import json
from pathlib import Path

from sqlalchemy import select
from app.models.project import Project, ProjectStatus
from app.models.lot import Lot, LotStatus
from app.services.reservation_actions import recount_project

CATALOG = json.loads((Path(__file__).resolve().parents[1] / 'data/maculi-lots.json').read_text())
SLUG = CATALOG['slug']
TERMS = CATALOG['financing']


def quote(price, payment_plan, months):
    if payment_plan not in ('financed', 'cash', 'undecided'):
        raise ValueError('Forma de pago no válida.')
    if payment_plan == 'financed' and months not in TERMS['terms']:
        raise ValueError('Elige un plazo de 1 a 6 años.')
    if payment_plan != 'financed' and months is not None:
        raise ValueError('El plazo sólo corresponde a un pago financiado.')
    down = round(price * TERMS['downPaymentRate'], 2) if payment_plan == 'financed' else (price if payment_plan == 'cash' else 0)
    balance = round(price-down, 2)
    rate = TERMS['monthlyRate'] if payment_plan == 'financed' else 0
    payment = round(balance*rate/(1-(1+rate)**-months), 2) if rate else 0
    return dict(payment_plan=payment_plan, sale_price=price, down_payment=down,
                financing_amount=balance, interest_rate=rate*1200,
                payment_terms_months=months or 0, monthly_payment=payment)


async def seed_maculi(db):
    """Insert only missing lots. Existing prices, customers and states always win."""
    project = await db.scalar(select(Project).where(Project.slug == SLUG).with_for_update())
    if project is None:
        project = Project(name=CATALOG['name'], slug=SLUG, price_per_sqm=CATALOG['price_per_sqm'],
                          city='Felipe Carrillo Puerto', state='Quintana Roo', status=ProjectStatus.ACTIVE,
                          description='49 lotes habitacionales y una plaza comercial. Financiamiento de 1 a 6 años; 20% de enganche.')
        db.add(project)
        await db.flush()
    existing = (await db.scalars(select(Lot).where(Lot.project_id == project.id))).all()
    if len({l.lot_number for l in existing}) != len(existing) or any(l.block for l in existing):
        raise RuntimeError('Maculí tiene identificadores en conflicto; no se modificó su inventario.')
    numbers = {l.lot_number for l in existing}
    added = 0
    for row in CATALOG['lots']:
        if row['number'] in numbers:
            continue
        db.add(Lot(project_id=project.id, block=None, lot_number=row['number'], area_sqm=row['area'],
                   price_per_sqm=CATALOG['price_per_sqm'], total_price=round(row['area']*CATALOG['price_per_sqm'], 2),
                   status=LotStatus(row['status']), map_coordinates=json.dumps(row['polygon'], separators=(',', ':'))))
        added += 1
    await recount_project(db, project.id)
    return {'project_id': project.id, 'added': added, 'preserved': len(existing)}
