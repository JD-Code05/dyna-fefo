from datetime import datetime

from pydantic import BaseModel


class AuditOut(BaseModel):
    id: int
    ts: datetime
    user: str
    action: str
    entity: str
    entity_id: str
    before: dict | None
    after: dict | None
