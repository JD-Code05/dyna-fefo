from datetime import datetime
from typing import Literal

from pydantic import BaseModel

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


class DecisionIn(BaseModel):
    decision: Literal["approve", "reject"]
    note: str | None = None
