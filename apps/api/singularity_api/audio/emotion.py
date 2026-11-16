"""Valencia y activación por ventana con Essentia (embeddings MusiCNN + regresor entrenado en DEAM).

ESTADO: código sin ejecutar todavía. Essentia no se instala en Windows; corre en el
contenedor Linux (infra/). Si Essentia o los pesos no están, available() dice por qué y el
pipeline deja las cifras de emoción en "pendiente" con value=null. Nunca se estiman de otro modo.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np

from ..config import MODELS_DIR

EMBEDDING_MODEL = "msd-musicnn-1.pb"
REGRESSOR_MODEL = "deam-msd-musicnn-2.pb"
SOURCE = "modelo:essentia-deam-musicnn"
METHOD = (
    "embeddings MusiCNN (MSD) + regresor de valencia/activación DEAM, ventanas de 5 s con salto de 2,5 s · v1. "
    "Sus autores publican CCC 0,78 en valencia y 0,65 en activación sobre DEAM; "
    "Singularity aún no lo ha reproducido en un conjunto propio separado"
)
EMBEDDINGS_LABEL = "essentia msd-musicnn-1 · deam-msd-musicnn-2"


def available() -> tuple[bool, str]:
    try:
        import essentia.standard  # noqa: F401
    except Exception:
        return False, "Essentia no está instalado en este entorno (no hay versión para Windows; usa el contenedor Linux)"
    missing = [m for m in (EMBEDDING_MODEL, REGRESSOR_MODEL) if not (MODELS_DIR / m).exists()]
    if missing:
        return False, f"faltan los pesos del modelo en {MODELS_DIR}: {', '.join(missing)}"
    return True, ""


def predict_windows(path: str | Path, spans: list[tuple[float, float]]) -> tuple[list[tuple[float, float]], list[float]]:
    """((valencia, activación) en [-1, 1] por ventana, embedding medio de la pista)."""
    from essentia.standard import MonoLoader, TensorflowPredict2D, TensorflowPredictMusiCNN

    sr = 16000
    audio = MonoLoader(filename=str(path), sampleRate=sr, resampleQuality=4)()
    embed = TensorflowPredictMusiCNN(graphFilename=str(MODELS_DIR / EMBEDDING_MODEL), output="model/dense/BiasAdd")
    regress = TensorflowPredict2D(graphFilename=str(MODELS_DIR / REGRESSOR_MODEL), output="model/Identity")
    out = []
    embeddings = []
    for t0, t1 in spans:
        chunk = audio[int(t0 * sr) : int(t1 * sr)]
        emb = np.asarray(embed(chunk))
        embeddings.append(emb.mean(axis=0))
        pred = np.asarray(regress(emb)).mean(axis=0)  # DEAM anota de 1 a 9
        out.append(tuple(float(np.clip((v - 5.0) / 4.0, -1.0, 1.0)) for v in pred[:2]))
    return out, [float(v) for v in np.mean(embeddings, axis=0)]
