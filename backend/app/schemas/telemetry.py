from datetime import UTC, datetime, timedelta

from pydantic import AwareDatetime, BaseModel, Field, field_validator

from app.core.config import get_settings


class TelemetryIn(BaseModel):
    device_id: str
    zone_id: str
    ts: AwareDatetime
    temperature_c: float = Field(ge=-40, le=60)
    humidity_pct: float = Field(ge=0, le=100)
    seq: int = Field(ge=0)

    @field_validator("ts")
    @classmethod
    def not_future(cls, v: datetime) -> datetime:
        if not get_settings().sim_mode and v > datetime.now(UTC) + timedelta(minutes=5):
            raise ValueError("ts is more than 5 minutes in the future")
        return v


class StoredOut(BaseModel):
    stored: bool


class Point(BaseModel):
    ts: datetime
    temperature_c: float
    humidity_pct: float


class HistoryOut(BaseModel):
    zone_id: str
    points: list[Point]
