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
        "CRITICAL RULES FOR THE DATE FIELD:\n"
        "1. \"date\" must be a 4-digit integer (e.g. 1917, 2028) ONLY if that exact 4-digit number "
        "appears literally in the passage below. Otherwise \"date\" MUST be null.\n"
        "2. DO NOT invent, guess, estimate, or assume any year. If you are not 100% certain the year "
        "appears word-for-word in the text, write null.\n"
        "3. Month numbers (1-12) and day numbers (1-31) are NOT years. Set date to null for those.\n"
        "4. Never skip an event just because it has no date.\n\n"
        "EXAMPLES:\n"
        "Text has no year: "
        "{\"event\": \"She won the best paper award.\", \"date\": null, \"date_confidence\": null}\n"
        "Text says '...in 2019 she published...': "
        "{\"event\": \"She published a paper.\", \"date\": 2019, \"date_confidence\": \"explicit\"}\n\n"
        "SKIP only:\n"
        "  - Table of contents entries (title + page number only)\n"
        "  - Bare page numbers, headers, footers\n"
        "  - Figure captions that are only labels (e.g. 'Fig. 1')\n"
        "  - Raw bibliography/reference list entries\n"
        "  - Lines that are purely numbers, dots, or URLs\n\n"
        "For each event output:\n"
        '  {"event": "What happened (1-3 sentences)", '
        '"date": <4-digit year integer OR null>, '
        '"date_confidence": "explicit" if that year literally appears in the text, else null}\n\n'
        "Return ONLY a valid JSON array.\n\n"
        f"Text:\n{chunk['text']}"
        + _LANG_INSTRUCTION
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
    if not (isinstance(date, int) and 1000 <= date <= 2100):
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
