from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class Thresholds:
    salvage_ratio: float = 0.10
    dispatch_ratio: float = 0.50


def decide(rul_h: float, rul_ratio: float, th: Thresholds) -> Literal["SALVAGE", "PRIORITY_DISPATCH"] | None:
    if rul_h <= 0 or rul_ratio < th.salvage_ratio:
        return "SALVAGE"
    if rul_ratio < th.dispatch_ratio:
        return "PRIORITY_DISPATCH"
    return None
