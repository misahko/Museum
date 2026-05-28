import numpy as np
from sentence_transformers import SentenceTransformer

_MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"
_THRESHOLD = 0.92
_CONFIDENCE_RANK = {"explicit": 3, "inferred_certain": 2, "inferred_range": 1, "unknown": 0}


def run(events: list[dict]) -> list[dict]:
    """Stage 3.5: remove near-duplicate events (cosine similarity > 0.92)."""
    if len(events) < 2:
        return events

    model = SentenceTransformer(_MODEL_NAME, device="cpu")
    embeddings = model.encode([e["event"] for e in events], normalize_embeddings=True)

    removed: set[int] = set()
    for i in range(len(events)):
        if i in removed:
            continue
        for j in range(i + 1, len(events)):
            if j in removed:
                continue
            if float(np.dot(embeddings[i], embeddings[j])) > _THRESHOLD:
                rank_i = _CONFIDENCE_RANK.get(events[i]["date_confidence"], -1)
                rank_j = _CONFIDENCE_RANK.get(events[j]["date_confidence"], -1)
                removed.add(j if rank_i >= rank_j else i)

    return [e for i, e in enumerate(events) if i not in removed]
