import os
os.environ['DATABASE_MODE'] = 'external'
os.environ['DATABASE_URL'] = 'sqlite+aiosqlite:///:memory:'
os.environ['DATABASE_URL_SYNC'] = 'sqlite:///:memory:'
os.environ['SECRET_KEY'] = 'integration-tests-only-not-production'
os.environ['ENCRYPTION_KEY'] = ''
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.core.database import Base, get_db
from app.models import Client, Project, Lot, Sale, User
from app.models.document import SaleDocument
from app.models.sale import SaleStatus
from app.api import documents
from app.api.deps import get_current_user
from app.core.audit import AuditLog

PDF = b'%PDF-1.4\n1 0 obj <</Type /Catalog>> endobj\n%%EOF'

@pytest_asyncio.fixture
async def archive(tmp_path):
    engine = create_async_engine('sqlite+aiosqlite:///' + str(tmp_path / 'documents.db'))
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with sessions() as db:
        db.add(User(id=1, email='archive@example.com', username='archive', full_name='Prueba', hashed_password='not-a-login'))
        db.add(Project(id=1, name='Floresta', slug='floresta', price_per_sqm=800))
        db.add_all([Client(id=1, full_name='Cliente Uno'), Client(id=2, full_name='Cliente Dos')])
        await db.flush()
        for i in range(1, 4):
            db.add(Lot(id=i, project_id=1, block='M1', lot_number=i, area_sqm=300, price_per_sqm=800, total_price=240000))
        await db.flush()
        for i in range(1, 4):
            db.add(Sale(id=i, lot_id=i, client_id=1 if i < 3 else 2, sale_price=240000,
                        reservation_expires_at=datetime.now(timezone.utc) + timedelta(days=15)))
        await db.commit()
    app = FastAPI()
    app.include_router(documents.router, prefix='/api/v1')
    async def override_db():
        async with sessions() as db:
            yield db
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1, email='archive@example.com')
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as http:
        yield http, sessions, app, engine
    await engine.dispose()

async def upload(http, sale=1, files=None, category='ownership'):
    return await http.post(f'/api/v1/sales/{sale}/documents', data={'category': category, 'description': 'Documento de prueba'}, files=files or [('files', ('titularidad.pdf', PDF, 'application/pdf'))])

async def count(sessions):
    async with sessions() as db:
        return await db.scalar(select(func.count()).select_from(SaleDocument))

async def test_shared_archive_is_persistent_and_keeps_sale_client_lot_link(archive):
    http, sessions, app, engine = archive
    result = await upload(http)
    assert result.status_code == 201, result.text
    doc = result.json()[0]
    assert doc['filename'] == 'titularidad.pdf' and doc['size_bytes'] == len(PDF)
    assert not {'content', 'storage_path'} & set(doc)
    await engine.dispose()  # Re-open database connections: file bytes remain stored.
    sale = (await http.get('/api/v1/sales/1/dossier')).json()
    client = (await http.get('/api/v1/clients/1/dossier')).json()
    assert sale['client']['full_name'] == 'Cliente Uno'
    assert sale['lot']['block'] == 'M1' and sale['lot']['number'] == 1
    assert sale['sale']['reservation_expires_at']
    assert sale['documents'][0]['id'] == doc['id']
    first = next(record for record in client['sales'] if record['sale']['id'] == 1)
    assert first['documents'] == sale['documents']
    assert await count(sessions) == 1
    download = await http.get(f"/api/v1/sales/1/documents/{doc['id']}/download")
    assert download.content == PDF and download.status_code == 200
    assert download.headers['content-disposition'].startswith('attachment;')
    assert download.headers['cache-control'] == 'no-store'
    assert download.headers['x-content-type-options'] == 'nosniff'
    async with sessions() as db:
        assert await db.scalar(select(func.count()).select_from(AuditLog)) == 2
        sale = await db.get(Sale, 1)
        assert sale.status == SaleStatus.RESERVED

async def test_client_records_separate_lots_and_preserve_cancelled_documents(archive):
    http, sessions, _, _ = archive
    await upload(http, 1)
    await upload(http, 2, category='client')
    async with sessions() as db:
        sale = await db.get(Sale, 1); sale.status = SaleStatus.CANCELLED
        await db.commit()
    result = (await http.get('/api/v1/clients/1/dossier')).json()
    assert len(result['sales']) == 2
    assert all(len(record['documents']) == 1 for record in result['sales'])
    other = (await http.get('/api/v1/clients/2/dossier')).json()
    assert len(other['sales']) == 1 and other['sales'][0]['documents'] == []
    doc = next(r for r in result['sales'] if r['sale']['id'] == 1)['documents'][0]
    assert (await http.get(f"/api/v1/sales/2/documents/{doc['id']}/download")).status_code == 404
    assert (await http.get(f"/api/v1/sales/1/documents/{doc['id']}/download")).content == PDF

async def test_all_document_routes_require_authentication(archive):
    http, sessions, app, _ = archive
    doc = (await upload(http)).json()[0]
    app.dependency_overrides.pop(get_current_user)
    for path in ['/sales/1/dossier', '/clients/1/dossier', f"/sales/1/documents/{doc['id']}/download"]:
        assert (await http.get('/api/v1' + path)).status_code == 401
    assert (await upload(http)).status_code == 401
    assert await count(sessions) == 1

@pytest.mark.parametrize('filename,content', [('empty.pdf', b''), ('fake.pdf', b'<html>bad</html>'), ('script.html', b'<html>bad</html>'), ('fake.docx', b'not an office document')])
async def test_invalid_batch_is_atomic(archive, filename, content):
    http, sessions, _, _ = archive
    result = await upload(http, files=[('files', ('valid.pdf', PDF, 'application/pdf')), ('files', (filename, content, 'application/octet-stream'))])
    assert result.status_code == 422
    assert await count(sessions) == 0

async def test_limits_category_missing_sale_and_safe_names(archive, monkeypatch):
    http, sessions, _, _ = archive
    assert (await upload(http, sale=999)).status_code == 404
    assert (await upload(http, category='unknown')).status_code == 422
    assert (await upload(http, files=[('files', ('a.pdf', PDF, 'application/pdf'))] * 11)).status_code == 422
    monkeypatch.setattr(documents.settings, 'MAX_UPLOAD_SIZE_MB', 1)
    assert (await upload(http, files=[('files', ('large.pdf', b'%PDF-' + b'0' * 1024 * 1024, 'application/pdf'))])).status_code == 413
    assert await count(sessions) == 0
    result = await upload(http, files=[('files', ('../../folder/título.pdf', PDF, 'application/pdf'))])
    assert result.status_code == 201 and result.json()[0]['filename'] == 'título.pdf'

async def test_multiple_files_and_missing_records(archive):
    http, sessions, _, _ = archive
    result = await upload(http, files=[('files', ('one.pdf', PDF, 'application/pdf')), ('files', ('notes.txt', b'Client notes', 'text/plain'))])
    assert result.status_code == 201 and len(result.json()) == 2
    assert await count(sessions) == 2
    assert (await http.get('/api/v1/clients/999/dossier')).status_code == 404
    assert (await http.get('/api/v1/sales/999/dossier')).status_code == 404
