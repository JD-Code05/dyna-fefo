import pytest

from app.engine.recommend import Thresholds, decide

TH = Thresholds()


@pytest.mark.parametrize("rul_h,ratio,expected", [
    (0, 0.0, "SALVAGE"), (10, 0.05, "SALVAGE"), (50, 0.2, "PRIORITY_DISPATCH"), (200, 0.8, None), (120, 0.5, None)])
def test_decide(rul_h, ratio, expected):
    assert decide(rul_h, ratio, TH) == expected
