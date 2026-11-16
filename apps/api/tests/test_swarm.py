"""Módulo 2: enjambre, tribus y ADN del artista. Las fuentes externas se simulan: se prueba
la procedencia, el aislamiento de fallos y que nada se inventa cuando una fuente no está."""
import json
from types import SimpleNamespace

import numpy as np
import pytest

from singularity_api import artist_graph, tribes
from singularity_api.contract import passes, validation_errors
from singularity_api.swarm import orchestrator, perspectives
from singularity_api.swarm.agents import DATA_AGENTS, run_risk_agent
from singularity_api.swarm.tools import Tool, ToolResult, default_tools

NOW = "2026-11-15T00:00:00Z"
CAL = {"ref": "prueba", "metric": "MAE", "score": 0.1, "threshold": 0.5, "n": 7, "passed": True, "tested_at": NOW}


def measured(id, label, value, unit=None, cal=CAL):
    return {"id": id, "label": label, "value": value, "unit": unit, "source": "audio", "measured_at": NOW,
            "status": "medido", "method": "m", "calibration": cal}


REPORT = {"track": {"id": "abcdef012345", "title": "Tema", "artist": "Yo"},
          "descriptors": {"loudness": measured("loudness", "Sonoridad", -9.4, "LUFS"),
                          "dynamics": measured("dynamics", "Dinámica", 3.8, "LU"),
                          "tempo": measured("tempo", "Pulso", 120, "BPM")}}


def connected_tools(fail=()):
    def adapter(name):
        def fetch(query, context):
            if name in fail:
                raise TimeoutError("la fuente no respondió")
            return ToolResult(value=f"dato de {name}:{query}", data_date="2026-11-10T00:00:00Z", method=f"API de {name}", calibration=CAL)
        return fetch
    return {n: Tool(n, t.label, t.source, [], adapter(n)) for n, t in default_tools().items()}


class FakeLLM:
    def __init__(self, payload):
        self.payload, self.calls = payload, []
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self._create))

    def _create(self, **kw):
        self.calls.append(kw)
        return SimpleNamespace(stop_reason="end_turn", content=[SimpleNamespace(type="text", text=json.dumps(self.payload))])


def view(role, cited):
    return {"role": role, "reading": f"lectura de {role}", "recommendation": "haz esto", "score": 72, "cited_ids": cited}


# ---------- Enjambre ----------
def test_without_credentials_everything_abstains(monkeypatch):
    for t in default_tools().values():
        for v in t.env:
            monkeypatch.delenv(v, raising=False)
    out = orchestrator.run(REPORT, NOW)
    data = [a for a in out["agents"] if a["kind"] == "data"]
    assert [a["id"] for a in data] == [a.id for a in DATA_AGENTS]
    for a in data:
        assert all(f["value"] is None and f["status"] == "no_conectado" for f in a["findings"])
    rows = [r for r in out["swarm"] if r["agent"] in {a.id for a in DATA_AGENTS}]
    assert rows and all(r["status"] == "no_conectado" and "faltan credenciales" in r["detail"] for r in rows)
    for a in out["agents"]:
        if a["kind"] == "perspective":
            assert a["reading"]["value"] is None and a["score"]["value"] is None


def test_credentials_without_adapter_are_still_not_connected(monkeypatch):
    monkeypatch.setenv("YOUTUBE_API_KEY", "x")
    assert "adaptador" in default_tools()["youtube"].why_not()


def test_one_source_down_only_its_figures_abstain():
    out = orchestrator.run(REPORT, NOW, tools=connected_tools(fail={"youtube"}), llm_client=FakeLLM({"perspectives": []}))
    figs = {f["id"]: f for a in out["agents"] for f in a["findings"]}
    assert figs["youtube_rising"]["value"] is None and figs["youtube_rising"]["status"] == "no_conectado"
    assert figs["tiktok_rising"]["value"] is not None  # mismo agente, otra fuente: sigue en pie
    assert passes(figs["genre_trend_12m"]) and figs["genre_trend_12m"]["source"] == "google_trends"
    assert figs["genre_trend_12m"]["measured_at"] == "2026-11-10T00:00:00Z"  # la fecha es la de los datos
    row = next(r for r in out["swarm"] if r["agent"] == "tendencias" and r["tool"] == "YouTube")
    assert row["status"] == "error" and row["latency_ms"] is not None
    ok = next(r for r in out["swarm"] if r["agent"] == "tendencias" and r["tool"] == "Google Trends")
    assert ok["status"] == "ok" and ok["data_date"] == "2026-11-10T00:00:00Z"


