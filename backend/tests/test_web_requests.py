import os
os.environ['DATABASE_MODE']='external'
os.environ['DATABASE_URL']='sqlite+aiosqlite:///:memory:'
os.environ['DATABASE_URL_SYNC']='sqlite:///:memory:'
os.environ['SECRET_KEY']='integration-tests-only-not-production'
os.environ['ENCRYPTION_KEY']=''
import json
from datetime import date, timedelta
from types import SimpleNamespace
from uuid import uuid4
import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from app.core.database import Base, get_db
from app.models import *
from app.models.project import Project
from app.models.client import Client, ClientInteraction
from app.models.sale import Sale
from app.models.lot import Lot, LotStatus
from app.api import web_requests, sales
from app.api.deps import get_current_user

@pytest_asyncio.fixture
async def setup(tmp_path, monkeypatch):
    monkeypatch.setattr(sales, "write_audit_log", lambda *args,**kwargs:None)
    monkeypatch.setattr(web_requests, "write_audit_log", lambda *args,**kwargs:None)
    engine=create_async_engine('sqlite+aiosqlite:///'+str(tmp_path/'test.db'))
    async with engine.begin() as c: await c.run_sync(Base.metadata.create_all)
    sessions=async_sessionmaker(engine,expire_on_commit=False)
    async with sessions() as db:
        p=Project(name='Floresta Campestre',slug='floresta-campestre',price_per_sqm=800,total_lots=3,available_lots=2,sold_lots=1)
        db.add(p);await db.flush()
        for block,num,status in [('M1',1,'available'),('M2',1,'available'),('M1',2,'sold')]:
            db.add(Lot(project_id=p.id,block=block,lot_number=num,area_sqm=300,price_per_sqm=800,total_price=240000,status=LotStatus(status)))
        await db.commit()
    app=FastAPI()
    app.include_router(web_requests.public_router,prefix='/api/v1')
    app.include_router(web_requests.router,prefix='/api/v1')
    app.include_router(sales.router,prefix='/api/v1')
    app.state.limiter=web_requests.limiter;web_requests.limiter.enabled=False
    app.add_exception_handler(RateLimitExceeded,_rate_limit_exceeded_handler)
    async def db_override():
        async with sessions() as db:yield db
    app.dependency_overrides[get_db]=db_override
    async with AsyncClient(transport=ASGITransport(app=app),base_url='http://test') as http:yield http,sessions,app
    await engine.dispose()

def payload(**kw):
    return dict(request_id=str(uuid4()),kind='reservation',project_slug='floresta-campestre',block='M1',lot_number=1,full_name='Cliente de prueba',phone='6620000000',**kw)

async def send(http, data):return await http.post('/api/v1/public/requests',json=data)

def authorize(app):app.dependency_overrides[get_current_user]=lambda:SimpleNamespace(id=1,email='test@example.com')

@pytest.mark.asyncio
async def test_reservation_persists_customer_sale_and_lot(setup):
    http,sessions,app=setup;r=await send(http,payload());assert r.status_code==200,r.text
    assert r.json()['reference'].startswith('WEB-') and r.json()['expires_at']
    async with sessions() as db:
        sale=(await db.execute(select(Sale))).scalar_one();lot=await db.get(Lot,sale.lot_id)
        assert lot.status==LotStatus.RESERVED and sale.down_payment==15000
        assert sale.sale_price==240000 and sale.payment_terms_months==144
        assert round(sale.interest_rate,6)==round(.0141033227511898*1200,6)
    authorize(app);feed=(await http.get('/api/v1/web-requests')).json()
    assert feed[0]['block']=='M1' and feed[0]['phone']=='6620000000'

@pytest.mark.asyncio
async def test_retry_returns_same_reference_without_duplicate(setup):
    http,sessions,_=setup;data=payload();first=await send(http,data);second=await send(http,data)
    assert first.json()==second.json()
    async with sessions() as db:
        assert await db.scalar(select(func.count()).select_from(Sale))==1
        assert await db.scalar(select(func.count()).select_from(ClientInteraction))==1
    data['full_name']='Otro nombre';assert (await send(http,data)).status_code==409

@pytest.mark.asyncio
async def test_visit_does_not_reserve_inventory_and_can_be_managed(setup):
    http,sessions,app=setup;data=payload();data.update(kind='visit',preferred_date=str(date.today()+timedelta(days=3)),preferred_time='Por la tarde')
    assert (await send(http,data)).status_code==200
    async with sessions() as db:
        assert (await db.get(Lot,1)).status==LotStatus.AVAILABLE
        assert await db.scalar(select(func.count()).select_from(Sale))==0
    authorize(app);feed=(await http.get('/api/v1/web-requests')).json();assert feed[0]['preferred_time']=='Por la tarde'
    update=await http.patch(f"/api/v1/web-requests/{feed[0]['id']}",json={'status':'confirmed'});assert update.status_code==200

