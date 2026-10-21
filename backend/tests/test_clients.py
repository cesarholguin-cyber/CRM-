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
from app.models import User, Client


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
