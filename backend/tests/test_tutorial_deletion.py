"""Confirmed deletion, provider failures, and retired upload retries."""
from uuid import uuid4
from unittest.mock import AsyncMock
import pytest
from fastapi import HTTPException
from sqlalchemy import select, func
from test_tutorials import setup, publish
from app.core.audit import AuditLog
from app.models.tutorial import Tutorial, TutorialUpload
from app.services import backblaze_storage as b2


@pytest.mark.parametrize('query', ['', '?confirmed=false'])
async def test_confirmation_required_even_via_api(setup, query):
    http, sessions, _, _, remove, *_ = setup
    video = (await publish(http)).json()
    assert (await http.delete(f"/api/v1/tutorials/{video['id']}{query}")).status_code == 422
    remove.assert_not_called()
    async with sessions() as db:
        assert await db.get(Tutorial, video['id']) is not None


@pytest.mark.parametrize('role', ['ADMIN', 'SISTEMAS'])
async def test_confirmed_delete_removes_only_selected_video_and_records_audit(setup, role):
    http, sessions, caller, _, remove, sign, _ = setup
    first = (await publish(http)).json()
    second = (await publish(http)).json()
    async with sessions() as db:
        path = (await db.get(Tutorial, first['id'])).object_path
    caller.role = role
    url = f"/api/v1/tutorials/{first['id']}?confirmed=true"
    assert (await http.delete(url)).status_code == 204
    assert (await http.delete(url)).status_code == 204  # Lost response retry.
    remove.assert_awaited_once_with(path)
    assert [v['id'] for v in (await http.get('/api/v1/tutorials')).json()] == [second['id']]
    assert (await http.get(f"/api/v1/tutorials/{first['id']}/play")).status_code == 404
    sign.assert_not_called()
    async with sessions() as db:
        log = await db.scalar(select(AuditLog).where(AuditLog.action == 'TUTORIAL_DELETED'))
        assert log.user_id == caller.id and log.entity_id == first['id']
        assert log.details['confirmed'] is True
        assert await db.scalar(select(func.count()).select_from(AuditLog)) == 1


async def test_promoter_and_unauthenticated_cannot_delete(setup):
    from app.api.deps import get_current_user
    http, _, caller, _, remove, _, app = setup
    video = (await publish(http)).json()
    caller.role = 'PROMOTOR'
    url = f"/api/v1/tutorials/{video['id']}?confirmed=true"
    assert (await http.delete(url)).status_code == 403
    app.dependency_overrides.pop(get_current_user)
    assert (await http.delete(url)).status_code == 401
    remove.assert_not_called()


async def test_storage_failure_keeps_metadata_and_can_retry(setup):
    http, sessions, _, _, remove, *_ = setup
    video = (await publish(http)).json()
    remove.side_effect = HTTPException(503, 'Storage unavailable')
    url = f"/api/v1/tutorials/{video['id']}?confirmed=true"
    assert (await http.delete(url)).status_code == 503
    async with sessions() as db:
        assert await db.get(Tutorial, video['id']) is not None
        assert await db.scalar(select(func.count()).select_from(AuditLog)) == 0
    remove.side_effect = None
    assert (await http.delete(url)).status_code == 204


async def test_deleted_upload_session_cannot_resurrect_tutorial(setup, monkeypatch):
    http, sessions, caller, *_ = setup
    video = (await publish(http)).json()
    upload_id = str(uuid4())
    async with sessions() as db:
        item = await db.get(Tutorial, video['id'])
        db.add(TutorialUpload(id=upload_id, uploaded_by=caller.id, object_path=item.object_path,
            title=item.title, description=item.description, size_bytes=item.size_bytes, content_type=item.content_type,
            state='complete', tutorial_id=item.id, storage_upload_id='finished-provider-id'))
        await db.commit()
    complete = AsyncMock()
    monkeypatch.setattr(b2, 'complete_multipart', complete)
    assert (await http.delete(f"/api/v1/tutorials/{video['id']}?confirmed=true")).status_code == 204
    assert (await http.post(f'/api/v1/tutorials/uploads/{upload_id}/complete')).status_code == 410
    async with sessions() as db:
        record = await db.get(TutorialUpload, upload_id)
        assert record.state == 'aborted' and record.tutorial_id is None
        assert await db.scalar(select(func.count()).select_from(Tutorial)) == 0
    complete.assert_not_called()
