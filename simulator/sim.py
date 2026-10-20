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
MQTT_HOST = os.getenv("MQTT_HOST", "mqtt")
H = 3600.0


def temperature(scenario: str, t: float) -> float:
    """Temperature in C at virtual elapsed seconds t."""
    base = 3.5 + random.uniform(-0.3, 0.3)
    if scenario == "door_open":  # 3 min spike to 10-15 C every 30 min
        return random.uniform(10, 15) if t % 1800 < 180 else base
    if scenario == "compressor_failure":  # climbs toward 25 C ambient, tau 3 h
        return 25 - (25 - 3.5) * math.exp(-t / (3 * H)) + random.uniform(-0.3, 0.3)
    if scenario == "ltl_abuse":  # Herron pattern: 2 h at 4 C, 2 h at ~23 C
        return 23 + random.uniform(-0.5, 0.5) if t % (4 * H) >= 2 * H else 4 + random.uniform(-0.2, 0.2)
    if scenario == "recover":  # one 2 h excursion to ~23 C, then back to 4 C
        return 23 + random.uniform(-0.5, 0.5) if 2 * H <= t < 4 * H else 4 + random.uniform(-0.2, 0.2)
    return base


def main() -> None:
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    while True:
        try:
            client.connect(MQTT_HOST, 1883)
            break
        except OSError:
            time.sleep(2)
    client.loop_start()
    start, n = datetime.now(UTC), 0
    seq0 = int(time.time())  # survives restarts against a persisted DB
    while True:
        t = n * INTERVAL_S * SPEEDUP
        msg = {
            "device_id": DEVICE_ID,
            "zone_id": ZONE_ID,
            "ts": (start + timedelta(seconds=t)).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "temperature_c": round(temperature(SCENARIO, t), 2),
            "humidity_pct": round(86 + random.uniform(-2, 2), 1),
            "seq": seq0 + n,
        }
        client.publish(f"sensors/{DEVICE_ID}/telemetry", json.dumps(msg))
        n += 1
        time.sleep(INTERVAL_S)


if __name__ == "__main__":
    main()
