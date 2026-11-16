"""Estructura de la canción: límites de tramo por novedad sobre una matriz de auto-similitud
de croma + MFCC (Foote, 2000), y un nombre para cada tramo.

Los LÍMITES se calibran (ver calibration/). Los NOMBRES (intro, estrofa, coro…) salen de
reglas sobre repetición y energía: son una ayuda de lectura, no una medición.
"""
from __future__ import annotations

import librosa
import numpy as np
from scipy.signal import find_peaks

from .io import Audio

METHOD = "novedad de Foote sobre auto-similitud de croma + MFCC (0,5 s); nombres de tramo por reglas · v1"
FRAME_S = 0.5
KERNEL_S = 8.0
MIN_SECTION_S = 6.0


def _features(a: Audio) -> tuple[np.ndarray, np.ndarray]:
    hop = 512
    chroma = librosa.feature.chroma_cqt(y=a.y, sr=a.sr, hop_length=hop)
    mfcc = librosa.feature.mfcc(y=a.y, sr=a.sr, n_mfcc=13, hop_length=hop)[1:]
    rms = librosa.feature.rms(y=a.y, frame_length=2048, hop_length=hop)
    agg = max(1, int(round(FRAME_S * a.sr / hop)))
    n = min(chroma.shape[1], mfcc.shape[1], rms.shape[1]) // agg

    def pool(f: np.ndarray) -> np.ndarray:
        return f[:, : n * agg].reshape(f.shape[0], n, agg).mean(axis=2)

    def z(f: np.ndarray) -> np.ndarray:
        return (f - f.mean(axis=1, keepdims=True)) / (f.std(axis=1, keepdims=True) + 1e-9)

    x = np.vstack([z(pool(chroma)), z(pool(mfcc))])
    x /= np.linalg.norm(x, axis=0, keepdims=True) + 1e-9
    return x, pool(rms)[0]


def boundaries(a: Audio) -> tuple[list[float], np.ndarray, np.ndarray]:
    """Devuelve los límites en segundos (incluye 0 y la duración), las características y el RMS."""
    x, rms = _features(a)
    ssm = x.T @ x
    half = int(round(KERNEL_S / FRAME_S))
    n = ssm.shape[0]
    if n < 4 * half:
        return [0.0, a.duration], x, rms
    ax = np.arange(-half, half) + 0.5
    gauss = np.exp(-(ax**2) / (2 * (half / 2) ** 2))
    kernel = np.outer(gauss, gauss) * np.outer(np.sign(ax), np.sign(ax))
    padded = np.pad(ssm, half, mode="reflect")
    novelty = np.array([(padded[i : i + 2 * half, i : i + 2 * half] * kernel).sum() for i in range(n)])
    novelty = np.maximum(novelty, 0)
    peaks, _ = find_peaks(
        novelty, distance=int(MIN_SECTION_S / FRAME_S), prominence=0.12 * float(novelty.max() or 1.0)
    )
    inner = [float(p * FRAME_S) for p in peaks if MIN_SECTION_S / 2 <= p * FRAME_S <= a.duration - MIN_SECTION_S / 2]
    return [0.0, *inner, a.duration], x, rms


def _name_sections(feats: list[np.ndarray], energy: np.ndarray, durations: np.ndarray) -> list[str]:
    n = len(feats)
    if n == 1:
        return ["Tramo único"]
    # Tramos parecidos (coseno) comparten grupo.
    group = list(range(n))
    for i in range(n):
        for j in range(i):
            cos = float(feats[i] @ feats[j] / (np.linalg.norm(feats[i]) * np.linalg.norm(feats[j]) + 1e-9))
            if cos > 0.8:
                group[i] = group[j]
                break
    rel = energy / (energy.max() + 1e-9)
    names = ["Estrofa"] * n

    repeated = {g for g in group if group.count(g) > 1 and np.mean([rel[i] for i in range(n) if group[i] == g]) >= np.median(rel)}
    if repeated:
        chorus = max(repeated, key=lambda g: sum(rel[i] * durations[i] for i in range(n) if group[i] == g))
        chorus_idx = [i for i in range(n) if group[i] == chorus]
    else:
        chorus_idx = [int(np.argmax(rel))]
    for i in chorus_idx:
        names[i] = "Coro"
    if rel[0] < 0.7 and 0 not in chorus_idx:
        names[0] = "Intro"
    if rel[-1] < 0.7 and n - 1 not in chorus_idx:
        names[-1] = "Outro"
    for i in range(1, n - 1):
        if names[i] == "Estrofa" and rel[i] < 0.5:
            names[i] = "Puente"
    for i in chorus_idx:
        if i > 1 and names[i - 1] == "Estrofa" and durations[i - 1] <= 10:
            names[i - 1] = "Pre-coro"
    return names


def analyze(a: Audio) -> list[dict]:
    bounds, x, rms = boundaries(a)
    spans = list(zip(bounds[:-1], bounds[1:]))
    feats, energy = [], []
    for t0, t1 in spans:
        i0, i1 = int(t0 / FRAME_S), max(int(t0 / FRAME_S) + 1, int(t1 / FRAME_S))
        feats.append(x[:, i0:i1].mean(axis=1))
        energy.append(float(rms[i0:i1].mean()))
    energy_arr = np.array(energy)
    names = _name_sections(feats, energy_arr, np.array([t1 - t0 for t0, t1 in spans]))
    rel = energy_arr / (energy_arr.max() + 1e-9)
    return [
        {
            "id": f"tramo-{i + 1}",
            "label": names[i],
            "t0": round(t0, 2),
            "t1": round(t1, 2),
            "valence": None,
            "arousal": None,
            "quadrant": None,
            "dominant": None,
            "energy": round(float(rel[i]), 3),
        }
        for i, (t0, t1) in enumerate(spans)
    ]
