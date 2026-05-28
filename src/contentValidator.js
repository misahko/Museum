/**
 * Two-stage content validation:
 *   1. Heuristics — instant, no network (catches obvious garbage)
 *   2. LLM snippet check — sends only the first ~600 chars to Ollama
 *
 * Returns { ok: true } or { ok: false, reason: string }
 * If the LLM is unreachable, falls through to avoid blocking legitimate users.
 */

const OLLAMA_MODEL = import.meta.env.VITE_OLLAMA_MODEL ?? 'llama3';

// ── Stage 1: heuristics ───────────────────────────────────────────────────────

function checkHeuristics(text) {
  const words = text.trim().split(/\s+/);

  if (words.length < 80) {
    return { ok: false, reason: 'The text is too short. Please provide more detail about your research career.' };
  }

  // Catch copy-paste spam: unique word ratio below 20% is a red flag
  const uniqueRatio = new Set(words.map(w => w.toLowerCase())).size / words.length;
  if (uniqueRatio < 0.20) {
    return { ok: false, reason: 'The text appears to contain repetitive or invalid content.' };
  }

  return { ok: true };
}

// ── Stage 2: LLM snippet check ────────────────────────────────────────────────

async function checkWithLLM(text) {
  const excerpt = text.trim().slice(0, 600);

  let res;
  try {
    res = await fetch('/api/ollama/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: [
          'Does the following text contain any substantive content — such as events, dates, facts, research, discoveries, reports, biographies, stories, histories, or academic material?',
          'Reply with only YES or NO.',
          '',
          `"${excerpt}"`,
        ].join('\n'),
        stream: false,
        options: { temperature: 0, num_predict: 5 },
      }),
    });
  } catch {
    return { ok: true };
  }

  if (!res.ok) return { ok: true };

  const data = await res.json();
  const answer = (data.response ?? '').trim().toUpperCase();

  if (answer.startsWith('NO')) {
    return { ok: false, reason: 'The text does not appear to contain enough substantive content. Please provide research, events, reports, or biographical material.' };
  }

  return { ok: true };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function validateContent(text) {
  const heuristic = checkHeuristics(text);
  if (!heuristic.ok) return heuristic;

  return checkWithLLM(text);
}
