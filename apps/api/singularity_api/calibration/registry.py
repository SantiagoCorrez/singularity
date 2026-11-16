"""Registro de calibraciones. El pipeline adjunta a cada cifra el resultado guardado de su prueba.

Una calibración solo vale para el método con el que se probó: si el método cambia de versión
y no se vuelve a ejecutar la prueba, la cifra sale sin calibración y el visor se abstiene.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from ..audio import descriptors, envelope, structure

RESULTS_PATH = Path(__file__).with_name("results.json")


def method_for(key: str) -> str:
    if key == "energy":
        return envelope.METHOD
    if key == "structure":
        return structure.METHOD
    return descriptors.METHODS[key]


@lru_cache(maxsize=1)
def _results() -> dict[str, dict]:
    if not RESULTS_PATH.exists():
        return {}
    return json.loads(RESULTS_PATH.read_text(encoding="utf-8"))


def calibration_for(key: str) -> dict | None:
    entry = _results().get(key)
    if not entry or entry.get("method") != method_for(key):
        return None
    return entry["calibration"]
