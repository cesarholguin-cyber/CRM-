from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone, timedelta

from app.core.database import get_db
from app.core.audit import write_audit_log
from app.models.sale import Sale, SaleStatus, PaymentPlan, Payment
from app.models.lot import Lot, LotStatus
from app.models.client import Client
from app.schemas.sale import (
    SaleCreate, SaleUpdate, SaleResponse,
    PaymentPlanResponse, PaymentCreate, PaymentResponse,
    QuoteRequest, QuoteResponse,
)
from app.api.deps import get_current_user, get_current_superuser, get_request_info

router = APIRouter(prefix="/sales", tags=["Sales"])


@router.get("/", response_model=list[SaleResponse])
async def list_sales(
    status: str | None = None,
    agent_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Sale).order_by(Sale.created_at.desc())

    if status:
        try:
            ss = SaleStatus(status)
            query = query.where(Sale.status == ss)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status")

    if agent_id:
        query = query.where(Sale.agent_id == agent_id)

    result = await db.execute(query)
    return [SaleResponse.model_validate(s) for s in result.scalars().all()]


@router.get("/{sale_id}", response_model=SaleResponse)
async def get_sale(
    sale_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Sale).where(Sale.id == sale_id))
    sale = result.scalar_one_or_none()
    if not sale:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sale not found")
    return SaleResponse.model_validate(sale)


