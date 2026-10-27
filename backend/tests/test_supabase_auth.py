"""Identity, permissions and session revocation at the Supabase boundary."""
import os
os.environ['DATABASE_MODE'] = 'external'
os.environ['DATABASE_URL'] = 'sqlite+aiosqlite:///:memory:'
os.environ['DATABASE_URL_SYNC'] = 'sqlite:///:memory:'
os.environ['SECRET_KEY'] = 'integration-tests-only-not-production'
from uuid import uuid4
from unittest.mock import AsyncMock
import json
import pytest
from fastapi import FastAPI, HTTPException
from httpx import AsyncClient, ASGITransport
import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.core.database import Base, get_db
from app.core.config import settings
from app.models.user import User, UserRole
from app.api import auth, users
from app.services import supabase_auth as provider


@pytest.fixture
async def setup(monkeypatch):
    engine = create_async_engine('sqlite+aiosqlite:///:memory:')
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    uid, sid = str(uuid4()), str(uuid4())
    token = jwt.encode({'sub':uid,'session_id':sid,'aal':'aal1'}, 'test-session-key-with-at-least-32-bytes')
    identity = {'id':uid,'email':'admin@example.com','user_metadata':{'role':'ADMIN'}}
    async with sessions() as db:
        db.add(User(email='admin@example.com',username='admin',full_name='Admin',
                    role=UserRole.ADMIN,hashed_password='!supabase-auth',supabase_auth_id=uid))
        await db.commit()
    monkeypatch.setattr(settings, 'DATABASE_MODE', 'supabase')
    monkeypatch.setattr(auth, 'write_audit_log', lambda *a, **kw:None)
    monkeypatch.setattr(users, 'write_audit_log', lambda *a, **kw:None)
    remote = AsyncMock(return_value=identity)
    monkeypatch.setattr(provider, 'auth_request', remote)
    active = AsyncMock(return_value=True)
    monkeypatch.setattr(provider, 'session_exists', active)
    app = FastAPI()
    app.include_router(auth.router,prefix='/api/v1')
    app.include_router(users.router,prefix='/api/v1')
    async def db_override():
        async with sessions() as db:
            yield db
    app.dependency_overrides[get_db] = db_override
    async with AsyncClient(transport=ASGITransport(app=app),base_url='http://test') as http:
        yield http,sessions,token,identity,remote,active
    await engine.dispose()


async def test_login_uses_supabase_password_and_returns_provider_tokens(setup, monkeypatch):
    http,_,token,identity,_,_ = setup
    sign_in=AsyncMock(return_value={'access_token':token,'refresh_token':'provider-refresh','user':identity})
    monkeypatch.setattr(provider,'sign_in',sign_in)
    monkeypatch.setattr(auth,'verify_password',lambda *a:pytest.fail('Local password was used'))
    response=await http.post('/api/v1/auth/login',json={'email':identity['email'],'password':'chosen-in-supabase'})
    assert response.status_code==200,response.text
    assert response.json()['access_token']==token
    assert response.json()['user']['role']=='ADMIN'
    sign_in.assert_awaited_once_with(identity['email'],'chosen-in-supabase',None)


async def test_supabase_failure_never_falls_back_to_local_password(setup,monkeypatch):
    http,_,_,identity,_,_=setup
    monkeypatch.setattr(provider,'sign_in',AsyncMock(side_effect=HTTPException(401,'Rejected')))
    monkeypatch.setattr(auth,'verify_password',lambda *a:pytest.fail('Local fallback'))
    assert (await http.post('/api/v1/auth/login',json={'email':identity['email'],'password':'old-demo'})).status_code==401


