from Tools.llm import extract_events


def run(chunks: list[dict], progress=None) -> list[dict]:
    """Stage 2: extract event cards from every chunk via Ollama."""
    total = len(chunks)
    all_events = []
    for i, chunk in enumerate(chunks):
        print(f"  chunk {i + 1}/{total} ({chunk['file_id']})", end="\r", flush=True)
        all_events.extend(extract_events(chunk))
        if progress:
            pct = 10 + int(32 * (i + 1) / total)
            progress(2, f"Event extraction: chunk {i + 1}/{total} ({chunk['file_id']})", pct)
    print()
    return all_events
