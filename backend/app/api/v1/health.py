import socket

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import get_db

router = APIRouter()


@router.get("/health")
def health(db: Session = Depends(get_db)):
    s = get_settings()
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:  # noqa: BLE001 - any DB failure must report as down
        db_ok = False
    try:
        socket.create_connection((s.mqtt_host, s.mqtt_port), timeout=1).close()
        mqtt = "ok"
    except OSError:
        mqtt = "down"
    body = {"status": "ok" if db_ok else "down", "db": "ok" if db_ok else "down", "mqtt": mqtt}
    return JSONResponse(body, status_code=200 if db_ok else 503)
