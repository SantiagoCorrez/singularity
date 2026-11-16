"""API de Singularity.

    uvicorn singularity_api.main:app --port 8010
"""
from __future__ import annotations

import soundfile as sf
from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from . import jobs, store
from .config import MAX_DURATION_S, MAX_UPLOAD_BYTES, MIN_DURATION_S, WEB_ORIGINS

app = FastAPI(title="Singularity API", version="0.3.0")

# El navegador sube el WAV directamente a la API: el proxy de Next no aguanta archivos de
# decenas de MB. Solo se admiten los orígenes de la web, y sin credenciales.
app.add_middleware(
    CORSMiddleware,
    allow_origins=WEB_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def _meta_or_404(track_id: str) -> dict:
    try:
        return store.load_meta(track_id)
    except KeyError:
        raise HTTPException(404, "No existe esa pista.") from None


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


@app.post("/api/tracks", status_code=202)
async def create_track(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    title: str = Form(""),
    artist: str = Form(""),
    lyrics: str = Form(""),
) -> dict:
    track_id = store.new_id()
    directory = store.track_dir(track_id)
    directory.mkdir(parents=True, exist_ok=False)
    path = store.wav_path(track_id)

    size = 0
    with path.open("wb") as out:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_UPLOAD_BYTES:
                break
            out.write(chunk)

    problem = None
    if size > MAX_UPLOAD_BYTES:
        problem = f"El archivo supera el máximo de {MAX_UPLOAD_BYTES // (1024 * 1024)} MB."
    else:
        try:
            info = sf.info(str(path))
            if info.format != "WAV":
                problem = f"El archivo es {info.format}, no WAV. Sube la canción en WAV."
            elif not MIN_DURATION_S <= info.duration <= MAX_DURATION_S:
                problem = f"La pista dura {info.duration:.0f} s; debe durar entre {MIN_DURATION_S:.0f} s y {MAX_DURATION_S / 60:.0f} min."
        except Exception:
            problem = "No se pudo leer el archivo. Sube un WAV válido."
    if problem:
        path.unlink(missing_ok=True)
        directory.rmdir()
        raise HTTPException(422, problem)

    fallback = (file.filename or "Pista sin título").rsplit(".", 1)[0]
    store.save_meta(
        track_id,
        {
            "id": track_id,
            "title": title.strip()[:200] or fallback[:200],
            "artist": artist.strip()[:200] or "Artista sin nombre",
            "lyrics": lyrics.strip()[:20000],
            "status": "queued",
            "error": None,
        },
    )
    jobs.enqueue(track_id, background)
    return {"id": track_id, "status": "queued"}


@app.get("/api/tracks/{track_id}")
def track_status(track_id: str) -> dict:
    meta = _meta_or_404(track_id)
    return {k: meta[k] for k in ("id", "title", "artist", "status", "error")}


@app.get("/api/tracks/{track_id}/report")
def track_report(track_id: str) -> dict:
    meta = _meta_or_404(track_id)
    if meta["status"] != "done":
        raise HTTPException(409, f"El reporte aún no está listo (estado: {meta['status']}).")
    return store.load_report(track_id)


@app.get("/api/tracks/{track_id}/audio")
def track_audio(track_id: str) -> FileResponse:
    _meta_or_404(track_id)
    return FileResponse(store.wav_path(track_id), media_type="audio/wav")
