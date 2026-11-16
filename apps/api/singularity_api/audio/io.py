from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf

from ..config import MAX_DURATION_S, MIN_DURATION_S

ANALYSIS_SR = 22050


class InvalidAudio(ValueError):
    """El archivo no es un WAV utilizable. El mensaje se le muestra al artista."""


@dataclass
class Audio:
    original: np.ndarray  # (n,) o (n, canales), a la frecuencia original; para la sonoridad
    original_sr: int
    y: np.ndarray  # mono a ANALYSIS_SR, para todo lo demás
    sr: int
    duration: float


def from_array(data: np.ndarray, sr: int) -> Audio:
    data = np.asarray(data, dtype=np.float64)
    mono = data if data.ndim == 1 else data.mean(axis=1)
    y = mono.astype(np.float32)
    if sr != ANALYSIS_SR:
        y = librosa.resample(y, orig_sr=sr, target_sr=ANALYSIS_SR)
    return Audio(original=data, original_sr=sr, y=y, sr=ANALYSIS_SR, duration=len(mono) / sr)


def load(path: str | Path) -> Audio:
    try:
        info = sf.info(str(path))
    except Exception as exc:  # soundfile lanza RuntimeError con archivos corruptos
        raise InvalidAudio("No se pudo leer el archivo. Sube un WAV válido.") from exc
    if info.format != "WAV":
        raise InvalidAudio(f"El archivo es {info.format}, no WAV. Sube la canción en WAV.")
    if info.duration < MIN_DURATION_S:
        raise InvalidAudio(f"La pista dura {info.duration:.1f} s; el mínimo es {MIN_DURATION_S:.0f} s.")
    if info.duration > MAX_DURATION_S:
        raise InvalidAudio(f"La pista dura {info.duration / 60:.1f} min; el máximo es {MAX_DURATION_S / 60:.0f} min.")
    data, sr = sf.read(str(path), dtype="float64", always_2d=False)
    if not np.isfinite(data).all() or float(np.abs(data).max()) < 1e-6:
        raise InvalidAudio("La pista está en silencio o tiene muestras inválidas.")
    return from_array(data, sr)
