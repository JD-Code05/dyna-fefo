import logging
import threading

from apscheduler.schedulers.blocking import BlockingScheduler

from app.ingest import mqtt_sub


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    threading.Thread(target=mqtt_sub.run, daemon=True).start()
    BlockingScheduler().start()  # jobs added in Task 7


if __name__ == "__main__":
    main()
