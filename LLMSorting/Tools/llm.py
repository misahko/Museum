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
        "Extract ALL events, achievements, publications, awards, appointments, projects, or roles from the text.\n\n"
        "RULES FOR 'date':\n"
        "- 'date' MUST be a 4-digit integer ONLY if that exact year is explicitly mentioned in the text (e.g., 2019).\n"
        "- If no year is mentioned, 'date' MUST be null. Do not guess, estimate, or use day/month numbers.\n"
        "- Set 'date_confidence' to 'explicit' if a 4-digit year is found, otherwise null.\n\n"
        "SKIP ONLY:\n"
        "- Table of contents, headers, footers, page numbers, figure labels, URLs, raw references.\n\n"
        "OUTPUT FORMAT:\n"
        "Return ONLY a valid JSON array of objects:\n"
        '[{"event": "Description (1-3 sentences)", "date": 2019 or null, "date_confidence": "explicit" or null}]\n\n'
        f"Text:\n{chunk['text']}" + _LANG_INSTRUCTION
    )
    response = ollama.chat(model=MODEL, messages=[{"role": "user", "content": prompt}])
    content = response["message"]["content"].strip()
    text = chunk["text"]
    return [
        _validated_event(e, text, chunk["file_id"], chunk["chunk_index"])
        for e in _extract_json_array(content)
        if e.get("event", "").strip()
    ]


def _validated_event(e: dict, chunk_text: str, file_id: str, chunk_index: int) -> dict:
    """Strip any hallucinated year that doesn't literally appear in the chunk text."""
    date = e.get("date")
    confidence = e.get("date_confidence")

    # Accept only valid 4-digit years
    if not (isinstance(date, int)):
        date, confidence = None, None
    elif str(date) not in chunk_text:
        # LLM claimed the year is explicit but it's not in the text — hallucinated
        date, confidence = None, None

    return {
        "event": e.get("event", ""),
        "date": date,
        "date_confidence": confidence,
        "source_file_id": file_id,
        "chunk_index": chunk_index,
    }


def name_cluster(representative_event: str) -> str:
    """Stage 4: short human-readable name for a cluster given its centroid event."""
    prompt = (
        "Given this event description, write a short thematic title (3-6 words, noun phrase only):\n\n"
        f"{representative_event}\n\n"
        "Return ONLY the title, nothing else." + _LANG_INSTRUCTION
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
    # Try direct array extraction first
    start = text.find("[")
    end = text.rfind("]") + 1
    if start != -1 and end > 0:
        try:
            result = json.loads(text[start:end])
            if isinstance(result, list):
                return result
        except json.JSONDecodeError:
            pass

    # Fallback: maybe the LLM wrapped the array in an object like {"events": [...]}
    obj_start = text.find("{")
    obj_end = text.rfind("}") + 1
    if obj_start != -1 and obj_end > 0:
        try:
            obj = json.loads(text[obj_start:obj_end])
            if isinstance(obj, dict):
                for v in obj.values():
                    if isinstance(v, list):
                        return v
        except json.JSONDecodeError:
            pass

    return []
