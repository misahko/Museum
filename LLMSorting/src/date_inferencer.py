def run(events: list[dict]) -> list[dict]:
    """Stage 3: fill null dates using nearest dated neighbours in the same file."""
    by_file: dict[str, list[dict]] = {}
    for e in events:
        by_file.setdefault(e["source_file_id"], []).append(e)

    result = []
    for file_events in by_file.values():
        file_events.sort(key=lambda x: x["chunk_index"])
        dated = [(e["chunk_index"], e["date"]) for e in file_events if e["date"] is not None]

        for e in file_events:
            if e["date"] is not None:
                result.append(e)
                continue

            ci = e["chunk_index"]
            lefts = [d for d in dated if d[0] <= ci]
            rights = [d for d in dated if d[0] >= ci]
            left = max(lefts, key=lambda x: x[0]) if lefts else None
            right = min(rights, key=lambda x: x[0]) if rights else None

            e = dict(e)
            if left is None and right is None:
                e["date"] = "unknown"
                e["date_confidence"] = "unknown"
            elif left is None:
                e["date"] = right[1]
                e["date_confidence"] = "inferred_certain"
            elif right is None:
                e["date"] = left[1]
                e["date_confidence"] = "inferred_certain"
            elif left[1] == right[1]:
                e["date"] = left[1]
                e["date_confidence"] = "inferred_certain"
            else:
                e["date"] = f"між {left[1]} і {right[1]}"
                e["date_confidence"] = "inferred_range"

            result.append(e)

    return result
