import json
import sqlite3
from pathlib import Path
from datetime import datetime, timezone

import pytest
from sqlalchemy import event, func, select

from test_web_requests import setup, payload, send, authorize
from app.core.audit import AuditLog
from app.models import Client, ClientInteraction, Lot, Project, Sale, User, Payment, PaymentPlan
from app.models.document import SaleDocument, DocumentObject
from app.models.lot import LotStatus
from app.services.project_consolidation import consolidate_projects
from app.services.project_identity import TARGET_NAME, TARGET_SLUG


async def add_destination(sessions):
    async with sessions() as db:
        db.add(Project(id=2, name='Campestre El Triunfo', slug=TARGET_SLUG,
                       price_per_sqm=0, description='Descripción de destino'))
        source = await db.get(Project, 1)
        source.location = 'Hermosillo'
        source.description = 'Descripción original'
        await db.commit()


async def test_move_preserves_ids_values_documents_and_retries(setup):
    http, sessions, app = setup
    request = payload()
    first = await send(http, request)
    assert first.status_code == 200
    await add_destination(sessions)
    async with sessions() as db:
        db.add(User(id=1, email='test@example.com', username='tester', full_name='Prueba', hashed_password='unused'))
        db.add(Client(id=2, full_name='Cliente del destino', project_id=2))
        await db.flush()
        sale = await db.get(Sale, 1)
        db.add(PaymentPlan(id=1, sale_id=1, client_id=1, installment_number=1,
                           due_date=datetime.now(timezone.utc), amount=3000))
        await db.flush()
        db.add(Payment(id=1, sale_id=1, payment_plan_id=1, amount=3000))
        db.add(SaleDocument(id=1, sale_id=1, category='ownership', filename='titularidad.pdf',
                            content_type='application/pdf', size_bytes=4, sha256='a'*64,
                            uploaded_by=1, content=b'%PDF'))
        await db.flush()
        db.add(DocumentObject(document_id=1, namespace='private', bucket='documents', object_key='original.pdf'))
        await db.commit()
        lot_snapshot = {lot.id: (lot.block, lot.lot_number, lot.status, lot.area_sqm, lot.total_price,
                                lot.sold_to_client_id, lot.created_at, lot.updated_at)
                        for lot in await db.scalars(select(Lot))}
        sale_snapshot = {c.name: getattr(sale, c.name) for c in Sale.__table__.columns}
        metadata_before = json.loads((await db.get(ClientInteraction, 1)).metadata_json)

    # Real foreign keys catch an accidental cascade or dangling association.
    engine = sessions.kw['bind']
    await engine.dispose()
    @event.listens_for(engine.sync_engine, 'connect')
    def foreign_keys(connection, _):
        connection.execute('PRAGMA foreign_keys=ON')

    report = await consolidate_projects(sessions)
    assert report['moved_lots'] == 3 and report['moved_clients'] == 1
    assert report['updated_requests'] == 1 and report['target_id'] == 2
    backup_path = Path(report['backup'])
    assert backup_path.exists() and backup_path.stat().st_mode & 0o777 == 0o600
    with sqlite3.connect(backup_path) as backup:
        assert backup.execute('select slug from projects where id=1').fetchone()[0] == 'floresta-campestre'
        assert backup.execute('select count(*) from lots where project_id=1').fetchone()[0] == 3
        assert backup.execute('select content from sale_documents').fetchone()[0] == b'%PDF'
    async with sessions() as db:
        assert await db.get(Project, 1) is None
        project = await db.get(Project, 2)
        assert project.name == TARGET_NAME
        assert (project.total_lots, project.available_lots, project.sold_lots) == (3, 1, 1)
        assert project.location == 'Hermosillo' and project.price_per_sqm == 800
        assert project.description == 'Descripción de destino'
        for lot in await db.scalars(select(Lot)):
            assert lot.project_id == 2
            assert lot_snapshot[lot.id] == (lot.block, lot.lot_number, lot.status, lot.area_sqm, lot.total_price,
                                            lot.sold_to_client_id, lot.created_at, lot.updated_at)
        sale = await db.get(Sale, 1)
        assert sale_snapshot == {c.name: getattr(sale, c.name) for c in Sale.__table__.columns}
        assert [c.project_id for c in await db.scalars(select(Client).order_by(Client.id))] == [2, 2]
        assert (await db.get(Payment, 1)).payment_plan_id == 1
        assert (await db.get(PaymentPlan, 1)).client_id == 1
        assert await db.scalar(select(SaleDocument.content).where(SaleDocument.id == 1)) == b'%PDF'
        assert (await db.get(DocumentObject, 1)).object_key == 'original.pdf'
        metadata_after = json.loads((await db.get(ClientInteraction, 1)).metadata_json)
        assert metadata_after == dict(metadata_before, project_slug=TARGET_SLUG, project_name=TARGET_NAME)
        audit = await db.scalar(select(AuditLog).where(AuditLog.action == 'PROJECT_CONSOLIDATED'))
        assert audit.old_values['description'] == 'Descripción original'

    assert await consolidate_projects(sessions) == {'migrated': False}
    assert len(list(backup_path.parent.glob('*.db'))) == 1
    assert (await send(http, request)).json() == first.json()
    old = (await http.get('/api/v1/public/catalog/floresta-campestre')).json()
    new = (await http.get('/api/v1/public/catalog/' + TARGET_SLUG)).json()
    assert old['lots'] == new['lots']
    authorize(app)
    feed = (await http.get('/api/v1/web-requests')).json()
    assert feed[0]['project_name'] == TARGET_NAME
    # Cancelling the original sale still releases the exact same lot for both URLs.
    response = await http.put('/api/v1/sales/1', json={'status': 'cancelled'})
    assert response.status_code == 200, response.text
    for slug in ('floresta-campestre', TARGET_SLUG):
        catalog = (await http.get('/api/v1/public/catalog/' + slug)).json()
        assert next(l for l in catalog['lots'] if l['block'] == 'M1' and l['lot_number'] == 1)['status'] == 'available'


