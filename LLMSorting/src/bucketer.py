import re
import numpy as np
from sentence_transformers import SentenceTransformer
import hdbscan

from Tools.llm import name_cluster

_MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"
_DENSE_THRESHOLD = 25
_MAX_CLUSTER_SIZE = 25
_MIN_CLUSTER_SIZE = 5
_MIN_CLUSTER_SIZE_RECURSIVE = 3


def _cluster(events: list[dict], embeddings: np.ndarray, model: SentenceTransformer, min_cluster_size: int) -> list[dict]:
    """Run HDBSCAN and return list of cluster dicts, recursively splitting large ones."""
    clusterer = hdbscan.HDBSCAN(min_cluster_size=min_cluster_size, metric="euclidean")
    labels = clusterer.fit_predict(embeddings)

    groups: dict[int, list[int]] = {}
    for i, label in enumerate(labels):
        groups.setdefault(label, []).append(i)

    clusters = []
    for label, indices in groups.items():
        group_events = [events[i] for i in indices]
        group_embeddings = embeddings[indices]

        if label == -1:
            clusters.append({"name": None, "events": group_events})
            continue

        centroid = group_embeddings.mean(axis=0)
        rep_idx = int(np.argmin(np.linalg.norm(group_embeddings - centroid, axis=1)))
        cluster_name = name_cluster(group_events[rep_idx]["event"])

        if len(group_events) > _MAX_CLUSTER_SIZE:
            sub = _cluster(group_events, group_embeddings, model, _MIN_CLUSTER_SIZE_RECURSIVE)
            for s in sub:
                s["name"] = f"{cluster_name} / {s['name']}"
            clusters.extend(sub)
        else:
            clusters.append({"name": cluster_name, "events": group_events})

    return clusters


def run(events: list[dict]) -> dict:
    """Stage 4: group events by year; cluster years with >25 events via HDBSCAN."""
    raw_buckets: dict[str, list[dict]] = {}
    for e in events:
        date = e.get("date")
        if isinstance(date, int):
            key = str(date)
        elif isinstance(date, str) and date != "unknown":
            years = re.findall(r"\d{4}", date)
            key = years[0] if years else "unknown"
        else:
            key = "unknown"
        raw_buckets.setdefault(key, []).append(e)

    sent_model = SentenceTransformer(_MODEL_NAME, device="cpu")
    result = {}

    for year, year_events in raw_buckets.items():
        if len(year_events) <= _DENSE_THRESHOLD:
            result[year] = {"layout": "linear", "clusters": [{"name": None, "events": year_events}]}
        else:
            embeddings = sent_model.encode([e["event"] for e in year_events], normalize_embeddings=True)
            clusters = _cluster(year_events, embeddings, sent_model, _MIN_CLUSTER_SIZE)
            result[year] = {"layout": "thematic_clusters", "clusters": clusters}

    return result
