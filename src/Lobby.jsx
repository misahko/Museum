import { useState, useRef, useCallback, useEffect } from 'react';
import { extractTextFromPDF } from './pdfParser';
import { sortAndStructureHistory, fileToBase64 } from './llmSorting';
import { generateMuseumRooms } from './museumGenerator';

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'linear-gradient(135deg, #0d0d1a 0%, #1a1128 50%, #0d1a0d 100%)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    fontFamily: '"Segoe UI", system-ui, sans-serif',
    color: '#e8e8f0', overflow: 'auto', padding: '24px 16px',
  },
  card: {
    width: '100%', maxWidth: 680,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 16, padding: '36px 40px',
    boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
    backdropFilter: 'blur(12px)',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 },
  bell: { fontSize: 32, filter: 'drop-shadow(0 0 8px rgba(160,120,255,0.6))' },
  title: {
    fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px',
    background: 'linear-gradient(90deg, #c8a8ff, #80d4ff)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0,
  },
  subtitle: { fontSize: 13, color: 'rgba(200,200,220,0.6)', margin: '4px 0 28px' },
  label: {
    fontSize: 12, fontWeight: 600, color: 'rgba(200,200,220,0.7)',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'block',
  },
  textarea: {
    width: '100%', minHeight: 180, padding: '14px 16px',
    background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, color: '#e8e8f0', fontSize: 14, lineHeight: 1.6,
    resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  },
  dropZone: (drag) => ({
    width: '100%', padding: '18px 16px',
    background: drag ? 'rgba(130,90,255,0.15)' : 'rgba(0,0,0,0.25)',
    border: `1.5px dashed ${drag ? '#a87aff' : 'rgba(255,255,255,0.15)'}`,
    borderRadius: 10, textAlign: 'center', cursor: 'pointer',
    transition: 'all 0.2s', boxSizing: 'border-box',
    color: drag ? '#c8a8ff' : 'rgba(200,200,220,0.5)', fontSize: 14,
  }),
  btn: (disabled) => ({
    width: '100%', marginTop: 20, padding: '13px 0', borderRadius: 10, border: 'none',
    background: disabled ? 'rgba(130,90,255,0.2)' : 'linear-gradient(135deg, #7040cc, #3080cc)',
    color: disabled ? 'rgba(255,255,255,0.4)' : '#fff',
    fontSize: 15, fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
    transition: 'all 0.2s',
    boxShadow: disabled ? 'none' : '0 4px 20px rgba(100,60,200,0.4)',
  }),
  errorBox: {
    marginTop: 14, padding: '12px 16px', borderRadius: 8,
    background: 'rgba(200,60,60,0.15)', border: '1px solid rgba(200,60,60,0.3)',
    color: '#ff9090', fontSize: 13, whiteSpace: 'pre-wrap',
  },
  divider: { textAlign: 'center', color: 'rgba(200,200,220,0.3)', fontSize: 12, margin: '14px 0' },
  hint: { fontSize: 11, color: 'rgba(200,200,220,0.3)', marginTop: 14 },
  tag: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '3px 9px', borderRadius: 20,
    background: 'rgba(130,90,255,0.2)', border: '1px solid rgba(130,90,255,0.3)',
    fontSize: 12, color: '#c8a8ff', marginTop: 6, marginRight: 6,
  },
  // Progress
  progressWrap: { marginTop: 16 },
  progressTrack: {
    height: 5, background: 'rgba(255,255,255,0.08)',
    borderRadius: 3, overflow: 'hidden', marginBottom: 8,
  },
  progressBar: (pct) => ({
    height: '100%', width: `${pct}%`,
    background: 'linear-gradient(90deg, #7040cc, #3080cc)',
    borderRadius: 3, transition: 'width 0.4s ease',
  }),
  logBox: {
    maxHeight: 160, overflowY: 'auto',
    background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 8, padding: '8px 12px',
    fontFamily: '"Courier New", monospace', fontSize: 12, lineHeight: 1.7,
  },
  logLine: (last) => ({
    color: last ? '#c8a8ff' : 'rgba(180,180,210,0.55)',
    display: 'flex', alignItems: 'baseline', gap: 8,
  }),
  logPct: { color: 'rgba(130,90,255,0.8)', minWidth: 36, textAlign: 'right', flexShrink: 0 },
};

// ── Stage labels ──────────────────────────────────────────────────────────────

const STAGE_ICONS = { 0: '🖼', 1: '📥', 2: '🔍', 3: '📅', 4: '♻️', 5: '🗂', 6: '↕️', 7: '🏗' };

// ── Component ─────────────────────────────────────────────────────────────────

