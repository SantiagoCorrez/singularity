"""Agentes de datos y agente de riesgo. Cada afirmación es una cifra con fuente y fecha."""
from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

from ..contract import figure, passes
from .tools import NotConnected, Tool


@dataclass
class Finding:
    id: str
    label: str
    tool: str
    query: str
    unit: str | None = None


@dataclass
class DataAgent:
    id: str
    label: str
    findings: list[Finding]


DATA_AGENTS = [
    DataAgent("tendencias", "Tendencias", [
        Finding("genre_trend_12m", "Interés del género por país, 12 meses", "google_trends", "genre.interest_12m"),
        Finding("youtube_rising", "YouTube: en alza", "youtube", "rising"),
        Finding("tiktok_rising", "TikTok: sonidos en alza", "tiktok", "sounds.rising"),
    ]),
]


def run_finding(agent_id: str, agent_label: str, f: Finding, tools: dict[str, Tool], context: dict, now: str) -> tuple[dict, dict]:
    """(cifra, fila de estado del enjambre). Una herramienta que falla nunca produce un valor."""
    tool = tools[f.tool]
    start = time.perf_counter()
    row = {"agent": agent_id, "label": agent_label, "tool": tool.label, "status": "no_conectado",
           "latency_ms": None, "data_date": None, "detail": ""}
    try:
        result = tool.fetch(f.query, context)
    except NotConnected as exc:
        row["detail"] = str(exc)
    except Exception as exc:  # la fuente respondió mal o no respondió
        row.update(status="error", latency_ms=round((time.perf_counter() - start) * 1000, 1),
                   detail=f"la fuente falló ({type(exc).__name__})")
    else:
        row.update(status="ok", latency_ms=round((time.perf_counter() - start) * 1000, 1),
                   data_date=result.data_date, detail=f.label)
        fig = figure(f.id, f.label, result.value, f.unit, source=tool.source, status="verificado",
                     method=result.method, calibration=result.calibration, measured_at=result.data_date)
        return fig, row
    fig = figure(f.id, f.label, None, f.unit, source=tool.source, status="no_conectado",
                 method=f"consulta a {tool.label}. Sin ejecutar: {row['detail']}", measured_at=now)
    return fig, row


def run_data_agent(agent: DataAgent, tools: dict[str, Tool], context: dict, now: str) -> tuple[dict, list[dict]]:
    figs, rows = [], []
    for f in agent.findings:
        fig, row = run_finding(agent.id, agent.label, f, tools, context, now)
        figs.append(fig)
        rows.append(row)
    # Una fila de estado por herramienta distinta que usa el agente.
    merged: dict[str, dict] = {}
    for row in rows:
        merged.setdefault(row["tool"], row)
    return ({"id": agent.id, "label": agent.label, "kind": "data", "findings": figs,
             "reading": None, "recommendation": None, "score": None}, list(merged.values()))


# --- Agente Riesgo ---
STREAMING_REFERENCE_LUFS = -14.0
_num = lambda v: f"{v:.1f}".replace(".", ",").replace("-", "−")  # noqa: E731


def run_risk_agent(report: dict[str, Any], tools: dict[str, Tool], context: dict, now: str) -> tuple[dict, list[dict]]:
    """Señales técnicas del máster (derivadas de cifras medidas y calibradas) + riesgos de mercado."""
    d = report["descriptors"]
    figs: list[dict] = []

    def derived(id: str, label: str, base: dict, text: str | None, method: str) -> dict:
        if text is None or not passes(base):
            return figure(id, label, None, None, source="agente:riesgo", status="pendiente",
                          method=f"{method}. Sin calcular: la medida de origen no supera la regla de procedencia", measured_at=now)
        # Aritmética sobre una medida calibrada: hereda su calibración y su fecha.
        return figure(id, label, text, None, source="agente:riesgo", status="medido",
                      method=f"{method}; a partir de «{base['label']}» ({base['source']}, {base['measured_at'][:10]})",
                      calibration=base["calibration"], measured_at=base["measured_at"])

    lufs = d["loudness"]["value"]
    text = None
    if isinstance(lufs, (int, float)):
        gap = lufs - STREAMING_REFERENCE_LUFS
        side = "por encima" if gap > 0 else "por debajo"
        text = (f"{_num(lufs)} LUFS: en la referencia de −14 LUFS" if abs(gap) < 0.5
                else f"{_num(lufs)} LUFS: {_num(abs(gap))} LU {side} de la referencia de −14 LUFS")
    figs.append(derived("risk_loudness", "Sonoridad frente al streaming", d["loudness"], text,
                        "sonoridad integrada menos la referencia de normalización de −14 LUFS"))

    lra = d["dynamics"]["value"]
    text = None
    if isinstance(lra, (int, float)):
        band = "estrecho (menos de 5 LU)" if lra < 5 else "amplio (más de 12 LU)" if lra > 12 else "medio (entre 5 y 12 LU)"
        text = f"{_num(lra)} LU de rango de sonoridad: {band}"
    figs.append(derived("risk_dynamics", "Rango dinámico", d["dynamics"], text,
                        "rango de sonoridad clasificado con cortes fijos en 5 y 12 LU"))

    rows = []
    for f in (Finding("market_saturation", "Saturación del género", "google_trends", "genre.saturation"),):
        fig, row = run_finding("riesgo", "Riesgo", f, tools, context, now)
        figs.append(fig)
        rows.append(row)
    rows.insert(0, {"agent": "riesgo", "label": "Riesgo", "tool": "Análisis de audio", "status": "ok",
                    "latency_ms": 0.0, "data_date": d["loudness"]["measured_at"], "detail": "señales técnicas del máster"})
    return ({"id": "riesgo", "label": "Riesgo", "kind": "risk", "findings": figs,
             "reading": None, "recommendation": None, "score": None}, rows)
