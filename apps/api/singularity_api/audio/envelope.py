"""Envolvente de energía a 20 Hz (total y por bandas) y ventanas de 5 s con salto de 2,5 s."""
from __future__ import annotations

import librosa
import numpy as np

from .io import Audio

METHOD = "RMS por STFT (2048/512) remuestreado a 20 Hz; bandas < 250 Hz, 250 Hz–4 kHz, > 4 kHz · v1"
RATE_HZ = 20
WINDOW_S = 5.0
HOP_S = 2.5


def compute(a: Audio) -> dict:
    hop = 512
    spec = np.abs(librosa.stft(a.y, n_fft=2048, hop_length=hop)) ** 2
    freqs = librosa.fft_frequencies(sr=a.sr, n_fft=2048)
    times = librosa.frames_to_time(np.arange(spec.shape[1]), sr=a.sr, hop_length=hop)
    grid = np.arange(int(np.ceil(a.duration * RATE_HZ))) / RATE_HZ

    def band(mask: np.ndarray) -> list[float]:
        amp = np.sqrt(spec[mask].sum(axis=0))
        amp = np.interp(grid, times, amp)
        peak = float(amp.max())
        return [round(float(v), 3) for v in (amp / peak if peak > 0 else amp)]

    return {
        "rate_hz": RATE_HZ,
        "rms": band(np.ones_like(freqs, dtype=bool)),
        "low": band(freqs < 250),
        "mid": band((freqs >= 250) & (freqs < 4000)),
        "high": band(freqs >= 4000),
    }


def windows(duration: float, rms: list[float]) -> list[dict]:
    """Ventanas de análisis con su energía media. Valencia, activación y dimensiones las pone el modelo."""
    out = []
    t0 = 0.0
    while t0 < duration - HOP_S or not out:
        t1 = min(duration, t0 + WINDOW_S)
        chunk = rms[int(t0 * RATE_HZ) : max(int(t0 * RATE_HZ) + 1, int(t1 * RATE_HZ))]
        out.append(
            {
                "t0": round(t0, 3),
                "t1": round(t1, 3),
                "valence": None,
                "arousal": None,
                "energy": round(float(np.mean(chunk)), 3),
                "dims": {},
            }
        )
        t0 += HOP_S
    return out
