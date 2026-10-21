from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Identity
from app.core.database import Base


class Tutorial(Base):
    __tablename__ = 'tutorials'
    id = Column(Integer, Identity(), primary_key=True)
    title = Column(String(160), nullable=False)
    description = Column(Text, nullable=False, default='')
    object_path = Column(String(255), nullable=False, unique=True)
    content_type = Column(String(40), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    uploaded_by = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
