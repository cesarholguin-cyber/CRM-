from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, BigInteger
from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    user_id = Column(Integer, nullable=True)
    username = Column(String(100), nullable=True)
    action = Column(String(50), nullable=False, index=True)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    details = Column(JSON, nullable=True)
    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)


# Synchronous audit writer for use within async contexts
from sqlalchemy import create_engine
from app.core.config import settings

_sync_engine = create_engine(settings.DATABASE_URL_SYNC, pool_pre_ping=True)


def write_audit_log(
    user_id: int | None,
    username: str | None,
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    details: dict | None = None,
    old_values: dict | None = None,
    new_values: dict | None = None,
):
    from sqlalchemy.orm import Session
    with Session(_sync_engine) as session:
        log = AuditLog(
            user_id=user_id,
            username=username,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            ip_address=ip_address,
            user_agent=user_agent,
            details=details,
            old_values=old_values,
            new_values=new_values,
        )
        session.add(log)
        session.commit()
