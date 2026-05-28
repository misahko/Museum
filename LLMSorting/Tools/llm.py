import json
import ollama

MODEL = "llama3"

# Language instruction appended to every prompt so the LLM always responds
# in the same language as the source material.
_LANG_INSTRUCTION = (
    "\n\nIMPORTANT: Your entire response MUST be written in the SAME LANGUAGE "
    "as the input text above. Do not translate. Do not switch to English."
)


def extract_events(chunk: dict) -> list[dict]:
    """Stage 2: extract event cards from one chunk."""
    prompt = (
        "You are a precise event extractor. Given the text below, extract concrete historical events.\n"
        "Use ALL substantive content in the text.\n"
        "SKIP and ignore completely:\n"
        "  - Table of contents entries (lines that are just a title + page number)\n"
        "  - Page numbers, headers, footers, running titles\n"
        "  - Section/chapter numbers and headings that contain no event information\n"
        "  - Figure captions that are only labels (e.g. 'Fig. 1', 'Мал. 2')\n"
        "  - Bibliography, references, and citation lists\n"
        "  - Any line that is purely a number, a dot sequence, or a URL\n"
        "For each real event create a JSON object:\n"
        '  {"event": "What happened (1-2 sentences)", "date": <year as integer or null>, '
        '"date_confidence": "explicit" | null}\n'
        'Set date_confidence to "explicit" ONLY if the year appears literally in this text. '
        "If the year is not stated in THIS text, set date to null.\n"
        "Return ONLY a valid JSON array. Return [] if no events found.\n\n"
        f"Text:\n{chunk['text']}"
        + _LANG_INSTRUCTION
    )
    response = ollama.chat(model=MODEL, messages=[{"role": "user", "content": prompt}])
    content = response["message"]["content"].strip()
    return [
        {
            "event": e.get("event", ""),
            "date": e.get("date"),
            "date_confidence": e.get("date_confidence"),
            "source_file_id": chunk["file_id"],
            "chunk_index": chunk["chunk_index"],
        }
        for e in _extract_json_array(content)
    ]


def name_cluster(representative_event: str) -> str:
    """Stage 4: short human-readable name for a cluster given its centroid event."""
    prompt = (
        "Given this event description, write a short thematic title (3-6 words, noun phrase only):\n\n"
        f"{representative_event}\n\n"
        "Return ONLY the title, nothing else."
        + _LANG_INSTRUCTION
    )
    response = ollama.chat(model=MODEL, messages=[{"role": "user", "content": prompt}])
    return response["message"]["content"].strip()


def order_and_describe_bucket(events: list[dict]) -> dict:
    """Stage 5: causal ordering + one-paragraph description for ≤15 events."""
    numbered = "\n".join(f"{i}. {e['event']}" for i, e in enumerate(events))
    prompt = (
        "You are given a list of historical events. Do two things:\n"
        "1. Reorder them by cause-and-effect logic.\n"
        "2. Write one paragraph describing the thematic group.\n\n"
        f"Events:\n{numbered}\n\n"
        'Return ONLY valid JSON: {"order": [0-based indices in causal order], "description": "paragraph"}'
        + _LANG_INSTRUCTION
    )
    response = ollama.chat(model=MODEL, messages=[{"role": "user", "content": prompt}])
    content = response["message"]["content"].strip()
    start = content.find("{")
    end = content.rfind("}") + 1
    return json.loads(content[start:end])


def _extract_json_array(text: str) -> list:
    start = text.find("[")
    end = text.rfind("]") + 1
    if start == -1 or end == 0:
        return []
    try:
        return json.loads(text[start:end])
    except json.JSONDecodeError:
        return []