@pytest.mark.asyncio
async def test_block_identity_and_unavailable_lots(setup):
    http,sessions,_=setup;assert (await send(http,payload())).status_code==200
    assert (await send(http,payload())).status_code==409
    data=payload();data['block']='2';assert (await send(http,data)).status_code==200
    data=payload();data['lot_number']=2;assert (await send(http,data)).status_code==409
    data=payload();data['block']='M99';assert (await send(http,data)).status_code==409
    data=payload();data['project_slug']='campestre-el-triunfo';assert (await send(http,data)).status_code==503

@pytest.mark.asyncio
async def test_contact_dedupe_and_phone_only_clients(setup):
    http,sessions,_=setup
    for phone in ['6620000000','6620000001','6620000000']:
        data=payload();data.update(kind='information',phone=phone);assert (await send(http,data)).status_code==200
    async with sessions() as db:assert await db.scalar(select(func.count()).select_from(Client))==2

@pytest.mark.asyncio
async def test_email_dedupe(setup):
    http,sessions,_=setup
    for email in ['CLIENT@example.com','client@example.com']:
        data=payload();data.update(kind='information',email=email,phone=None);assert (await send(http,data)).status_code==200
    async with sessions() as db:assert await db.scalar(select(func.count()).select_from(Client))==1

@pytest.mark.asyncio
@pytest.mark.parametrize('changes',[{'phone':None},{'phone':'123'},{'email':'invalid'},{'full_name':' '},{'kind':'visit'},{'kind':'visit','preferred_date':'2020-01-01'},{'block':None},{'lot_number':None}])
async def test_invalid_data_rejected(setup,changes):
    http,_,_=setup;data=payload();data.update(changes);assert (await send(http,data)).status_code==422

@pytest.mark.asyncio
async def test_personal_data_not_public(setup):
    http,_,_=setup;await send(http,payload())
    assert (await http.get('/api/v1/web-requests')).status_code==401
    assert (await http.get('/api/v1/sales/')).status_code==401
    catalog=(await http.get('/api/v1/public/catalog/floresta-campestre')).json()
    assert len(catalog['lots'])==3
    assert all(not {'client_id','sold_to_client_id','phone','email'}&set(row) for row in catalog['lots'])

@pytest.mark.asyncio
async def test_cancel_and_rebook_preserves_history(setup):
    http,sessions,app=setup;first=await send(http,payload());assert first.status_code==200
    authorize(app)
    cancelled=await http.put('/api/v1/sales/1',json={'status':'cancelled'});assert cancelled.status_code==200,cancelled.text
    assert (await send(http,payload())).status_code==200
    async with sessions() as db:assert await db.scalar(select(func.count()).select_from(Sale))==2

@pytest.mark.asyncio
async def test_simultaneous_reservations_only_one_wins(setup):
    import asyncio
    http,sessions,_=setup
    responses=await asyncio.gather(send(http,payload()),send(http,payload()))
    assert sorted(r.status_code for r in responses)==[200,409]
    async with sessions() as db:assert await db.scalar(select(func.count()).select_from(Sale))==1

@pytest.mark.asyncio
async def test_simultaneous_retries_share_one_receipt(setup):
    import asyncio
    http,sessions,_=setup;data=payload()
    responses=await asyncio.gather(send(http,data),send(http,data))
    assert all(r.status_code==200 for r in responses)
    assert responses[0].json()==responses[1].json()

async def lot_state(http, block='M1', number=1):
    catalog=(await http.get('/api/v1/public/catalog/floresta-campestre')).json()
    return next(l['status'] for l in catalog['lots'] if l['block']==block and l['lot_number']==number)

async def visit_request(http, **changes):
    data=payload();data.update(kind='visit',preferred_date=str(date.today()+timedelta(days=3)));data.update(changes)
    response=await send(http,data);assert response.status_code==200,response.text
    return int(response.json()['reference'].split('-')[1])

@pytest.mark.asyncio
async def test_cancel_releases_public_catalog_and_retry_cannot_release_new_reservation(setup):
    http,_,app=setup;await send(http,payload());authorize(app)
    assert await lot_state(http)=='reserved'
    assert (await http.put('/api/v1/sales/1',json={'status':'cancelled'})).status_code==200
    assert await lot_state(http)=='available'
    data=payload();data['phone']='6620000001';assert (await send(http,data)).status_code==200
    assert (await http.put('/api/v1/sales/1',json={'status':'cancelled'})).status_code==200
    assert await lot_state(http)=='reserved'
    assert (await http.put('/api/v1/sales/1',json={'status':'paid'})).status_code==409

