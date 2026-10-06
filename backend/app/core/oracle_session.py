"""Use UTC for Oracle sessions, including naive timestamps imported from SQLite."""
from sqlalchemy import event


def configure_oracle_session(engine):
    if engine.dialect.name == 'oracle':
        @event.listens_for(engine, 'connect')
        def set_timezone(connection, record):
            cursor = connection.cursor()
            try:
                cursor.execute("ALTER SESSION SET TIME_ZONE = '+00:00'")
            finally:
                cursor.close()
    return engine
