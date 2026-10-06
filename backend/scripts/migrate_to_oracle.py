"""Offline SQLite -> Oracle migration. Dry-run by default; never edits the source.

Run with --help. The CRM must stay stopped during import and final verification.
"""
import argparse
from datetime import datetime, timezone
from enum import Enum
import hashlib
import json
from pathlib import Path
import sqlite3
import sys
from urllib.parse import quote

from sqlalchemy import create_engine, inspect, select, func, text

VERSION = 'oracle-v1-ready'
INTERNAL = {'intake_mutex', 'crm_schema_migrations'}


def source_engine(path):
    path = Path(path).resolve(strict=True)
    return create_engine('sqlite:///file:' + quote(str(path), safe='/') + '?mode=ro&uri=true')


def backup_source(source, destination):
    destination = Path(destination)
    # Never overwrite a prior backup.
    with destination.open('xb'):
        pass
    destination.chmod(0o600)
    try:
        with sqlite3.connect('file:' + quote(str(Path(source).resolve()), safe='/') + '?mode=ro', uri=True) as original:
            with sqlite3.connect(destination) as backup:
                original.backup(backup)
    except Exception:
        destination.unlink(missing_ok=True)
        raise


def normalized(value):
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat()
    if isinstance(value, Enum):
        return value.name
    if isinstance(value, bytes):
        return {'bytes': len(value), 'sha256': hashlib.sha256(value).hexdigest()}
    if value == '':  # Oracle treats empty VARCHARs as NULL.
        return None
    return value


def digest_table(connection, table):
    digest = hashlib.sha256()
    count = 0
    for row in connection.execute(select(table).order_by(*table.primary_key.columns)).mappings():
        values = {key: normalized(value) for key, value in row.items()}
        digest.update(json.dumps(values, sort_keys=True, ensure_ascii=False, default=str).encode())
        digest.update(b'\n')
        count += 1
    return count, digest.hexdigest()


def inspect_source(connection, tables):
    present = set(inspect(connection).get_table_names())
    if not {'users', 'projects', 'lots', 'clients', 'sales'} <= present:
        raise RuntimeError('La copia no contiene las tablas principales del CRM.')
    if connection.exec_driver_sql('PRAGMA integrity_check').scalar() != 'ok':
        raise RuntimeError('La copia SQLite no pasó la comprobación de integridad.')
    if connection.exec_driver_sql('PRAGMA foreign_key_check').first():
        raise RuntimeError('La copia contiene relaciones inválidas; reconcílialas antes de migrar.')
    selected = [table for table in tables if table.name in present and table.name not in INTERNAL]
    counts = {}
    for table in selected:
        actual = {col['name'] for col in inspect(connection).get_columns(table.name)}
        if actual != set(table.columns.keys()):
            raise RuntimeError(f'Esquema de origen incompatible: {table.name}. Actualiza el CRM antes de copiarlo.')
        counts[table.name] = connection.scalar(select(func.count()).select_from(table))
        for column in table.columns:
            if not column.nullable:
                from sqlalchemy import String
                if isinstance(column.type, String) and connection.scalar(
                    select(func.count()).select_from(table).where(column == '')
                ):
                    raise RuntimeError(f'Hay valores vacíos obligatorios en {table.name}.{column.name}.')
    sales = next(table for table in selected if table.name == 'sales')
    duplicates = connection.execute(select(sales.c.lot_id).where(
        sales.c.status.not_in(['CANCELLED', 'REVERSED'])).group_by(sales.c.lot_id).having(func.count() > 1)).first()
    if duplicates:
        raise RuntimeError('Existen varias ventas activas del mismo lote.')
    if counts.get('users', 0) == 0:
        raise RuntimeError('La copia no contiene usuarios; crea primero un administrador en el CRM.')
    return selected, counts


def copy_rows(source, target, tables):
    # Refuse any occupied destination, including tables absent from an older source.
    from app.core.database import Base
    for table in Base.metadata.sorted_tables:
        if table.name not in INTERNAL and target.scalar(select(func.count()).select_from(table)):
            raise RuntimeError('Oracle ya contiene datos. No se sobrescribió ni eliminó nada.')
    for table in tables:
        rows = source.execute(select(table)).mappings()
        while batch := rows.fetchmany(10):
            target.execute(table.insert(), [dict(row) for row in batch])
    verify_rows(source, target, tables)


