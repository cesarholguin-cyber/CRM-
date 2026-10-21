"""Import a current, offline Easypanel SQLite backup into the private crm schema.

Dry-run by default. --schema-sql emits DDL for the Supabase SQL tooling;
--apply imports data only, refuses occupied destinations and verifies every row.
"""
import argparse
from datetime import datetime, timezone
from enum import Enum
import hashlib
import json
import os
from pathlib import Path
import sys

from dotenv import dotenv_values
from sqlalchemy import create_engine, create_mock_engine, inspect, select, func, text
from sqlalchemy.engine import make_url

INTERNAL = {'intake_mutex', 'crm_schema_migrations'}
VERSION = 'supabase-v1-ready'


def metadata():
    # Loading the models must never connect to or change the live configuration.
    os.environ.update(DATABASE_MODE='external', DATABASE_URL='sqlite+aiosqlite:///:memory:',
                      DATABASE_URL_SYNC='sqlite:///:memory:', DOCUMENT_STORAGE='database')
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    import app.models
    import app.core.audit
    from app.core.database import Base
    return Base.metadata


def schema_sql(meta):
    statements = ["BEGIN;", "CREATE SCHEMA IF NOT EXISTS crm;", "SET LOCAL search_path TO crm;",
                  "REVOKE ALL ON SCHEMA crm FROM PUBLIC, anon, authenticated;"]
    def emit(sql, *args, **kwargs):
        statements.append(str(sql.compile(dialect=mock.dialect)).strip() + ';')
    mock = create_mock_engine('postgresql+psycopg://', emit)
    meta.create_all(mock)
    for table in meta.sorted_tables:
        statements.append(f'ALTER TABLE crm."{table.name}" ENABLE ROW LEVEL SECURITY;')
    statements += ["REVOKE ALL ON ALL TABLES IN SCHEMA crm FROM PUBLIC, anon, authenticated;",
                   "REVOKE ALL ON ALL SEQUENCES IN SCHEMA crm FROM PUBLIC, anon, authenticated;",
                   "ALTER DEFAULT PRIVILEGES IN SCHEMA crm REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;",
                   "COMMIT;"]
    return '\n'.join(line.rstrip() for line in '\n\n'.join(statements).splitlines()) + '\n'


def normalized(value):
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat()
    if isinstance(value, Enum):
        return value.name
    if isinstance(value, (bytes, memoryview)):
        return {'size': len(value), 'sha256': hashlib.sha256(value).hexdigest()}
    if isinstance(value, dict):
        return {key: normalized(val) for key, val in value.items()}
    if isinstance(value, (tuple, list)):
        return [normalized(val) for val in value]
    return value


def digest(connection, table):
    result = hashlib.sha256()
    count = 0
    for row in connection.execute(select(table).order_by(*table.primary_key.columns)).mappings():
        result.update(json.dumps(normalized(dict(row)), sort_keys=True, ensure_ascii=False).encode())
        result.update(b'\n')
        count += 1
    return count, result.hexdigest()


def inspect_source(connection, meta):
    if connection.exec_driver_sql('PRAGMA integrity_check').scalar() != 'ok':
        raise RuntimeError('El respaldo SQLite no pasó la verificación de integridad.')
    if connection.exec_driver_sql('PRAGMA foreign_key_check').first():
        raise RuntimeError('El respaldo tiene relaciones inválidas.')
    names = set(inspect(connection).get_table_names())
    if not {'users', 'projects', 'lots', 'clients', 'sales'} <= names:
        raise RuntimeError('El respaldo no contiene las tablas principales del CRM.')
    selected = [t for t in meta.sorted_tables if t.name in names - INTERNAL]
    for table in selected:
        columns = {col['name'] for col in inspect(connection).get_columns(table.name)}
        if columns != set(table.columns.keys()):
            raise RuntimeError(f'Actualiza el CRM antes de respaldar: esquema incompatible en {table.name}.')
    users = meta.tables['users']
    if not connection.scalar(select(func.count()).select_from(users).where(users.c.is_active.is_(True))):
        raise RuntimeError('El respaldo no contiene usuarios activos.')
    sales = meta.tables['sales']
    if connection.execute(select(sales.c.lot_id).where(sales.c.status.not_in(['CANCELLED','REVERSED']))
                          .group_by(sales.c.lot_id).having(func.count() > 1)).first():
        raise RuntimeError('Hay varias ventas activas del mismo lote; reconciliar antes de importar.')
    return selected


def verify(source, target, tables, meta):
    imported = {table.name for table in tables}
    for table in meta.sorted_tables:
        if table.name in INTERNAL:
            continue
        if table.name in imported:
            if digest(source, table) != digest(target, table):
                raise RuntimeError(f'No coinciden los datos de {table.name}. No actives Supabase.')
        elif target.scalar(select(func.count()).select_from(table)):
            raise RuntimeError(f'El destino contiene datos adicionales en {table.name}.')


