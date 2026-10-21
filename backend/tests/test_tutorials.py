"""Role boundaries, private playback and atomic tutorial uploads (no real data)."""
import os
os.environ['DATABASE_MODE'] = 'external'
os.environ['DATABASE_URL'] = 'sqlite+aiosqlite:///:memory:'
os.environ['DATABASE_URL_SYNC'] = 'sqlite:///:memory:'
os.environ['SECRET_KEY'] = 'integration-tests-only-not-production'
from unittest.mock import AsyncMock
import pytest
from fastapi import FastAPI, HTTPException
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.core.database import Base, get_db
from app.models.user import User
from app.models.tutorial import Tutorial
from app.api import tutorials, auth, users, clients, projects, lots, sales, documents, web_requests, admin, dashboard
from app.api.deps import get_current_user
from app.services import tutorial_storage

MP4 = b'\x00\x00\x00\x20ftypisom' + b'\x00' * 100


@pytest.fixture
async def setup(monkeypatch):
    engine = create_async_engine('sqlite+aiosqlite:///:memory:')
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with sessions() as db:
        caller = User(email='systems@example.com', username='sistemas', full_name='Sistemas', role='SISTEMAS', hashed_password='unused', is_superuser=True)
        db.add(caller); await db.commit()
    app = FastAPI()
    for module in (tutorials, auth, users, clients, projects, lots, sales, documents, web_requests, admin, dashboard):
        app.include_router(module.router, prefix='/api/v1')
    async def database():
        async with sessions() as db:
            yield db
    app.dependency_overrides[get_db] = database
    app.dependency_overrides[get_current_user] = lambda: caller
    upload, remove, sign = AsyncMock(), AsyncMock(), AsyncMock(return_value='https://example.com/private-signed-video')
    monkeypatch.setattr(tutorial_storage, 'upload_video', upload)
    monkeypatch.setattr(tutorial_storage, 'remove_video', remove)
    monkeypatch.setattr(tutorial_storage, 'signed_video_url', sign)
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as http:
        yield http, sessions, caller, upload, remove, sign, app
    await engine.dispose()


async def publish(http, **kwargs):
    return await http.post('/api/v1/tutorials', data=kwargs.pop('data', {'title': '  Registrar un cliente  ', 'description': 'Paso a paso'}),
                           files={'file': kwargs.pop('file', ('clientes.mp4', MP4, 'video/mp4'))})


async def test_systems_publishes_and_admin_can_list_and_play(setup):
    http, sessions, caller, upload, remove, sign, _ = setup
    result = await publish(http)
    assert result.status_code == 201, result.text
    assert result.json()['title'] == 'Registrar un cliente'
    assert 'object_path' not in result.json()
    upload.assert_awaited_once()
    assert upload.call_args.args[0].startswith(f'{caller.id}/')
    remove.assert_not_called()
    caller.role = 'ADMIN'
    listed = await http.get('/api/v1/tutorials')
    assert len(listed.json()) == 1
    played = await http.get(f"/api/v1/tutorials/{result.json()['id']}/play")
    assert played.status_code == 200
    assert played.json()['expires_in'] == 3600 and played.headers['cache-control'] == 'no-store'
    sign.assert_awaited_once()
    async with sessions() as db:
        record = await db.scalar(select(Tutorial))
        assert record.uploaded_by == caller.id and record.size_bytes == len(MP4)


@pytest.mark.parametrize('role', ['ADMIN', 'PROMOTOR'])
async def test_only_systems_uploads_even_if_superuser(setup, role):
    http, _, caller, upload, *_ = setup
    caller.role = role
    assert (await publish(http)).status_code == 403
    upload.assert_not_called()


async def test_promoter_cannot_list_or_obtain_private_playback_url(setup):
    http, _, caller, _, _, sign, _ = setup
    created = (await publish(http)).json()
    caller.role = 'PROMOTOR'
    for path in ['/tutorials', f"/tutorials/{created['id']}/play"]:
        assert (await http.get('/api/v1'+path)).status_code == 403
    sign.assert_not_called()


@pytest.mark.parametrize('method,path', [('GET','/clients'),('POST','/clients'),('GET','/projects'),('GET','/projects/1'),('GET','/projects/1/lots'),('GET','/sales'),('GET','/sales/1/dossier'),('GET','/clients/1/dossier'),('GET','/web-requests'),('GET','/users'),('GET','/users/agents'),('GET','/dashboard/stats')])
async def test_systems_cannot_access_commercial_data_even_if_superuser(setup,method,path):
    http, *_ = setup
    result = await http.request(method, '/api/v1'+path, json={'full_name':'Do not create'} if method=='POST' else None, follow_redirects=True)
    assert result.status_code == 403, (path, result.text)


@pytest.mark.parametrize('file',[('empty.mp4',b'', 'video/mp4'),('fake.mp4',b'<html>hello</html>','video/mp4'),('renamed.html',MP4,'video/mp4')])
async def test_invalid_files_never_reach_storage(setup,file):
    http, _, _, upload, *_ = setup
    assert (await publish(http,file=file)).status_code == 422
    upload.assert_not_called()


async def test_size_limit_and_empty_title(setup,monkeypatch):
    http, _, _, upload, *_ = setup
    monkeypatch.setattr(tutorial_storage,'MAX_VIDEO_BYTES',20)
    assert (await publish(http)).status_code == 413
    assert (await publish(http,data={'title':'   '})).status_code == 422
    upload.assert_not_called()


async def test_failed_storage_leaves_no_metadata_and_attempts_cleanup(setup):
    http,sessions,_,upload,remove,_,_ = setup
    upload.side_effect = HTTPException(503,'Unavailable')
    assert (await publish(http)).status_code == 503
    async with sessions() as db:
        assert await db.scalar(select(func.count()).select_from(Tutorial)) == 0
    remove.assert_awaited_once()


async def test_failed_database_cleans_uploaded_object(setup,monkeypatch):
    http,sessions,_,upload,remove,_,_ = setup
    from sqlalchemy.ext.asyncio import AsyncSession
    original = AsyncSession.flush
    async def failed_flush(db, *args, **kwargs):
        if any(isinstance(obj, Tutorial) for obj in db.new):
            raise HTTPException(503,'Database unavailable')
        return await original(db,*args,**kwargs)
    monkeypatch.setattr(AsyncSession,'flush',failed_flush)
    assert (await publish(http)).status_code == 503
    upload.assert_awaited_once(); remove.assert_awaited_once()
    async with sessions() as db:
        assert await db.scalar(select(func.count()).select_from(Tutorial)) == 0


async def test_requires_login_and_handles_missing_video(setup):
    http,_,_,upload,_,sign,app=setup
    assert (await http.get('/api/v1/tutorials/999/play')).status_code == 404
    app.dependency_overrides.pop(get_current_user)
    for method,path in [('GET','/tutorials'),('GET','/tutorials/1/play')]:
        assert (await http.request(method,'/api/v1'+path)).status_code == 401
    assert (await publish(http)).status_code == 401
    sign.assert_not_called();upload.assert_not_called()
