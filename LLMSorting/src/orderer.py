from Tools.llm import order_and_describe_bucket

_MAX_BATCH = 15


def _order_cluster(cluster: dict) -> dict:
    """Stage 5: causally order and describe one cluster via Ollama."""
    events = cluster["events"]
    if not events:
        return {**cluster, "description": "", "events": []}

    ordered_events: list[dict] = []
    descriptions: list[str] = []

    for start in range(0, len(events), _MAX_BATCH):
        batch = events[start : start + _MAX_BATCH]
        try:
            res = order_and_describe_bucket(batch)
            order = res.get("order") or list(range(len(batch)))
            ordered_events.extend(batch[i] for i in order if i < len(batch))
            descriptions.append(res.get("description", ""))
        except Exception:
            ordered_events.extend(batch)

    return {**cluster, "description": " ".join(d for d in descriptions if d), "events": ordered_events}


def run(buckets: dict, progress=None) -> dict:
    """Stage 5: order and describe every cluster in every year bucket."""
    result = {}
    years = list(buckets.keys())
    total = len(years)

    for yi, year in enumerate(years):
        bucket = buckets[year]
        if progress:
            pct = 65 + int(23 * yi / max(total, 1))
            progress(6, f"Ordering bucket {yi + 1}/{total}: year {year}", pct)
        result[year] = {**bucket, "clusters": [_order_cluster(c) for c in bucket["clusters"]]}

    return result