@pytest.mark.parametrize('slug', ['floresta-campestre', TARGET_SLUG])
async def test_new_requests_use_destination_and_keep_plan_terms(setup, slug):
    http, sessions, _ = setup
    await add_destination(sessions)
    await consolidate_projects(sessions)
    data = payload()
    data['project_slug'] = slug
    response = await send(http, data)
    assert response.status_code == 200, response.text
    async with sessions() as db:
        assert (await db.get(Client, 1)).project_id == 2
        sale = await db.get(Sale, 1)
        assert sale.down_payment == 15000 and sale.payment_terms_months == 144
        assert (await db.get(Lot, sale.lot_id)).project_id == 2
        metadata = json.loads((await db.get(ClientInteraction, 1)).metadata_json)
        assert metadata['project_slug'] == TARGET_SLUG and metadata['project_name'] == TARGET_NAME


async def test_duplicate_block_lot_aborts_without_changing_anything(setup):
    _, sessions, _ = setup
    await add_destination(sessions)
    async with sessions() as db:
        db.add(Lot(project_id=2, block='MZ 01', lot_number=1, area_sqm=400,
                   price_per_sqm=900, total_price=360000))
        await db.commit()
    with pytest.raises(RuntimeError, match='duplicado'):
        await consolidate_projects(sessions)
    async with sessions() as db:
        assert (await db.get(Project, 1)).slug == 'floresta-campestre'
        assert (await db.get(Project, 2)).name == 'Campestre El Triunfo'
        assert await db.scalar(select(func.count()).select_from(Lot).where(Lot.project_id == 1)) == 3
        assert await db.scalar(select(func.count()).select_from(AuditLog)) == 0


async def test_without_destination_renames_source_without_changing_ids(setup):
    http, sessions, _ = setup
    await send(http, payload())
    report = await consolidate_projects(sessions)
    assert report['source_id'] == report['target_id'] == 1
    async with sessions() as db:
        assert (await db.get(Project, 1)).slug == TARGET_SLUG
        assert (await db.get(Client, 1)).project_id == 1
        assert (await db.get(Lot, 1)).project_id == 1


async def test_seeder_and_restart_never_recreate_floresta(setup, monkeypatch):
    _, sessions, _ = setup
    from app.services import catalog
    monkeypatch.setattr(catalog, 'async_session_factory', sessions)
    # This fixture has intentionally different areas from the real plan. Start empty.
    from sqlalchemy import delete
    async with sessions() as db:
        await db.execute(delete(Lot))
        await db.execute(delete(Project))
        await db.commit()
    await catalog.seed(apply=True)
    async with sessions() as db:
        project = await db.scalar(select(Project))
        assert project.slug == TARGET_SLUG and project.name == TARGET_NAME
        assert project.total_lots == 358
        lot = await db.scalar(select(Lot).where(Lot.status == LotStatus.AVAILABLE).limit(1))
        lot.status = LotStatus.BLOCKED
        lot_id = lot.id
        await db.commit()
    assert await consolidate_projects(sessions) == {'migrated': False}
    await catalog.seed(apply=True)
    async with sessions() as db:
        assert await db.scalar(select(func.count()).select_from(Project)) == 1
        assert await db.scalar(select(func.count()).select_from(Lot)) == 358
        assert (await db.get(Lot, lot_id)).status == LotStatus.BLOCKED
