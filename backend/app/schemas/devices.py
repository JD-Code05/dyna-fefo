from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class DeviceCreate(BaseModel):
    id: str = Field(pattern=r"^[a-z0-9-]{3,64}$")
    name: str
    zone_id: str


class DeviceUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = None
    zone_id: str | None = None

    @model_validator(mode="after")
    def _no_explicit_null(self):
        for f in self.model_fields_set:
            if getattr(self, f) is None:
                raise ValueError(f"{f} cannot be null")
        return self


class DeviceOut(BaseModel):
    id: str
    name: str
    zone_id: str
    created_at: datetime
    deleted_at: datetime | None


class DeviceCreated(DeviceOut):
    api_key: str
