"""Direct upload ownership, validation, resumability and idempotent publication."""
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from unittest.mock import AsyncMock
import pytest
from sqlalchemy import select, func
from fastapi import HTTPException
from test_tutorials import setup  # isolated metadata/auth fixture, no production access
from app.models.tutorial import Tutorial, TutorialUpload
from app.services import backblaze_storage as b2


@pytest.fixture
def remote(monkeypatch):
    mocks = {name: AsyncMock() for name in ('begin_multipart', 'multipart_plan', 'complete_multipart', 'abort_multipart', 'remove')}
    mocks['begin_multipart'].return_value = 'private-upload-id'
    mocks['multipart_plan'].return_value = {'parts': [], 'uploaded': False}
    for name, mock in mocks.items():
        monkeypatch.setattr(b2, name, mock)
    return mocks


def payload(**overrides):
    return {'id': str(uuid4()), 'title': ' Tutorial ', 'description': ' Ejemplo ',
            'filename': 'video.mp4', 'size_bytes': 200 * 1024 * 1024, **overrides}


async def test_start_and_finish_retries_publish_exactly_once(setup, remote):
    http, sessions, caller, *_ = setup
    data = payload()
    for _ in range(2):
        started = await http.post('/api/v1/tutorials/uploads', json=data)
        assert started.status_code == 200, started.text
        assert started.headers['cache-control'] == 'no-store'
        assert 'private-upload-id' not in started.text
    remote['begin_multipart'].assert_awaited_once()
    first = await http.post(f"/api/v1/tutorials/uploads/{data['id']}/complete")
    second = await http.post(f"/api/v1/tutorials/uploads/{data['id']}/complete")
    assert first.status_code == second.status_code == 200
    assert first.json()['id'] == second.json()['id']
    assert first.json()['size_bytes'] == second.json()['size_bytes']
    remote['complete_multipart'].assert_awaited_once()
    again = await http.post('/api/v1/tutorials/uploads', json=data)
    assert again.json()['tutorial']['id'] == first.json()['id']
    await http.delete(f"/api/v1/tutorials/uploads/{data['id']}")
    remote['remove'].assert_not_called()  # Cancel never deletes a published tutorial.
    async with sessions() as db:
        assert await db.scalar(select(func.count()).select_from(Tutorial)) == 1


@pytest.mark.parametrize('role', ['ADMIN', 'PROMOTOR'])
async def test_upload_routes_require_systems(setup, remote, role):
    http, _, caller, *_ = setup
    data = payload()
    caller.role = role
    assert (await http.post('/api/v1/tutorials/uploads', json=data)).status_code == 403
    assert (await http.post(f"/api/v1/tutorials/uploads/{data['id']}/complete")).status_code == 403
    assert (await http.delete(f"/api/v1/tutorials/uploads/{data['id']}")).status_code == 403
    remote['begin_multipart'].assert_not_called()


async def test_other_systems_user_cannot_access_or_cancel_upload(setup, remote):
    http, _, caller, *_ = setup
    data = payload()
    assert (await http.post('/api/v1/tutorials/uploads', json=data)).status_code == 200
    caller.id = 999
    assert (await http.post('/api/v1/tutorials/uploads', json=data)).status_code == 404
    assert (await http.post(f"/api/v1/tutorials/uploads/{data['id']}/complete")).status_code == 404
    assert (await http.delete(f"/api/v1/tutorials/uploads/{data['id']}")).status_code == 404
    remote['remove'].assert_not_called()


@pytest.mark.parametrize('overrides', [{'size_bytes': 0}, {'size_bytes': 200*1024*1024+1}, {'title': ' '}, {'filename': 'fake.html'}])
async def test_invalid_metadata_never_starts_storage(setup, remote, overrides):
    http, *_ = setup
    assert (await http.post('/api/v1/tutorials/uploads', json=payload(**overrides))).status_code == 422
    remote['begin_multipart'].assert_not_called()


async def test_expired_session_and_cancel_are_safe(setup, remote):
    http, sessions, *_ = setup
    data = payload()
    await http.post('/api/v1/tutorials/uploads', json=data)
    async with sessions() as db:
        row = await db.get(TutorialUpload, data['id'])
        row.created_at = datetime.now(timezone.utc) - timedelta(days=2)
        await db.commit()
    assert (await http.post('/api/v1/tutorials/uploads', json=data)).status_code == 410
    assert (await http.post(f"/api/v1/tutorials/uploads/{data['id']}/complete")).status_code == 410
    assert (await http.delete(f"/api/v1/tutorials/uploads/{data['id']}")).status_code == 204
    remote['abort_multipart'].assert_awaited_once()
    remote['remove'].assert_awaited_once()
    remote['complete_multipart'].assert_not_called()


async def test_storage_or_metadata_failure_can_resume_without_removing_video(setup, remote, monkeypatch):
    http, sessions, *_ = setup
    data = payload()
    await http.post('/api/v1/tutorials/uploads', json=data)
    remote['complete_multipart'].side_effect = HTTPException(503, 'Unavailable')
    assert (await http.post(f"/api/v1/tutorials/uploads/{data['id']}/complete")).status_code == 503
    remote['complete_multipart'].side_effect = None
    from sqlalchemy.ext.asyncio import AsyncSession
    original = AsyncSession.flush
    async def fail(db, *args, **kwargs):
        if any(isinstance(o, Tutorial) for o in db.new):
            raise HTTPException(503, 'Metadata unavailable')
        return await original(db, *args, **kwargs)
    monkeypatch.setattr(AsyncSession, 'flush', fail)
    assert (await http.post(f"/api/v1/tutorials/uploads/{data['id']}/complete")).status_code == 503
    monkeypatch.setattr(AsyncSession, 'flush', original)
    assert (await http.post(f"/api/v1/tutorials/uploads/{data['id']}/complete")).status_code == 200
    remote['remove'].assert_not_called()
    async with sessions() as db:
        assert await db.scalar(select(func.count()).select_from(Tutorial)) == 1


async def test_changed_payload_cannot_reuse_upload(setup, remote):
    http, *_ = setup
    data = payload()
    await http.post('/api/v1/tutorials/uploads', json=data)
    data['size_bytes'] -= 1
    assert (await http.post('/api/v1/tutorials/uploads', json=data)).status_code == 409
