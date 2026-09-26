import numpy as np

_MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"
_THRESHOLD = 0.92
_CONFIDENCE_RANK = {
    "explicit": 3,
    "inferred_certain": 2,
    "inferred_range": 1,
    "unknown": 0,
}


class _UnionFind:
    """Disjoint-set so duplicate detection is transitive: if 0~1 and 1~2
    are each above threshold, all three end up in ONE group even if 0~2
    alone falls just short of it."""

    def __init__(self, n: int):
        self.parent = list(range(n))

    def find(self, x: int) -> int:
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]  # path compression
            x = self.parent[x]
        return x

    def union(self, a: int, b: int) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[rb] = ra


def _cluster_and_merge(
    events: list[dict], embeddings, threshold: float = _THRESHOLD
) -> list[dict]:
    """Core merge logic, kept separate from model loading so it can be
    unit-tested with synthetic embeddings (no network / model download
    needed - see the demo at the bottom of this file)."""

    n = len(events)
    uf = _UnionFind(n)
    for i in range(n):
        for j in range(i + 1, n):
            sim = float(np.dot(embeddings[i], embeddings[j]))
            if sim > threshold:
                uf.union(i, j)

    groups: dict[int, list[int]] = {}
    for idx in range(n):
        groups.setdefault(uf.find(idx), []).append(idx)

    survivors = [
        max(
            members,
            key=lambda idx: _CONFIDENCE_RANK.get(events[idx]["date_confidence"], -1),
        )
        for members in groups.values()
    ]
    survivors.sort()  # keep original relative order
    return [events[i] for i in survivors]


def run(events: list[dict]) -> list[dict]:
    """Stage 3.5: remove near-duplicate events (cosine similarity > threshold),
    merging any chain of duplicates into a single survivor."""
    if len(events) < 2:
        return events

    from sentence_transformers import (
        SentenceTransformer,  # heavy import, only needed here
    )

    model = SentenceTransformer(_MODEL_NAME, device="cpu")
    embeddings = model.encode([e["event"] for e in events], normalize_embeddings=True)
    return _cluster_and_merge(events, embeddings)


# ---------------------------------------------------------------------------
# Demo / regression test - reproduces the exact chain scenario (0~1, 1~2,
# but 0~2 just below threshold) with synthetic 2D embeddings, no model
# download needed. Shows the OLD greedy logic splitting into 2 survivors
# vs the NEW union-find logic correctly merging into 1.
# ---------------------------------------------------------------------------


def _old_greedy_merge(events: list[dict], embeddings) -> list[dict]:
    """The original (buggy) logic, kept here only for the side-by-side demo."""
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


if __name__ == "__main__":
    t = np.arccos(0.95)  # angle between adjacent vectors -> cos(t) = 0.95 (> 0.92)
    v0 = np.array([1.0, 0.0])
    v1 = np.array([np.cos(t), np.sin(t)])
    v2 = np.array([np.cos(2 * t), np.sin(2 * t)])
    synthetic_embeddings = np.stack([v0, v1, v2])

    print(f"sim(0,1) = {float(np.dot(v0, v1)):.3f}")
    print(f"sim(1,2) = {float(np.dot(v1, v2)):.3f}")
    print(f"sim(0,2) = {float(np.dot(v0, v2)):.3f}  <- below {_THRESHOLD} threshold\n")

    events = [
        {"event": "Доцент, факультет кібернетики, КНУ.", "date_confidence": "explicit"},
        {
            "event": "Працював доцентом на факультеті кібернетики КНУ.",
            "date_confidence": "explicit",
        },
        {
            "event": "Обіймав посаду доцента, факультет кібернетики, КНУ.",
            "date_confidence": "explicit",
        },
    ]

    old_result = _old_greedy_merge(events, synthetic_embeddings)
    new_result = _cluster_and_merge(events, synthetic_embeddings)

    print(f"OLD greedy logic -> {len(old_result)} survivor(s):")
    for e in old_result:
        print(f"  - {e['event']}")

    print(f"\nNEW union-find logic -> {len(new_result)} survivor(s):")
    for e in new_result:
        print(f"  - {e['event']}")
