"""Move Floresta's inventory without recreating lots or deleting their history.

Runs before catalog seeding and before the app accepts requests. Any conflict
rolls the entire transaction back; a second successful run is a no-op.
"""
import asyncio
import json
import os
from pathlib import Path
import sqlite3
import tempfile

from sqlalchemy import delete, func, select, text, update

from app.core.audit import AuditLog
from app.core.database import async_session_factory
from app.models.client import Client, ClientInteraction
from app.models.lot import Lot, LotStatus
from app.models.project import Project
from app.services.project_identity import LEGACY_SLUG, TARGET_NAME, TARGET_SLUG, normalize_block


def _backup_sqlite(database):
    """Use SQLite's backup API (including WAL), never copy a live database file."""
    source_path = Path(database).resolve()
    directory = source_path.parent / 'backups'
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    fd, filename = tempfile.mkstemp(prefix='before-triunfo-', suffix='.db', dir=directory)
    os.close(fd)  # mkstemp creates the backup with owner-only permissions.
    try:
        with sqlite3.connect(source_path.as_uri() + '?mode=ro', uri=True) as source:
            with sqlite3.connect(filename) as destination:
                source.backup(destination)
                if destination.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                    raise RuntimeError('No se pudo verificar el respaldo previo al traslado.')
        return filename
    except Exception:
        Path(filename).unlink(missing_ok=True)
        raise


async def consolidate_projects(session_factory=async_session_factory):
    async with session_factory() as db:
        if db.bind.dialect.name == 'sqlite':
            await db.execute(text('BEGIN IMMEDIATE'))
        projects = (await db.scalars(select(Project).where(
            Project.slug.in_((LEGACY_SLUG, TARGET_SLUG))).order_by(Project.id).with_for_update())).all()
        source = next((p for p in projects if p.slug == LEGACY_SLUG), None)
        target = next((p for p in projects if p.slug == TARGET_SLUG), None)
        if source is None:
            return {'migrated': False}

        lots = (await db.scalars(select(Lot).where(
            Lot.project_id.in_([p.id for p in projects])).order_by(Lot.id).with_for_update())).all()
        identities = set()
        for lot in lots:
            identity = (normalize_block(lot.block), lot.lot_number)
            if identity in identities:
                raise RuntimeError(f'Traslado cancelado: manzana {identity[0] or "sin asignar"}, '
                                   f'lote {identity[1]} duplicado. No se modificó ningún registro.')
            identities.add(identity)
        source_lot_ids = {lot.id for lot in lots if lot.project_id == source.id}
        source_clients = set((await db.scalars(select(Client.id).where(Client.project_id == source.id))).all())
        interactions = (await db.scalars(select(ClientInteraction).where(
            ClientInteraction.interaction_type == 'web_request').with_for_update())).all()
        updates = []
        for row in interactions:
            try:
                saved = json.loads(row.metadata_json or '{}')
                if not isinstance(saved, dict):
                    raise ValueError('Expected object')
            except (ValueError, TypeError):
                if row.client_id in source_clients:
                    raise RuntimeError(f'Traslado cancelado: revisar la solicitud WEB-{row.id}.')
                continue
            if saved.get('project_slug') in (LEGACY_SLUG, TARGET_SLUG) or saved.get('lot_id') in source_lot_ids:
                updates.append((row, saved))

        backup = None
        database = db.bind.url.database
        if db.bind.dialect.name == 'sqlite' and database and database != ':memory:':
            backup = await asyncio.to_thread(_backup_sqlite, database)

        # Keep the source project's descriptive fields in the audit trail even
        # when the destination already has its own values.
        fields = ('description', 'location', 'city', 'state', 'country', 'cover_image_url', 'gallery')
        original = {field: getattr(source, field) for field in fields}
        original.update(name=source.name, slug=source.slug, price_per_sqm=source.price_per_sqm,
                        status=source.status.value if source.status else None, total_lots=source.total_lots,
                        available_lots=source.available_lots, sold_lots=source.sold_lots)
        source_id = source.id
        if target is None:
            # No destination exists: changing the project's identity preserves
            # every relationship and avoids allocating an unnecessary ID.
            target = source
            target.slug = TARGET_SLUG
        else:
            for field in fields:
                if not getattr(target, field) and getattr(source, field):
                    setattr(target, field, getattr(source, field))
            if not target.price_per_sqm:
                target.price_per_sqm = source.price_per_sqm
            await db.execute(update(Lot).where(Lot.project_id == source_id).values(
                project_id=target.id, updated_at=Lot.updated_at))
            await db.execute(update(Client).where(Client.project_id == source_id).values(
                project_id=target.id, updated_at=Client.updated_at))
            # Core delete intentionally bypasses the ORM's delete-orphan cascade.
            # The two project foreign keys have both been moved above.
            await db.execute(delete(Project).where(Project.id == source_id))
        target.name = TARGET_NAME
        for row, saved in updates:
            # Leave fingerprints intact: retries from an already-open landing
            # must still return the same receipt instead of creating a new sale.
            saved.update(project_slug=TARGET_SLUG, project_name=TARGET_NAME)
            row.metadata_json = json.dumps(saved, ensure_ascii=False)
        await db.flush()
        counts = dict((await db.execute(select(Lot.status, func.count()).where(
            Lot.project_id == target.id).group_by(Lot.status))).all())
        target.total_lots = sum(counts.values())
        target.available_lots = counts.get(LotStatus.AVAILABLE, 0)
        target.sold_lots = counts.get(LotStatus.SOLD, 0)
        report = {'migrated': True, 'source_id': source_id, 'target_id': target.id,
                  'moved_lots': len(source_lot_ids), 'moved_clients': len(source_clients),
                  'updated_requests': len(updates), 'total_lots': target.total_lots,
                  'backup': backup}
        db.add(AuditLog(action='PROJECT_CONSOLIDATED', entity_type='project', entity_id=target.id,
                        username='system-migration', old_values=original,
                        new_values={'name': TARGET_NAME, 'slug': TARGET_SLUG}, details=report))
        await db.commit()
        return report
