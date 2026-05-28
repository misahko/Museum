import json
import sys
from pathlib import Path

from Tools.reader import extract_chunks, extract_chunks_from_text
from src import event_extractor, date_inferencer, deduplicator, bucketer, orderer, json_assembler


def run_pipeline(inputs: list[dict], progress=None) -> dict:
    """
    inputs: list of dicts — either
      {"type": "pdf",  "path": "...", "file_id": "..."}
      {"type": "text", "content": "...", "file_id": "..."}

    progress: optional callable(stage, message, percent) for streaming updates
    """
    def emit(stage, message, percent):
        if progress:
            progress(stage, message, percent)

    emit(1, "Ingestion: reading and chunking sources…", 5)
    all_chunks: list[dict] = []
    for inp in inputs:
        if inp["type"] == "pdf":
            chunks = extract_chunks(inp["path"])
        else:
            chunks = extract_chunks_from_text(inp["content"], inp["file_id"])
        all_chunks.extend(chunks)
    emit(1, f"Ingestion complete — {len(all_chunks)} chunk(s) from {len(inputs)} source(s)", 8)

    emit(2, f"Event extraction: processing {len(all_chunks)} chunk(s) via Ollama…", 10)
    events = event_extractor.run(all_chunks, progress=progress)
    emit(2, f"Event extraction complete — {len(events)} raw event(s)", 42)

    emit(3, "Date inference: filling undated events…", 45)
    events = date_inferencer.run(events)
    dated = sum(1 for e in events if e["date"] != "unknown")
    emit(3, f"Date inference complete — {dated}/{len(events)} event(s) dated", 50)

    emit(4, "Deduplication: removing near-duplicate events…", 52)
    events = deduplicator.run(events)
    emit(4, f"Deduplication complete — {len(events)} unique event(s)", 57)

    emit(5, "Bucketing: grouping events by year…", 60)
    buckets = bucketer.run(events)
    emit(5, f"Bucketing complete — {len(buckets)} year bucket(s)", 63)

    emit(6, "Ordering: causally ordering each bucket via Ollama…", 65)
    ordered = orderer.run(buckets, progress=progress)
    emit(6, "Ordering complete", 88)

    emit(7, "Assembling final museum JSON…", 92)
    museum = json_assembler.run(ordered)
    emit(7, f"Assembly complete — {len(museum['rooms'])} room(s) generated", 95)

    return museum


if __name__ == "__main__":
    if len(sys.argv) > 1:
        inputs = [{"type": "pdf", "path": p, "file_id": Path(p).name} for p in sys.argv[1:]]
    else:
        inputs = [
            {
                "type": "text",
                "file_id": "demo.txt",
                "content": (
                    "In 1917, the Russian Revolution overthrew the tsar. "
                    "The Bolsheviks seized power in October 1917. "
                    "In 1918, the Russian Civil War began between the Red and White armies. "
                    "The Treaty of Brest-Litovsk was signed in March 1918, ending Russian participation in WWI. "
                    "In 1920, the Bolsheviks consolidated control over most of the former empire. "
                    "The Soviet Union was formally established in December 1922."
                ),
            }
        ]

    def cli_progress(stage, message, percent):
        print(f"[{percent:3d}%] {message}")

    result = run_pipeline(inputs, progress=cli_progress)
    out = Path("museum.json")
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nDone. Output → {out}")