async def test_admin_requires_linked_uuid_and_not_user_metadata(setup):
    http,sessions,token,identity,remote,_=setup
    headers={'Authorization':'Bearer '+token}
    assert (await http.get('/api/v1/users',headers=headers)).status_code==200
    async with sessions() as db:
        user=await db.scalar(select(User));user.role=UserRole.PROMOTOR;await db.commit()
    assert (await http.get('/api/v1/users',headers=headers)).status_code==403
    # Same email, different Auth UUID must not inherit the old profile or role.
    stranger=str(uuid4())
    remote.return_value=dict(identity,id=stranger)
    other=jwt.encode({'sub':stranger,'session_id':str(uuid4())},'test-session-key-with-at-least-32-bytes')
    assert (await http.get('/api/v1/auth/me',headers={'Authorization':'Bearer '+other})).status_code==403


async def test_disabled_or_revoked_sessions_cannot_enter(setup):
    http,sessions,token,_,_,active=setup
    headers={'Authorization':'Bearer '+token}
    active.return_value=False
    assert (await http.get('/api/v1/auth/me',headers=headers)).status_code==401
    active.return_value=True
    async with sessions() as db:
        user=await db.scalar(select(User));user.is_active=False;await db.commit()
    assert (await http.get('/api/v1/auth/me',headers=headers)).status_code==403


async def test_malformed_jwt_and_unverified_mfa_do_not_authenticate(setup):
    http,_,token,identity,remote,_=setup
    assert (await http.get('/api/v1/auth/me',headers={'Authorization':'Bearer malformed'})).status_code==401
    remote.return_value=dict(identity,factors=[{'status':'verified','factor_type':'totp'}])
    assert (await http.get('/api/v1/auth/me',headers={'Authorization':'Bearer '+token})).status_code==428


async def test_self_edit_cannot_grant_admin_or_change_active_flag(setup):
    http,sessions,token,_,_,_=setup
    async with sessions() as db:
        user=await db.scalar(select(User));user.role=UserRole.PROMOTOR;await db.commit()
    r=await http.put('/api/v1/auth/me',headers={'Authorization':'Bearer '+token},
                     json={'role':'ADMIN','is_active':False,'full_name':'Nuevo nombre'})
    assert r.status_code==200
    assert r.json()['role']=='PROMOTOR' and r.json()['is_active'] is True
    assert r.json()['full_name']=='Nuevo nombre'


async def test_refresh_validates_provider_session_and_rotates_tokens(setup):
    http,_,token,identity,remote,_=setup
    remote.side_effect=[{'access_token':token,'refresh_token':'rotated'},identity]
    r=await http.post('/api/v1/auth/refresh',json={'refresh_token':'previous'})
    assert r.status_code==200 and r.json()['refresh_token']=='rotated'
    assert remote.call_args_list[0].args==('POST','/token?grant_type=refresh_token')


async def test_password_change_goes_to_supabase(setup,monkeypatch):
    http,_,token,identity,remote,_=setup
    remote.side_effect=[identity,{'user':identity,'access_token':'reauth-session'},{},{}]
    r=await http.post('/api/v1/auth/change-password',headers={'Authorization':'Bearer '+token},
                     json={'current_password':'old','new_password':'New-password-123'})
    assert r.status_code==200
    assert remote.call_args.args==('PUT','/user')
    assert remote.call_args.kwargs['token']==token


async def test_logout_revokes_supabase_session(setup):
    http,_,token,_,remote,_=setup
    r=await http.post('/api/v1/auth/logout',headers={'Authorization':'Bearer '+token})
    assert r.status_code==200
    remote.assert_awaited_once_with('POST','/logout?scope=local',token=token)


def test_inventory_initialization_preserves_sold_and_rejects_discrepancy():
    import sys
    from pathlib import Path
    sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
    from initialize_supabase import prepare_inventory
    projects=[{'id':1,'slug':'floresta-campestre'},{'id':2,'slug':'campestre-el-triunfo'}]
    lots=[{'id':10,'project_id':1,'block':'M1','lot_number':1,'status':'SOLD','sold_to_client_id':5},
          {'id':11,'project_id':1,'block':'M1','lot_number':2,'status':'RESERVED','sold_to_client_id':6}]
    catalog={'lots':[{'block':'M1','lot_number':n,'status':s,'area_sqm':200,'price_per_sqm':800,'total_price':160000}
                     for n,s in [(1,'sold'),(2,'available')]]}
    p,rows=prepare_inventory(projects,lots,catalog)
    assert p['slug']=='campestre-el-triunfo' and p['sold_lots']==1
    assert [r['status'] for r in rows]==['SOLD','AVAILABLE']
    assert all(r['sold_to_client_id'] is None and r['project_id']==2 for r in rows)
    assert lots[0]['sold_to_client_id']==5 # backup input untouched
    catalog['lots'][0]['status']='available'
    with pytest.raises(RuntimeError,match='vendidos difieren'):
        prepare_inventory(projects,lots,catalog)


