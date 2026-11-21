"""Seeded comparison of static printed-date FEFO vs the dynamic system (paper Algorithm 5).

Simulation only: a batch's "true" life is the same Q10 model fed its chiller's full temperature history,
so this measures the value of acting on sensor data, given the calibrated model. Not a field trial.

    python scripts/evaluate.py --runs 50 --csv evaluation.csv
"""

import argparse
import csv
import random
import statistics
import sys
from dataclasses import dataclass
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
from app.engine.mdp import MdpParams, solve
from app.engine.rul import RulParams, rate

SETPOINT_C = {"chicken-breast": 2.0, "fresh-milk": 3.5, "tomato-dish": 3.0}  # seed layout, README
CHILLERS_PER_PRODUCT = 2  # two rooms per product, so batches of one product see different temperatures
MIN_SHIP_H = MdpParams().min_ship_hours  # shipped with less true life than this = food-safety risk
POLICIES = ("static", "dynamic", "dynamic_mdp")
METRICS = ("arrived", "shipped_safe", "shipped_unsafe", "discarded_at_label", "spoiled_in_stock", "salvaged")


@dataclass
class Batch:
    chiller: int
    qty: int
    received_h: int
    label_h: float
    age_h: float = 0.0


def temperatures(rng: random.Random, hours: int, setpoint: float) -> list[float]:
    """Hourly temperatures: setpoint + noise, door openings, compressor failures, Herron abuse days."""
    temps: list[float] = []
    herron_left = fail_left = fail_elapsed = 0
    for h in range(hours):
        if h % 24 == 0 and not herron_left and not fail_left and rng.random() < 0.05:
            herron_left = 24
        if not herron_left and not fail_left and rng.random() < 0.003:
            fail_left, fail_elapsed = rng.randint(6, 18), 0
        if herron_left:  # Herron et al. (2022): 2 h at 4 C, 2 h at 23 C
            t = 4.0 if ((24 - herron_left) // 2) % 2 == 0 else 23.0
            herron_left -= 1
        elif fail_left:  # compressor failure: climbs ~3 C per hour towards ambient
            fail_elapsed += 1
            t = min(25.0, setpoint + 3.0 * fail_elapsed)
            fail_left -= 1
        elif rng.random() < 0.02:  # door left open for an hour
            t = rng.uniform(10, 15)
        else:
            t = setpoint + rng.gauss(0, 0.3)
        temps.append(t)
    return temps


def make_world(seed: int, days: int, products: list[dict]) -> dict[str, dict]:
    rng = random.Random(seed)
    world = {}
    for p in products:
        world[p["id"]] = {
            "temps": [temperatures(rng, days * 24, SETPOINT_C[p["id"]]) for _ in range(CHILLERS_PER_PRODUCT)],
            "arrivals": [(rng.randint(10, 30), rng.randrange(CHILLERS_PER_PRODUCT)) for _ in range(days)],
            "demand": [max(0, round(rng.gauss(19, 5))) for _ in range(days)],  # slightly below 20/day supply
        }
    return world


def run(world: dict, products: list[dict], days: int, policy: str, salvage: dict[str, float]) -> dict[str, int]:
    m = dict.fromkeys(METRICS, 0)
    for p in products:
        w = world[p["id"]]
        params = RulParams(p["shelf_life_ref_hours"], p["t_ref_c"], p["q10"])
        life = params.shelf_life_ref_hours
        stock: list[Batch] = []
        for day in range(days):
            qty, chiller = w["arrivals"][day]
            stock.append(Batch(chiller, qty, day * 24, day * 24 + life))
            m["arrived"] += qty
            for h in range(day * 24, day * 24 + 24):
                for b in stock:
                    b.age_h += rate(w["temps"][b.chiller][h], params)
            now = (day + 1) * 24

            kept = []
            for b in stock:
                rul = life - b.age_h
                if now >= b.label_h:  # both policies: never sell past the printed label
                    m["discarded_at_label"] += b.qty
                elif policy != "static" and rul <= 0:
                    m["spoiled_in_stock"] += b.qty
                elif policy != "static" and rul / life < salvage[p["id"]]:
                    m["salvaged"] += b.qty
                else:
                    kept.append(b)
            stock = kept

            if policy == "static":
                stock.sort(key=lambda b: b.label_h)
            else:  # dynamic FEFO, never later than the label (open audit item: clamp RUL to the label)
                stock.sort(key=lambda b: min(life - b.age_h, b.label_h - now))
            need = w["demand"][day]
            for b in stock:
                if need == 0:
                    break
                take = min(need, b.qty)
                m["shipped_safe" if life - b.age_h >= MIN_SHIP_H else "shipped_unsafe"] += take
                b.qty -= take
                need -= take
            stock = [b for b in stock if b.qty > 0]
    return m


def lost(m: dict[str, int]) -> int:
    """Units not sold safely and not recovered: thrown away, spoiled, or shipped unsafe."""
    return m["discarded_at_label"] + m["spoiled_in_stock"] + m["shipped_unsafe"]


def paired_test(diffs: list[float], resamples: int = 20000) -> tuple[float, float]:
    """Paired t statistic and a two-sided sign-flip permutation p-value (no scipy needed)."""
    n = len(diffs)
    mean, sd = statistics.fmean(diffs), statistics.stdev(diffs)
    t = mean / (sd / n**0.5) if sd else float("inf")
    rng = random.Random(0)
    hits = sum(
        abs(statistics.fmean(d if rng.random() < 0.5 else -d for d in diffs)) >= abs(mean) for _ in range(resamples)
    )
    return t, (hits + 1) / (resamples + 1)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--runs", type=int, default=50)
    ap.add_argument("--days", type=int, default=60)
    ap.add_argument("--csv", type=Path)
    a = ap.parse_args()

    products = yaml.safe_load((ROOT / "data" / "products.yaml").read_text())["products"]
    mdp = {p["id"]: solve(RulParams(p["shelf_life_ref_hours"], p["t_ref_c"], p["q10"])) for p in products}
    salvage = {
        "dynamic": {p["id"]: p.get("salvage_ratio", 0.10) for p in products},
        "dynamic_mdp": {p["id"]: mdp[p["id"]].salvage_ratio[0] for p in products},
    }

    rows = []
    for seed in range(1, a.runs + 1):
        world = make_world(seed, a.days, products)
        for pol in POLICIES:
            m = run(world, products, a.days, pol, salvage.get(pol, {}))
            rows.append({"seed": seed, "policy": pol, **m, "lost": lost(m)})

    if a.csv:
        with a.csv.open("w", newline="") as f:
            wr = csv.DictWriter(f, fieldnames=list(rows[0]))
            wr.writeheader()
            wr.writerows(rows)

    print(f"{a.runs} seeded runs x {a.days} days, 3 products x {CHILLERS_PER_PRODUCT} chillers (simulation)\n")
    print("MDP policy per product (normal chiller / warm chiller), act when life ratio is below:")
    for pid, r in mdp.items():
        print(
            f"  {pid:15} dispatch {r.dispatch_ratio[0]:.2f} / {r.dispatch_ratio[1]:.2f}"
            f"   salvage {r.salvage_ratio[0]:.2f} / {r.salvage_ratio[1]:.2f}"
        )
    print("\n| Metric (mean units per run) | " + " | ".join(POLICIES) + " |")
    print("|---|" + "---|" * len(POLICIES))
    for k in (*METRICS, "lost"):
        means = [statistics.fmean(r[k] for r in rows if r["policy"] == pol) for pol in POLICIES]
        print(f"| {k} | " + " | ".join(f"{x:.1f}" for x in means) + " |")
    by = {pol: [r["lost"] for r in rows if r["policy"] == pol] for pol in POLICIES}
    for pol in ("dynamic", "dynamic_mdp"):
        t, p = paired_test([s - d for s, d in zip(by["static"], by[pol], strict=True)])
        print(f"\nstatic vs {pol}: lost units, paired t = {t:.2f}, permutation p = {p:.4g}")


if __name__ == "__main__":
    main()
