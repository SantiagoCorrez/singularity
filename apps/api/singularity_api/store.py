"""Almacén de pistas y reportes en disco. Interfaz mínima para sustituirla por S3 + Postgres."""
from __future__ import annotations

import json
import re
import uuid
from pathlib import Path
from typing import Any

from .config import DATA_DIR

_ID_RE = re.compile(r"^[a-f0-9]{12}$")


def new_id() -> str:
    return uuid.uuid4().hex[:12]


def track_dir(track_id: str) -> Path:
    if not _ID_RE.match(track_id):  # el id llega en la URL: nunca se usa como ruta sin validar
        raise KeyError(track_id)
    return DATA_DIR / "tracks" / track_id


def wav_path(track_id: str) -> Path:
    return track_dir(track_id) / "audio.wav"


def _write(path: Path, data: dict[str, Any]) -> None:
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


def save_meta(track_id: str, meta: dict[str, Any]) -> None:
    _write(track_dir(track_id) / "track.json", meta)


def load_meta(track_id: str) -> dict[str, Any]:
    path = track_dir(track_id) / "track.json"
    if not path.exists():
        raise KeyError(track_id)
    return json.loads(path.read_text(encoding="utf-8"))


def update_meta(track_id: str, **patch: Any) -> dict[str, Any]:
    meta = {**load_meta(track_id), **patch}
    save_meta(track_id, meta)
    return meta


def save_report(track_id: str, report: dict[str, Any]) -> None:
    _write(track_dir(track_id) / "report.json", report)


def load_report(track_id: str) -> dict[str, Any]:
    path = track_dir(track_id) / "report.json"
    if not path.exists():
        raise KeyError(track_id)
    return json.loads(path.read_text(encoding="utf-8"))
