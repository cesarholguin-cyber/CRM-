import json
from uuid import uuid4
from datetime import date, timedelta

import pytest
from sqlalchemy import select, func
from test_web_requests import setup, authorize
from app.models.lot import Lot, LotStatus
from app.models.project import Project
from app.models.sale import Sale
from app.models.client import ClientInteraction
from app.services.maculi import seed_maculi, quote, TERMS


async def provision(sessions):
    async with sessions() as db:
        before = [(l.id, l.status, l.area_sqm, l.price_per_sqm) for l in (await db.scalars(select(Lot))).all()]
        result = await seed_maculi(db)
        await db.commit()
        for ident, status, area, price in before:
            lot = await db.get(Lot, ident)
            assert (lot.status, lot.area_sqm, lot.price_per_sqm) == (status, area, price)
        lot = await db.scalar(select(Lot).where(Lot.project_id == result['project_id'], Lot.lot_number == 2))
        lot.status = LotStatus.AVAILABLE
        await db.commit()
        return result['project_id'], lot.id


def payload(**changes):
    return dict(request_id=str(uuid4()), kind='reservation', project_slug='maculi-sur', lot_number=2,
                full_name='Prueba Maculí', phone='9830000000', payment_plan='financed', financing_months=36) | changes


@pytest.mark.asyncio
async def test_catalog_import_is_additive_and_idempotent(setup):
    http, sessions, _ = setup
    project_id, lot_id = await provision(sessions)
    async with sessions() as db:
        lot = await db.get(Lot, lot_id)
        lot.status = LotStatus.SOLD
        lot.price_per_sqm = 1300
        await db.commit()
        result = await seed_maculi(db)
        await db.commit()
        assert result['added'] == 0 and result['preserved'] == 50
        assert lot.status == LotStatus.SOLD and lot.price_per_sqm == 1300
    catalog = (await http.get('/api/v1/public/catalog/maculi-sur')).json()['lots']
    assert len(catalog) == 50 and len({l['lot_number'] for l in catalog}) == 50
    assert all(not l['block'] for l in catalog)
    assert next(l for l in catalog if l['lot_number'] == 1)['total_price'] == 1554000
    for number in [14, 15]:
        assert next(l for l in catalog if l['lot_number'] == number)['area_sqm'] == 139.62


@pytest.mark.asyncio
@pytest.mark.parametrize('months', TERMS['terms'])
async def test_reservation_saves_selected_financing_and_can_cancel(setup, months):
    http, sessions, app = setup
    project_id, lot_id = await provision(sessions)
    data = payload(financing_months=months)
    first = await http.post('/api/v1/public/requests', json=data)
    assert first.status_code == 200, first.text
    assert (await http.post('/api/v1/public/requests', json=data)).json() == first.json()
    async with sessions() as db:
        sale = await db.scalar(select(Sale).where(Sale.lot_id == lot_id))
        expected = quote(168000, 'financed', months)
        assert sale.down_payment == 33600 and sale.payment_terms_months == months
        assert sale.monthly_payment == expected['monthly_payment']
        assert (await db.get(Lot, lot_id)).status == LotStatus.RESERVED
        assert (await db.get(Project, project_id)).available_lots == 0
        sale_id = sale.id
    authorize(app)
    feed = (await http.get('/api/v1/web-requests')).json()
    assert feed[0]['project_name'] == 'Maculi sur' and feed[0]['quotation'] == expected
    # Use the same cancellation action used by Apartados.
    response = await http.put(f'/api/v1/sales/{sale_id}', json={'status': 'cancelled'})
    assert response.status_code == 200, response.text
    catalog = (await http.get('/api/v1/public/catalog/maculi-sur')).json()['lots']
    assert next(l for l in catalog if l['lot_number'] == 2)['status'] == 'available'


@pytest.mark.asyncio
async def test_visit_does_not_block_lot_and_conversion_keeps_six_years(setup):
    http, sessions, app = setup
    _, lot_id = await provision(sessions)
    response = await http.post('/api/v1/public/requests', json=payload(kind='visit', financing_months=72,
                              preferred_date=str(date.today()+timedelta(days=3))))
    assert response.status_code == 200, response.text
    async with sessions() as db:
        assert (await db.get(Lot, lot_id)).status == LotStatus.AVAILABLE
        assert await db.scalar(select(func.count()).select_from(Sale)) == 0
        row = await db.scalar(select(ClientInteraction))
        ident = row.id
    authorize(app)
    response = await http.post(f'/api/v1/web-requests/{ident}/actions', json={'action':'sale'})
    assert response.status_code == 200, response.text
    async with sessions() as db:
        sale = await db.get(Sale, response.json()['sale_id'])
        assert sale.payment_terms_months == 72 and sale.monthly_payment == 2984.18


@pytest.mark.asyncio
@pytest.mark.parametrize('changes', [{'financing_months':144}, {'financing_months':13}, {'financing_months':12.5},
                                   {'block':'M1'}, {'payment_plan':'cash'}, {'payment_plan':None}])
async def test_invalid_terms_are_rejected(setup, changes):
    http, _, _ = setup
    assert (await http.post('/api/v1/public/requests', json=payload(**changes))).status_code == 422


@pytest.mark.asyncio
async def test_cash_and_unavailable_lots(setup):
    http, sessions, _ = setup
    _, lot_id = await provision(sessions)
    response = await http.post('/api/v1/public/requests', json=payload(payment_plan='cash', financing_months=None))
    assert response.status_code == 200, response.text
    async with sessions() as db:
        sale = await db.scalar(select(Sale))
        assert sale.sale_price == 168000 and sale.down_payment == 168000
        assert sale.monthly_payment == 0 and sale.payment_terms_months == 0
    assert (await http.post('/api/v1/public/requests', json=payload())).status_code == 409
    assert (await http.post('/api/v1/public/requests', json=payload(lot_number=1))).status_code == 409