export function Lobby({ onMuseumReady }) {
  const [text, setText]           = useState('');
  const [pdfFiles, setPdfFiles]   = useState([]);
  const [pdfNames, setPdfNames]   = useState([]);
  const [phase, setPhase]         = useState('idle');
  const [errorMsg, setErrorMsg]   = useState('');
  const [drag, setDrag]           = useState(false);
  const [progress, setProgress]   = useState({ percent: 0, message: '' });
  const [logs, setLogs]           = useState([]);
  const fileRef                   = useRef();
  const logEndRef                 = useRef();

  // Auto-scroll log to bottom
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  const addLog = (stage, message, percent) => {
    const icon = STAGE_ICONS[stage] ?? '▸';
    setLogs(prev => [...prev, { icon, message, percent }]);
    setProgress({ percent, message });
  };

  const addText = (extra) => setText(prev =>
    prev.trim() ? prev + '\n\n---\n\n' + extra : extra
  );

  const processFiles = useCallback(async (files) => {
    const pdfs = [...files].filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
    const txts = [...files].filter(f => f.type.startsWith('text/') || f.name.endsWith('.txt'));
    if (!pdfs.length && !txts.length) return;

    setPhase('parsing');
    setErrorMsg('');
    try {
      for (const f of txts) addText(await f.text());
      for (const f of pdfs) {
        addText(await extractTextFromPDF(f));
        setPdfNames(prev => [...prev, f.name]);
        setPdfFiles(prev => [...prev, f]);
      }
    } catch (e) {
      setErrorMsg('Failed to read file: ' + e.message);
      setPhase('error');
      return;
    }
    setPhase('idle');
  }, []);

  const handleDrop = (e) => { e.preventDefault(); setDrag(false); processFiles(e.dataTransfer.files); };

  const handleGenerate = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setPhase('generating');
    setErrorMsg('');
    setLogs([]);
    setProgress({ percent: 0, message: 'Starting…' });

    try {
      addLog(0, 'Preparing files…', 2);
      const pdfsBase64 = await Promise.all(
        pdfFiles.map(async f => ({ name: f.name, data: await fileToBase64(f) }))
      );

      const llmOutput = await sortAndStructureHistory(
        trimmed,
        pdfsBase64,
        ({ stage, message, percent }) => addLog(stage, message, percent),
      );

      addLog(7, 'Building 3D museum rooms…', 98);
      const rooms = generateMuseumRooms(llmOutput);
      addLog(7, `Done — ${rooms.length} room(s) ready`, 100);

      setTimeout(() => onMuseumReady({ rooms }), 400);
    } catch (e) {
      setErrorMsg(e.message);
      setPhase('error');
    }
  };

  const busy = phase === 'parsing' || phase === 'generating';

  return (
    <div style={S.overlay}>
      <div style={S.card}>

        <div style={S.logo}>
          <span style={S.bell}>🔔</span>
          <h1 style={S.title}>Science Museum Generator</h1>
        </div>
        <p style={S.subtitle}>
          Paste your scientific biography, CV, or publication list — or upload PDFs —
          and the local LLM will build a personalised 3D museum of your research career.
        </p>

        <label style={S.label}>Your scientific history</label>
        <textarea
          style={S.textarea}
          placeholder={'Paste your CV, biography, list of papers, projects, awards…\n\nThe more detail you provide, the richer the museum.'}
          value={text}
          onChange={e => setText(e.target.value)}
          disabled={busy}
        />

        <div style={{ marginTop: 14 }}>
          <div style={S.divider}>— or upload PDF / text files —</div>
          <div
            style={S.dropZone(drag)}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={handleDrop}
          >
            {phase === 'parsing' ? '⏳ Extracting text…' : '📄 Click or drag PDF / .txt files here'}
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.txt,text/plain,application/pdf"
            multiple style={{ display: 'none' }} onChange={e => processFiles(e.target.files)} />
          {pdfNames.map(n => <span key={n} style={S.tag}>📎 {n}</span>)}
        </div>

        <button style={S.btn(busy || !text.trim())} onClick={handleGenerate} disabled={busy || !text.trim()}>
          {phase === 'generating' ? '⏳ Processing…' : '🏛 Build Museum'}
        </button>

        {/* ── Progress area ───────────────────────────────────────────────── */}
        {phase === 'generating' && (
          <div style={S.progressWrap}>
            {/* Bar */}
            <div style={S.progressTrack}>
              <div style={S.progressBar(progress.percent)} />
            </div>

            {/* Log */}
            <div style={S.logBox}>
              {logs.map((l, i) => {
                const isLast = i === logs.length - 1;
                return (
                  <div key={i} style={S.logLine(isLast)}>
                    <span style={S.logPct}>{l.percent}%</span>
                    <span>{l.icon} {l.message}</span>
                  </div>
                );
              })}
              <div ref={logEndRef} />
            </div>
          </div>
        )}

        {phase === 'error' && <div style={S.errorBox}>⚠ {errorMsg}</div>}

        <p style={S.hint}>
          Requires: <code>cd LLMSorting &amp;&amp; python server.py</code>
          {'  ·  '}<code>ollama pull llama3</code>
        </p>
      </div>
    </div>
  );
}