@pytest.mark.asyncio
async def test_sold_lot_cannot_be_released_as_reservation(setup):
    http,_,app=setup;await send(http,payload());authorize(app)
    assert (await http.put('/api/v1/sales/1',json={'status':'paid'})).status_code==200
    assert await lot_state(http)=='sold'
    assert (await http.put('/api/v1/sales/1',json={'status':'cancelled'})).status_code==409
    assert await lot_state(http)=='sold'

@pytest.mark.asyncio
@pytest.mark.parametrize('status',['available','reserved','sold','blocked'])
async def test_cancel_unlinked_visit_preserves_inventory(setup,status):
    http,sessions,app=setup;rid=await visit_request(http);authorize(app)
    async with sessions() as db:
        lot=await db.get(Lot,1);lot.status=LotStatus(status);await db.commit()
    response=await http.post(f'/api/v1/web-requests/{rid}/actions',json={'action':'cancel'})
    assert response.status_code==200,response.text
    assert await lot_state(http)==status

@pytest.mark.asyncio
async def test_visit_to_sale_idempotent_then_cancel_and_rebook(setup):
    http,sessions,app=setup;rid=await visit_request(http);authorize(app)
    first=await http.post(f'/api/v1/web-requests/{rid}/actions',json={'action':'sale'})
    assert first.status_code==200,first.text
    second=await http.post(f'/api/v1/web-requests/{rid}/actions',json={'action':'sale'})
    assert first.json()['sale_id']==second.json()['sale_id']
    assert await lot_state(http)=='reserved'
    response=await http.post(f'/api/v1/web-requests/{rid}/actions',json={'action':'cancel'})
    assert response.status_code==200,response.text
    assert await lot_state(http)=='available'
    assert (await send(http,payload())).status_code==200
    assert (await http.post(f'/api/v1/web-requests/{rid}/actions',json={'action':'cancel'})).status_code==200
    assert await lot_state(http)=='reserved'
    assert (await http.post(f'/api/v1/web-requests/{rid}/actions',json={'action':'sold'})).status_code==409

@pytest.mark.asyncio
async def test_visit_to_sold_is_atomic_and_retains_history(setup):
    http,sessions,app=setup;rid=await visit_request(http);authorize(app)
    response=await http.post(f'/api/v1/web-requests/{rid}/actions',json={'action':'sold'})
    assert response.status_code==200,response.text
    assert await lot_state(http)=='sold'
    assert (await http.post(f'/api/v1/web-requests/{rid}/actions',json={'action':'sold'})).status_code==200
    assert (await http.post(f'/api/v1/web-requests/{rid}/actions',json={'action':'cancel'})).status_code==409
    async with sessions() as db:
        assert await db.scalar(select(func.count()).select_from(Sale))==1
        project=await db.get(Project,1);assert project.available_lots==1 and project.sold_lots==2
    feed=(await http.get('/api/v1/web-requests')).json();assert feed[0]['status']=='sold'

@pytest.mark.asyncio
async def test_visit_cannot_sell_other_customers_reserved_lot(setup):
    http,_,app=setup;rid=await visit_request(http,phone='6620000001')
    await send(http,payload());authorize(app)
    assert (await http.post(f'/api/v1/web-requests/{rid}/actions',json={'action':'sold'})).status_code==409
    assert await lot_state(http)=='reserved'
    assert (await http.post(f'/api/v1/web-requests/{rid}/actions',json={'action':'cancel'})).status_code==200
    assert await lot_state(http)=='reserved'

@pytest.mark.asyncio
async def test_request_actions_require_auth_and_lot_for_sale(setup):
    http,_,app=setup;rid=await visit_request(http,block=None,lot_number=None)
    assert (await http.post(f'/api/v1/web-requests/{rid}/actions',json={'action':'cancel'})).status_code==401
    authorize(app)
    assert (await http.post(f'/api/v1/web-requests/{rid}/actions',json={'action':'sold'})).status_code==409
    assert (await http.post(f'/api/v1/web-requests/{rid}/actions',json={'action':'cancel'})).status_code==200

@pytest.mark.asyncio
async def test_simultaneous_visit_conversion_creates_one_sale(setup):
    import asyncio
    http,sessions,app=setup;rid=await visit_request(http);authorize(app)
    responses=await asyncio.gather(*[http.post(f'/api/v1/web-requests/{rid}/actions',json={'action':'sale'}) for _ in range(2)])
    assert all(r.status_code==200 for r in responses),[r.text for r in responses]
    assert responses[0].json()['sale_id']==responses[1].json()['sale_id']
    async with sessions() as db:assert await db.scalar(select(func.count()).select_from(Sale))==1
