# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running

```bash
# Test Ollama connectivity (calls Tools/llm.py directly)
python Tools/llm.py

# Run the full pipeline on one or more PDFs
python main.py paper1.pdf paper2.pdf

# Run on inline demo text (no args)
python main.py
```

Output is written to `museum.json` in the project root.

## Dependencies

```bash
pip install ollama pdfplumber sentence-transformers hdbscan numpy
# Ollama must be running with a model pulled:
ollama pull llama3
```

The model name is hardcoded as `MODEL = "llama3"` in `Tools/llm.py`. Change it there to use a different Ollama model.

## Pipeline Architecture

7-stage pipeline: text/PDF → structured JSON for a Three.js 3D museum. The authoritative design rationale is in `архітектурна специфікація.md`.

**LLM is used only at Stages 2 and 5** — all other stages are deterministic Python. This is a deliberate choice: 8B models hallucinate for date inference and deduplication, so only the two tasks that genuinely require language understanding are delegated to Ollama.

| Stage | Module | What it does |
|---|---|---|
| 1 – Ingestion | `Tools/reader.py` | PDF/text → chunks (~500 words, ~50 word overlap). **Each file chunked independently** — never merged across file boundaries, as that causes incorrect date attribution. |
| 2 – Event extraction | `src/event_extractor.py` → `Tools/llm.extract_events` | Each chunk → Ollama → JSON array of `{event, date, date_confidence, source_file_id, chunk_index}`. `date_confidence: "explicit"` only when year appears literally in the text. |
| 3 – Date inference | `src/date_inferencer.py` | Fills `date: null` events deterministically: finds nearest left/right dated event in the **same file**. Produces `inferred_certain`, `inferred_range` ("між X і Y"), or `unknown`. |
| 3.5 – Dedup | `src/deduplicator.py` | Drops near-duplicate events (cosine > 0.92) via `paraphrase-multilingual-MiniLM-L12-v2`. Keeps the card with highest `date_confidence`. |
| 4 – Bucketing | `src/bucketer.py` | Groups by year. Years with ≤25 events → `layout: "linear"`. Years with >25 events → HDBSCAN clustering (`min_cluster_size=5`, recursive if cluster >25) + one Ollama call per cluster centroid for a human-readable name. |
| 5 – Ordering | `src/orderer.py` | Per cluster: Ollama receives ≤15 events, returns `{"order": [...], "description": "..."}`. Batches larger clusters in groups of 15. |
| 6 – JSON assembly | `src/json_assembler.py` | Builds the final hierarchy. Events with `inferred_range`/`unknown` confidence get `semi_transparent: true`. |

## Output Schema

```jsonc
{
  "rooms": [
    {
      "year": "1917",               // string; "unknown" sorts last
      "layout": "linear" | "thematic_clusters",
      "sectors": [
        {
          "name": "Cluster title or null",
          "description": "One-paragraph description from Stage 5",
          "events": [
            {
              "event": "What happened (1-2 sentences)",
              "date": 1917,          // int, or "між X і Y" string, or "unknown"
              "date_confidence": "explicit" | "inferred_certain" | "inferred_range" | "unknown" | null,
              "source_file_id": "filename.pdf",
              "semi_transparent": false
            }
          ]
        }
      ]
    }
  ]
}
```

## Key Constants

| Location | Name | Value | Purpose |
|---|---|---|---|
| `Tools/llm.py` | `MODEL` | `"llama3"` | Ollama model for all LLM calls |
| `src/deduplicator.py` | `_THRESHOLD` | `0.92` | Cosine similarity threshold for dedup |
| `src/bucketer.py` | `_DENSE_THRESHOLD` | `25` | Events/year before HDBSCAN kicks in |
| `src/bucketer.py` | `_MAX_CLUSTER_SIZE` | `25` | Max cluster size before recursive split |
| `src/orderer.py` | `_MAX_BATCH` | `15` | Max events per Ollama ordering call |
