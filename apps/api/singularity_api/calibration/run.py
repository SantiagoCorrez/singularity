"""Pruebas de calibración de lo que se MIDE del audio, contra señales de referencia.

    python -m singularity_api.calibration.run          # ejecuta y guarda results.json

Alcance honesto: las referencias son señales sintéticas con respuesta conocida. Demuestran que
la medición es correcta en condiciones controladas; no sustituyen a una validación con
música real anotada, que es la que hará falta para los modelos de emoción.
"""
from __future__ import annotations

import json
from typing import Callable

import numpy as np

from ..audio import descriptors as d
from ..audio import envelope, structure
from ..audio.io import from_array
from ..contract import now_iso
from . import synth
from .registry import RESULTS_PATH, method_for

Result = tuple[float, int]  # (puntuación, n)


def _mae(pairs: list[tuple[float, float]]) -> Result:
    return float(np.mean([abs(a - b) for a, b in pairs])), len(pairs)


def _acc(hits: list[bool]) -> Result:
    return float(np.mean(hits)), len(hits)


def cal_loudness() -> Result:
    # Una senoidal de 997 Hz y amplitud A mide 20·log10(A) − 3,01 LUFS (ITU-R BS.1770).
    amps = [0.05, 0.1, 0.2, 0.35, 0.5, 0.7, 0.9]
    return _mae([(d.loudness_lufs(from_array(synth.sine(997, a, 10, 48000), 48000)), 20 * np.log10(a) - 3.01) for a in amps])


def cal_tempo() -> Result:
    # Acc1: acierto si el tempo estimado está a ±4 % del real (métrica habitual en MIR).
    bpms = [70, 80, 90, 100, 110, 120, 128, 140, 150, 160, 170]
    return _acc([abs(d.tempo_bpm(from_array(synth.click_track(b), synth.SR)) - b) <= 0.04 * b for b in bpms])


def cal_key() -> Result:
    cases = [(pc, minor) for pc in range(12) for minor in (False, True)]
    return _acc(
        [d.key_index(from_array(synth.progression(pc, minor), synth.SR)) == (pc, "menor" if minor else "mayor") for pc, minor in cases]
    )


def cal_brightness() -> Result:
    freqs = [220, 440, 880, 1500, 2500, 4000, 6000]
    return _mae([(d.brightness_hz(from_array(synth.sine(f, 0.5, 5), synth.SR)), f) for f in freqs])


def cal_dynamics() -> Result:
    rng = np.random.default_rng(1)
    return _mae([(d.dynamics_lu(from_array(synth.two_levels(delta, rng), synth.SR)), delta) for delta in [3, 6, 9, 12, 15]])


def cal_onsets() -> Result:
    return _mae([(d.onset_density(from_array(synth.onset_track(r), synth.SR)), r) for r in [1, 2, 3, 4, 6]])


def cal_climax() -> Result:
    rng = np.random.default_rng(2)
    return _mae([(d.climax_s(from_array(synth.bump(t0, rng), synth.SR)), t0) for t0 in [12, 20, 30, 41, 50]])


def cal_energy() -> Result:
    amps = [0.2, 0.5, 1.0, 0.35, 0.7]
    env = envelope.compute(from_array(synth.steps(amps), synth.SR))["rms"]
    return _mae([(env[int((i * 5 + 2.5) * envelope.RATE_HZ)], a) for i, a in enumerate(amps)])


def cal_structure() -> Result:
    # F1 de límites con tolerancia de ±3 s sobre canciones sintéticas.
    tp = fp = fn = 0
    for seed in range(8):
        y, truth = synth.song(seed)
        found = structure.boundaries(from_array(y, synth.SR))[0][1:-1]
        used: set[int] = set()
        for t in truth:
            match = next((i for i, f in enumerate(found) if i not in used and abs(f - t) <= 3.0), None)
            if match is None:
                fn += 1
            else:
                used.add(match)
                tp += 1
        fp += len(found) - len(used)
    f1 = 2 * tp / max(1, 2 * tp + fp + fn)
    return float(f1), tp + fn


# clave: (función, métrica, umbral, "menor es mejor", referencia)
TESTS: dict[str, tuple[Callable[[], Result], str, float, bool, str]] = {
    "loudness": (cal_loudness, "MAE", 0.5, True, "sintético: senoidales de 997 Hz de nivel conocido (BS.1770)"),
    "tempo": (cal_tempo, "Acc1", 0.8, False, "sintético: pistas de percusión de 70 a 170 BPM"),
    "key": (cal_key, "exactitud", 0.8, False, "sintético: progresiones I–IV–V–I en las 24 tonalidades"),
    "brightness": (cal_brightness, "MAE", 60.0, True, "sintético: senoidales de 220 Hz a 6 kHz"),
    "dynamics": (cal_dynamics, "MAE", 1.0, True, "sintético: ruido a dos niveles con diferencia conocida"),
    "onset_density": (cal_onsets, "MAE", 0.5, True, "sintético: golpes a ritmo conocido (1 a 6 por segundo)"),
    "climax": (cal_climax, "MAE", 2.5, True, "sintético: ruido con un máximo de energía en un instante conocido"),
    "energy": (cal_energy, "MAE", 0.05, True, "sintético: senoidal a escalones de amplitud conocida"),
    "structure": (cal_structure, "F1", 0.7, False, "sintético: 8 canciones generadas con límites de tramo conocidos (±3 s)"),
}


def run_all() -> dict[str, dict]:
    out: dict[str, dict] = {}
    for key, (fn, metric, threshold, lower_is_better, ref) in TESTS.items():
        score, n = fn()
        out[key] = {
            "method": method_for(key),
            "calibration": {
                "ref": ref,
                "metric": metric,
                "score": round(score, 3),
                "threshold": threshold,
                "n": n,
                "passed": bool(score <= threshold if lower_is_better else score >= threshold),
                "tested_at": now_iso(),
            },
        }
    return out


if __name__ == "__main__":
    results = run_all()
    RESULTS_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for key, r in results.items():
        c = r["calibration"]
        print(f"{'OK ' if c['passed'] else 'NO '} {key:14s} {c['metric']:9s} {c['score']:8.3f}  umbral {c['threshold']}  n={c['n']}")