def test_an_agent_that_crashes_does_not_take_the_swarm_down(monkeypatch):
    from singularity_api.swarm import orchestrator as orch

    real = orch.run_data_agent

    def flaky(agent, *a, **k):
        if agent.id == "tendencias":
            raise RuntimeError("bug")
        return real(agent, *a, **k)

    monkeypatch.setattr(orch, "run_data_agent", flaky)
    out = orch.run(REPORT, NOW, tools=connected_tools(), llm_client=FakeLLM({"perspectives": []}))
    by = {a["id"]: a for a in out["agents"]}
    assert all(f["value"] is None for f in by["tendencias"]["findings"])
    assert by["riesgo"]["findings"][0]["value"] is not None  # el resto del enjambre sigue
    assert next(r for r in out["swarm"] if r["agent"] == "tendencias")["status"] == "error"


# ---------- Riesgo ----------
def test_risk_derives_only_from_calibrated_measurements():
    agent, rows = run_risk_agent(REPORT, default_tools(), {}, NOW)
    figs = {f["id"]: f for f in agent["findings"]}
    assert figs["risk_loudness"]["value"] == "−9,4 LUFS: 4,6 LU por encima de la referencia de −14 LUFS"
    assert figs["risk_dynamics"]["value"].endswith("estrecho (menos de 5 LU)")
    assert passes(figs["risk_loudness"]) and figs["risk_loudness"]["source"] == "agente:riesgo"
    assert figs["market_saturation"]["value"] is None and figs["market_saturation"]["status"] == "no_conectado"
    assert "release_clash" not in figs  # dependía de Chartmetric, que está excluido

    uncal = {**REPORT, "descriptors": {**REPORT["descriptors"], "loudness": measured("loudness", "Sonoridad", -9.4, "LUFS", cal=None)}}
    agent, _ = run_risk_agent(uncal, default_tools(), {}, NOW)
    assert next(f for f in agent["findings"] if f["id"] == "risk_loudness")["value"] is None


# ---------- Perspectivas ----------
def test_perspectives_need_market_evidence_before_calling_the_model():
    llm = FakeLLM({"perspectives": [view("manager", ["tempo"])]})
    agents = [run_risk_agent(REPORT, default_tools(), {}, NOW)[0]]
    views, row = perspectives.run(REPORT, agents, NOW, client=llm)
    assert llm.calls == [] and row["status"] == "no_conectado"
    assert all(v["reading"]["value"] is None for v in views)


def test_perspectives_must_cite_real_evidence():
    out0 = orchestrator.run(REPORT, NOW, tools=connected_tools(), llm_client=FakeLLM({"perspectives": []}))
    agents = [a for a in out0["agents"] if a["kind"] != "perspective"]
    llm = FakeLLM({"perspectives": [view("manager", ["genre_trend_12m", "tempo"]), view("marketing", ["inventada"]), view("pr", [])]})
    views, row = perspectives.run(REPORT, agents, NOW, client=llm)
    by = {v["id"]: v for v in views}
    assert by["manager"]["reading"]["value"] == "lectura de manager" and by["manager"]["score"]["value"] == 72
    assert "Interés del género por país, 12 meses (google_trends, 2026-11-10)" in by["manager"]["reading"]["method"]
    assert by["manager"]["reading"]["status"] == "heurístico" and not passes(by["manager"]["reading"])
    assert by["marketing"]["reading"]["value"] is None  # citó algo que no existe
    assert by["pr"]["reading"]["value"] is None  # no citó nada
    sent = llm.calls[0]["messages"][0]["content"]
    assert "id=genre_trend_12m" in sent and "id=market_saturation" in sent and row["status"] == "ok"


