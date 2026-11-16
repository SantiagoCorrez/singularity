"""El pipeline sobre audio real (el WAV sintético de la demo) y la API de punta a punta."""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from singularity_api import config, store
from singularity_api.audio import emotion
from singularity_api.contract import validation_errors
from singularity_api.pipeline import analyze_file, detect_turns

DEMO_WAV = config.REPO_ROOT / "apps" / "web" / "public" / "demo" / "track.demo.wav"
TRACK = {"id": "abcdef012345", "title": "Prueba", "artist": "Test", "audio_url": "/api/tracks/abcdef012345/audio"}


@pytest.fixture(scope="module")
def report() -> dict:
    return analyze_file(DEMO_WAV, track=TRACK)


def test_report_validates_against_schema(report):
    assert validation_errors(report) == []
    assert report["demo"] is False


def test_descriptors_are_measured_and_calibrated(report):
    for key, fig in report["descriptors"].items():
        assert fig["source"] == "audio" and fig["status"] == "medido", key
        assert fig["value"] is not None, key
        assert fig["calibration"] and fig["calibration"]["passed"] is True, key


def test_known_properties_of_the_demo_track(report):
    # La pista de la demo está sintetizada a 120 BPM sobre La m – Fa – Do – Sol. Esa progresión
    # usa las mismas notas en La menor y en Do mayor (relativas), así que valen las dos lecturas.
    d = report["descriptors"]
    assert abs(d["tempo"]["value"] - 120) <= 2
    assert d["key"]["value"] in ("La menor", "Do mayor")
    assert 26 <= d["climax"]["value"] <= 58
    assert abs(report["track"]["duration_s"] - 64) < 0.1


@pytest.mark.skipif(emotion.available()[0], reason="con Essentia instalado las emociones sí se calculan")
def test_unavailable_emotions_are_never_invented(report):
    # Sin Essentia ni cabezal entrenado, las emociones salen sin valor; no se rellenan.
    for fig in [*report["russell"].values(), *report["dimensions"], report["dominant"], report["series"]["emotion"]]:
        assert fig["value"] is None and fig["status"] == "pendiente"
        assert fig["calibration"] is None
    assert all(w["valence"] is None and w["dims"] == {} for w in report["windows"])
    assert report["psychographics"] == []
    assert report["turns"] == [] and report["lyrics"] is None and report["coherence"] is None


def test_turn_detection():
    sections = [
        {"t0": 0, "valence": 0.2, "arousal": -0.3, "quadrant": "CHILL"},
        {"t0": 10, "valence": 0.3, "arousal": 0.3, "quadrant": "FIESTA"},
        {"t0": 20, "valence": 0.35, "arousal": 0.5, "quadrant": "FIESTA"},
    ]
    turns = detect_turns(sections)
    assert [(t["t"], t["kind"]) for t in turns] == [(10, "quadrant"), (10, "arousal")]


def test_api_upload_to_report(tmp_path, monkeypatch):
    monkeypatch.setattr(store, "DATA_DIR", tmp_path)
    from singularity_api.main import app

    client = TestClient(app)
    with DEMO_WAV.open("rb") as f:
        res = client.post("/api/tracks", files={"file": ("demo.wav", f, "audio/wav")}, data={"title": "Mi tema", "artist": "Yo"})
    assert res.status_code == 202
    track_id = res.json()["id"]
    assert client.get(f"/api/tracks/{track_id}").json()["status"] == "done"  # inline: termina antes de responder
    rep = client.get(f"/api/tracks/{track_id}/report").json()
    assert rep["track"]["title"] == "Mi tema" and validation_errors(rep) == []
    assert client.get(f"/api/tracks/{track_id}/audio").status_code == 200


def test_api_rejects_non_wav(tmp_path, monkeypatch):
    monkeypatch.setattr(store, "DATA_DIR", tmp_path)
    from singularity_api.main import app

    res = TestClient(app).post("/api/tracks", files={"file": ("x.wav", b"esto no es audio", "audio/wav")})
    assert res.status_code == 422
    assert not any(Path(tmp_path).rglob("audio.wav"))


def test_api_rejects_path_tricks(tmp_path, monkeypatch):
    monkeypatch.setattr(store, "DATA_DIR", tmp_path)
    from singularity_api.main import app

    assert TestClient(app).get("/api/tracks/..%2F..%2Fsecret").status_code == 404


def test_cors_allows_only_the_web_origin():
    from singularity_api.main import app

    client = TestClient(app)
    preflight = {"Access-Control-Request-Method": "POST"}
    ok = client.options("/api/tracks", headers={"Origin": "http://localhost:3000", **preflight})
    assert ok.status_code == 200 and ok.headers["access-control-allow-origin"] == "http://localhost:3000"
    other = client.options("/api/tracks", headers={"Origin": "https://otro-sitio.example", **preflight})
    assert "access-control-allow-origin" not in other.headers
    assert client.get("/api/health", headers={"Origin": "http://localhost:3000"}).headers["access-control-allow-origin"] == "http://localhost:3000"
