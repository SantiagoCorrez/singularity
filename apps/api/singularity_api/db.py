"""Postgres + pgvector. Opcional: sin DATABASE_URL, lo que depende de él sale "no_conectado"."""
from __future__ import annotations

import os
import threading
from typing import Any

EMBEDDING_DIM = 200  # MusiCNN (MSD)

_MIGRATION = f"""
CREATE EXTENSION IF NOT EXISTS vector;

-- Memoria por artista: una fila por pista analizada.
CREATE TABLE IF NOT EXISTS track_vectors (
    track_id    text PRIMARY KEY,
    artist_key  text NOT NULL,
    title       text NOT NULL,
    analyzed_at timestamptz NOT NULL,
    embedding   vector({EMBEDDING_DIM}) NOT NULL,
    valence     real,
    arousal     real,
    quadrant    text
);
CREATE INDEX IF NOT EXISTS track_vectors_artist ON track_vectors (artist_key, analyzed_at);

-- Catálogo de referencia para las tribus: playlists, curadores y artistas con su vector.
-- Hoy está vacío: aún no hay una fuente definida para llenarlo.
CREATE TABLE IF NOT EXISTS reference_vectors (
    kind        text NOT NULL CHECK (kind IN ('playlist', 'curator', 'artist')),
    ref_id      text NOT NULL,
    name        text NOT NULL,
    source      text NOT NULL,
    measured_at timestamptz NOT NULL,
    reach       double precision,
    growth_90d  double precision,
    quadrant    text,
    embedding   vector({EMBEDDING_DIM}) NOT NULL,
    PRIMARY KEY (kind, ref_id)
);
"""

_migrated = False
_lock = threading.Lock()


def available() -> tuple[bool, str]:
    if not os.environ.get("DATABASE_URL"):
        return False, "la base de datos no está configurada (falta DATABASE_URL)"
    try:
        import psycopg  # noqa: F401
    except Exception:
        return False, "falta el controlador de Postgres (psycopg)"
    return True, ""


def connect():
    import psycopg

    global _migrated
    conn = psycopg.connect(os.environ["DATABASE_URL"], connect_timeout=5)
    with _lock:
        if not _migrated:
            conn.execute(_MIGRATION)
            conn.commit()
            _migrated = True
    return conn


def _vec(v: list[float]) -> str:
    return "[" + ",".join(f"{x:.6f}" for x in v) + "]"


def _parse(text: str) -> list[float]:
    return [float(x) for x in text.strip("[]").split(",")]


def upsert_track(row: dict[str, Any]) -> None:
    with connect() as conn:
        conn.execute(
            """INSERT INTO track_vectors (track_id, artist_key, title, analyzed_at, embedding, valence, arousal, quadrant)
               VALUES (%s, %s, %s, %s, %s::vector, %s, %s, %s)
               ON CONFLICT (track_id) DO UPDATE SET artist_key = EXCLUDED.artist_key, title = EXCLUDED.title,
                   analyzed_at = EXCLUDED.analyzed_at, embedding = EXCLUDED.embedding, valence = EXCLUDED.valence,
                   arousal = EXCLUDED.arousal, quadrant = EXCLUDED.quadrant""",
            (row["track_id"], row["artist_key"], row["title"], row["analyzed_at"], _vec(row["embedding"]),
             row["valence"], row["arousal"], row["quadrant"]),
        )


def artist_tracks(artist_key: str) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            """SELECT track_id, title, analyzed_at, embedding::text, valence, arousal, quadrant
               FROM track_vectors WHERE artist_key = %s ORDER BY analyzed_at""",
            (artist_key,),
        ).fetchall()
    return [
        {"track_id": r[0], "title": r[1], "analyzed_at": r[2].strftime("%Y-%m-%dT%H:%M:%SZ"), "embedding": _parse(r[3]),
         "valence": r[4], "arousal": r[5], "quadrant": r[6]}
        for r in rows
    ]


def reference_vectors() -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT kind, ref_id, name, source, measured_at, reach, growth_90d, quadrant, embedding::text FROM reference_vectors"
        ).fetchall()
    return [
        {"kind": r[0], "ref_id": r[1], "name": r[2], "source": r[3], "measured_at": r[4].strftime("%Y-%m-%dT%H:%M:%SZ"),
         "reach": r[5], "growth_90d": r[6], "quadrant": r[7], "embedding": _parse(r[8])}
        for r in rows
    ]
