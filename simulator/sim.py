import json
import math
import os
import random
import time
from datetime import UTC, datetime, timedelta

import paho.mqtt.client as mqtt

SCENARIO = os.getenv("SCENARIO", "normal")
SPEEDUP = float(os.getenv("SIM_SPEEDUP", "1"))
DEVICE_ID = os.getenv("DEVICE_ID", "esp32-chiller-01")
ZONE_ID = os.getenv("ZONE_ID", "chiller-a")
INTERVAL_S = float(os.getenv("INTERVAL_S", "5"))
# Room setpoint and humidity. Humidity is display only: no shelf-life data covers it.
BASE_TEMP_C = float(os.getenv("BASE_TEMP_C", "3.5"))
BASE_HUMIDITY_PCT = float(os.getenv("BASE_HUMIDITY_PCT", "86"))
MQTT_HOST = os.getenv("MQTT_HOST", "mqtt")
# The broker only takes known devices: username = device ID, password = the device's key.
DEVICE_KEY = os.getenv("DEVICE_KEY", "")
TOPIC = f"sensors/{DEVICE_ID}/telemetry"
H = 3600.0


def resume_from(client: mqtt.Client, now: datetime) -> datetime:
    """Continue after this sensor's last reading (retained by the broker), so a restart never rewinds a clock that SIM_SPEEDUP ran ahead."""
    last: list[datetime] = []
    client.on_message = lambda c, u, m: last.append(datetime.fromisoformat(json.loads(m.payload)["ts"]))
    client.subscribe(TOPIC)
    time.sleep(2)  # the broker sends the retained message right after the subscribe; none yet = fresh start
    client.unsubscribe(TOPIC)
    return max([now] + [t + timedelta(seconds=INTERVAL_S * SPEEDUP) for t in last])


def temperature(scenario: str, t: float) -> float:
    """Temperature in C at virtual elapsed seconds t."""
    base = BASE_TEMP_C + random.uniform(-0.3, 0.3)
    if scenario == "door_open":  # 3 min spike to 10-15 C every 30 min
        return random.uniform(10, 15) if t % 1800 < 180 else base
    if scenario == "compressor_failure":  # climbs toward 25 C ambient, tau 3 h
        return 25 - (25 - BASE_TEMP_C) * math.exp(-t / (3 * H)) + random.uniform(-0.3, 0.3)
    if scenario == "ltl_abuse":  # Herron pattern: 2 h at 4 C, 2 h at ~23 C (the study protocol, not the room setpoint)
        return 23 + random.uniform(-0.5, 0.5) if t % (4 * H) >= 2 * H else 4 + random.uniform(-0.2, 0.2)
    if scenario == "recover":  # one 2 h excursion to ~23 C, then back to 4 C
        return 23 + random.uniform(-0.5, 0.5) if 2 * H <= t < 4 * H else 4 + random.uniform(-0.2, 0.2)
    return base


def main() -> None:
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.username_pw_set(DEVICE_ID, DEVICE_KEY)
    while True:
        try:
            client.connect(MQTT_HOST, 1883)
            break
        except OSError:
            time.sleep(2)
    client.loop_start()
    start, n = resume_from(client, datetime.now(UTC)), 0
    seq0 = int(time.time())  # survives restarts against a persisted DB
    while True:
        t = n * INTERVAL_S * SPEEDUP
        msg = {
            "device_id": DEVICE_ID,
            "zone_id": ZONE_ID,
            "ts": (start + timedelta(seconds=t)).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "temperature_c": round(temperature(SCENARIO, t), 2),
            "humidity_pct": round(min(100.0, max(0.0, BASE_HUMIDITY_PCT + random.uniform(-2, 2))), 1),
            "seq": seq0 + n,
        }
        client.publish(TOPIC, json.dumps(msg), retain=True)
        n += 1
        time.sleep(INTERVAL_S)


if __name__ == "__main__":
    main()
