"""Landing intake. Uses existing interactions and sales; no client data in public reads."""
import hashlib
import json
import re
from datetime import date, datetime, timedelta, timezone
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator
from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.api.deps import get_current_user, get_request_info
from app.core.audit import write_audit_log
from app.services.reservation_actions import lock_lot, change_sale_status, recount_project, INACTIVE
from app.core.database import get_db
from app.core.config import settings
from app.models.client import Client, ClientInteraction, ClientStatus
from app.models.lot import Lot, LotStatus
from app.models.project import Project
from app.models.sale import Sale, SaleStatus

public_router = APIRouter(prefix="/public", tags=["Public"])
router = APIRouter(prefix="/web-requests", tags=["Website requests"], dependencies=[Depends(get_current_user)])
limiter = Limiter(key_func=get_remote_address)


def normalize_block(value):
    value = str(value or "").strip().upper()
    return 'M' + str(int(re.sub(r'^M(?:Z)?\s*', '', value))) if re.fullmatch(r'(?:M(?:Z)?\s*)?\d+', value) else value


class WebsiteRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    request_id: UUID
    kind: Literal['reservation', 'visit', 'information']
    project_slug: Literal['floresta-campestre', 'campestre-el-triunfo']
    block: str | None = Field(default=None, max_length=50)
    lot_number: int | None = Field(default=None, gt=0)
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=30)
    preferred_date: date | None = None
    preferred_time: Literal['Por coordinar', 'Por la mañana', 'Por la tarde'] = 'Por coordinar'
    message: str = Field(default='', max_length=1500)

    @model_validator(mode='after')
    def validate_request(self):
        self.phone = re.sub(r'\D', '', self.phone or '') or None
        if self.phone and not 10 <= len(self.phone) <= 15:
            raise ValueError('Escribe un teléfono de 10 a 15 dígitos.')
        if not self.email and not self.phone:
            raise ValueError('Se necesita un correo o teléfono de contacto.')
        if self.email:
            self.email = self.email.lower()
        self.block = normalize_block(self.block) or None
        if bool(self.block) != bool(self.lot_number):
            raise ValueError('Indica tanto manzana como lote.')
        if self.kind == 'reservation' and not self.lot_number:
            raise ValueError('Selecciona el lote que deseas apartar.')
        if self.kind == 'visit' and not self.preferred_date:
            raise ValueError('Elige la fecha de tu visita.')
        return self


async def lock_key(db, key):
    # Transaction locks also work with Supabase transaction pooling. Row locks
    # protect inventory; this lock serializes retries and matching contacts.
    if db.bind.dialect.name == 'sqlite' and not db.in_transaction():
        await db.execute(text('BEGIN IMMEDIATE'))
    if db.bind.dialect.name == 'postgresql':
        lock_id = int.from_bytes(hashlib.sha256(key.encode()).digest()[:8], 'big', signed=True)
        await db.execute(text('SELECT pg_advisory_xact_lock(:key)'), {'key': lock_id})


def metadata(interaction):
    try:
        return json.loads(interaction.metadata_json or '{}')
    except (ValueError, TypeError):
        return {}


def receipt(interaction, data):
    reserved = data['kind'] == 'reservation'
    return {'success': True, 'reference': f'WEB-{interaction.id}', 'kind': data['kind'],
            'message': 'Tu apartado quedó registrado. Un asesor te contactará para formalizarlo.' if reserved else 'Tu solicitud llegó al equipo. Un asesor confirmará contigo los detalles.',
            'expires_at': data.get('expires_at')}


@public_router.get('/config')
def public_config():
    return {'test_mode': settings.DATABASE_MODE == 'embedded'}


