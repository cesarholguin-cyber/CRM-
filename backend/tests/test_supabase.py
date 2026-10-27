"""Private PostgreSQL configuration and lossless migration safeguards."""
from datetime import datetime, timezone
import pytest
from sqlalchemy import create_engine, select
from test_oracle import source
from app.core.database import Base
from app.core.config import Settings
from app.models import User, Sale
from app.models.document import SaleDocument
from scripts.migrate_to_supabase import inspect_source, copy_rows, verify, normalized, schema_sql


def test_supabase_engines_share_private_schema_and_require_session_key():
    values = dict(_env_file=None, DATABASE_MODE='supabase',
                  DATABASE_URL='postgresql://postgres.example:test@localhost:5432/postgres',
                  DATABASE_URL_SYNC='postgresql://wrong:wrong@elsewhere/other', SECRET_KEY='x'*40,
                  SUPABASE_URL='https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY='test-key')
    config = Settings(**values)
    assert config.DATABASE_URL == config.DATABASE_URL_SYNC
    assert config.DATABASE_URL.startswith('postgresql+psycopg://')
    assert config.database_connect_args['options'] == '-csearch_path=crm -ctimezone=UTC'
    assert config.database_connect_args['sslmode'] == 'verify-full'
    assert config.database_connect_args['sslrootcert'].endswith('supabase-prod-root-2021.crt')
    from pathlib import Path
    assert Path(config.database_connect_args['sslrootcert']).is_file()
    custom = Settings(**(values | {'DATABASE_SSL_ROOT_CERT': '/etc/ssl/custom-root.crt'}))
    assert custom.database_connect_args['sslrootcert'] == '/etc/ssl/custom-root.crt'
    with pytest.raises(ValueError, match='SECRET_KEY'):
        Settings(**(values | {'SECRET_KEY': ''}))
    with pytest.raises(ValueError, match='PostgreSQL'):
        Settings(**(values | {'DATABASE_URL': ''}))


def test_import_preserves_passwords_files_and_foreign_keys_and_refuses_overwrite(source):
    _, original = source
    target = create_engine('sqlite://')
    Base.metadata.create_all(target)
    with original.connect() as src, target.begin() as dst:
        tables = inspect_source(src, Base.metadata)
        copy_rows(src, dst, tables, Base.metadata)
        assert dst.scalar(select(User.hashed_password)) == 'unchanged-hash'
        assert dst.scalar(select(Sale.client_id)) == 12
        assert dst.scalar(select(SaleDocument.content)) == b'original archived file'
        with pytest.raises(RuntimeError, match='ya contiene datos'):
            copy_rows(src, dst, tables, Base.metadata)
        dst.execute(SaleDocument.__table__.update().values(content=b'changed'))
        with pytest.raises(RuntimeError, match='sale_documents'):
            verify(src, dst, tables, Base.metadata)
    target.dispose()


def test_inactive_only_backup_cannot_activate_a_new_database(source):
    _, original = source
    with original.begin() as src:
        src.execute(User.__table__.update().values(is_active=False))
        with pytest.raises(RuntimeError, match='usuarios activos'):
            inspect_source(src, Base.metadata)


def test_verification_preserves_empty_strings_and_normalizes_sqlite_utc():
    assert normalized('') == ''
    assert normalized(datetime(2026, 10, 21)) == normalized(datetime(2026, 10, 21, tzinfo=timezone.utc))
    assert normalized(b'abc') == normalized(memoryview(b'abc'))


def test_schema_is_private_and_keeps_partial_reservation_constraint():
    sql = schema_sql(Base.metadata)
    assert 'SET LOCAL search_path TO crm' in sql
    assert 'FROM PUBLIC, anon, authenticated' in sql
    assert 'uq_sales_active_lot ON sales' in sql
    assert 'uq_sales_active_lot_oracle' not in sql
    for table in Base.metadata.sorted_tables:
        assert f'ALTER TABLE crm."{table.name}" ENABLE ROW LEVEL SECURITY' in sql


def test_postgres_import_is_lossless_and_identity_continues_in_rollback(source):
    """Opt-in against an empty prepared schema; every fixture row is rolled back."""
    import os
    from dotenv import dotenv_values
    from sqlalchemy.engine import make_url
    from scripts.migrate_to_supabase import validate_target, finalize
    filename = os.environ.get('SUPABASE_TEST_ENV')
    if not filename:
        pytest.skip('Set SUPABASE_TEST_ENV for the rollback-only PostgreSQL check')
    config = dotenv_values(filename)
    url = make_url(config['DATABASE_URL']).set(drivername='postgresql+psycopg')
    engine = create_engine(url, hide_parameters=True, connect_args={
        'sslmode':'require', 'connect_timeout':15, 'prepare_threshold':None,
        'options':'-csearch_path=crm -ctimezone=UTC'})
    from app.core.postgres_session import configure_supabase_session
    configure_supabase_session(engine)
    _, original = source
    with original.connect() as src, engine.connect() as dst:
        transaction = dst.begin()
        try:
            validate_target(dst, Base.metadata)
            tables = inspect_source(src, Base.metadata)
            copy_rows(src, dst, tables, Base.metadata)
            finalize(dst, tables, Base.metadata)
            uid = dst.execute(User.__table__.insert().values(
                email='rollback-only@example.com', username='rollback-only', full_name='Rollback Only',
                hashed_password='test-only').returning(User.id)).scalar_one()
            assert uid > 7
            assert dst.scalar(select(SaleDocument.content)) == b'original archived file'
        finally:
            transaction.rollback()
    engine.dispose()


async def test_async_runtime_uses_private_schema_after_pool_reuse():
    import os
    from dotenv import dotenv_values
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine
    from app.core.postgres_session import configure_supabase_session
    filename = os.environ.get('SUPABASE_TEST_ENV')
    if not filename:
        pytest.skip('Set SUPABASE_TEST_ENV for PostgreSQL runtime check')
    url = dotenv_values(filename)['DATABASE_URL']
    engine = create_async_engine(url, hide_parameters=True, connect_args={
        'sslmode':'require', 'prepare_threshold':None, 'connect_timeout':15})
    configure_supabase_session(engine.sync_engine)
    try:
        for _ in range(2):
            async with engine.connect() as conn:
                assert await conn.scalar(text('select current_schema()')) == 'crm'
                assert await conn.scalar(text("select current_setting('TimeZone')")) == 'UTC'
    finally:
        await engine.dispose()
