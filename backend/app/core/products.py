import yaml
from pydantic import BaseModel


class ProductConfig(BaseModel):
    id: str
    name: str
    shelf_life_ref_hours: float
    t_ref_c: float
    q10: float
    rate_floor: float = 0.5
    max_dt_hours: float = 1.0
    salvage_ratio: float = 0.10
    dispatch_ratio: float = 0.50


def load_products(path: str) -> dict[str, ProductConfig]:
    with open(path) as f:
        return {p["id"]: ProductConfig(**p) for p in yaml.safe_load(f)["products"]}
