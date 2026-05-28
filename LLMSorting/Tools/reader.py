import base64
import pdfplumber
from pathlib import Path


def extract_chunks(file_path: str, chunk_size: int = 300, overlap: int = 50) -> list[dict]:
    path = Path(file_path)
    with pdfplumber.open(file_path) as pdf:
        text = " ".join(page.extract_text() or "" for page in pdf.pages)
    return _chunk_text(text, path.name, chunk_size, overlap)


def extract_chunks_from_text(text: str, file_id: str, chunk_size: int = 300, overlap: int = 50) -> list[dict]:
    return _chunk_text(text, file_id, chunk_size, overlap)


def _chunk_text(text: str, file_id: str, chunk_size: int, overlap: int) -> list[dict]:
    words = text.split()
    chunks = []
    chunk_index = 0
    start = 0
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunks.append({
            "file_id": file_id,
            "chunk_index": chunk_index,
            "text": " ".join(words[start:end]),
        })
        chunk_index += 1
        if end == len(words):
            break
        start = end - overlap
    return chunks


def extract_images_from_pdf_bytes(data: bytes, file_id: str, min_size: int = 80) -> list[dict]:
    """
    Extract embedded images from a PDF supplied as raw bytes.

    Returns a list of dicts:
        {"file_id", "page", "width", "height", "data_url"}

    Images smaller than min_size in either dimension are skipped (avoids
    logos, bullets, and other decorative elements).

    Requires pymupdf (pip install pymupdf). Returns [] silently if not installed.
    """
    try:
        import fitz  # pymupdf
    except ImportError:
        return []

    doc = fitz.open(stream=data, filetype="pdf")
    images = []
    seen_xrefs: set[int] = set()

    for page_num, page in enumerate(doc):
        for img_ref in page.get_images(full=True):
            xref = img_ref[0]
            if xref in seen_xrefs:
                continue
            seen_xrefs.add(xref)

            try:
                img_info = doc.extract_image(xref)
            except Exception:
                continue

            w, h = img_info["width"], img_info["height"]
            if w < min_size or h < min_size:
                continue

            ext = img_info["ext"]
            mime = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"
            b64 = base64.b64encode(img_info["image"]).decode()

            images.append({
                "file_id": file_id,
                "page": page_num + 1,
                "width": w,
                "height": h,
                "data_url": f"data:{mime};base64,{b64}",
            })

    doc.close()
    return images
