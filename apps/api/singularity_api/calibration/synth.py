"""Señales de referencia con la respuesta correcta conocida por construcción."""
from __future__ import annotations

import numpy as np

SR = 22050
TAU = 2 * np.pi


def sine(freq: float, amp: float, dur: float, sr: int = SR) -> np.ndarray:
    t = np.arange(int(dur * sr)) / sr
    return amp * np.sin(TAU * freq * t)


def noise(dur: float, rng: np.random.Generator, sr: int = SR) -> np.ndarray:
    """Ruido con caída suave en agudos, normalizado a RMS 0,1."""
    x = rng.standard_normal(int(dur * sr))
    x = np.convolve(x, np.ones(4) / 4, mode="same")
    return 0.1 * x / np.sqrt(np.mean(x**2))


def _burst(n: int, freq: float, decay: float, sr: int = SR) -> np.ndarray:
    t = np.arange(n) / sr
    return np.sin(TAU * freq * t) * np.exp(-t * decay)


def click_track(bpm: float, dur: float = 30.0, sr: int = SR) -> np.ndarray:
    """Bombo en cada pulso y un golpe agudo más flojo en el contratiempo."""
    y = np.zeros(int(dur * sr))
    beat = 60.0 / bpm
    kick, hat = _burst(int(0.12 * sr), 70, 30, sr), 0.35 * _burst(int(0.04 * sr), 6000, 120, sr)
    for k in range(int(dur / beat)):
        for offset, sound in ((0.0, kick), (0.5, hat)):
            i = int((k + offset) * beat * sr)
            seg = sound[: len(y) - i]
            y[i : i + len(seg)] += seg
    return 0.8 * y


def onset_track(rate: float, dur: float = 20.0, sr: int = SR) -> np.ndarray:
    y = np.zeros(int(dur * sr))
    hit = _burst(int(0.05 * sr), 1200, 90, sr)
    for k in range(int(dur * rate)):
        i = int(k / rate * sr)
        seg = hit[: len(y) - i]
        y[i : i + len(seg)] += seg
    return 0.8 * y


def _tone(midi: float, dur: float, sr: int = SR) -> np.ndarray:
    f = 440.0 * 2 ** ((midi - 69) / 12)
    t = np.arange(int(dur * sr)) / sr
    env = np.minimum(1, t / 0.02) * np.exp(-t * 0.8)
    return env * sum(a * np.sin(TAU * f * h * t) for h, a in ((1, 1.0), (2, 0.5), (3, 0.25)))


def chord(root_midi: int, minor: bool, dur: float, sr: int = SR) -> np.ndarray:
    third = 3 if minor else 4
    return sum(_tone(root_midi + i, dur, sr) for i in (0, third, 7, 12)) / 4


def progression(pc: int, minor: bool, sr: int = SR) -> np.ndarray:
    """I–IV–V–I (mayor) o i–iv–V–i (menor armónica), dos vueltas."""
    root = 48 + pc
    steps = [(0, minor), (5, minor), (7, False), (0, minor)]
    return 0.6 * np.concatenate([chord(root + s, m, 2.0, sr) for s, m in steps * 2])


def two_levels(delta_db: float, rng: np.random.Generator, dur: float = 60.0, sr: int = SR) -> np.ndarray:
    """Mitad a un nivel y mitad delta_db más alto: su rango de sonoridad es delta_db."""
    x = noise(dur, rng, sr)
    half = len(x) // 2
    x[half:] *= 10 ** (delta_db / 20)
    return x / max(1.0, np.abs(x).max() / 0.95)


def bump(t0: float, rng: np.random.Generator, dur: float = 60.0, sr: int = SR) -> np.ndarray:
    """Ruido con un máximo de energía centrado en t0."""
    t = np.arange(int(dur * sr)) / sr
    return noise(dur, rng, sr) * (0.3 + 2.0 * np.exp(-((t - t0) ** 2) / (2 * 4.0**2)))


def steps(amps: list[float], step_s: float = 5.0, sr: int = SR) -> np.ndarray:
    return np.concatenate([sine(440, a, step_s, sr) for a in amps])


# --- Canciones sintéticas con límites de tramo conocidos ---
_SECTION_TYPES = [
    # (progresión en semitonos sobre la tónica, menor, octava, batería, nivel)
    ([0, 5, 7, 0], False, 0, False, 0.35),
    ([9, 5, 0, 7], False, 0, True, 0.6),
    ([0, 7, 9, 5], False, 12, True, 1.0),
    ([2, 9, 5, 7], True, -12, False, 0.4),
    ([5, 7, 4, 9], True, 0, True, 0.75),
]


def song(seed: int, sr: int = SR) -> tuple[np.ndarray, list[float]]:
    """Devuelve (audio, límites internos en segundos). Cada tramo cambia armonía, registro y batería."""
    rng = np.random.default_rng(seed)
    order = [0, 1, 2, 1, 3, 2, 0] if seed % 2 == 0 else [0, 1, 4, 2, 3, 2]
    parts, bounds, t = [], [], 0.0
    kick = _burst(int(0.12 * sr), 70, 30, sr)
    for kind in order:
        prog, minor, octave, drums, level = _SECTION_TYPES[kind]
        bars = int(rng.integers(4, 8))  # compases de 2 s
        seg = np.concatenate([chord(48 + octave + prog[b % 4], minor, 2.0, sr) for b in range(bars)])
        if drums:
            for k in range(bars * 4):
                i = int(k * 0.5 * sr)
                seg[i : i + len(kick)] += 0.8 * kick[: len(seg) - i]
            seg += 0.02 * rng.standard_normal(len(seg))
        parts.append(level * seg)
        t += bars * 2.0
        bounds.append(t)
    y = np.concatenate(parts)
    return 0.9 * y / np.abs(y).max(), bounds[:-1]
