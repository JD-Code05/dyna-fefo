import csv
from collections import defaultdict
from pathlib import Path
from statistics import mean

import pytest

from app.core.config import get_settings
from app.engine.rul import rate
from app.services.rul_jobs import params_for

# CSV product names -> products.yaml ids
CSV_IDS = {"raw_chicken": "chicken-breast", "fresh_milk": "fresh-milk", "tomato_based_dish": "tomato-dish"}
TOLERANCE = 0.10  # model shelf life within 10% of the dataset mean at every temperature


def dataset_means() -> dict[tuple[str, float], float]:
    path = Path(get_settings().products_path).parent / "shelf_life_by_temperature.csv"
    rows: dict[tuple[str, float], list[float]] = defaultdict(list)
    with open(path) as f:
        for r in csv.DictReader(f):
            rows[(CSV_IDS[r["product"]], float(r["temperature_c"]))].append(float(r["hours_to_expire"]))
    return {k: mean(v) for k, v in rows.items()}


MEANS = dataset_means()


def test_every_dataset_product_is_configured(products):
    assert {pid for pid, _ in MEANS} == set(products)


@pytest.mark.parametrize(("product_id", "temperature_c"), sorted(MEANS))
def test_model_matches_dataset(products, product_id, temperature_c):
    p = params_for(products[product_id])
    model_h = p.shelf_life_ref_hours / rate(temperature_c, p)  # constant temperature: life = ref / rate
    data_h = MEANS[(product_id, temperature_c)]
    assert abs(model_h - data_h) / data_h <= TOLERANCE, f"model {model_h:.1f} h vs data {data_h:.1f} h"
