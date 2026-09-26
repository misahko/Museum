from Tools.llm import clean_large_text, extract_events
from Tools.reader import _chunk_text


def run(chunks: list[dict], progress=None) -> list[dict]:
    """Stage 2: extract event cards from every chunk via Ollama."""
    total = len(chunks)
    all_events = []
    for i, chunk in enumerate(chunks):
        file_id = chunk["file_id"]
        raw_text = chunk["text"]

        # 1. Очищуємо великий шматок тексту (до 600 слів)
        print(
            f"  Cleaning large chunk {i + 1}/{total} ({file_id})...",
            end="\r",
            flush=True,
        )
        cleaned_text = clean_large_text(raw_text)

        # 2. Розбиваємо очищений текст на дрібні порції (по 120 слів) для екстракції
        # Функцію _chunk_text ми позичили з Tools.reader
        small_chunks = _chunk_text(cleaned_text, file_id, chunk_size=120, overlap=25)
        total_small_chunks = len(small_chunks)

        for j, sc in enumerate(small_chunks):
            # Передаємо оригінальний raw_text для валідації дат
            all_events.extend(extract_events(sc))
            print(f"extrcting events from part {j}/{total_small_chunks} ({file_id})...")
        if progress:
            pct = 10 + int(32 * (i + 1) / total)
            progress(2, f"Processed large chunk {i + 1}/{total} ({file_id})", pct)
    print()
    return all_events
