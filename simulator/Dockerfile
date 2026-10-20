FROM python:3.12-slim
WORKDIR /sim
RUN pip install --no-cache-dir "paho-mqtt>=2,<3"
COPY sim.py .
CMD ["python", "-u", "sim.py"]
