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
        "You are an expert data extraction assistant.\n"
        "Extract ALL events, achievements, publications, awards, appointments, projects, or roles from the text.\n\n"
        "EXTRACTION RULES:\n"
        "1. 'event': all sentences describing the event.\n"
        "2. 'date': A 4-digit integer ONLY if explicitly mentioned (e.g., 2019). Otherwise, use null. No guesses, no day/month.\n"
        "3. 'date_confidence': 'explicit' if a 4-digit year is found, otherwise null.\n"
        "4. IGNORE: Table of contents, headers, footers, page numbers, figure labels, URLs, raw references.\n\n"
        "OUTPUT FORMAT:\n"
        "You MUST return ONLY a valid JSON array of objects. NO explanations, NO markdown formatting, NO preamble.\n"
        "Example:\n"
        '[{"event": "Published a groundbreaking paper on AI.", "date": 2019, "date_confidence": "explicit"}, '
        '{"event": "Appointed as lead researcher.", "date": null, "date_confidence": null}]\n\n'
        f"Text to analyze:\n{chunk['text']}" + _LANG_INSTRUCTION
    )

    response = ollama.chat(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        # format="json",
        options={"num_predict": 4096},
    )

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
        "Write a short thematic title (3 to 6 words, noun phrase only) for the following event.\n\n"
        f"Event:\n{representative_event}\n\n"
        "OUTPUT FORMAT:\n"
        "Return ONLY the title string. NO quotes, NO preamble, NO explanations."
        + _LANG_INSTRUCTION
    )
    response = ollama.chat(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        options={"num_predict": 128},
    )

    return response["message"]["content"].strip()


def order_and_describe_bucket(events: list[dict]) -> dict:
    """Stage 5: causal ordering + one-paragraph description for ≤15 events."""
    numbered = "\n".join(f"{i}. {e['event']}" for i, e in enumerate(events))
    prompt = (
        "Analyze the following list of historical events and perform two tasks:\n"
        "1. Reorder them by cause-and-effect logic (chronological or logical progression).\n"
        "2. Write a single, cohesive paragraph describing this thematic group.\n\n"
        f"Events:\n{numbered}\n\n"
        "OUTPUT FORMAT:\n"
        "You MUST return ONLY a valid JSON object. NO preamble, NO explanations.\n"
        'Example format:\n{"order": [2, 0, 1], "description": "This era was characterized by..."}'
        + _LANG_INSTRUCTION
    )

    response = ollama.chat(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        # format="json",  # <--- ГАРАНТУЄ JSON
        options={"num_predict": 8192},
    )

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
