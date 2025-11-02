FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app


RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*


COPY requirements.txt /app/requirements.txt
RUN pip install -r requirements.txt


COPY app /app/app
COPY .env.example /app/.env.example


RUN useradd -u 10001 -ms /bin/bash appuser
USER appuser

EXPOSE 8080


CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
