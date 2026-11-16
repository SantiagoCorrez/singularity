"""Herramientas del enjambre: una por fuente externa.

Chartmetric y Spotify están excluidos por decisión de producto (noviembre de 2026): Spotify no
da a una app nueva el contenido de playlists ajenas ni datos de audio. Con ellos salieron los
agentes de Audiencia, Playlists, Geolocalización y Oportunidades y la psicografía.

Estado actual: ningún adaptador está escrito todavía. Cada uno se implementará y se probará
contra la API real cuando haya credenciales; escribirlos a ciegas produciría datos que no
se pueden verificar. Mientras tanto fetch() lanza NotConnected y el visor se abstiene.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any, Callable


class NotConnected(RuntimeError):
    """La herramienta no puede dar datos. El mensaje dice por qué."""


@dataclass
class ToolResult:
    value: Any
    data_date: str  # fecha de los datos según la fuente, ISO-8601
    method: str
    calibration: dict | None = None


@dataclass
class Tool:
    name: str
    label: str
    source: str  # valor del campo source de las cifras que produce
    env: list[str]
    #: consulta → ToolResult. None mientras el adaptador no exista.
    adapter: Callable[[str, dict], ToolResult] | None = field(default=None, repr=False)

    def why_not(self) -> str | None:
        missing = [v for v in self.env if not os.environ.get(v)]
        if missing:
            return f"faltan credenciales ({', '.join(missing)})"
        if self.adapter is None:
            return "hay credenciales, pero el adaptador de esta fuente aún no está escrito ni probado"
        return None

    def fetch(self, query: str, context: dict) -> ToolResult:
        reason = self.why_not()
        if reason:
            raise NotConnected(reason)
        return self.adapter(query, context)  # type: ignore[misc]


def default_tools() -> dict[str, Tool]:
    return {
        t.name: t
        for t in (
            Tool("youtube", "YouTube", "youtube", ["YOUTUBE_API_KEY"]),
            Tool("tiktok", "TikTok", "tiktok", ["TIKTOK_ACCESS_TOKEN"]),
            Tool("google_trends", "Google Trends", "google_trends", ["GOOGLE_TRENDS_API_KEY"]),
        )
    }
