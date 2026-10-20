from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DeviceCreate(BaseModel):
    id: str = Field(pattern=r"^[a-z0-9-]{3,64}$")
    name: str
    zone_id: str


class DeviceUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = None
    zone_id: str | None = None


class DeviceOut(BaseModel):
    id: str
    name: str
    zone_id: str
    created_at: datetime
    deleted_at: datetime | None


class DeviceCreated(DeviceOut):
    api_key: str
