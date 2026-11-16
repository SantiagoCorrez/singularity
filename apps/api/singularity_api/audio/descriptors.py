"""Descriptores medidos del máster. Cada función mide una cosa y solo una.

Si cambias cómo se mide algo, sube su versión en METHODS: la calibración guardada deja
de aplicarse hasta que se vuelva a ejecutar (ver calibration/registry.py).
"""
from __future__ import annotations

import librosa
import numpy as np
import pyloudnorm as pyln

from .io import Audio

METHODS: dict[str, str] = {
    "loudness": "sonoridad integrada ITU-R BS.1770-4 (pyloudnorm) · v1",
    "tempo": "seguimiento de pulso (librosa.beat), tempo por intervalo medio entre pulsos · v2",
    "key": "croma CQT + perfiles Krumhansl-Schmuckler · v1",
    "brightness": "centroide espectral medio ponderado por energía (librosa) · v1",
    "dynamics": "rango de sonoridad tipo EBU R128 LRA, ventanas de 3 s · v1",
    "onset_density": "detección de ataques por flujo espectral (librosa.onset) · v1",
    "climax": "centro de la ventana de 5 s con más energía RMS · v1",
}

_MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
_MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
PITCHES = ["Do", "Do♯", "Re", "Mi♭", "Mi", "Fa", "Fa♯", "Sol", "La♭", "La", "Si♭", "Si"]


def loudness_lufs(a: Audio) -> float:
    return float(pyln.Meter(a.original_sr).integrated_loudness(a.original))


def tempo_bpm(a: Audio) -> float:
    tempo, beats = librosa.beat.beat_track(y=a.y, sr=a.sr, units="time")
    # El tempo de librosa sale de una rejilla gruesa (cerca de 120 BPM salta de 117,5 a 123).
    # El intervalo medio entre el primer y el último pulso seguido es mucho más fino.
    if len(beats) >= 8:
        return float(60.0 * (len(beats) - 1) / (beats[-1] - beats[0]))
    return float(np.atleast_1d(tempo)[0])


def key_index(a: Audio) -> tuple[int, str]:
    """(clase de altura 0–11, 'mayor' | 'menor')."""
    chroma = librosa.feature.chroma_cqt(y=a.y, sr=a.sr).mean(axis=1)
    best = (-2.0, 0, "mayor")
    for pc in range(12):
        for profile, mode in ((_MAJOR, "mayor"), (_MINOR, "menor")):
            r = float(np.corrcoef(chroma, np.roll(profile, pc))[0, 1])
            if r > best[0]:
                best = (r, pc, mode)
    return best[1], best[2]


def key_name(a: Audio) -> str:
    pc, mode = key_index(a)
    return f"{PITCHES[pc]} {mode}"


def brightness_hz(a: Audio) -> float:
    centroid = librosa.feature.spectral_centroid(y=a.y, sr=a.sr)[0]
    rms = librosa.feature.rms(y=a.y, frame_length=2048, hop_length=512)[0]
    n = min(len(centroid), len(rms))
    w = rms[:n] ** 2
    return float((centroid[:n] * w).sum() / max(w.sum(), 1e-12))


def dynamics_lu(a: Audio) -> float:
    """Percentil 95 − percentil 10 de la sonoridad a corto plazo, con las puertas de EBU Tech 3342."""
    sr, x = a.original_sr, a.original
    meter = pyln.Meter(sr)
    win, hop = 3 * sr, sr
    st = np.array([meter.integrated_loudness(x[i : i + win]) for i in range(0, len(x) - win + 1, hop)])
    st = st[np.isfinite(st) & (st > -70.0)]
    if len(st) < 2:
        return 0.0
    mean_power = 10 * np.log10(np.mean(10 ** (st / 10)))
    st = st[st > mean_power - 20.0]
    if len(st) < 2:
        return 0.0
    return float(np.percentile(st, 95) - np.percentile(st, 10))


def onset_density(a: Audio) -> float:
    onsets = librosa.onset.onset_detect(y=a.y, sr=a.sr, units="time")
    return float(len(onsets) / a.duration)


def climax_s(a: Audio) -> float:
    hop = 512
    rms = librosa.feature.rms(y=a.y, frame_length=2048, hop_length=hop)[0]
    n = max(1, int(round(5.0 * a.sr / hop)))
    if len(rms) <= n:
        return a.duration / 2
    power = np.convolve(rms**2, np.ones(n) / n, mode="valid")
    start = int(np.argmax(power))
    return float((start + n / 2) * hop / a.sr)


def measure_all(a: Audio) -> dict[str, float | str]:
    return {
        "loudness": round(loudness_lufs(a), 1),
        "tempo": round(tempo_bpm(a), 1),
        "key": key_name(a),
        "brightness": round(brightness_hz(a)),
        "dynamics": round(dynamics_lu(a), 1),
        "onset_density": round(onset_density(a), 2),
        "climax": round(climax_s(a), 1),
    }