@public_router.get('/catalog/{slug}')
async def catalog(slug: str, db: AsyncSession = Depends(get_db)):
    project = (await db.execute(select(Project).where(Project.slug == slug))).scalar_one_or_none()
    if not project:
        raise HTTPException(404, 'Desarrollo no encontrado.')
    lots = (await db.execute(select(Lot).where(Lot.project_id == project.id))).scalars().all()
    return {'project_slug': slug, 'lots': [
        {'block': normalize_block(l.block), 'lot_number': l.lot_number, 'status': l.status.value,
         'area_sqm': l.area_sqm, 'price_per_sqm': l.price_per_sqm, 'total_price': round(l.area_sqm * l.price_per_sqm, 2)}
        for l in lots if l.block
    ]}


@public_router.post('/requests')
@limiter.limit('10/minute')
async def submit_request(request: Request, data: WebsiteRequest, db: AsyncSession = Depends(get_db)):
    channel = 'web:' + str(data.request_id)
    fingerprint = hashlib.sha256(data.model_dump_json(exclude={'request_id'}).encode()).hexdigest()
    await lock_key(db, channel)
    existing = (await db.execute(select(ClientInteraction).where(ClientInteraction.channel == channel))).scalar_one_or_none()
    if existing:
        saved = metadata(existing)
        if saved.get('fingerprint') != fingerprint:
            raise HTTPException(409, 'Esta solicitud ya fue enviada con otros datos. Inicia una nueva solicitud.')
        return receipt(existing, saved)
    if data.kind == 'visit' and data.preferred_date < datetime.now(ZoneInfo('America/Hermosillo')).date():
        raise HTTPException(422, 'La fecha de visita no puede estar en el pasado.')
    project = (await db.execute(select(Project).where(Project.slug == data.project_slug))).scalar_one_or_none()
    if not project:
        raise HTTPException(503, 'Este desarrollo todavía no recibe solicitudes en línea. Contacta al asesor.')
    lot = None
    if data.lot_number:
        candidates = (await db.execute(select(Lot).where(
            Lot.project_id == project.id, Lot.lot_number == data.lot_number
        ).with_for_update())).scalars().all()
        matches = [l for l in candidates if normalize_block(l.block) == data.block]
        if len(matches) != 1:
            raise HTTPException(409, 'No pudimos vincular esta manzana y lote. Contacta al asesor.')
        lot = matches[0]
        if data.kind == 'reservation' and lot.status != LotStatus.AVAILABLE:
            raise HTTPException(409, 'Este lote ya no está disponible para apartar. Elige otro terreno.')
    contact = ('email:' + data.email) if data.email else ('phone:' + data.phone)
    await lock_key(db, contact)
    # Existing setters store dec:: values. Do not compare plain email against storage,
    # and never match NULL emails (that would join unrelated phone-only clients).
    criterion = Client._email == 'dec::' + data.email if data.email else Client._phone == 'dec::' + data.phone
    client = (await db.execute(select(Client).where(criterion).order_by(Client.id))).scalars().first()
    if not client:
        client = Client(full_name=data.full_name, email=data.email, phone=data.phone,
                        project_id=project.id, status=ClientStatus.RESERVATION if data.kind == 'reservation' else ClientStatus.LEAD,
                        lead_source='website', notes='Solicitud recibida desde la landing page.')
        db.add(client)
        await db.flush()
    sale = None
    if data.kind == 'reservation':
        price = round(lot.area_sqm * lot.price_per_sqm, 2)
        # Terms from the supplied Floresta plan; other developments keep CRM terms.
        down = min(15000, price) if data.project_slug == 'floresta-campestre' else round(price * .30, 2)
        amount = price - down
        rate, months = .0141033227511898, 144
        sale = Sale(client_id=client.id, lot_id=lot.id, sale_price=price, down_payment=down,
                    financing_amount=amount, interest_rate=rate * 12 * 100, payment_terms_months=months,
                    monthly_payment=round(amount * rate / (1 - (1 + rate) ** -months), 2),
                    status=SaleStatus.RESERVED, reservation_expires_at=datetime.now(timezone.utc) + timedelta(days=15),
                    notes=f'Apartado web: {data.block} · lote {data.lot_number}. {data.message}')
        db.add(sale)
        lot.status = LotStatus.RESERVED
        lot.sold_to_client_id = client.id
        client.status = ClientStatus.RESERVATION
        await db.flush()
    saved = {'kind': data.kind, 'fingerprint': fingerprint, 'project_slug': data.project_slug,
             'project_name': project.name, 'block': data.block, 'lot_number': data.lot_number,
             'lot_id': lot.id if lot else None, 'sale_id': sale.id if sale else None,
             'preferred_date': data.preferred_date.isoformat() if data.preferred_date else None,
             'preferred_time': data.preferred_time, 'status': 'pending',
             'full_name': data.full_name, 'email': data.email, 'phone': data.phone,
             'expires_at': sale.reservation_expires_at.isoformat() if sale else None}
    interaction = ClientInteraction(client_id=client.id, interaction_type='web_request',
                                    channel=channel, notes=data.message, metadata_json=json.dumps(saved, ensure_ascii=False))
    db.add(interaction)
    await db.commit()
    await db.refresh(interaction)
    return receipt(interaction, saved)


