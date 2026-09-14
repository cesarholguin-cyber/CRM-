from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.core.database import get_db
from app.core.audit import write_audit_log
from app.models.client import Client, ClientStatus, ClientInteraction
from app.models.user import User
from app.schemas.client import (
    ClientCreate, ClientUpdate, ClientResponse,
    InteractionCreate, InteractionResponse,
)
from app.api.deps import get_current_user, get_current_admin, get_request_info

router = APIRouter(prefix="/clients", tags=["Clients"])


@router.get("/", response_model=list[ClientResponse])
async def list_clients(
    search: str | None = Query(None),
    status: str | None = Query(None),
    agent_id: int | None = Query(None),
    project_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(Client).order_by(Client.created_at.desc())

    if status:
        try:
            cs = ClientStatus(status)
            query = query.where(Client.status == cs)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status")

    if agent_id:
        query = query.where(Client.assigned_agent_id == agent_id)

    if project_id:
        query = query.where(Client.project_id == project_id)

    if search:
        query = query.where(
            or_(
                Client.notes.ilike(f"%{search}%"),
                Client._email.ilike(f"%{search}%"),
            )
        )

    result = await db.execute(query)
    return [ClientResponse.model_validate(c) for c in result.scalars().all()]


@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(
    client_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

    return ClientResponse.model_validate(client)


@router.post("/", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
async def create_client(
    client_data: ClientCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    client = Client(
        project_id=client_data.project_id,
        full_name=client_data.full_name,
        email=client_data.email,
        phone=client_data.phone,
        address=client_data.address,
        status=client_data.status,
        lead_source=client_data.lead_source,
        notes=client_data.notes,
        budget_range=client_data.budget_range,
        preferred_lot_size=client_data.preferred_lot_size,
        assigned_agent_id=client_data.assigned_agent_id or current_user.id,
    )
    db.add(client)
    await db.commit()
    await db.refresh(client)

    write_audit_log(
        current_user.id, current_user.email, "CLIENT_CREATED", "client", client.id,
        new_values=client_data.model_dump(exclude_none=True), **get_request_info(request),
    )
    return ClientResponse.model_validate(client)


@router.put("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: int,
    client_data: ClientUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

    old_values = {}
    update_dict = client_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        old_values[field] = getattr(client, field)
        setattr(client, field, value)

    await db.commit()
    await db.refresh(client)

    write_audit_log(
        current_user.id, current_user.email, "CLIENT_UPDATED", "client", client_id,
        old_values=old_values, new_values=update_dict, **get_request_info(request),
    )
    return ClientResponse.model_validate(client)


@router.delete("/{client_id}")
async def delete_client(
    client_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_admin),
):
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

    await db.delete(client)
    await db.commit()

    write_audit_log(
        current_user.id, current_user.email, "CLIENT_DELETED", "client", client_id,
        **get_request_info(request),
    )
    return {"message": "Client deleted"}


@router.post("/{client_id}/interactions", response_model=InteractionResponse, status_code=status.HTTP_201_CREATED)
async def add_interaction(
    client_id: int,
    interaction_data: InteractionCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

    interaction = ClientInteraction(
        client_id=client_id,
        user_id=current_user.id,
        interaction_type=interaction_data.interaction_type,
        notes=interaction_data.notes,
        channel=interaction_data.channel,
        metadata_json=interaction_data.metadata_json,
    )
    db.add(interaction)
    await db.commit()
    await db.refresh(interaction)
    return InteractionResponse.model_validate(interaction)


@router.get("/{client_id}/interactions", response_model=list[InteractionResponse])
async def get_interactions(
    client_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    result = await db.execute(
        select(ClientInteraction)
        .where(ClientInteraction.client_id == client_id)
        .order_by(ClientInteraction.created_at.desc())
    )
    return [InteractionResponse.model_validate(i) for i in result.scalars().all()]
