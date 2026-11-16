"""Tribus: clústeres de playlists, curadores y artistas con afinidad sonora con la canción.

La canción y las referencias se comparan por su embedding de audio (coseno). El perfil de
13 dimensiones se sumará al vector cuando exista. Chartmetric y Spotify, las fuentes previstas para el catálogo de referencia, están excluidos, y
todavía no hay otra. Sin catálogo de referencia no hay tribus:
el grafo sale vacío y el visor muestra la maqueta gris "VISTA PREVIA SIN DATOS".
"""
from __future__ import annotations

from typing import Any

import numpy as np

from .contract import figure

METHOD = "HDBSCAN sobre embeddings de audio normalizados; afinidad = similitud coseno entre la canción y el centro de la tribu · v1"
MIN_REFERENCES = 6
MEMBERS_SHOWN = 4


def _unit(m: np.ndarray) -> np.ndarray:
    return m / (np.linalg.norm(m, axis=-1, keepdims=True) + 1e-12)


def cluster(embeddings: np.ndarray, min_cluster_size: int = 3) -> np.ndarray:
    """Etiqueta de clúster por fila (−1 = ruido)."""
    from sklearn.cluster import HDBSCAN

    return HDBSCAN(min_cluster_size=min_cluster_size, metric="euclidean").fit_predict(_unit(embeddings))


def empty(reason: str, status: str, now: str) -> tuple[dict, list]:
    prov = figure("tribe_graph", "Red de tribus", None, "nodos", source="modelo:singularity-tribus", status=status,
                  method=f"{METHOD}. Sin ejecutar: {reason}", measured_at=now)
    return {"provenance": prov, "nodes": [], "edges": []}, []


def build(song_embedding: list[float] | None, refs: list[dict[str, Any]], song_title: str, now: str) -> tuple[dict, list]:
    """(tribe_graph, tribes)."""
    if song_embedding is None:
        return empty("la canción no tiene embedding de audio", "pendiente", now)
    if len(refs) < MIN_REFERENCES:
        return empty(f"el catálogo de referencia tiene {len(refs)} entradas y hacen falta al menos {MIN_REFERENCES}; "
                     "aún no hay una fuente definida para llenarlo", "no_conectado", now)

    song = _unit(np.asarray(song_embedding, dtype=float))
    emb = _unit(np.asarray([r["embedding"] for r in refs], dtype=float))
    labels = cluster(emb)
    ids = sorted(set(int(v) for v in labels if v >= 0))
    if not ids:
        return empty("las referencias no forman ningún clúster", "pendiente", now)

    max_reach = max((r["reach"] or 0) for r in refs) or 1.0
    # Afinidad sin calibrar contra oyentes reales: "heurístico".
    model = dict(source="modelo:singularity-tribus", status="heurístico", method=METHOD, measured_at=now)
    nodes = [{"id": "song", "kind": "song", "label": song_title, "reach": None, "quadrant": None, "source": "audio", "measured_at": now}]
    edges, tribes = [], []

    for cid in ids:
        idx = [i for i, v in enumerate(labels) if v == cid]
        members = sorted((refs[i] | {"_i": i} for i in idx), key=lambda r: -(r["reach"] or 0))
        centroid = _unit(emb[idx].mean(axis=0))
        affinity = int(round(max(0.0, float(song @ centroid)) * 100))
        reach = sum((m["reach"] or 0) for m in members)
        grown = [(m["growth_90d"], m["reach"] or 1) for m in members if m["growth_90d"] is not None]
        growth = sum(g * w for g, w in grown) / sum(w for _, w in grown) if grown else None
        quads = [m["quadrant"] for m in members if m["quadrant"]]
        quadrant = max(set(quads), key=quads.count) if quads else None
        newest = max(m["measured_at"] for m in members)
        srcs = sorted({m["source"] for m in members})
        data = dict(source=srcs[0], status="verificado", measured_at=newest,
                    method=f"suma de sus {len(members)} miembros ({', '.join(srcs)})")
        tid = f"tribu-{cid + 1}"
        tribes.append({
            "id": tid,
            # Nombre provisional a partir del miembro con más alcance; el nombre por LLM llega después.
            "name": f"Tribu · {members[0]['name']}",
            "affinity": figure(f"{tid}_affinity", "Afinidad", affinity, "/100", **model),
            "size": figure(f"{tid}_size", "Tamaño estimado", round(reach), "oyentes", **data),
            "growth_90d": figure(f"{tid}_growth", "Crecimiento a 90 días",
                                 None if growth is None else round(growth * 100, 1), "%", **data),
            "emotion": figure(f"{tid}_emotion", "Emoción que la conecta", None, None, source="modelo:singularity-13d",
                              status="pendiente", measured_at=now,
                              method="dimensión compartida entre la canción y la tribu. Sin calcular: faltan las 13 dimensiones"),
        })
        nodes.append({"id": tid, "kind": "tribe", "label": tribes[-1]["name"], "reach": min(1.0, reach / max_reach / len(members) * 2),
                      "quadrant": quadrant, "source": srcs[0], "measured_at": newest})
        edges.append({"source": "song", "target": tid, "similarity": round(affinity / 100, 3)})
        for m in members[:MEMBERS_SHOWN]:
            nid = f"{m['kind']}-{m['ref_id']}"
            nodes.append({"id": nid, "kind": m["kind"], "label": m["name"], "reach": round((m["reach"] or 0) / max_reach, 3),
                          "quadrant": m["quadrant"], "source": m["source"], "measured_at": m["measured_at"]})
            edges.append({"source": tid, "target": nid, "similarity": round(max(0.0, float(emb[m["_i"]] @ centroid)), 3)})

    # Orden: afinidad × crecimiento (las que no tienen crecimiento, al final).
    def rank(t: dict) -> float:
        g = t["growth_90d"]["value"]
        return -1e9 if g is None else t["affinity"]["value"] * g
    tribes.sort(key=rank, reverse=True)

    prov = figure("tribe_graph", "Red de tribus", len(nodes), "nodos", **model)
    return {"provenance": prov, "nodes": nodes, "edges": edges}, tribes