@router.get('')
async def list_requests(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(ClientInteraction).where(
        ClientInteraction.interaction_type == 'web_request').order_by(ClientInteraction.created_at.desc()))).scalars().all()
    sale_ids = [metadata(row).get('sale_id') for row in rows if metadata(row).get('sale_id')]
    sales = {sale.id: sale for sale in (await db.execute(select(Sale).where(Sale.id.in_(sale_ids)))).scalars()} if sale_ids else {}
    result = []
    for row in rows:
        saved = {k:v for k,v in metadata(row).items() if k != 'fingerprint'}
        sale = sales.get(saved.get('sale_id'))
        if sale:
            saved['sale_status'] = sale.status.value
            if sale.status in INACTIVE:
                saved['status'] = 'cancelled'
            elif sale.status == SaleStatus.PAID:
                saved['status'] = 'sold'
        result.append(dict(saved, id=row.id, reference=f'WEB-{row.id}', client_id=row.client_id,
                           message=row.notes, created_at=row.created_at.replace(tzinfo=timezone.utc) if row.created_at.tzinfo is None else row.created_at))
    return result


class RequestUpdate(BaseModel):
    status: Literal['pending', 'contacted', 'confirmed', 'completed', 'cancelled']


@router.patch('/{request_id}')
async def update_request(request_id: int, data: RequestUpdate, db: AsyncSession = Depends(get_db)):
    if db.bind.dialect.name == 'sqlite':
        await db.execute(update(ClientInteraction).where(ClientInteraction.id == request_id)
                         .values(id=ClientInteraction.id))
    row = (await db.execute(select(ClientInteraction).where(
        ClientInteraction.id == request_id, ClientInteraction.interaction_type == 'web_request').with_for_update())).scalar_one_or_none()
    if not row:
        raise HTTPException(404, 'Solicitud no encontrada.')
    saved = metadata(row)
    if saved.get('kind') == 'reservation':
        raise HTTPException(409, 'Gestiona el apartado desde sus acciones de venta o cancelación.')
    if saved.get('sale_id'):
        raise HTTPException(409, 'Esta solicitud ya tiene una venta vinculada. Usa sus acciones para cambiar el estado.')
    if saved.get('status') in ('cancelled', 'sold') and data.status != saved.get('status'):
        raise HTTPException(409, 'Esta solicitud ya está cerrada.')
    saved['status'] = data.status
    row.metadata_json = json.dumps(saved, ensure_ascii=False)
    await db.commit()
    return {'success': True, 'status': data.status}


class RequestAction(BaseModel):
    action: Literal['sale', 'sold', 'cancel']


