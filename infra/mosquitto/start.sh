#!/bin/sh
# Builds the broker's password file from env at every start, so no hashes or secrets are committed.
# MQTT_DEVICES is a space-separated list of device_id:key pairs (the same keys the HTTP ingest checks).
set -eu
f=/mosquitto/data/passwd
rm -f "$f"  # mosquitto_passwd -c refuses to overwrite an existing file (2.1+), which crashed every restart
mosquitto_passwd -c -b "$f" ingest "$MQTT_INGEST_PASSWORD"
for pair in $MQTT_DEVICES; do
  mosquitto_passwd -b "$f" "${pair%%:*}" "${pair#*:}"
done
chown mosquitto:mosquitto "$f"
chmod 0700 "$f"
exec mosquitto -c /mosquitto/config/mosquitto.conf
