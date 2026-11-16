"""Coherencia letra ↔ sonido. Misma definición que apps/web/src/lib/coherence.ts:

coherencia = 1 − distancia, donde la distancia combina a partes iguales
  · la distancia euclídea en el plano valencia × activación, dividida por su máximo (2·√2);
  · 1 − similitud coseno entre los perfiles de 13 dimensiones.
Si alguno de los dos lados no tiene dimensiones, solo cuenta el plano valencia × activación.
"""
from __future__ import annotations

import math

QUADRANT_LABEL = {"FIESTA": "FIESTA", "CHILL": "CHILL", "DEFIANCE": "DEFIANCE", "NOSTALGICA": "NOSTÁLGICA"}


def coherence(audio: dict, lyric: dict) -> int:
    """Porcentaje 0–100. audio y lyric: {valence, arousal, dims}."""
    d_va = math.hypot(audio["valence"] - lyric["valence"], audio["arousal"] - lyric["arousal"]) / (2 * math.sqrt(2))
    keys = [k for k in audio.get("dims", {}) if k in lyric.get("dims", {})]
    dot = sum(audio["dims"][k] * lyric["dims"][k] for k in keys)
    na = sum(audio["dims"][k] ** 2 for k in keys)
    nl = sum(lyric["dims"][k] ** 2 for k in keys)
    d = 0.5 * d_va + 0.5 * (1 - dot / math.sqrt(na * nl)) if na > 0 and nl > 0 else d_va
    return int(math.floor(max(0.0, min(1.0, 1 - d)) * 100 + 0.5))


def label(score: float) -> str:
    if score >= 75:
        return "COHERENTE"
    if score >= 50:
        return "TENSION_CREATIVA"
    return "CONTRASTE_DELIBERADO"


def explain(section: dict, lyric: dict, score: int) -> str:
    """Una frase concreta sobre el tramo donde más se separan letra y sonido."""
    quadrant = QUADRANT_LABEL.get(section["quadrant"], section["quadrant"])
    where = section["label"].lower()
    if score >= 75:
        return f"Letra y sonido van juntos: incluso en {where}, donde más se separan, la letra habla de {lyric['theme']} y el audio está en {quadrant}."
    return f"En {where}, la letra habla de {lyric['theme']} mientras el audio está en {quadrant}."