@router.post('/{request_id}/actions')
async def request_action(request_id: int, data: RequestAction, request: Request,
                         db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    if db.bind.dialect.name == 'sqlite':
        await db.execute(update(ClientInteraction).where(ClientInteraction.id == request_id)
                         .values(id=ClientInteraction.id))
    row = (await db.execute(select(ClientInteraction).where(
        ClientInteraction.id == request_id, ClientInteraction.interaction_type == 'web_request')
        .with_for_update().execution_options(populate_existing=True))).scalar_one_or_none()
    if not row:
        raise HTTPException(404, 'Solicitud no encontrada.')
    saved = metadata(row)
    if saved.get('kind') == 'reservation':
        raise HTTPException(409, 'Gestiona este apartado desde el registro del lote.')
    sale = None
    lot = None
    if saved.get('lot_id'):
        lot = await lock_lot(db, saved['lot_id'])
    if saved.get('sale_id'):
        sale = (await db.execute(select(Sale).where(Sale.id == saved['sale_id']).with_for_update()
                                .execution_options(populate_existing=True))).scalar_one_or_none()
        if not sale or sale.client_id != row.client_id or not lot or sale.lot_id != lot.id:
            raise HTTPException(409, 'No pudimos verificar la venta vinculada.')
    if data.action == 'cancel':
        if saved.get('status') == 'sold':
            raise HTTPException(409, 'La solicitud ya corresponde a un lote vendido.')
        if sale:
            await change_sale_status(db, sale, lot, SaleStatus.CANCELLED)
        # An unconverted visit never owned the inventory; cancelling it must
        # leave another client's reservation, a sold lot or a block unchanged.
        saved['status'] = 'cancelled'
    else:
        if saved.get('status') == 'cancelled' or (sale and sale.status in INACTIVE):
            raise HTTPException(409, 'Esta solicitud está cancelada. Registra una nueva solicitud.')
        if not lot:
            raise HTTPException(409, 'La solicitud no tiene un lote seleccionado. Registra la venta desde Ventas.')
        if not sale:
            active_sale = await db.scalar(select(Sale.id).where(Sale.lot_id == lot.id, Sale.status.notin_(INACTIVE)).limit(1))
            if lot.status != LotStatus.AVAILABLE or active_sale:
                raise HTTPException(409, 'El lote ya no está disponible. Revisa el apartado o venta existente.')
            price = round(lot.area_sqm * lot.price_per_sqm, 2)
            down = min(15000, price) if saved.get('project_slug') == 'floresta-campestre' else round(price * .3, 2)
            rate, months = .0141033227511898, 144
            sale = Sale(client_id=row.client_id, lot_id=lot.id, agent_id=current_user.id,
                        sale_price=price, down_payment=down, financing_amount=price-down,
                        interest_rate=rate*1200, payment_terms_months=months,
                        monthly_payment=round((price-down)*rate/(1-(1+rate)**-months), 2),
                        status=SaleStatus.RESERVED, reservation_expires_at=datetime.now(timezone.utc)+timedelta(days=15),
                        notes=f'Originada desde WEB-{row.id}. {row.notes or ""}')
            db.add(sale)
            lot.status = LotStatus.RESERVED
            lot.sold_to_client_id = row.client_id
            await db.flush()
            saved['sale_id'] = sale.id
            client = await db.get(Client, row.client_id)
            client.status = ClientStatus.RESERVATION
            await recount_project(db, lot.project_id)
        if data.action == 'sold':
            await change_sale_status(db, sale, lot, SaleStatus.PAID)
            saved['status'] = 'sold'
        else:
            saved['status'] = 'sold' if sale.status == SaleStatus.PAID else 'sale'
    row.metadata_json = json.dumps(saved, ensure_ascii=False)
    await db.commit()
    write_audit_log(current_user.id, current_user.email, 'WEB_REQUEST_ACTION', 'client_interaction', row.id,
                    new_values={'action': data.action, 'sale_id': saved.get('sale_id')}, **get_request_info(request))
    return {'success': True, 'status': saved['status'], 'sale_id': saved.get('sale_id'),
            'lot_status': lot.status.value if lot else None}
