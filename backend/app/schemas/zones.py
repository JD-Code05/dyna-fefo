from datetime import datetime

from pydantic import BaseModel


class Latest(BaseModel):
    ts: datetime
    temperature_c: float
    humidity_pct: float
    danger: bool


class ZoneOut(BaseModel):
    id: str
    name: str
    latest: Latest | None