def copy_rows(source, target, tables, meta):
    for table in meta.sorted_tables:
        if target.scalar(select(func.count()).select_from(table)):
            raise RuntimeError('El destino ya contiene datos; no se sobrescribió nada.')
    for table in tables:
        rows = source.execute(select(table)).mappings()
        while batch := rows.fetchmany(10):
            values = []
            for row in batch:
                values.append({key: value.replace(tzinfo=timezone.utc)
                               if isinstance(value, datetime) and value.tzinfo is None else value
                               for key, value in row.items()})
            target.execute(table.insert(), values)
    verify(source, target, tables, meta)


def validate_target(target, meta):
    if target.dialect.name != 'postgresql' or target.scalar(text('select current_schema()')) != 'crm':
        raise RuntimeError('La conexión debe usar PostgreSQL y el esquema privado crm.')
    expected = set(meta.tables)
    if set(inspect(target).get_table_names(schema='crm')) != expected:
        raise RuntimeError('Crea primero el esquema crm generado con --schema-sql, en una base vacía.')
    # RLS and revoked schema access keep both public Supabase API roles out.
    unsafe = target.execute(text("""
        SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='crm' AND c.relkind='r' AND NOT c.relrowsecurity
    """)).first()
    if unsafe:
        raise RuntimeError('Falta activar RLS en una tabla del CRM.')
    for role in ('anon', 'authenticated'):
        if target.scalar(text("SELECT has_schema_privilege(:role, 'crm', 'USAGE')"), {'role': role}):
            raise RuntimeError('El esquema crm no debe ser accesible desde la API pública.')


def finalize(target, tables, meta):
    # Imported explicit IDs must not collide with the next INSERT.
    for table in tables:
        for column in table.primary_key:
            if column.identity is None:
                continue
            relation = 'crm.' + table.name
            sequence = target.scalar(text('select pg_get_serial_sequence(:relation, :column)'),
                                     {'relation': relation, 'column': column.name})
            if sequence:
                maximum = target.scalar(select(func.max(column)))
                target.execute(text('select setval(CAST(:sequence AS regclass), :value, :called)'),
                               {'sequence': sequence, 'value': maximum or 1, 'called': maximum is not None})
    target.execute(meta.tables['intake_mutex'].insert().values(id=1))
    target.execute(meta.tables['crm_schema_migrations'].insert().values(version=VERSION))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--schema-sql', action='store_true')
    parser.add_argument('--source', type=Path)
    parser.add_argument('--env-file', type=Path)
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--apply', action='store_true')
    group.add_argument('--verify-only', action='store_true')
    parser.add_argument('--confirm-offline', action='store_true', help='El CRM origen está detenido y el respaldo es reciente')
    args = parser.parse_args()
    meta = metadata()
    if args.schema_sql:
        print(schema_sql(meta), end='')
        return
    if not args.source or not args.env_file:
        parser.error('Se requieren --source y --env-file.')
    if args.apply and not args.confirm_offline:
        parser.error('Detén el CRM origen y confirma --confirm-offline antes de la importación final.')
    from migrate_to_oracle import source_engine, backup_source
    values = dotenv_values(args.env_file)
    url = make_url(values.get('DATABASE_URL', '')).set(drivername='postgresql+psycopg')
    target_engine = create_engine(url, hide_parameters=True, connect_args={
        'options':'-csearch_path=crm -ctimezone=UTC', 'sslmode':'require',
        'prepare_threshold':None, 'connect_timeout':15})
    from app.core.postgres_session import configure_supabase_session
    configure_supabase_session(target_engine)
    original = source_engine(args.source)
    with original.connect() as source:
        tables = inspect_source(source, meta)
        counts = {t.name: source.scalar(select(func.count()).select_from(t)) for t in tables}
        print(json.dumps({'source_counts': counts}, sort_keys=True))
        if args.apply:
            destination = args.source.with_name(args.source.name + '.before-supabase-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%f') + '.db')
            backup_source(args.source, destination)
        with target_engine.begin() as target:
            validate_target(target, meta)
            target.execute(text("SELECT pg_advisory_xact_lock(hashtext('rf-crm-supabase-import'))"))
            if args.verify_only:
                verify(source, target, tables, meta)
            elif args.apply:
                copy_rows(source, target, tables, meta)
                finalize(target, tables, meta)
        print('Importación verificada.' if args.apply else 'Verificación finalizada; no se importaron datos.')
    original.dispose()
    target_engine.dispose()


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        # Database exceptions can contain connection details or bound user data.
        if isinstance(exc, RuntimeError):
            print(str(exc), file=sys.stderr)
        else:
            print('No se completó la operación (' + type(exc).__name__ + '). Revisa configuración y esquema.', file=sys.stderr)
        raise SystemExit(1)