# ---------- Tribus ----------
def blobs(rng, centers, per=6, dim=200):
    refs = []
    for c, center in enumerate(centers):
        for i in range(per):
            refs.append({"kind": "playlist", "ref_id": f"{c}-{i}", "name": f"Playlist {c}-{i}", "source": "youtube",
                         "measured_at": NOW, "reach": 1000.0 * (i + 1), "growth_90d": 0.1 * (c + 1),
                         "quadrant": "FIESTA", "embedding": list(center + 0.05 * rng.standard_normal(dim))})
    return refs


def test_tribes_find_the_clusters_and_rank_by_affinity_times_growth():
    rng = np.random.default_rng(0)
    centers = [rng.standard_normal(200) for _ in range(3)]
    graph, found = tribes.build(list(centers[0]), blobs(rng, centers), "Tema", NOW)
    assert len(found) == 3
    best = max(found, key=lambda t: t["affinity"]["value"])
    assert best["affinity"]["value"] >= 95 and best["size"]["value"] == 21000
    assert found[0] is best  # la más afín gana aunque crezca menos: 99 × 10 > ~0 × 30
    assert graph["nodes"][0]["kind"] == "song" and all(n["source"] and n["measured_at"] for n in graph["nodes"])
    assert not passes(best["affinity"]) and best["emotion"]["value"] is None


@pytest.mark.parametrize("embedding, refs, reason", [(None, [], "embedding"), ([0.1] * 200, [], "catálogo")])
def test_no_data_no_tribes(embedding, refs, reason):
    graph, found = tribes.build(embedding, refs, "Tema", NOW)
    assert found == [] and graph["nodes"] == [] and graph["provenance"]["value"] is None
    assert reason in graph["provenance"]["method"]


# ---------- ADN ----------
def test_artist_dna_needs_two_tracks():
    rng = np.random.default_rng(1)
    base = rng.standard_normal(200)
    t = lambda i, v, a: {"track_id": f"t{i}", "title": f"T{i}", "analyzed_at": NOW, "embedding": list(base + 0.01 * rng.standard_normal(200)),  # noqa: E731
                         "valence": v, "arousal": a, "quadrant": "FIESTA"}
    one = artist_graph.summarize([t(1, 0.1, 0.2)], NOW)
    assert one["consistency"]["value"] is None and one["evolution"]["value"] is None
    two = artist_graph.summarize([t(1, 0.1, 0.2), t(2, -0.3, 0.5)], NOW)
    assert two["consistency"]["value"] >= 99
    assert two["evolution"]["value"] == "valencia +0,10 → −0,30 · activación +0,20 → +0,50"
    assert two["gaps"]["value"] is None and "embedding" not in two["tracks"][0]
    assert artist_graph.artist_key("  La  Banda ") == "la banda"


def test_no_database_means_not_connected(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    dna = artist_graph.record_and_summarize(REPORT["track"], [0.1] * 200, 0.1, 0.2, "FIESTA", NOW)
    assert dna["consistency"]["status"] == "no_conectado" and dna["tracks"] == []


def test_full_report_with_module_2_validates():
    from singularity_api import config
    from singularity_api.pipeline import analyze_file

    wav = config.REPO_ROOT / "apps" / "web" / "public" / "demo" / "track.demo.wav"
    report = analyze_file(wav, track={"id": "abcdef012345", "title": "t", "artist": "a", "audio_url": "x"})
    assert validation_errors(report) == []
    assert [a["id"] for a in report["agents"]] == ["tendencias", "riesgo", "manager", "marketing", "pr"]
    assert report["psychographics"] == []
    text = json.dumps(report, ensure_ascii=False).lower()
    assert "chartmetric" not in text and "spotify" not in text  # fuentes excluidas: no aparecen en el reporte
    risk = next(a for a in report["agents"] if a["id"] == "riesgo")
    assert passes(risk["findings"][0])  # la señal técnica del máster sí se puede mostrar
