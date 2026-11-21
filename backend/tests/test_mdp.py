import itertools

import pytest

from app.core.config import get_settings
from app.core.products import load_products
from app.engine.mdp import MdpParams, solve
from app.engine.rul import RulParams

CHICKEN = RulParams(shelf_life_ref_hours=168, t_ref_c=4, q10=2.97)
ORDER = {"SALVAGE": 0, "PRIORITY_DISPATCH": 1, "HOLD": 2}


def test_converges():
    assert solve(CHICKEN).iterations < 10_000


@pytest.mark.parametrize("p", load_products(get_settings().products_path).values(), ids=lambda p: p.id)
def test_policy_is_salvage_then_dispatch_then_hold(p):
    r = solve(RulParams(p.shelf_life_ref_hours, p.t_ref_c, p.q10))
    for row in r.policy:
        ranks = [ORDER[a] for a in row]
        assert ranks == sorted(ranks)  # never e.g. HOLD below a DISPATCH as life drops
        assert row[0] == "SALVAGE" and row[-1] == "HOLD"


def test_warm_chiller_acts_earlier():
    r = solve(CHICKEN)
    assert r.dispatch_ratio[1] > r.dispatch_ratio[0]


def test_salvage_line_is_min_ship_life():
    # Below min_ship_hours a shipment is unsafe, so salvage beats every other action.
    r = solve(CHICKEN, MdpParams(min_ship_hours=24))
    assert r.salvage_ratio[0] == pytest.approx(24 / 168, abs=0.011)


def test_values_bounded_by_rewards():
    r = solve(CHICKEN)
    for v in itertools.chain(*r.value):
        assert 0.2 - 1e-9 <= v <= 1.0 + 1e-9  # salvage is always available; nothing earns more than a sale
