from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.core.products import ProductConfig
from app.db.models import Product
from app.schemas.common import Page, PageParams

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/products", response_model=Page[ProductConfig])
def list_products(p: PageParams = Depends(), db: Session = Depends(get_db)):
    rows = db.scalars(select(Product).order_by(Product.id).limit(p.limit).offset(p.offset)).all()
    total = db.scalar(select(func.count()).select_from(Product))
    items = [ProductConfig.model_validate(r, from_attributes=True) for r in rows]
    return Page(items=items, total=total, limit=p.limit, offset=p.offset)
