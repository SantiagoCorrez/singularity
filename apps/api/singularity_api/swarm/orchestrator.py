"""Orquestador del enjambre. Los agentes corren en paralelo y aislados: si uno cae, solo
se abstienen sus cifras."""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from typing import Any

from ..contract import figure
from . import perspectives
from .agents import DATA_AGENTS, DataAgent, run_data_agent, run_risk_agent
from .tools import Tool, default_tools


def _crashed(agent: DataAgent, exc: Exception, now: str) -> tuple[dict, list[dict]]:
    detail = f"el agente falló ({type(exc).__name__})"
    figs = [figure(f.id, f.label, None, f.unit, source=f"agente:{agent.id}", status="no_conectado",
                   method=f"agente {agent.label}. Sin ejecutar: {detail}", measured_at=now) for f in agent.findings]
    row = {"agent": agent.id, "label": agent.label, "tool": "—", "status": "error",
           "latency_ms": None, "data_date": None, "detail": detail}
    return ({"id": agent.id, "label": agent.label, "kind": "data", "findings": figs,
             "reading": None, "recommendation": None, "score": None}, [row])


def run(report: dict[str, Any], now: str, *, tools: dict[str, Tool] | None = None,
        data_agents: list[DataAgent] | None = None, llm_client: Any = None) -> dict[str, Any]:
    """Devuelve {"agents": [...], "swarm": [...]} para el reporte."""
    tools = tools or default_tools()
    data_agents = DATA_AGENTS if data_agents is None else data_agents
    context = {"track": report["track"], "descriptors": report["descriptors"]}

    def safe(agent: DataAgent) -> tuple[dict, list[dict]]:
        try:
            return run_data_agent(agent, tools, context, now)
        except Exception as exc:
            return _crashed(agent, exc, now)

    with ThreadPoolExecutor(max_workers=max(1, len(data_agents))) as pool:
        results = list(pool.map(safe, data_agents))

    agents = [a for a, _ in results]
    swarm = [row for _, rows in results for row in rows]

    risk, risk_rows = run_risk_agent(report, tools, context, now)
    agents.append(risk)
    swarm.extend(risk_rows)

    views, row = perspectives.run(report, agents, now, client=llm_client)
    agents.extend(views)
    swarm.append(row)
    return {"agents": agents, "swarm": swarm}
