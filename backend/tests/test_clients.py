"""Client form requests must persist successfully and reject invalid assignments."""
import os
os.environ['DATABASE_MODE'] = 'external'
os.environ['DATABASE_URL'] = 'sqlite+aiosqlite:///:memory:'
os.environ['DATABASE_URL_SYNC'] = 'sqlite:///:memory:'
os.environ['SECRET_KEY'] = 'integration-tests-only-not-production'
import pytest
from fastapi import FastAPI
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.core.database import Base, get_db
from app.api import clients
from app.api.deps import get_current_user
from app.models import User, Client, Project, Lot, Sale
from app.models.client import ClientInteraction
from app.core.audit import AuditLog


@pytest.fixture
async def setup(monkeypatch):
    engine = create_async_engine('sqlite+aiosqlite:///:memory:')
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with sessions() as db:
        caller = User(email='admin@example.com', username='admin', full_name='Admin',
                      hashed_password='not-used', role='ADMIN')
        agent = User(email='agent@example.com', username='agent', full_name='Agent',
                     hashed_password='not-used')
        inactive = User(email='inactive@example.com', username='inactive', full_name='Inactive',
                        hashed_password='not-used', is_active=False)
        db.add_all([caller, agent, inactive])
        await db.commit()
    audit = []
    monkeypatch.setattr(clients, 'write_audit_log', lambda *a, **kw:audit.append((a,kw)))
    app = FastAPI()
    app.include_router(clients.router, prefix='/api/v1')
    async def override():
        async with sessions() as db:
            yield db
    app.dependency_overrides[get_db] = override
    app.dependency_overrides[get_current_user] = lambda:caller
    async with AsyncClient(transport=ASGITransport(app=app),base_url='http://test') as http:
        yield http, sessions, caller, agent, inactive, audit
    await engine.dispose()


async def test_new_client_form_without_agent_is_created_and_assigned_to_caller(setup):
    http,sessions,caller,_,_,audit = setup
    payload = {'full_name':'Ana Pérez','email':'ana@example.com','phone':'6620000000','notes':'','status':'lead'}
    response = await http.post('/api/v1/clients', json=payload)
    assert response.status_code == 201, response.text
    saved = response.json()
    assert saved['full_name'] == payload['full_name']
    assert saved['assigned_agent_id'] == caller.id
    async with sessions() as db:
        assert await db.scalar(select(func.count()).select_from(Client)) == 1
        record = await db.get(Client,saved['id'])
        assert record.email == payload['email'] and record.phone == payload['phone']
    assert len(audit) == 1 and audit[0][0][2] == 'CLIENT_CREATED'
    # Editing the returned name must not duplicate an internal storage prefix.
    response = await http.put('/api/v1/clients/'+str(saved['id']),json={'full_name':saved['full_name']})
    assert response.status_code == 200 and response.json()['full_name'] == payload['full_name']


async def test_client_can_be_assigned_to_existing_active_agent(setup):
    http,_,_,agent,_,_ = setup
    response = await http.post('/api/v1/clients/',json={'full_name':'Otro cliente','assigned_agent_id':agent.id})
    assert response.status_code == 201
    assert response.json()['assigned_agent_id'] == agent.id


@pytest.mark.parametrize('values',[{'assigned_agent_id':9999},{'assigned_agent_id':0},{'project_id':9999}])
async def test_invalid_reference_does_not_become_a_500_or_create_a_client(setup, values):
    http,sessions,_,_,_,audit = setup
    response = await http.post('/api/v1/clients',json={'full_name':'No guardar',**values})
    assert response.status_code == 422, response.text
    async with sessions() as db:
        assert await db.scalar(select(func.count()).select_from(Client)) == 0
    assert not audit


async def test_inactive_agent_cannot_receive_new_client(setup):
    http,_,_,_,inactive,_ = setup
    response = await http.post('/api/v1/clients',json={'full_name':'No guardar','assigned_agent_id':inactive.id})
    assert response.status_code == 422


async def test_delete_requires_confirmation_then_removes_client_and_contact_history(setup):
    http,sessions,_,_,_,_ = setup
    created = (await http.post('/api/v1/clients',json={'full_name':'Cliente para eliminar'})).json()
    client_id = created['id']
    async with sessions() as db:
        db.add(ClientInteraction(client_id=client_id,interaction_type='note',notes='Contacto'))
        await db.commit()
    for suffix in ('', '?confirmed=false'):
        assert (await http.delete(f'/api/v1/clients/{client_id}'+suffix)).status_code == 422
    async with sessions() as db:
        assert await db.get(Client,client_id) is not None
        assert await db.scalar(select(func.count()).select_from(ClientInteraction)) == 1
    assert (await http.delete(f'/api/v1/clients/{client_id}?confirmed=true')).status_code == 200
    async with sessions() as db:
        assert await db.get(Client,client_id) is None
        assert await db.scalar(select(func.count()).select_from(ClientInteraction)) == 0
        entry = await db.scalar(select(AuditLog).where(AuditLog.action=='CLIENT_DELETED'))
        assert entry.entity_id == client_id and entry.details == {'confirmed':True}
    assert (await http.delete(f'/api/v1/clients/{client_id}?confirmed=true')).status_code == 404


async def test_promoter_cannot_delete_even_with_confirmation(setup):
    http,sessions,caller,_,_,_ = setup
    created = (await http.post('/api/v1/clients',json={'full_name':'Conservar'})).json()
    caller.role = 'PROMOTOR'
    assert (await http.delete(f"/api/v1/clients/{created['id']}?confirmed=true")).status_code == 403
    async with sessions() as db:
        assert await db.get(Client,created['id']) is not None


@pytest.mark.parametrize('link_kind',['sale','lot'])
async def test_customer_with_property_history_cannot_be_deleted(setup,link_kind):
    http,sessions,_,_,_,_ = setup
    created = (await http.post('/api/v1/clients',json={'full_name':'Propietario'})).json()
    async with sessions() as db:
        project = Project(name='Triunfo',slug='campestre-el-triunfo')
        db.add(project);await db.flush()
        lot = Lot(project_id=project.id,lot_number=1,block='M1',area_sqm=200,price_per_sqm=800,total_price=160000,status='SOLD',
                  sold_to_client_id=created['id'] if link_kind=='lot' else None)
        db.add(lot);await db.flush();lot_id=lot.id
        if link_kind=='sale':
            db.add(Sale(client_id=created['id'],lot_id=lot.id,sale_price=160000,status='PAID'))
        await db.commit()
    r = await http.delete(f"/api/v1/clients/{created['id']}?confirmed=true")
    assert r.status_code == 409
    async with sessions() as db:
        assert await db.get(Client,created['id']) is not None
        assert (await db.get(Lot,lot_id)).status.value == 'sold'
        assert await db.scalar(select(func.count()).select_from(AuditLog)) == 0
