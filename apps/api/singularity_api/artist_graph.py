"""ADN del artista: memoria de todas sus pistas analizadas.

Hoy un artista se identifica por su nombre normalizado, porque aún no hay cuentas. El orden
de "lanzamientos" es el orden en que se analizaron las pistas, no su fecha de publicación.
"""
from __future__ import annotations

from typing import Any

import numpy as np

from . import db
from .contract import figure

SOURCE = "modelo:singularity-adn"


def artist_key(name: str) -> str:
    return " ".join(name.lower().split())


def summarize(tracks: list[dict[str, Any]], now: str) -> dict[str, Any]:
    """tracks en orden de análisis, cada una con embedding, valence, arousal, quadrant."""
    # Derivado de un modelo sin calibrar: "heurístico".
    meta = dict(source=SOURCE, status="heurístico", measured_at=now)
    n = len(tracks)

    if n >= 2:
        e = np.asarray([t["embedding"] for t in tracks], dtype=float)
        e /= np.linalg.norm(e, axis=1, keepdims=True) + 1e-12
        sims = (e @ e.T)[np.triu_indices(n, k=1)]
        consistency = figure("dna_consistency", "Consistencia sonora", int(round(float(sims.mean()) * 100)), "%",
                             method=f"similitud coseno media entre los embeddings de sus {n} pistas · v1", **meta)
    else:
        consistency = figure("dna_consistency", "Consistencia sonora", None, "%", source=SOURCE, status="pendiente", measured_at=now,
                             method="similitud coseno media entre pistas. Sin calcular: hace falta al menos una segunda pista del artista")

    with_emotion = [t for t in tracks if t["valence"] is not None and t["arousal"] is not None]
    if len(with_emotion) >= 2:
        a, b = with_emotion[0], with_emotion[-1]
        sign = lambda v: f"{v:+.2f}".replace("-", "−").replace(".", ",")  # noqa: E731
        text = f"valencia {sign(a['valence'])} → {sign(b['valence'])} · activación {sign(a['arousal'])} → {sign(b['arousal'])}"
        evolution = figure("dna_evolution", "Evolución emocional", text, None,
                           method=f"primera y última de {len(with_emotion)} pistas, en orden de análisis · v1", **meta)
    else:
        evolution = figure("dna_evolution", "Evolución emocional", None, None, source=SOURCE, status="pendiente", measured_at=now,
                           method="cambio de valencia y activación entre pistas. Sin calcular: hacen falta dos pistas con emoción")

    no_tribes = "Sin calcular: todavía no hay tribus (el catálogo de referencia está vacío)"
    return {
        "consistency": consistency,
        "evolution": evolution,
        "recurring_tribes": figure("dna_recurring", "Tribus recurrentes", None, None, source=SOURCE, status="pendiente",
                                   measured_at=now, method=f"tribus que se repiten entre sus pistas. {no_tribes}"),
        "gaps": figure("dna_gaps", "Huecos", None, None, source=SOURCE, status="pendiente", measured_at=now,
                       method=f"tribus afines que aún no alcanza. {no_tribes}"),
        "tracks": [{k: t[k] for k in ("track_id", "title", "analyzed_at", "valence", "arousal", "quadrant")} for t in tracks],
    }


def unavailable(reason: str, now: str) -> dict[str, Any]:
    def fig(id: str, label: str, unit: str | None = None) -> dict:
        return figure(id, label, None, unit, source=SOURCE, status="no_conectado", measured_at=now,
                      method=f"memoria por artista en Postgres + pgvector. Sin ejecutar: {reason}")
    return {"consistency": fig("dna_consistency", "Consistencia sonora", "%"), "evolution": fig("dna_evolution", "Evolución emocional"),
            "recurring_tribes": fig("dna_recurring", "Tribus recurrentes"), "gaps": fig("dna_gaps", "Huecos"), "tracks": []}


def record_and_summarize(track: dict[str, Any], embedding: list[float] | None, valence: float | None,
                         arousal: float | None, quadrant: str | None, now: str) -> dict[str, Any]:
    ok, reason = db.available()
    if not ok:
        return unavailable(reason, now)
    if embedding is None:
        return unavailable("esta pista no tiene embedding de audio", now)
    try:
        key = artist_key(track["artist"])
        db.upsert_track({"track_id": track["id"], "artist_key": key, "title": track["title"], "analyzed_at": now,
                         "embedding": embedding, "valence": valence, "arousal": arousal, "quadrant": quadrant})
        return summarize(db.artist_tracks(key), now)
    except Exception as exc:
        return unavailable(f"la base de datos no respondió ({type(exc).__name__})", now)
