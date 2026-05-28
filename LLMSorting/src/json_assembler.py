_UNCERTAIN = {"inferred_range", "unknown"}


def run(ordered_buckets: dict) -> dict:
    """Stage 6: assemble final JSON hierarchy for Three.js."""
    rooms = []

    def sort_key(year: str) -> tuple:
        try:
            return (0, int(year))
        except ValueError:
            return (1, 0)  # "unknown" and non-numeric sort last

    for year in sorted(ordered_buckets, key=sort_key):
        bucket = ordered_buckets[year]
        sectors = []
        for cluster in bucket["clusters"]:
            sectors.append({
                "name": cluster.get("name"),
                "description": cluster.get("description", ""),
                "events": [
                    {
                        "event": e["event"],
                        "date": e.get("date"),
                        "date_confidence": e.get("date_confidence"),
                        "source_file_id": e.get("source_file_id"),
                        "semi_transparent": e.get("date_confidence") in _UNCERTAIN,
                    }
                    for e in cluster["events"]
                ],
            })
        rooms.append({"year": year, "layout": bucket["layout"], "sectors": sectors})

    return {"rooms": rooms}
