from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime, Enum as SAEnum
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class ProjectStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    PAUSED = "paused"
    CANCELLED = "cancelled"


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    location = Column(String(500), nullable=True)
    city = Column(String(255), nullable=True)
    state = Column(String(255), nullable=True)
    country = Column(String(100), default="México")

    # Pricing
    price_per_sqm = Column(Float, nullable=False, default=1000.0)

    # Stats
    total_lots = Column(Integer, nullable=False, default=0)
    available_lots = Column(Integer, nullable=False, default=0)
    sold_lots = Column(Integer, nullable=False, default=0)

    status = Column(SAEnum(ProjectStatus), default=ProjectStatus.ACTIVE)

    # Media
    cover_image_url = Column(String(500), nullable=True)
    gallery = Column(String(2000), nullable=True)  # JSON array of URLs

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    lots = relationship("Lot", back_populates="project", cascade="all, delete-orphan")
    clients = relationship("Client", back_populates="project")

    def __repr__(self):
        return f"<Project {self.id}: {self.name}>"
