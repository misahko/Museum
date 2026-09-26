import json
from curses import raw

import ollama

MODEL = "llama3"
# Language instruction appended to every prompt so the LLM always responds
# in the same language as the source material.
_LANG_INSTRUCTION = (
    "\n\nIMPORTANT: Your entire response MUST be written in the SAME LANGUAGE "
    "as the input text above. Do not translate. Do not switch to English."
)


def clean_large_text(raw_text: str) -> str:
    """Етап 1: Очищення великого блоку тексту від PDF-сміття."""
    prompt = (
        "You are a professional text editor. Clean the following text from a scanned document.\n\n"
        "RULES:\n"
        "1. Remove page numbers, headers, footers, and formatting garbage.\n"
        "2. Fix broken words and merge fragmented sentences into cohesive text.\n"
        "3. CRITICAL: DO NOT summarize. Keep 100% of the facts, dates, names, job titles, and details.\n"
        "4. Return ONLY the cleaned text. NO explanations.\n\n"
        f"Raw Text:\n{raw_text}" + _LANG_INSTRUCTION
    )
    response = ollama.chat(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        options={"num_predict": 4096, "temperature": 0.0},
    )
    return response["message"]["content"].strip()


def extract_events(chunk: dict) -> list[dict]:
    """Stage 2: extract event cards from one chunk."""

    cleaned_text = chunk["text"]

    prompt = (
        "You are an expert data extraction assistant.\n"
        "Your task is to extract EVERY SINGLE event, job position, degree, dissertation, and achievement from the text.\n\n"
        "EXTRACTION RULES:\n"
        "1. BE COMPREHENSIVE: Output a separate JSON object for each distinct event.\n"
        "2. 'event': MUST be a COMPLETE, descriptive sentence with FULL CONTEXT. Always specify WHO the event is about (use the person's name, e.g., 'Ісаак Ньютон', NOT 'він') and WHAT exactly happened. Instead of 'закінчив університет', write 'Ісаак Ньютон закінчив Кембриджський університет'. Explain the context if necessary.\n"
        "3. 'date': MUST be a SINGLE 4-digit integer (e.g., 2012). If the text contains a time range, extract ONLY the starting year. If no year is mentioned, use null.\n"
        "4. 'date_confidence': 'explicit' if a 4-digit year is found, otherwise null.\n"
        "5. IGNORE: Table of contents, headers, footers.\n\n"
        "OUTPUT FORMAT:\n"
        "You MUST return ONLY a valid JSON array of objects. NO explanations.\n"
        "Example:\n"
        '[{"event": "У 1661 році Ісаак Ньютон успішно закінчив школу в Грентемі та вирушив продовжувати освіту в Кембриджі.", "date": 1661, "date_confidence": "explicit"}, '
        '{"event": "Ісаак Ньютон був прийнятий до Триніті-коледжу Кембриджського університету як студент-субсайзер.", "date": null, "date_confidence": null}]\n\n'
        f"Text to analyze:\n{cleaned_text}" + _LANG_INSTRUCTION
    )

    response = ollama.chat(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        # format="json",
        options={"num_predict": 8192, "num_ctx": 8192, "temperature": 0.0},
    )

    content = response["message"]["content"].strip()
    text = chunk["text"]
    print(content)
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
        options={"num_predict": 16384},
    )

    return response["message"]["content"].strip()


def describe_bucket(events: list[dict]) -> str:
    """Stage 5: write a one-sentence description for a group of events."""
    numbered = "\n".join(f"- {e['event']}" for e in events)
    prompt = (
        "Analyze the following list of historical events and write a single, cohesive sentence describing this thematic group.\n\n"
        f"Events:\n{numbered}\n\n"
        "OUTPUT FORMAT:\n"
        "Return ONLY the sentence. NO preamble, NO quotes, NO formatting, NO JSON."
        + _LANG_INSTRUCTION
    )

    response = ollama.chat(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        options={"num_predict": 1024},
    )

    return response["message"]["content"].strip()


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