async def test_username_is_editable_normalized_and_does_not_change_login_email(setup):
    http,_,token,identity,_,_=setup
    r=await http.put('/api/v1/auth/me',headers={'Authorization':'Bearer '+token},json={'username':'  Admin.RF  '})
    assert r.status_code==200, r.text
    assert r.json()['username']=='admin.rf' and r.json()['email']==identity['email']
    assert r.json()['role']=='ADMIN'


@pytest.mark.parametrize('value',['duplicated@example.com','ab','two words',None,'<script>',123])
async def test_username_rejects_email_and_invalid_values(setup,value):
    http,_,token,_,_,_=setup
    r=await http.put('/api/v1/auth/me',headers={'Authorization':'Bearer '+token},json={'username':value})
    assert r.status_code==422


async def test_username_uniqueness_is_case_insensitive(setup):
    http,sessions,token,_,_,_=setup
    async with sessions() as db:
        db.add(User(email='other@example.com',username='Existing',full_name='Other',hashed_password='unused'))
        await db.commit()
    r=await http.put('/api/v1/auth/me',headers={'Authorization':'Bearer '+token},json={'username':'EXISTING'})
    assert r.status_code==409
    me=await http.get('/api/v1/auth/me',headers={'Authorization':'Bearer '+token})
    assert me.json()['username']=='admin'


async def test_admin_creates_promoter_with_separate_username_and_private_role(setup):
    http,sessions,token,identity,remote,_=setup
    new_id=str(uuid4())
    remote.side_effect=[identity, {'id':new_id}]
    r=await http.post('/api/v1/users',headers={'Authorization':'Bearer '+token},json={
        'email':'agent@example.com','username':'Asesor.RF','password':'Local-test-only-123',
        'full_name':'Asesor','role':'PROMOTOR'})
    assert r.status_code==201, r.text
    assert r.json()['role']=='PROMOTOR' and r.json()['username']=='asesor.rf'
    assert r.json()['email']=='agent@example.com'
    async with sessions() as db:
        saved=await db.scalar(select(User).where(User.supabase_auth_id==new_id))
        assert saved.role==UserRole.PROMOTOR and saved.is_superuser is False
    # User-editable metadata carries display name, never role authority.
    assert 'role' not in remote.call_args.kwargs['data'].get('user_metadata',{})


@pytest.mark.parametrize('endpoint', ['/api/v1/users', '/api/v1/auth/register'])
async def test_retired_systems_role_cannot_be_created(setup, endpoint):
    http, sessions, token, identity, remote, _ = setup
    remote.return_value = identity
    r = await http.post(endpoint, headers={'Authorization': 'Bearer ' + token}, json={
        'email': 'retired@example.com', 'username': 'retired',
        'password': 'Local-test-only-123', 'full_name': 'Retired role', 'role': 'SISTEMAS'})
    assert r.status_code == 422
    assert not any('/admin/users' in str(call) for call in remote.call_args_list)
    async with sessions() as db:
        assert await db.scalar(select(User.id).where(User.username == 'retired')) is None


async def test_retired_systems_role_cannot_be_assigned(setup):
    http, _, token, _, _, _ = setup
    r = await http.put('/api/v1/users/1', headers={'Authorization': 'Bearer ' + token},
                       json={'role': 'SISTEMAS'})
    assert r.status_code == 422