def verify_rows(source, target, tables):
    from app.core.database import Base
    names = {table.name for table in tables}
    for table in Base.metadata.sorted_tables:
        if table.name not in names | INTERNAL and target.scalar(select(func.count()).select_from(table)):
            raise RuntimeError(f'Oracle contiene registros adicionales en {table.name}.')
    for table in tables:
        if digest_table(source, table) != digest_table(target, table):
            raise RuntimeError(f'La verificación de {table.name} no coincide. No actives Oracle.')


def finalize(target, tables):
    from app.models.oracle import IntakeMutex, SchemaMigration
    # Oracle DDL commits implicitly. Data is already verified and committed here.
    with target.connect() as connection:
        for table in tables:
            for column in table.primary_key:
                if column.identity is not None:
                    q = connection.dialect.identifier_preparer.quote
                    connection.execute(text(f'ALTER TABLE {q(table.name)} MODIFY '
                        f'{q(column.name)} GENERATED BY DEFAULT AS IDENTITY (START WITH LIMIT VALUE)'))
        connection.commit()
    with target.begin() as connection:
        if connection.scalar(select(IntakeMutex.id).where(IntakeMutex.id == 1)) is None:
            connection.execute(IntakeMutex.__table__.insert().values(id=1))
        if connection.scalar(select(SchemaMigration.version).where(SchemaMigration.version == VERSION)) is None:
            connection.execute(SchemaMigration.__table__.insert().values(version=VERSION))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, type=Path, help='Copia SQLite descargada de Easypanel')
    parser.add_argument('--env-file', type=Path, help='Configuración privada Oracle; no se imprime')
    parser.add_argument('--apply', action='store_true', help='Importar a un esquema Oracle vacío')
    parser.add_argument('--verify-only', action='store_true', help='Comparar con Oracle sin modificar')
    parser.add_argument('--finalize', action='store_true', help='Recuperar identidades tras un fallo DDL, después de verificar')
    args = parser.parse_args()
    if sum((args.apply, args.verify_only, args.finalize)) > 1:
        parser.error('Elige una sola acción.')
    if args.env_file:
        from dotenv import load_dotenv
        if not args.env_file.is_file():
            parser.error('No existe el archivo de configuración.')
        load_dotenv(args.env_file, override=True)
    from app.core.database import Base
    import app.models
    from app.core.audit import AuditLog
    from app.core.config import settings
    from app.core.oracle_session import configure_oracle_session
    tables = Base.metadata.sorted_tables
    source_path = args.source.resolve(strict=True)
    if args.apply:
        backup = source_path.with_name(source_path.stem + '-respaldo-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%f') + '.db')
        backup_source(source_path, backup)
        source_path = backup
        print('Respaldo creado:', backup)
    source = source_engine(source_path)
    target = None
    try:
        with source.connect() as original:
            original.exec_driver_sql('BEGIN')  # Stable read snapshot, including WAL sources.
            selected, counts = inspect_source(original, tables)
            print(json.dumps({'mode': 'apply' if args.apply else 'verify' if args.verify_only else 'finalize' if args.finalize else 'dry-run', 'rows': counts}))
            if not (args.apply or args.verify_only or args.finalize):
                print('Revisión local completada. No se escribió en Oracle ni en la copia.')
                return
            if settings.DATABASE_MODE != 'oracle':
                raise RuntimeError('Se requiere DATABASE_MODE=oracle para conectar al destino.')
            target = create_engine(settings.DATABASE_URL_SYNC, connect_args=settings.database_connect_args,
                                   hide_parameters=True, pool_pre_ping=True)
            configure_oracle_session(target)
            if args.apply:
                Base.metadata.create_all(target)
                with target.begin() as destination:
                    copy_rows(original, destination, selected)
            else:
                with target.connect() as destination:
                    verify_rows(original, destination, selected)
            if args.apply or args.finalize:
                finalize(target, tables)
            print('Datos e integridad verificados. No se modificó la base de origen.')
    finally:
        source.dispose()
        if target is not None:
            target.dispose()


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        # Driver exceptions can contain connection descriptors or personal values.
        print('Migración detenida:', str(exc) if isinstance(exc, (RuntimeError, FileNotFoundError)) else type(exc).__name__, file=sys.stderr)
        sys.exit(1)
