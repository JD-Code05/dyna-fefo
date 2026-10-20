import logging
from datetime import UTC, datetime
import threading

from apscheduler.schedulers.blocking import BlockingScheduler

from app.core.config import get_settings
from app.core.products import load_products
from app.db.session import SessionLocal
from app.ingest import mqtt_sub
from app.services.rul_jobs import recompute_all

log = logging.getLogger(__name__)


def recompute_job(products) -> None:
    try:
        with SessionLocal() as db:
            recompute_all(db, products)
    except Exception:
        log.exception("RUL recompute failed")


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    threading.Thread(target=mqtt_sub.run, daemon=True).start()
    products = load_products(get_settings().products_path)
    sched = BlockingScheduler()
    sched.add_job(recompute_job, "interval", seconds=30, args=[products], next_run_time=datetime.now(UTC))
    sched.start()


if __name__ == "__main__":
    main()
