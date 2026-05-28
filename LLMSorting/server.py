"""
HTTP server wrapping the LLMSorting pipeline with SSE progress streaming.

Usage:
    python server.py           # port 8765
    python server.py 9000

Endpoints
─────────
GET  /health          → {"status": "ok"}

POST /process
  Headers:  Accept: text/event-stream   → SSE stream of progress + final result
            (no Accept header)          → plain JSON (blocks until done)
  Body:
    {
      "inputs": [{"type": "text", "content": "...", "file_id": "..."}],
      "pdfs":   [{"name": "paper.pdf", "data": "<base64>"}]   // optional
    }

SSE event shapes
────────────────
  data: {"type":"progress","stage":2,"message":"...","percent":30}
  data: {"type":"done","result":{...museum JSON including images...}}
  data: {"type":"error","message":"..."}
"""

import base64
import json
import queue
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from main import run_pipeline
from Tools.reader import extract_images_from_pdf_bytes


class Handler(BaseHTTPRequestHandler):
    # ── helpers ────────────────────────────────────────────────────────────────

    def _send_json(self, status: int, data: dict) -> None:
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_sse_event(self, payload: dict) -> bool:
        """Write one SSE event. Returns False if the connection is broken."""
        try:
            line = f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
            self.wfile.write(line.encode())
            self.wfile.flush()
            return True
        except (BrokenPipeError, ConnectionResetError):
            return False

    def _parse_body(self):
        length = int(self.headers.get("Content-Length", 0))
        try:
            return json.loads(self.rfile.read(length))
        except json.JSONDecodeError as e:
            return None, str(e)

    # ── routing ────────────────────────────────────────────────────────────────

    def do_GET(self):
        if self.path == "/health":
            self._send_json(200, {"status": "ok"})
        else:
            self._send_json(404, {"error": "not found"})

    def do_POST(self):
        if self.path == "/health":
            self._send_json(200, {"status": "ok"})
            return
        if self.path != "/process":
            self._send_json(404, {"error": "not found"})
            return

        body = self._parse_body()
        if body is None:
            self._send_json(400, {"error": "invalid JSON"})
            return

        inputs = body.get("inputs")
        if not inputs:
            self._send_json(400, {"error": "'inputs' field is required"})
            return

        pdfs = body.get("pdfs", [])
        wants_sse = "text/event-stream" in self.headers.get("Accept", "")

        if wants_sse:
            self._handle_sse(inputs, pdfs)
        else:
            self._handle_plain(inputs, pdfs)

    # ── plain JSON mode ────────────────────────────────────────────────────────

    def _handle_plain(self, inputs, pdfs):
        images = self._extract_images(pdfs)
        try:
            result = run_pipeline(inputs)
        except Exception as e:
            self._send_json(500, {"error": str(e)})
            return
        result["images"] = images
        self._send_json(200, result)

    # ── SSE streaming mode ─────────────────────────────────────────────────────

    def _handle_sse(self, inputs, pdfs):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()

        q: queue.Queue = queue.Queue()

        def progress(stage, message, percent):
            q.put(("progress", {"type": "progress", "stage": stage,
                                "message": message, "percent": percent}))

        def worker():
            images = self._extract_images(pdfs, progress_cb=lambda msg, pct: progress(0, msg, pct))
            try:
                result = run_pipeline(inputs, progress=progress)
            except Exception as e:
                q.put(("error", str(e)))
                return
            result["images"] = images
            q.put(("done", result))

        t = threading.Thread(target=worker, daemon=True)
        t.start()

        while True:
            kind, data = q.get()
            if kind == "progress":
                if not self._send_sse_event(data):
                    break
            elif kind == "done":
                self._send_sse_event({"type": "done", "result": data})
                break
            elif kind == "error":
                self._send_sse_event({"type": "error", "message": data})
                break

    # ── image extraction (shared) ──────────────────────────────────────────────

    def _extract_images(self, pdfs: list, progress_cb=None) -> list:
        images = []
        for i, pdf_entry in enumerate(pdfs):
            name = pdf_entry.get("name", f"upload_{i}.pdf")
            if progress_cb:
                progress_cb(f"Extracting images from {name}…", 96)
            try:
                pdf_bytes = base64.b64decode(pdf_entry["data"])
                images.extend(extract_images_from_pdf_bytes(pdf_bytes, name))
            except Exception as e:
                print(f"[llmsorting] image extraction error ({name}): {e}", flush=True)
        return images

    def log_message(self, fmt, *args):
        print(f"[llmsorting] {fmt % args}", flush=True)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    server = HTTPServer(("", port), Handler)
    print(f"LLMSorting server  →  http://localhost:{port}", flush=True)
    print("Requires:  ollama serve  +  ollama pull llama3", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutdown.", flush=True)
