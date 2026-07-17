from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.audit import write_audit_log
from app.models.project import Project, ProjectStatus
from app.models.lot import Lot, LotStatus
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse
from app.schemas.lot import LotResponse
from app.api.deps import get_current_user, get_current_superuser, get_request_info, role_required
from app.models.user import UserRole

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("/", response_model=list[ProjectResponse])
async def list_projects(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Project).order_by(Project.name))
    return [ProjectResponse.model_validate(p) for p in result.scalars().all()]


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return ProjectResponse.model_validate(project)


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_superuser),
):
    # Check slug uniqueness
    result = await db.execute(select(Project).where(Project.slug == project_data.slug))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slug already exists")

    project = Project(**project_data.model_dump())
    db.add(project)
    await db.commit()
    await db.refresh(project)

    write_audit_log(
        current_user.id, current_user.email, "PROJECT_CREATED", "project", project.id,
        new_values=project_data.model_dump(), **get_request_info(request),
    )
    return ProjectResponse.model_validate(project)


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    project_data: ProjectUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_superuser),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    old_values = {}
    for field, value in project_data.model_dump(exclude_unset=True).items():
        old_values[field] = getattr(project, field)
        setattr(project, field, value)
    await db.commit()
    await db.refresh(project)

    write_audit_log(
        current_user.id, current_user.email, "PROJECT_UPDATED", "project", project_id,
        old_values=old_values, new_values=project_data.model_dump(exclude_unset=True),
        **get_request_info(request),
    )
    return ProjectResponse.model_validate(project)


@router.delete("/{project_id}")
async def delete_project(
    project_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_superuser),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    await db.delete(project)
    await db.commit()

    write_audit_log(
        current_user.id, current_user.email, "PROJECT_DELETED", "project", project_id,
        **get_request_info(request),
    )
    return {"message": "Project deleted successfully"}


@router.get("/{project_id}/lots", response_model=list[LotResponse])
async def get_project_lots(
    project_id: int,
    status_filter: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Lot).where(Lot.project_id == project_id).order_by(Lot.block, Lot.lot_number)
    if status_filter:
        try:
            ls = LotStatus(status_filter)
            query = query.where(Lot.status == ls)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid status: {status_filter}")

    result = await db.execute(query)
    return [LotResponse.model_validate(l) for l in result.scalars().all()]
