from datetime import datetime

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

from app.db.models import BatchStatus


class BatchCreate(BaseModel):
    code: str = Field(min_length=1, max_length=32)
    product_id: str
    zone_id: str
    received_at: AwareDatetime
    printed_expiry: AwareDatetime
    quantity: int = Field(ge=0)
    notes: str | None = None


class BatchUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str | None = Field(default=None, min_length=1, max_length=32)
    product_id: str | None = None
    zone_id: str | None = None
    received_at: AwareDatetime | None = None
    printed_expiry: AwareDatetime | None = None
    quantity: int | None = Field(default=None, ge=0)
    notes: str | None = None  # the only field where an explicit null is meaningful
    status: BatchStatus | None = None

    @model_validator(mode="after")
    def _no_explicit_null(self):
        for f in self.model_fields_set - {"notes"}:
            if getattr(self, f) is None:
                raise ValueError(f"{f} cannot be null")
        return self


class BatchOut(BaseModel):
    id: int
    code: str
    product_id: str
    product_name: str
    zone_id: str
    received_at: datetime
    printed_expiry: datetime
    predicted_expiry: datetime | None
    quantity: int
    notes: str | None
    status: BatchStatus
    rul_h: float | None
    rul_ratio: float | None
    effective_age_h: float | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
