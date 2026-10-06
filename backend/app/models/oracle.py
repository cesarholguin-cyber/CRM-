from sqlalchemy import Column, Integer, String
from app.core.database import Base

class IntakeMutex(Base):
    """One row serializes public retries/contacts on Oracle without DBMS_LOCK privileges."""
    __tablename__ = "intake_mutex"
    id = Column(Integer, primary_key=True, autoincrement=False)

class SchemaMigration(Base):
    __tablename__ = "crm_schema_migrations"
    version = Column(String(80), primary_key=True)