@router.post("/", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
async def create_sale(
    sale_data: SaleCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    # Verify lot
    result = await db.execute(select(Lot).where(Lot.id == sale_data.lot_id))
    lot = result.scalar_one_or_none()
    if not lot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lot not found")
    if lot.status != LotStatus.AVAILABLE:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Lot is already {lot.status.value}")

    # Verify client
    result = await db.execute(select(Client).where(Client.id == sale_data.client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

    # Create sale
    sale = Sale(
        client_id=sale_data.client_id,
        lot_id=sale_data.lot_id,
        agent_id=sale_data.agent_id or current_user.id,
        sale_price=sale_data.sale_price,
        down_payment=sale_data.down_payment,
        financing_amount=sale_data.financing_amount,
        interest_rate=sale_data.interest_rate,
        payment_terms_months=sale_data.payment_terms_months,
        monthly_payment=sale_data.monthly_payment,
        commission_percentage=sale_data.commission_percentage,
        status=SaleStatus.RESERVED,
        reservation_expires_at=datetime.now(timezone.utc) + timedelta(days=15),
    )

    # Calculate commission amount
    if sale.commission_percentage:
        sale.commission_amount = sale.sale_price * (sale.commission_percentage / 100)

    db.add(sale)

    # Update lot status
    lot.status = LotStatus.RESERVED
    lot.sold_to_client_id = sale_data.client_id

    # Update client status
    client.status = "reservation"

    await db.commit()
    await db.refresh(sale)

    write_audit_log(
        current_user.id, current_user.email, "SALE_CREATED", "sale", sale.id,
        new_values=sale_data.model_dump(), **get_request_info(request),
    )
    return SaleResponse.model_validate(sale)


@router.put("/{sale_id}", response_model=SaleResponse)
async def update_sale(
    sale_id: int,
    sale_data: SaleUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    result = await db.execute(select(Sale).where(Sale.id == sale_id))
    sale = result.scalar_one_or_none()
    if not sale:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sale not found")

    old_values = {}
    update_dict = sale_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        old_values[field] = getattr(sale, field)
        setattr(sale, field, value)

    # Handle status transitions
    if "status" in update_dict:
        new_status = SaleStatus(update_dict["status"])
        if new_status == SaleStatus.CONTRACT_SIGNED:
            # Update lot to sold
            result = await db.execute(select(Lot).where(Lot.id == sale.lot_id))
            lot = result.scalar_one_or_none()
            if lot:
                lot.status = LotStatus.SOLD
                lot.sold_at = datetime.now(timezone.utc)
                # Update project counters would be handled separately
        elif new_status == SaleStatus.CANCELLED:
            result = await db.execute(select(Lot).where(Lot.id == sale.lot_id))
            lot = result.scalar_one_or_none()
            if lot:
                lot.status = LotStatus.AVAILABLE
                lot.sold_to_client_id = None

    await db.commit()
    await db.refresh(sale)

    write_audit_log(
        current_user.id, current_user.email, "SALE_UPDATED", "sale", sale_id,
        old_values=old_values, new_values=update_dict, **get_request_info(request),
    )
    return SaleResponse.model_validate(sale)


@router.get("/{sale_id}/payment-plans", response_model=list[PaymentPlanResponse])
async def get_payment_plans(
    sale_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    result = await db.execute(
        select(PaymentPlan).where(PaymentPlan.sale_id == sale_id).order_by(PaymentPlan.installment_number)
    )
    return [PaymentPlanResponse.model_validate(p) for p in result.scalars().all()]


@router.post("/{sale_id}/payments", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
async def register_payment(
    sale_id: int,
    payment_data: PaymentCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    result = await db.execute(select(Sale).where(Sale.id == sale_id))
    sale = result.scalar_one_or_none()
    if not sale:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sale not found")

    payment = Payment(
        sale_id=sale_id,
        payment_plan_id=payment_data.payment_plan_id,
        amount=payment_data.amount,
        payment_method=payment_data.payment_method,
        reference_number=payment_data.reference_number,
        receipt_url=payment_data.receipt_url,
        notes=payment_data.notes,
        paid_by=payment_data.paid_by,
    )
    db.add(payment)

    # Update payment plan if specified
    if payment_data.payment_plan_id:
        result = await db.execute(
            select(PaymentPlan).where(PaymentPlan.id == payment_data.payment_plan_id)
        )
        plan = result.scalar_one_or_none()
        if plan:
            plan.paid_amount = (plan.paid_amount or 0) + payment_data.amount
            if plan.paid_amount >= plan.amount:
                plan.is_paid = True
                plan.paid_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(payment)

    write_audit_log(
        current_user.id, current_user.email, "PAYMENT_REGISTERED", "payment", payment.id,
        new_values=payment_data.model_dump(), **get_request_info(request),
    )
    return PaymentResponse.model_validate(payment)


@router.post("/quote", response_model=QuoteResponse)
async def calculate_quote(
    quote_data: QuoteRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    result = await db.execute(select(Lot).where(Lot.id == quote_data.lot_id))
    lot = result.scalar_one_or_none()
    if not lot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lot not found")

    total_price = lot.area_sqm * lot.price_per_sqm
    down_payment = total_price * (quote_data.down_payment_percentage / 100)
    financing_amount = total_price - down_payment

    # Simple interest calculation
    monthly_rate = (quote_data.interest_rate / 100) / 12
    if monthly_rate > 0 and quote_data.payment_terms_months > 0:
        monthly_payment = financing_amount * (monthly_rate * (1 + monthly_rate) ** quote_data.payment_terms_months) / \
                          ((1 + monthly_rate) ** quote_data.payment_terms_months - 1)
        total_paid = monthly_payment * quote_data.payment_terms_months
        total_interest = total_paid - financing_amount
    else:
        monthly_payment = financing_amount / quote_data.payment_terms_months if quote_data.payment_terms_months else 0
        total_interest = 0
        total_paid = financing_amount

    return QuoteResponse(
        lot_number=lot.lot_number,
        block=lot.block,
        area_sqm=lot.area_sqm,
        price_per_sqm=lot.price_per_sqm,
        total_price=round(total_price, 2),
        down_payment=round(down_payment, 2),
        down_payment_percentage=quote_data.down_payment_percentage,
        financing_amount=round(financing_amount, 2),
        interest_rate=quote_data.interest_rate,
        payment_terms_months=quote_data.payment_terms_months,
        monthly_payment=round(monthly_payment, 2),
        total_interest=round(total_interest, 2),
        total_to_pay=round(total_paid + down_payment, 2),
    )
