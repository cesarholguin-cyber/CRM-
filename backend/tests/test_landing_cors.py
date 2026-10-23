"""Exercise the actual CRM middleware with the production landing origins.

The API may return HTTP 200 yet remain unreadable by a browser when the
Access-Control-Allow-Origin header is missing. Tests never use live data.
"""
from datetime import date, timedelta
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import update
from test_web_requests import setup, payload
from app.main import app
from app.core.database import get_db
from app.models.project import Project


@pytest_asyncio.fixture
async def crm(setup):
    _, sessions, _ = setup
    async with sessions() as db:
        await db.execute(update(Project).values(slug='campestre-el-triunfo', name='Campestre El Triunfo'))
        await db.commit()
    async def test_db():
        async with sessions() as db:
            yield db
    old = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = test_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url='https://crm.test') as http:
            yield http
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(old)


@pytest.mark.asyncio
@pytest.mark.parametrize('origin', ['https://eltriunfo.mx', 'https://www.eltriunfo.mx', 'https://maculisur.com.mx', 'https://www.maculisur.com.mx'])
async def test_catalog_and_visit_request_readable_from_landing(crm, origin):
    response = await crm.get('/api/v1/public/catalog/campestre-el-triunfo', headers={'Origin': origin})
    assert response.status_code == 200, response.text
    assert response.headers.get('access-control-allow-origin') == origin
    assert 'Origin' in response.headers['vary']
    before = response.json()['lots']
    assert len(before) == 3
    for method, path in [('GET', '/api/v1/public/catalog/campestre-el-triunfo'), ('POST', '/api/v1/public/requests')]:
        preflight = await crm.options(path, headers={
            'Origin': origin, 'Access-Control-Request-Method': method,
            'Access-Control-Request-Headers': 'content-type',
        })
        assert preflight.status_code == 200, preflight.text
        assert preflight.headers.get('access-control-allow-origin') == origin
        assert method in preflight.headers['access-control-allow-methods']
    data = payload(preferred_date=str(date.today() + timedelta(days=2)))
    data['kind'] = 'visit'
    response = await crm.post('/api/v1/public/requests', json=data, headers={'Origin': origin})
    assert response.status_code == 200, response.text
    assert response.headers.get('access-control-allow-origin') == origin
    assert response.json()['success'] is True
    after = (await crm.get('/api/v1/public/catalog/campestre-el-triunfo')).json()['lots']
    assert after == before  # Visits and CORS changes must not release sold lots.


@pytest.mark.asyncio
@pytest.mark.parametrize('origin', ['https://eltriunfo.mx.example.com', 'https://other.example', 'null'])
async def test_unrecognized_origins_remain_disallowed(crm, origin):
    response = await crm.options('/api/v1/public/requests', headers={
        'Origin': origin, 'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
    })
    assert response.status_code == 400
    assert 'access-control-allow-origin' not in response.headers
