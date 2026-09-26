from Tools.llm import describe_bucket

_MAX_BATCH = 15


def _order_cluster(cluster: dict) -> dict:
    """Stage 5: order cluster by date and describe it via Ollama."""
    events = cluster["events"]
    if not events:
        return {**cluster, "description": "", "events": []}

    # 1. Алгоритмічне сортування ТІЛЬКИ за датами
    def sort_key(e):
        d = e.get("date")
        # Якщо є конкретний рік - сортуємо за ним. Якщо немає (null/unknown) - ставимо в кінець (9999)
        return d if isinstance(d, int) else 9999

    ordered_events = sorted(events, key=sort_key)

    # 2. Генерація опису для вже відсортованих подій
    descriptions: list[str] = []

    for start in range(0, len(ordered_events), _MAX_BATCH):
        batch = ordered_events[start : start + _MAX_BATCH]
        try:
            # Викликаємо LLM ТІЛЬКИ для опису
            desc = describe_bucket(batch)
            if desc:
                descriptions.append(desc)
        except Exception:
            pass

    return {**cluster, "description": " ".join(descriptions), "events": ordered_events}


def run(buckets: dict, progress=None) -> dict:
    """Stage 5: order (by date) and describe every cluster in every year bucket."""
    result = {}
    years = list(buckets.keys())
    total = len(years)

    for yi, year in enumerate(years):
        bucket = buckets[year]
        if progress:
            pct = 65 + int(23 * yi / max(total, 1))
            progress(6, f"Ordering bucket {yi + 1}/{total}: year {year}", pct)

        result[year] = {
            **bucket,
            "clusters": [_order_cluster(c) for c in bucket["clusters"]],
        }

    return result
