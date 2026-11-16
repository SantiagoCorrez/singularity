# Contexto de build: la raíz del repositorio (necesita packages/schema).
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1 \
    SINGULARITY_SCHEMA_DIR=/app/packages/schema \
    SINGULARITY_DATA=/data \
    SINGULARITY_MODELS_DIR=/models \
    NUMBA_CACHE_DIR=/tmp/numba

RUN apt-get update && apt-get install -y --no-install-recommends libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/apps/api
COPY apps/api/requirements.txt apps/api/requirements-models.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-models.txt
COPY apps/api/requirements-llm.txt ./
RUN pip install --no-cache-dir -r requirements-llm.txt
COPY apps/api/requirements-db.txt ./
RUN pip install --no-cache-dir -r requirements-db.txt

COPY packages/schema /app/packages/schema
COPY apps/api/singularity_api ./singularity_api
COPY apps/api/tests ./tests
COPY apps/api/pytest.ini ./

EXPOSE 8000
CMD ["uvicorn", "singularity_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
