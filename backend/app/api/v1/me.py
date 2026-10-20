from fastapi import APIRouter, Depends

from app.core.deps import get_current_user
from app.db.models import User
from app.schemas.me import MeOut

router = APIRouter()


@router.get("/me", response_model=MeOut)
def me(user: User = Depends(get_current_user)):
    return user
