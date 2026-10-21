"""Initialize an empty Supabase CRM with verified inventory and one Auth admin.

The source backup is read-only. Test users, customers, sales and files are never
copied. Sold inventory must match the published snapshot exactly. Dry-run unless
--apply is supplied; existing destination data is never replaced.
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from dotenv import dotenv_values
from sqlalchemy import MetaData, create_engine, select, text, func
from migrate_to_supabase import metadata, validate_target, finalize
from migrate_to_oracle import source_engine


def prepare_inventory(projects, lots, catalog):
    from app.services.project_identity import normalize_block, TARGET_SLUG, TARGET_NAME, LEGACY_SLUG
    projects = [dict(p) for p in projects]
    if any(p['slug'] not in (TARGET_SLUG, LEGACY_SLUG) for p in projects):
        raise RuntimeError('Hay otros proyectos: revisar antes de importar.')
    target = next((p for p in projects if p['slug'] == TARGET_SLUG), None)
    if target is None:
        raise RuntimeError('Falta el proyecto Campestre del Triunfo.')
    published = {}
    for row in catalog['lots']:
        key = (normalize_block(row['block']), row['lot_number'])
        if key in published or row['status'] not in ('available', 'sold'):
            raise RuntimeError('El inventario publicado contiene duplicados o apartados pendientes. Revisar antes de importar.')
        published[key] = row
    local = {}
    for row in lots:
        key = (normalize_block(row['block']), row['lot_number'])
        if key in local:
            raise RuntimeError('El respaldo contiene lotes duplicados.')
        local[key] = dict(row)
    if not published or local.keys() != published.keys():
        raise RuntimeError('El inventario publicado y el respaldo no contienen los mismos lotes.')
    sold = {key for key, row in local.items() if row['status'] == 'SOLD'}
    if sold != {key for key, row in published.items() if row['status'] == 'sold'}:
        raise RuntimeError('Los lotes vendidos difieren. No se modificó ningún estado.')
    cleaned = []
    for key, row in local.items():
        live = published[key]
        row.update(project_id=target['id'], block=key[0], status=live['status'].upper(),
                   area_sqm=live['area_sqm'], price_per_sqm=live['price_per_sqm'],
                   total_price=live['total_price'], sold_to_client_id=None)
        cleaned.append(row)
    for source in projects:
        for field in ('description', 'location', 'city', 'state', 'country', 'cover_image_url', 'gallery'):
            if not target.get(field):
                target[field] = source.get(field)
    target.update(name=TARGET_NAME, slug=TARGET_SLUG, total_lots=len(cleaned),
                  sold_lots=len(sold), available_lots=len(cleaned)-len(sold))
    return target, cleaned


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--catalog', type=Path, required=True)
    parser.add_argument('--env-file', type=Path, required=True)
    parser.add_argument('--admin-id', required=True)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    admin_id = str(UUID(args.admin_id))
    meta = metadata()
    source = source_engine(args.source)
    with source.connect() as src:
        if src.exec_driver_sql('PRAGMA integrity_check').scalar() != 'ok':
            raise RuntimeError('Respaldo dañado.')
        reflected = MetaData()
        reflected.reflect(src, only=['projects', 'lots'])
        project, lots = prepare_inventory(
            list(src.execute(select(reflected.tables['projects'])).mappings()),
            list(src.execute(select(reflected.tables['lots'])).mappings()),
            json.loads(args.catalog.read_text()))
    source.dispose()
    env = dotenv_values(args.env_file)
    engine = create_engine(env['DATABASE_URL'], hide_parameters=True, connect_args={
        'sslmode':'require', 'prepare_threshold':None, 'connect_timeout':15})
    from app.core.postgres_session import configure_supabase_session
    configure_supabase_session(engine)
    with engine.begin() as dst:
        validate_target(dst, meta)
        dst.execute(text("SELECT pg_advisory_xact_lock(hashtext('rf-crm-supabase-import'))"))
        for table in meta.sorted_tables:
            if dst.scalar(select(func.count()).select_from(table)):
                raise RuntimeError('El destino ya contiene datos. No se sobrescribió nada.')
        identity = dst.execute(text('''SELECT id,email,raw_user_meta_data FROM auth.users
            WHERE id=CAST(:uid AS uuid) AND email_confirmed_at IS NOT NULL
              AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now())'''),
            {'uid':admin_id}).mappings().one_or_none()
        if not identity or not identity['email']:
            raise RuntimeError('El administrador no existe o no está confirmado/activo en Supabase Auth.')
        report = {'lots':len(lots), 'sold':project['sold_lots'], 'available':project['available_lots'],
                  'admin_email':identity['email'], 'mode':'apply' if args.apply else 'dry-run'}
        if args.apply:
            # Normalize SQLite's naive dates to UTC without changing their values.
            def utc(row):
                return {k:v.replace(tzinfo=timezone.utc) if isinstance(v,datetime) and v.tzinfo is None else v
                        for k,v in row.items()}
            dst.execute(meta.tables['projects'].insert(), utc(project))
            for row in lots:
                dst.execute(meta.tables['lots'].insert(), utc(row))
            dst.execute(meta.tables['users'].insert().values(
                email=identity['email'], username=identity['email'],
                full_name=(identity['raw_user_meta_data'] or {}).get('full_name') or identity['email'],
                hashed_password='!supabase-auth', supabase_auth_id=admin_id,
                role='ADMIN', is_active=True, is_superuser=True))
            imported = list(dst.execute(select(meta.tables['lots'])).mappings())
            for expected, actual in zip(sorted(lots,key=lambda x:x['id']), sorted(imported,key=lambda x:x['id'])):
                for field in ('id','project_id','block','lot_number','area_sqm','price_per_sqm','total_price'):
                    if actual[field] != expected[field]:
                        raise RuntimeError('La verificación de inventario falló.')
                if actual['status'].name != expected['status']:
                    raise RuntimeError('La verificación del estado del lote falló.')
            if len(imported) != len(lots):
                raise RuntimeError('No coincide el número de lotes.')
            finalize(dst, list(meta.sorted_tables), meta)
            dst.execute(meta.tables['crm_schema_migrations'].insert().values(version='supabase-auth-v2-ready'))
        print(json.dumps(report))
    engine.dispose()


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(str(exc) if isinstance(exc, RuntimeError) else 'Inicialización cancelada (' + type(exc).__name__ + ').')
        raise SystemExit(1)
