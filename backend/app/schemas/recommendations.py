from datetime import datetime
from typing import Literal

from pydantic import BaseModel, model_validator

from app.db.models import RecStatus, RecType


class RecommendationOut(BaseModel):
    id: int
    batch_id: int
    batch_code: str
    type: RecType
    status: RecStatus
    rationale: dict
    created_at: datetime
    decided_by: str | None
    decided_at: datetime | None
    decision_note: str | None
    handled_by: str | None
    handled_at: datetime | None
    flag_reason: Literal["not_found", "spoiled"] | None


class DecisionIn(BaseModel):
    decision: Literal["approve", "reject"]
    note: str | None = None


class TaskIn(BaseModel):
    result: Literal["done", "flagged"]
    reason: Literal["not_found", "spoiled"] | None = None

    @model_validator(mode="after")
    def reason_only_when_flagged(self) -> "TaskIn":
        if (self.result == "flagged") != (self.reason is not None):
            raise ValueError("reason is required when flagged and not allowed when done")
        return self
