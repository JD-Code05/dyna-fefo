import logging
import time

import paho.mqtt.client as mqtt

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.services.telemetry import handle_message

log = logging.getLogger(__name__)


def _on_connect(client, userdata, flags, reason_code, properties):
    client.subscribe("sensors/+/telemetry")


def _on_message(client, userdata, msg):
    with SessionLocal() as db:
        handle_message(db, msg.topic, msg.payload)


def run() -> None:
    s = get_settings()
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.on_connect, client.on_message = _on_connect, _on_message
    while True:  # broker may not be up yet; paho reconnects itself once connected
        try:
            client.connect(s.mqtt_host, s.mqtt_port)
            client.loop_forever(retry_first_connection=True)
        except OSError as e:
            log.warning("mqtt connect failed: %s", e)
            time.sleep(3)
