"""Construye el reporte de una pista. Cada cifra sale con su procedencia; lo que no se puede
medir sale con value=None y un estado que lo explica, y el visor se abstiene."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from . import artist_graph, db, tribes as tribes_mod
from . import coherence as coh
from .swarm import orchestrator
from .audio import descriptors, emotion, envelope, structure
from .audio.io import Audio, load
from .calibration.registry import calibration_for, method_for
from .config import SCHEMA_VERSION
from .contract import figure, now_iso, validation_errors
from .lyrics import analyze as lyr

DIMENSIONS = [
    ("poder", "Poder"), ("rebeldia", "Rebeldía"), ("tension", "Tensión"), ("ansiedad", "Ansiedad"),
    ("tristeza", "Tristeza"), ("nostalgia", "Nostalgia"), ("ternura", "Ternura"), ("belleza", "Belleza"),
    ("erotismo", "Erotismo"), ("ensonacion", "Ensoñación"), ("triunfo", "Triunfo"),
    ("diversion", "Diversión"), ("asombro", "Asombro"),
]
DESCRIPTORS = [
    ("loudness", "Sonoridad", "LUFS"), ("tempo", "Pulso", "BPM"), ("key", "Tonalidad", None),
    ("brightness", "Brillo", "Hz"), ("dynamics", "Dinámica", "LU"),
    ("onset_density", "Densidad de ataques", "ataques/s"), ("climax", "Clímax", "s"),
]
TURN_JUMP = 0.4


def quadrant_of(valence: float, arousal: float) -> str:
    if valence >= 0:
        return "FIESTA" if arousal >= 0 else "CHILL"
    return "DEFIANCE" if arousal >= 0 else "NOSTALGICA"


def detect_turns(sections: list[dict]) -> list[dict]:
    """Giros entre tramos consecutivos: cambio de cuadrante o salto > 0,4 en valencia o activación."""
    turns = []
    for prev, cur in zip(sections, sections[1:]):
        if prev["valence"] is None or cur["valence"] is None:
            continue
        if prev["quadrant"] != cur["quadrant"]:
            turns.append({"t": cur["t0"], "kind": "quadrant", "from": prev["quadrant"], "to": cur["quadrant"], "delta": None})
        for axis in ("valence", "arousal"):
            delta = cur[axis] - prev[axis]
            if abs(delta) > TURN_JUMP:
                turns.append({"t": cur["t0"], "kind": axis, "from": f"{prev[axis]:.2f}", "to": f"{cur[axis]:.2f}", "delta": round(delta, 3)})
    return turns


def _emotion_blocks(path: Path, windows: list[dict], sections: list[dict], now: str) -> dict[str, Any]:
    """Valencia/activación con Essentia si está disponible; si no, cifras pendientes sin valor."""
    ok, reason = emotion.available()
    pending = dict(source=emotion.SOURCE, status="pendiente", measured_at=now)

    if not ok:
        method = f"{emotion.METHOD}. Sin ejecutar: {reason}"
        return {
            "russell": {
                "valence": figure("valence", "Valencia", None, None, method=method, **pending),
                "arousal": figure("arousal", "Activación", None, None, method=method, **pending),
                "quadrant": figure("quadrant", "Cuadrante", None, None, method=method, **pending),
            },
            "series_emotion": figure("series_emotion", "Serie emocional", None, "ventanas", method=method, **pending),
            "embeddings": figure("embeddings", "Embeddings", None, None, method=method, **pending),
            "vector": None,
        }

    preds, vector = emotion.predict_windows(path, [(w["t0"], w["t1"]) for w in windows])
    for w, (v, a) in zip(windows, preds):
        w["valence"], w["arousal"] = round(v, 3), round(a, 3)
    total = sum(w["energy"] for w in windows) or 1.0
    g_v = sum(w["valence"] * w["energy"] for w in windows) / total  # media ponderada por energía
    g_a = sum(w["arousal"] * w["energy"] for w in windows) / total
    for s in sections:
        inside = [w for w in windows if s["t0"] <= (w["t0"] + w["t1"]) / 2 < s["t1"]] or windows[:1]
        s["valence"] = round(sum(w["valence"] for w in inside) / len(inside), 3)
        s["arousal"] = round(sum(w["arousal"] for w in inside) / len(inside), 3)
        s["quadrant"] = quadrant_of(s["valence"], s["arousal"])

    # El modelo es real pero aún no se ha calibrado contra DEAM + PMEmo + panel: "heurístico",
    # sin calibración. El visor se abstiene salvo en modo desarrollo ("NO CALIBRADO").
    live = dict(source=emotion.SOURCE, status="heurístico", method=emotion.METHOD, measured_at=now)
    return {
        "russell": {
            "valence": figure("valence", "Valencia", round(g_v, 3), None, **live),
            "arousal": figure("arousal", "Activación", round(g_a, 3), None, **live),
            "quadrant": figure("quadrant", "Cuadrante", quadrant_of(g_v, g_a), None, **live),
        },
        "series_emotion": figure("series_emotion", "Serie emocional", len(windows), "ventanas", **live),
        "embeddings": figure("embeddings", "Embeddings", emotion.EMBEDDINGS_LABEL, None, **live),
        "vector": vector,
    }


def _lyrics_blocks(text: str, sections: list[dict], now: str, client: Any = None) -> tuple[dict | None, dict | None]:
    """(lyrics, coherence). Sin letra: (None, None). Si el analizador falla, la letra sale sin valores."""
    if not text.strip():
        return None, None

    def lyric_fig(id: str, label: str, value: Any, unit: str | None, status: str, method: str) -> dict:
        return figure(id, label, value, unit, source=lyr.SOURCE, status=status, method=method, measured_at=now)

    try:
        blocks = lyr.analyze(text, client=client)
    except lyr.LyricsUnavailable as exc:
        method = f"{lyr.METHOD}. Sin ejecutar: {exc}"
        return {
            "provenance": lyric_fig("lyrics", "Análisis de la letra", None, "tramos", "no_conectado", method),
            "valence": lyric_fig("lyrics_valence", "Valencia de la letra", None, None, "no_conectado", method),
            "arousal": lyric_fig("lyrics_arousal", "Activación de la letra", None, None, "no_conectado", method),
            "sections": [],
        }, None

    aligned = lyr.align(blocks, sections)
    n = len(blocks)
    # Modelo real sin calibrar contra letras anotadas: "heurístico", sin calibración.
    lyrics = {
        "provenance": lyric_fig("lyrics", "Análisis de la letra", len(aligned), "tramos", "heurístico", lyr.METHOD),
        "valence": lyric_fig("lyrics_valence", "Valencia de la letra", round(sum(b["valence"] for b in blocks) / n, 3), None, "heurístico", lyr.METHOD),
        "arousal": lyric_fig("lyrics_arousal", "Activación de la letra", round(sum(b["arousal"] for b in blocks) / n, 3), None, "heurístico", lyr.METHOD),
        "sections": aligned,
    }

    by_id = {s["id"]: s for s in sections}
    scored = []
    for entry in aligned:
        s = by_id[entry["section_id"]]
        if s["valence"] is None or s["arousal"] is None:
            return lyrics, None  # sin emociones del audio no hay con qué comparar
        # El audio aún no tiene perfil de 13 dimensiones: se compara solo valencia × activación.
        score = coh.coherence({"valence": s["valence"], "arousal": s["arousal"], "dims": {}}, entry)
        scored.append((s, entry, score))
    total = sum(s["t1"] - s["t0"] for s, _, _ in scored)
    overall = int(sum(score * (s["t1"] - s["t0"]) for s, _, score in scored) / total + 0.5)
    worst = min(scored, key=lambda x: x[2])
    method = ("1 − distancia normalizada entre audio y letra por tramo, media ponderada por duración; "
              "solo valencia × activación mientras el audio no tenga las 13 dimensiones · v1")
    meta = dict(source="modelo:singularity-coherencia", status="heurístico", method=method, measured_at=now)
    return lyrics, {
        "overall": figure("coherence", "Coherencia letra ↔ sonido", overall, "%", **meta),
        "explanation": figure("coherence_explanation", "Dónde se separan", coh.explain(worst[0], worst[1], worst[2]), None, **meta),
        "sections": [{"section_id": s["id"], "score": score, "label": coh.label(score)} for s, _, score in scored],
    }


def build_report(
    audio: Audio, *, track: dict[str, Any], wav_path: Path, lyrics_text: str = "", lyrics_client: Any = None,
    swarm_tools: dict | None = None,
) -> dict[str, Any]:
    now = now_iso()
    measured = descriptors.measure_all(audio)
    env = envelope.compute(audio)
    windows = envelope.windows(audio.duration, env["rms"])
    sections = structure.analyze(audio)
    emo = _emotion_blocks(wav_path, windows, sections, now)
    lyrics, coherence = _lyrics_blocks(lyrics_text, sections, now, lyrics_client)

    def measured_fig(key: str, label: str, value: Any, unit: str | None) -> dict:
        return figure(key, label, value, unit, source="audio", status="medido",
                      method=method_for(key), calibration=calibration_for(key), measured_at=now)

    dims_method = ("cabezal multietiqueta de 13 dimensiones sobre los embeddings. Sin entrenar: "
                   "faltan las anotaciones del panel de oyentes (mín. 30 por pista de validación)")
    dims_pending = dict(source="modelo:singularity-13d", status="pendiente", method=dims_method, measured_at=now)

    report = {
        "schema_version": SCHEMA_VERSION,
        "demo": False,
        "generated_at": now,
        "track": {**track, "duration_s": round(audio.duration, 3)},
        "descriptors": {key: measured_fig(key, label, measured[key], unit) for key, label, unit in DESCRIPTORS},
        "russell": emo["russell"],
        "dimensions": [figure(k, label, None, "%", **dims_pending) for k, label in DIMENSIONS],
        "dominant": figure("dominant", "Emoción dominante", None, None, **dims_pending),
        "series": {
            "emotion": emo["series_emotion"],
            "energy": measured_fig("energy", "Envolvente de energía", len(env["rms"]), "muestras"),
            "structure": measured_fig("structure", "Estructura", len(sections), "tramos"),
        },
        "windows": windows,
        "envelope": env,
        "sections": sections,
        "markers": [
            {"t": 0, "kind": "intro", "label": "Inicio"},
            {"t": measured["climax"], "kind": "climax", "label": "Clímax"},
        ],
        "turns": detect_turns(sections),
        "lyrics": lyrics,
        "coherence": coherence,
        # La psicografía dependía de Chartmetric o Spotify for Artists, que están excluidos.
        "psychographics": [],
        "embeddings": emo["embeddings"],
    }
    # --- Módulo 2: enjambre, tribus y ADN del artista ---
    report.update(orchestrator.run(report, now, tools=swarm_tools, llm_client=lyrics_client))
    refs: list[dict] = []
    db_ok, db_reason = db.available()
    if db_ok:
        try:
            refs = db.reference_vectors()
        except Exception as exc:
            db_ok, db_reason = False, f"la base de datos no respondió ({type(exc).__name__})"
    if db_ok:
        report["tribe_graph"], report["tribes"] = tribes_mod.build(emo["vector"], refs, track["title"], now)
    else:
        report["tribe_graph"], report["tribes"] = tribes_mod.empty(db_reason, "no_conectado", now)
    report["swarm"].append({
        "agent": "tribus", "label": "Tribus · ADN del artista", "tool": "Postgres + pgvector",
        "status": "ok" if db_ok else "no_conectado", "latency_ms": None, "data_date": None,
        "detail": f"catálogo de referencia: {len(refs)} entradas" if db_ok else db_reason,
    })
    rv, ra, rq = (emo["russell"][k]["value"] for k in ("valence", "arousal", "quadrant"))
    report["artist_dna"] = artist_graph.record_and_summarize(track, emo["vector"], rv, ra, rq, now)

    errors = validation_errors(report)
    if errors:
        raise RuntimeError("El reporte generado no valida contra el esquema: " + "; ".join(errors[:5]))
    return report


def analyze_file(wav_path: Path, *, track: dict[str, Any], lyrics_text: str = "", lyrics_client: Any = None,
                 swarm_tools: dict | None = None) -> dict[str, Any]:
    return build_report(load(wav_path), track=track, wav_path=wav_path, lyrics_text=lyrics_text,
                        lyrics_client=lyrics_client, swarm_tools=swarm_tools)
