/**
 * Sends text (and optionally PDFs) to the local LLMSorting server via SSE.
 *
 * @param {string}   text       – extracted text (from pdfjs or typed input)
 * @param {Array}    pdfs       – [{name, data}] base64-encoded PDFs for image extraction
 * @param {Function} onProgress – called with {stage, message, percent} for each progress event
 * Returns: {rooms, images}
 *
 * Start the server: cd LLMSorting && python server.py
 */
export async function sortAndStructureHistory(text, pdfs = [], onProgress = null) {
  let res;
  try {
    res = await fetch('/api/llm/process', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'accept': 'text/event-stream',
      },
      body: JSON.stringify({
        inputs: [{ type: 'text', content: text, file_id: 'input.txt' }],
        pdfs,
      }),
    });
  } catch {
    throw new Error(
      'Cannot reach the LLMSorting server.\nStart it with:\n  cd LLMSorting && python server.py'
    );
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Server error ${res.status}`);
  }

  // Parse the SSE stream
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) throw new Error('Server closed the stream unexpectedly');

    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by double newline
    const parts = buffer.split('\n\n');
    buffer = parts.pop(); // keep incomplete tail

    for (const part of parts) {
      if (!part.startsWith('data: ')) continue;
      const payload = JSON.parse(part.slice(6));

      if (payload.type === 'progress') {
        onProgress?.(payload);
      } else if (payload.type === 'done') {
        return payload.result;
      } else if (payload.type === 'error') {
        throw new Error(payload.message);
      }
    }
  }
}

/** Read a File as a base64 string (without the data-URL prefix). */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
