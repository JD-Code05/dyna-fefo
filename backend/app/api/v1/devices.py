from fastapi import APIRouter, Depends, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_role
from app.db.models import Device, Role, User
from app.schemas.common import Page, PageParams
from app.schemas.devices import DeviceCreate, DeviceCreated, DeviceOut, DeviceUpdate
from app.services import devices as svc

router = APIRouter(dependencies=[Depends(get_current_user)])
supervisor = require_role(Role.supervisor)


@router.get("/devices", response_model=Page[DeviceOut])
def list_devices(include_deleted: bool = False, p: PageParams = Depends(), db: Session = Depends(get_db)):
    q = select(Device)
    if not include_deleted:
        q = q.where(Device.deleted_at.is_(None))
    total = db.scalar(select(func.count()).select_from(q.subquery()))
    items = db.scalars(q.order_by(Device.id).limit(p.limit).offset(p.offset)).all()
    return Page(items=items, total=total, limit=p.limit, offset=p.offset)


@router.post("/devices", response_model=DeviceCreated, status_code=201)
def create_device(body: DeviceCreate, db: Session = Depends(get_db), user: User = Depends(supervisor)):
    dev, key = svc.create_device(db, user, body)
    return DeviceCreated(**DeviceOut.model_validate(dev, from_attributes=True).model_dump(), api_key=key)


@router.patch("/devices/{device_id}", response_model=DeviceOut)
def update_device(device_id: str, body: DeviceUpdate, db: Session = Depends(get_db), user: User = Depends(supervisor)):
    return svc.update_device(db, user, device_id, body)


@router.delete("/devices/{device_id}", status_code=204)
def delete_device(device_id: str, db: Session = Depends(get_db), user: User = Depends(supervisor)):
    svc.delete_device(db, user, device_id)
    return Response(status_code=204)
