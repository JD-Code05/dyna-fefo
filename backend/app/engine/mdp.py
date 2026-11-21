"""Hold / dispatch / salvage as a Markov Decision Process, solved by value iteration.

Pure: stdlib only, no I/O. State = (remaining-life ratio on a grid, chiller condition). The chiller
condition is a two-state Markov chain (normal / warm), so the next state depends only on the current
state and action. Ageing per step uses the same Q10 `rate` as the RUL engine.
"""

from dataclasses import dataclass
from typing import Literal

from app.engine.rul import RulParams, rate

Action = Literal["HOLD", "PRIORITY_DISPATCH", "SALVAGE"]
NORMAL, WARM = 0, 1


@dataclass(frozen=True)
class MdpParams:
    # Placeholder values for the paper draft; the team still has to agree them.
    step_hours: float = 6.0
    normal_temp_c: float = 4.0
    warm_temp_c: float = 23.0  # Herron et al. (2022) abuse temperature
    p_warm: float = 0.02  # per step, normal chiller turns warm
    p_recover: float = 0.5  # per step, warm chiller returns to normal
    daily_sale_prob: float = 0.5  # chance per day the batch sells through normal FEFO
    rush_cost: float = 0.1  # priority dispatch earns 1 - rush_cost
    salvage_value: float = 0.2
    spoil_cost: float = 1.0  # spoiling in stock, or shipping with too little life left
    min_ship_hours: float = 24.0  # life a batch needs to survive transit and sale
    gamma: float = 0.99
    grid: int = 100  # ratio steps of 1%
    tol: float = 1e-9


@dataclass(frozen=True)
class MdpResult:
    policy: tuple[tuple[Action, ...], tuple[Action, ...]]  # [condition][grid index]
    value: tuple[tuple[float, ...], tuple[float, ...]]
    dispatch_ratio: tuple[float, float]  # per condition: act when ratio is below this
    salvage_ratio: tuple[float, float]  # per condition: salvage when ratio is below this
    iterations: int


def _interp(v: list[float], x: float, grid: int) -> float:
    pos = x * grid
    i = min(int(pos), grid - 1)
    return v[i] + (v[i + 1] - v[i]) * (pos - i)


def solve(rul: RulParams, m: MdpParams = MdpParams()) -> MdpResult:
    life = rul.shelf_life_ref_hours
    n = m.grid
    ratios = [i / n for i in range(n + 1)]
    sale_p = 1 - (1 - m.daily_sale_prob) ** (m.step_hours / 24)
    drop = [rate(t, rul) * m.step_hours / life for t in (m.normal_temp_c, m.warm_temp_c)]
    move = [[1 - m.p_warm, m.p_warm], [m.p_recover, 1 - m.p_recover]]  # P(next condition | condition)

    def ship(r: float, cost: float) -> float:
        return 1 - cost if r * life >= m.min_ship_hours else -m.spoil_cost

    def q_values(v: list[list[float]], i: int, k: int) -> dict[Action, float]:
        r = ratios[i]
        nxt = r - drop[k]
        if nxt <= 0:
            later = -m.spoil_cost
        else:
            later = m.gamma * sum(move[k][k2] * _interp(v[k2], nxt, n) for k2 in (NORMAL, WARM))
        return {
            "HOLD": sale_p * ship(r, 0.0) + (1 - sale_p) * later,
            "PRIORITY_DISPATCH": ship(r, m.rush_cost),
            "SALVAGE": m.salvage_value,
        }

    v = [[0.0] * (n + 1) for _ in (NORMAL, WARM)]
    iterations = 0
    while True:
        iterations += 1
        new = [[max(q_values(v, i, k).values()) for i in range(n + 1)] for k in (NORMAL, WARM)]
        delta = max(abs(a - b) for row_new, row in zip(new, v, strict=True) for a, b in zip(row_new, row, strict=True))
        v = new
        if delta < m.tol:
            break

    policy = [[_best(q_values(v, i, k)) for i in range(n + 1)] for k in (NORMAL, WARM)]
    return MdpResult(
        policy=(tuple(policy[NORMAL]), tuple(policy[WARM])),
        value=(tuple(v[NORMAL]), tuple(v[WARM])),
        dispatch_ratio=(_hold_above(policy[NORMAL], ratios), _hold_above(policy[WARM], ratios)),
        salvage_ratio=(_salvage_below(policy[NORMAL], ratios), _salvage_below(policy[WARM], ratios)),
        iterations=iterations,
    )


def _best(q: dict[Action, float]) -> Action:
    # Ties go to the least drastic action (HOLD, then dispatch, then salvage): dict order.
    return max(q, key=lambda a: q[a])


def _hold_above(policy: list[Action], ratios: list[float]) -> float:
    """Lowest ratio of the top run of HOLD: the policy acts when the ratio is below this."""
    i = len(policy) - 1
    while i >= 0 and policy[i] == "HOLD":
        i -= 1
    return ratios[i + 1] if i + 1 < len(ratios) else 1.0


def _salvage_below(policy: list[Action], ratios: list[float]) -> float:
    idx = [i for i, a in enumerate(policy) if a == "SALVAGE"]
    return ratios[min(max(idx) + 1, len(ratios) - 1)] if idx else 0.0
