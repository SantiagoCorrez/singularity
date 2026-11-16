"""Trabajo de análisis de una pista. Lo ejecuta un hilo del servidor (inline) o un worker de RQ."""
from __future__ import annotations

import logging

from . import store
from .audio.io import InvalidAudio
from .config import QUEUE_MODE, REDIS_URL
from .pipeline import analyze_file

log = logging.getLogger("singularity.jobs")


def analyze_track(track_id: str) -> None:
    meta = store.update_meta(track_id, status="processing")
    try:
        report = analyze_file(
            store.wav_path(track_id),
            track={
                "id": track_id,
                "title": meta["title"],
                "artist": meta["artist"],
                "audio_url": f"/api/tracks/{track_id}/audio",
            },
            lyrics_text=meta.get("lyrics", ""),
        )
        store.save_report(track_id, report)
        store.update_meta(track_id, status="done")
    except InvalidAudio as exc:
        store.update_meta(track_id, status="error", error=str(exc))
    except Exception:
        log.exception("Falló el análisis de %s", track_id)
        store.update_meta(track_id, status="error", error="El análisis falló por un error interno. Vuelve a intentarlo.")


def enqueue(track_id: str, background) -> None:
    if QUEUE_MODE == "rq":
        from redis import Redis
        from rq import Queue

        Queue("analysis", connection=Redis.from_url(REDIS_URL)).enqueue(analyze_track, track_id, job_timeout=1800)
    else:
        background.add_task(analyze_track, track_id)
