from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import get_db
from app.services import auth

router = APIRouter()


class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=256)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str


@router.post("/auth/login", response_model=TokenOut, responses={401: {}, 423: {}})
def login(body: LoginIn, db: Session = Depends(get_db)):
    user, token = auth.login(db, body.username, body.password)
    return TokenOut(access_token=token, username=user.username, role=user.role)
