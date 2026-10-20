import socket

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import get_db

router = APIRouter()


@router.get("/health")
def health(db: Session = Depends(get_db)):
    s = get_settings()
    db.execute(text("SELECT 1"))
    try:
        socket.create_connection((s.mqtt_host, s.mqtt_port), timeout=1).close()
        mqtt = "ok"
    except OSError:
        mqtt = "down"
    return {"status": "ok", "db": "ok", "mqtt": mqtt}
