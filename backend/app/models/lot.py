from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class LotStatus(str, enum.Enum):
    AVAILABLE = "available"
    RESERVED = "reserved"
    SOLD = "sold"
    BLOCKED = "blocked"


class Lot(Base):
    __tablename__ = "lots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    lot_number = Column(Integer, nullable=False)
    block = Column(String(50), nullable=True)
    area_sqm = Column(Float, nullable=False)
    price_per_sqm = Column(Float, nullable=False, default=1000.0)
    total_price = Column(Float, nullable=False)
    status = Column(SAEnum(LotStatus), default=LotStatus.AVAILABLE, nullable=False, index=True)

    # Map / coordinates for interactive map
    map_coordinates = Column(String(500), nullable=True)  # JSON polygon points

    # Sale info
    sold_to_client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)
    sold_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    project = relationship("Project", back_populates="lots")
    sale = relationship("Sale", back_populates="lot", uselist=False)

    @property
    def display_name(self) -> str:
        if self.block:
            return f"Lote {self.lot_number} - Manzana {self.block}"
        return f"Lote {self.lot_number}"

    def __repr__(self):
        return f"<Lot {self.id}: #{self.lot_number} ({self.area_sqm}m²) - {self.status.value}>"
