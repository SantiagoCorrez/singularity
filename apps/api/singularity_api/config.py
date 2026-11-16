import os
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = API_ROOT.parents[1]

# Dónde se guardan pistas y reportes. En producción esto será S3 + Postgres.
DATA_DIR = Path(os.environ.get("SINGULARITY_DATA", API_ROOT / "data"))
SCHEMA_DIR = Path(os.environ.get("SINGULARITY_SCHEMA_DIR", REPO_ROOT / "packages" / "schema"))
# Pesos de los modelos de Essentia (no se versionan).
MODELS_DIR = Path(os.environ.get("SINGULARITY_MODELS_DIR", API_ROOT / "models"))

# "inline" analiza en un hilo del propio servidor (desarrollo, Windows).
# "rq" encola en Redis para un worker aparte (Linux / Docker).
QUEUE_MODE = os.environ.get("SINGULARITY_QUEUE", "inline")
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

# Orígenes de la web que pueden llamar a la API desde el navegador (separados por comas).
WEB_ORIGINS = [
    o.strip()
    for o in os.environ.get("SINGULARITY_WEB_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if o.strip()
]

MIN_DURATION_S = 10.0
MAX_DURATION_S = 15 * 60.0
MAX_UPLOAD_BYTES = 300 * 1024 * 1024

SCHEMA_VERSION = "0.3.0"
