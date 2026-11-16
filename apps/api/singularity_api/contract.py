"""Contrato del reporte: el JSON Schema de packages/schema es la única fuente de verdad."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

from jsonschema import Draft7Validator, FormatChecker
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT7

from .config import SCHEMA_DIR


@lru_cache(maxsize=1)
def _validator() -> Draft7Validator:
    figure = json.loads((SCHEMA_DIR / "figure.schema.json").read_text(encoding="utf-8"))
    report = json.loads((SCHEMA_DIR / "report.schema.json").read_text(encoding="utf-8"))
    registry = Registry().with_resources(
        [("figure.schema.json", Resource.from_contents(figure, default_specification=DRAFT7))]
    )
    return Draft7Validator(report, registry=registry, format_checker=FormatChecker())


def validation_errors(report: dict[str, Any]) -> list[str]:
    return [
        f"/{'/'.join(str(p) for p in e.absolute_path)} {e.message}"
        for e in sorted(_validator().iter_errors(report), key=lambda e: list(e.absolute_path))
    ]


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def figure(
    id: str,
    label: str,
    value: float | int | str | None,
    unit: str | None,
    *,
    source: str,
    status: str,
    method: str,
    calibration: dict[str, Any] | None = None,
    measured_at: str | None = None,
) -> dict[str, Any]:
    """Una cifra con procedencia. Si no hay valor, value=None: nunca se rellena con una estimación."""
    return {
        "id": id,
        "label": label,
        "value": value,
        "unit": unit,
        "source": source,
        "measured_at": measured_at or now_iso(),
        "status": status,
        "method": method,
        "calibration": calibration,
    }


_VERIFIABLE = {"medido", "verificado"}


def passes(fig: dict[str, Any] | None) -> bool:
    """La regla del visor, en el servidor: ¿esta cifra se puede mostrar (y usar como evidencia)?"""
    if not fig or fig.get("value") is None:
        return False
    cal = fig.get("calibration")
    return bool(fig.get("source") and fig.get("measured_at") and fig.get("status") in _VERIFIABLE and cal and cal.get("passed") is True)
