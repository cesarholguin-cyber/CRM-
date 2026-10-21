"""Select the private schema explicitly; poolers may ignore startup options."""
from sqlalchemy import event


def configure_supabase_session(engine):
    if engine.dialect.name != 'postgresql':
        raise ValueError('Supabase requiere PostgreSQL.')

    @event.listens_for(engine, 'connect')
    def configure(connection, record):
        previous = connection.autocommit
        connection.autocommit = True
        cursor = connection.cursor()
        try:
            cursor.execute('SET SESSION search_path TO crm')
            cursor.execute("SET SESSION TIME ZONE 'UTC'")
        finally:
            cursor.close()
            connection.autocommit = previous
    return engine
