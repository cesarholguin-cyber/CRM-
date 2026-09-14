from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum
from app.core.security import encrypt_field, decrypt_field


class LeadSource(str, enum.Enum):
    WEBSITE = "website"
    WHATSAPP = "whatsapp"
    FACEBOOK = "facebook"
    INSTAGRAM = "instagram"
    REFERRAL = "referral"
    PHONE = "phone"
    VISIT = "visit"
    OTHER = "other"


class ClientStatus(str, enum.Enum):
    LEAD = "lead"
    CONTACTED = "contacted"
    VISIT_SCHEDULED = "visit_scheduled"
    VISIT_COMPLETED = "visit_completed"
    INTERESTED = "interested"
    RESERVATION = "reservation"
    SOLD = "sold"
    LOST = "lost"


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)

    # Personal info (encrypted at rest)
    _full_name = Column("full_name", String(500), nullable=False)
    _email = Column("email", String(500), nullable=True)
    _phone = Column("phone", String(500), nullable=True)
    _address = Column("address", String(1000), nullable=True)

    # Non-sensitive
    status = Column(SAEnum(ClientStatus), default=ClientStatus.LEAD, nullable=False, index=True)
    lead_source = Column(SAEnum(LeadSource), default=LeadSource.WEBSITE)
    notes = Column(Text, nullable=True)
    budget_range = Column(String(255), nullable=True)
    preferred_lot_size = Column(Float, nullable=True)

    # Agent assignment
    assigned_agent_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    project = relationship("Project", back_populates="clients")
    assigned_agent = relationship("User", back_populates="clients")
    sales = relationship("Sale", back_populates="client")
    interactions = relationship("ClientInteraction", back_populates="client", cascade="all, delete-orphan")
    payment_plans = relationship("PaymentPlan", back_populates="client")

    # Encrypted field accessors
    @property
    def full_name(self) -> str:
        return decrypt_field(self._full_name) if self._full_name and not self._full_name.startswith("dec::") else self._full_name

    @full_name.setter
    def full_name(self, value: str):
        self._full_name = f"dec::{value}" if value else value

    @property
    def email(self) -> str | None:
        if self._email:
            if self._email.startswith("dec::"):
                return self._email[5:]
            return decrypt_field(self._email)
        return None

    @email.setter
    def email(self, value: str | None):
        self._email = f"dec::{value}" if value else None

    @property
    def phone(self) -> str | None:
        if self._phone:
            if self._phone.startswith("dec::"):
                return self._phone[5:]
            return decrypt_field(self._phone)
        return None

    @phone.setter
    def phone(self, value: str | None):
        self._phone = f"dec::{value}" if value else None

    @property
    def address(self) -> str | None:
        if self._address:
            if self._address.startswith("dec::"):
                return self._address[5:]
            return decrypt_field(self._address)
        return None

    @address.setter
    def address(self, value: str | None):
        self._address = f"dec::{value}" if value else None

    def __repr__(self):
        return f"<Client {self.id}: {self.full_name}>"


class ClientInteraction(Base):
    __tablename__ = "client_interactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    interaction_type = Column(String(50), nullable=False)  # call, email, whatsapp, visit, note
    notes = Column(Text, nullable=True)
    channel = Column(String(50), nullable=True)  # whatsapp, email, phone, in_person
    metadata_json = Column(String(2000), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    client = relationship("Client", back_populates="interactions")
