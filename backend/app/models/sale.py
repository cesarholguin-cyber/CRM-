from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class SaleStatus(str, enum.Enum):
    RESERVED = "reserved"
    OPTION_SIGNED = "option_signed"
    CONTRACT_SIGNED = "contract_signed"
    FINANCING = "financing"
    PAID = "paid"
    CANCELLED = "cancelled"
    REVERSED = "reversed"


class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False, index=True)
    lot_id = Column(Integer, ForeignKey("lots.id"), nullable=False, unique=True, index=True)
    agent_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Sale details
    sale_price = Column(Float, nullable=False)
    down_payment = Column(Float, nullable=False, default=0)
    financing_amount = Column(Float, nullable=False, default=0)
    interest_rate = Column(Float, nullable=True)  # annual %
    payment_terms_months = Column(Integer, nullable=True)
    monthly_payment = Column(Float, nullable=True)

    status = Column(SAEnum(SaleStatus), default=SaleStatus.RESERVED, nullable=False)
    notes = Column(Text, nullable=True)

    # Reservation expiry
    reservation_expires_at = Column(DateTime(timezone=True), nullable=True)

    # Commission
    commission_percentage = Column(Float, nullable=True)
    commission_amount = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    closed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    client = relationship("Client", back_populates="sales")
    lot = relationship("Lot", back_populates="sale")
    agent = relationship("User", back_populates="sales")
    payment_plans = relationship("PaymentPlan", back_populates="sale", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="sale", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Sale {self.id}: Lot {self.lot_id} - ${self.sale_price:,.2f}>"


class PaymentPlan(Base):
    __tablename__ = "payment_plans"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False, index=True)
    installment_number = Column(Integer, nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=False)
    amount = Column(Float, nullable=False)
    paid_amount = Column(Float, nullable=True, default=0)
    is_paid = Column(Boolean, default=False)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    late_fee = Column(Float, nullable=True, default=0)
    notes = Column(String(500), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    sale = relationship("Sale", back_populates="payment_plans")
    client = relationship("Client", back_populates="payment_plans")

    def __repr__(self):
        return f"<PaymentPlan {self.id}: #{self.installment_number} - ${self.amount:,.2f} due {self.due_date.strftime('%Y-%m-%d')}>"


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False, index=True)
    payment_plan_id = Column(Integer, ForeignKey("payment_plans.id"), nullable=True)
    amount = Column(Float, nullable=False)
    payment_method = Column(String(50), nullable=True)  # cash, transfer, check, card
    reference_number = Column(String(255), nullable=True)
    receipt_url = Column(String(500), nullable=True)
    notes = Column(String(500), nullable=True)
    paid_by = Column(String(255), nullable=True)  # who made the payment

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    sale = relationship("Sale", back_populates="payments")
