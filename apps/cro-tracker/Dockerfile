FROM python:3.12-slim

# tzdata so TZ=Europe/Dublin works for date.today()
RUN apt-get update \
 && apt-get install -y --no-install-recommends tzdata \
 && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    TZ=Europe/Dublin \
    CLIENTS_DIR=/app/clients \
    DATA_DIR=/app/data/snapshots \
    REPORTS_DIR=/app/data/reports

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py scheduler.py ./
# One CSV per client: clients/acme.csv -> /api/acme/report
COPY clients/ ./clients/

# Run as uid 1000 so it can write to the Dokku storage mount on /app/data
RUN useradd --uid 1000 --create-home appuser \
 && mkdir -p /app/data/snapshots /app/data/reports \
 && chown -R appuser:appuser /app/data
USER appuser

EXPOSE 5000

# One worker keeps memory low on the Pi; threads handle concurrent requests.
# The daily rebuild runs as a Dokku cron task (see app.json), not a second container.
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "1", "--threads", "4", "--timeout", "600", "--access-logfile", "-", "app:app"]
