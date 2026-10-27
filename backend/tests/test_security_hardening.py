"""Regression checks against isolated applications and disposable databases only."""
import os

os.environ['DATABASE_MODE'] = 'external'
os.environ['DATABASE_URL'] = 'sqlite+aiosqlite:///:memory:'
os.environ['DATABASE_URL_SYNC'] = 'sqlite:///:memory:'
os.environ['SECRET_KEY'] = 'integration-tests-only-not-production'

import base64
import hashlib
import hmac
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import jwt
import pytest
from fastapi import FastAPI, Request
from httpx import ASGITransport, AsyncClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limit import limiter, APIRateLimitMiddleware
from app.core.request_limits import RequestBodyLimitMiddleware
from app.core.security import create_access_token, create_refresh_token, decode_token


def test_existing_hs256_session_format_still_works(monkeypatch):
    key = 'test-session-key-with-at-least-32-bytes'
    monkeypatch.setattr(settings, 'SECRET_KEY', key)
    monkeypatch.setattr(settings, 'ALGORITHM', 'HS256')
    # Library-independent representation of the JWTs issued before the migration.
    def encode(value):
        return base64.urlsafe_b64encode(json.dumps(value).encode()).rstrip(b'=')
    payload = {'sub': '42', 'type': 'access', 'exp': 4102444800}
    message = encode({'alg': 'HS256', 'typ': 'JWT'}) + b'.' + encode(payload)
    token = message + b'.' + base64.urlsafe_b64encode(hmac.digest(key.encode(), message, hashlib.sha256)).rstrip(b'=')
    assert decode_token(token.decode()) == payload
    assert decode_token(create_access_token('42'))['type'] == 'access'
    assert decode_token(create_refresh_token('42'))['type'] == 'refresh'


def test_expired_unsigned_wrong_algorithm_and_forged_tokens_are_rejected(monkeypatch):
    key = 'test-session-key-with-at-least-32-bytes'
    monkeypatch.setattr(settings, 'SECRET_KEY', key)
    monkeypatch.setattr(settings, 'ALGORITHM', 'HS256')
    payload = {'sub': '42', 'type': 'access', 'exp': 4102444800}
    tokens = [
        jwt.encode(payload, 'wrong-secret-that-is-also-long-enough'),
        jwt.encode(payload, key * 2, algorithm='HS512'),
        jwt.encode(payload, key=None, algorithm='none'),
        jwt.encode(payload | {'exp': 1}, key),
        jwt.encode({'sub': '42', 'type': 'access'}, key),
        'not.a.token',
    ]
    assert all(decode_token(token) == {} for token in tokens)


@pytest.fixture
def active_limiter(monkeypatch):
    monkeypatch.setattr(limiter, 'enabled', True)
    limiter.reset()
    yield
    limiter.reset()


async def test_both_landing_routes_share_one_budget_without_modifying_inventory(active_limiter, monkeypatch):
    from app.api import public_routes, web_requests
    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(APIRateLimitMiddleware)
    app.include_router(public_routes.router, prefix='/api/v1')
    app.include_router(web_requests.public_router, prefix='/api/v1')
    # Resolve no real project and never invoke a real database.
    fake_db = SimpleNamespace(execute=AsyncMock(return_value=SimpleNamespace(scalar_one_or_none=lambda: None)))
    app.dependency_overrides[get_db] = lambda: fake_db
    for module in (public_routes, web_requests):
        monkeypatch.setattr(module, 'resolve_public_project', AsyncMock(return_value=None))
    monkeypatch.setattr(web_requests, 'lock_key', AsyncMock())
    old = {'lot_id': 1, 'full_name': 'Test', 'phone': '6620000000'}
    new = {'request_id': str(uuid4()), 'kind': 'information', 'project_slug': 'campestre-el-triunfo',
           'full_name': 'Test', 'phone': '6620000000'}
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        for i in range(10):
            path, payload = ('reserve', old) if i % 2 else ('requests', new)
            assert (await client.post('/api/v1/public/' + path, json=payload)).status_code == 503
        response = await client.post('/api/v1/public/reserve', json=old)
        assert response.status_code == 429
        # An untrusted header must not reset the client's quota.
        assert (await client.post('/api/v1/public/requests', json=new,
                                 headers={'X-Forwarded-For': '198.51.100.123'})).status_code == 429


