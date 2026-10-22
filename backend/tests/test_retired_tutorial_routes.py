"""Retired media endpoints must not remain callable by saved links or clients."""
import os
os.environ['DATABASE_MODE'] = 'external'
os.environ['DATABASE_URL'] = 'sqlite+aiosqlite:///:memory:'
os.environ['DATABASE_URL_SYNC'] = 'sqlite:///:memory:'
os.environ['SECRET_KEY'] = 'integration-tests-only-not-production'
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.models.user import UserRole


@pytest.mark.asyncio
async def test_tutorial_routes_are_not_registered():
    assert all('/tutorials' not in route.path for route in app.routes)
    assert {role.value for role in UserRole} == {'ADMIN', 'PROMOTOR'}
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        for path in ['/api/v1/tutorials', '/api/v1/tutorials/1/play', '/api/v1/tutorials/uploads/test']:
            assert (await client.get(path)).status_code == 404
        for method, path in [('POST','/api/v1/tutorials/uploads'), ('DELETE','/api/v1/tutorials/1')]:
            assert (await client.request(method, path)).status_code in (404, 405)
