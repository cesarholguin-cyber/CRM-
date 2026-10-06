from sqlalchemy.dialects.oracle import TIMESTAMP
from sqlalchemy import Identity
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, LargeBinary
from sqlalchemy.orm import deferred
from app.core.database import Base


class SaleDocument(Base):
    """One archived file per sale; the client is resolved through the sale itself."""
    __tablename__ = "sale_documents"
    id = Column(Integer, Identity(), primary_key=True, autoincrement=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False, index=True)
    category = Column(String(40), nullable=False)
    filename = Column(String(255), nullable=False)
    content_type = Column(String(120), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    sha256 = Column(String(64), nullable=False)
    description = Column(Text, nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True).with_variant(TIMESTAMP(timezone=True), "oracle"), default=lambda: datetime.now(timezone.utc), nullable=False)
    # Stored with the existing database, not in ephemeral container storage or public assets.
    content = deferred(Column(LargeBinary, nullable=False))


class DocumentObject(Base):
    """Optional location: absent means the original bytes are still in the database.

    Separate table avoids rewriting or dropping the existing document archive.
    """
    __tablename__ = 'document_objects'
    document_id = Column(Integer, ForeignKey('sale_documents.id'), primary_key=True, autoincrement=False)
    namespace = Column(String(255), nullable=False)
    bucket = Column(String(255), nullable=False)
    object_key = Column(String(500), nullable=False, unique=True)