async def test_default_limit_is_wired_in_real_app_and_health_is_exempt(active_limiter):
    from app.main import app
    # Included routers and the SPA fallback must not bypass the limiter.
    # ASGITransport intentionally does not start lifespan/catalog seeding.
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        for _ in range(settings.RATE_LIMIT_PER_MINUTE):
            assert (await client.get('/api/v1/clients')).status_code == 401
        limited = await client.get('/api/v1/clients/999')
        assert limited.status_code == 429
        assert 'script-src' in limited.headers['content-security-policy']
        assert (await client.get('/health')).status_code == 200
        assert (await client.get('/api/v1/users')).status_code == 401


async def test_body_limits_reject_declared_and_chunked_uploads_before_endpoint():
    called = []
    app = FastAPI()
    app.add_middleware(RequestBodyLimitMiddleware, json_limit=32, upload_limit=128)
    @app.post('/api/v1/{path:path}')
    async def consume(path: str, request: Request):
        called.append(path)
        return {'bytes': len(await request.body())}

    async def chunks(*parts):
        for part in parts:
            yield part

    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        assert (await client.post('/api/v1/clients', content=b'x' * 33)).status_code == 413
        assert (await client.post('/api/v1/clients', content=chunks(b'x' * 20, b'x' * 20))).status_code == 413
        assert (await client.post('/api/v1/sales/1/documents', content=chunks(b'x' * 64, b'x' * 65))).status_code == 413
        assert called == []
        assert (await client.post('/api/v1/clients', content=b'x' * 32)).json()['bytes'] == 32
        assert (await client.post('/api/v1/sales/1/documents', content=chunks(b'x' * 64, b'x' * 64))).json()['bytes'] == 128
        assert (await client.post('/api/v1/clients', content=b'', headers={'Content-Length': '-1'})).status_code == 400


async def test_cors_headers_survive_body_limit_rejection():
    from app.main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        response = await client.post('/api/v1/public/requests', content=b'x' * (1024 * 1024 + 1),
                                     headers={'Origin': 'https://eltriunfo.mx'})
        assert response.status_code == 413
        assert response.headers['access-control-allow-origin'] == 'https://eltriunfo.mx'


async def test_multipart_document_upload_survives_disk_spooling():
    from fastapi import UploadFile, File
    app = FastAPI()
    app.add_middleware(RequestBodyLimitMiddleware)
    @app.post('/api/v1/sales/1/documents')
    async def upload(file: UploadFile = File(...)):
        contents = await file.read()
        return {'name': file.filename, 'digest': hashlib.sha256(contents).hexdigest()}

    # Exceeds the RAM spool threshold and the ordinary JSON ceiling, but is a
    # valid document upload. Verify the parser receives every original byte.
    contents = b'%PDF-test-document\n' * 70000
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        response = await client.post('/api/v1/sales/1/documents',
                                     files={'file': ('test.pdf', contents, 'application/pdf')})
        assert response.status_code == 200
        assert response.json() == {'name': 'test.pdf', 'digest': hashlib.sha256(contents).hexdigest()}


async def test_rate_limit_storage_failure_does_not_disable_protection(active_limiter, monkeypatch):
    from app.main import app
    def unavailable(*args, **kwargs):
        raise ConnectionError('test storage unavailable')
    monkeypatch.setattr(limiter.limiter, 'hit', unavailable)
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        response = await client.get('/api/v1/clients')
        assert response.status_code == 503
        assert response.headers['retry-after'] == '60'
        assert 'storage unavailable' not in response.text
        assert (await client.get('/health')).status_code == 200
