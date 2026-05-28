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
        "You are an extractor for a research biography museum.\n"
        "Extract EVERY event, achievement, publication, award, appointment, project, role, or milestone "
        "from the text below — whether or not a year is mentioned.\n\n"
        "CRITICAL RULES:\n"
        "1. Include ALL events even if they have NO date. Never skip an event because its year is unknown.\n"
        "2. \"date\": use the year as an integer if it appears literally in THIS text. "
        "Otherwise set \"date\": null — do NOT guess or infer.\n"
        "3. \"date_confidence\": \"explicit\" only when the year number literally appears in this passage. "
        "Otherwise null.\n"
        "4. Never omit a sentence that describes something that happened, was published, awarded, or started.\n\n"
        "SKIP only:\n"
        "  - Table of contents entries (title + page number only)\n"
        "  - Bare page numbers, headers, footers\n"
        "  - Figure captions that are only labels (e.g. 'Fig. 1')\n"
        "  - Raw bibliography/reference list entries\n"
        "  - Lines that are purely numbers, dots, or URLs\n\n"
        "For each event output a JSON object:\n"
        '  {"event": "What happened (1-3 sentences)", '
        '"date": <4-digit calendar year as integer, e.g. 1917 or 2028, or null if no 4-digit year appears in this passage>, '
        '"date_confidence": "explicit" if a 4-digit year literally appears in the text, else null}\n\n'
        "IMPORTANT: \"date\" must be a 4-digit year (1000–2100) or null. "
        "Day numbers (12, 28...) or month numbers (1–12) are NOT years — set date to null for those.\n\n"
        "Return ONLY a valid JSON array. Return [] only if the passage contains absolutely no events.\n\n"
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
