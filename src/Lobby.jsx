import { useState, useRef, useCallback, useEffect } from 'react';
import { extractTextFromPDF } from './pdfParser';
import { sortAndStructureHistory, fileToBase64 } from './llmSorting';
import { generateMuseumRooms } from './museumGenerator';

// ── Persistence ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'museum_app_v1';
const loadSaved  = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); } catch { return []; } };
const writeSaved = (list) => localStorage.setItem(STORAGE_KEY, JSON.stringify(list));

function deriveName(text) {
  const first = text.trim().split('\n')[0].trim();
  return first.length > 54 ? first.slice(0, 51) + '…' : first || 'Untitled Museum';
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  accent:      '#9b5cf6',
  accentDim:   'rgba(140,80,240,0.55)',
  accentGlow:  'rgba(120,60,220,0.25)',
  surface:     'rgba(12,4,26,0.72)',
  border:      'rgba(120,60,200,0.35)',
  borderFocus: 'rgba(155,92,246,0.7)',
  text:        '#ddd0f5',
  textMuted:   'rgba(190,170,230,0.5)',
  textDim:     'rgba(160,140,210,0.35)',
  errorBg:     'rgba(160,30,55,0.15)',
  errorBorder: 'rgba(200,60,90,0.3)',
};

// ── Shared styles ─────────────────────────────────────────────────────────────

const S = {
  root: {
    position: 'fixed', inset: 0,
    background: `
      radial-gradient(ellipse 55% 45% at 20% 15%, rgba(70,15,130,0.45) 0%, transparent 65%),
      radial-gradient(ellipse 50% 55% at 85% 85%, rgba(45,8,100,0.4) 0%, transparent 60%),
      linear-gradient(170deg, #07000f 0%, #0e0020 55%, #080012 100%)`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif',
    color: T.text, overflow: 'auto', padding: '24px 16px',
    minHeight: '100vh', animation: 'fade-in 0.5s ease-out',
  },

  card: {
    position: 'relative', width: '100%', maxWidth: 680,
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 16,
    backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
    boxShadow: `0 1px 0 rgba(255,255,255,0.06) inset, 0 32px 80px rgba(0,0,0,0.65), 0 0 60px rgba(80,20,160,0.15)`,
    animation: 'border-breathe 6s ease-in-out infinite',
    overflow: 'hidden',
  },

  stripe: {
    height: 3,
    background: `linear-gradient(90deg, transparent 0%, ${T.accent} 30%, rgba(100,160,255,0.8) 70%, transparent 100%)`,
    opacity: 0.75,
  },

  body: { padding: '36px 44px 40px' },

  wordmark: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  logoMark: {
    width: 32, height: 32, borderRadius: 8,
    background: 'rgba(100,40,200,0.3)', border: `1px solid ${T.accentDim}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16, flexShrink: 0, boxShadow: `0 0 16px ${T.accentGlow}`,
  },
  appName: {
    fontSize: 11, fontWeight: 700, letterSpacing: 2.5,
    textTransform: 'uppercase', color: T.accentDim,
  },

  title: {
    fontSize: 26, fontWeight: 700, letterSpacing: '-0.3px',
    color: '#ede5ff', lineHeight: 1.2, margin: '0 0 8px',
  },
  subtitle: { fontSize: 13.5, lineHeight: 1.65, color: T.textMuted, maxWidth: 520 },

  rule: { border: 'none', borderTop: `1px solid rgba(120,60,200,0.2)`, margin: '24px 0' },

  // ── List view ──────────────────────────────────────────────────────────────

  sectionRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: 700, letterSpacing: 1.8,
    textTransform: 'uppercase', color: T.textMuted,
  },
  countBadge: {
    padding: '2px 9px', borderRadius: 20,
    background: 'rgba(100,40,200,0.2)', border: '1px solid rgba(130,70,220,0.3)',
    fontSize: 11, color: '#c4a8ff', fontWeight: 600,
  },

  museumRow: (hover) => ({
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 14px', borderRadius: 10, marginBottom: 7,
    background: hover ? 'rgba(90,35,190,0.12)' : 'rgba(8,2,20,0.45)',
    border: `1px solid ${hover ? 'rgba(140,70,240,0.45)' : 'rgba(100,50,180,0.22)'}`,
    transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s',
    boxShadow: hover ? '0 0 18px rgba(100,40,200,0.1)' : 'none',
  }),
  museumName: {
    flex: 1, fontSize: 14, fontWeight: 600, color: '#ede5ff',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  museumMeta: {
    fontSize: 12, color: T.textMuted, flexShrink: 0,
    display: 'flex', alignItems: 'center', gap: 8,
  },
  metaDot: { color: 'rgba(120,80,200,0.35)', userSelect: 'none' },

  btnEnter: (h) => ({
    padding: '6px 14px', borderRadius: 7, flexShrink: 0,
    background: h ? 'rgba(120,50,220,0.35)' : 'rgba(90,30,180,0.2)',
    border: `1px solid ${h ? 'rgba(155,92,246,0.65)' : 'rgba(120,60,200,0.35)'}`,
    color: h ? '#e0d0ff' : '#c4a8ff',
    fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: 0.3,
    transition: 'all 0.15s',
    boxShadow: h ? '0 0 12px rgba(120,50,220,0.2)' : 'none',
  }),
  btnDelete: (h) => ({
    width: 28, height: 28, borderRadius: 7, flexShrink: 0, border: 'none',
    background: h ? 'rgba(160,30,55,0.22)' : 'transparent',
    border: `1px solid ${h ? 'rgba(200,60,90,0.4)' : 'rgba(120,60,200,0.18)'}`,
    color: h ? '#f08090' : T.textDim,
    fontSize: 16, lineHeight: 1, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s',
  }),

  emptyState: { padding: '36px 0 24px', textAlign: 'center' },
  emptyText:  { fontSize: 13.5, color: T.textMuted, marginBottom: 4 },
  emptyHint:  { fontSize: 12, color: T.textDim },

  // ── Buttons ────────────────────────────────────────────────────────────────

  btnPrimary: (disabled) => ({
    width: '100%', padding: '12px 0', borderRadius: 10,
    border: disabled ? '1px solid rgba(100,50,180,0.2)' : `1px solid ${T.accentDim}`,
    background: disabled
      ? 'rgba(50,20,90,0.25)'
      : 'linear-gradient(135deg, rgba(85,25,175,0.9) 0%, rgba(120,50,210,0.9) 100%)',
    color: disabled ? T.textDim : '#f0e8ff',
    fontSize: 14, fontWeight: 600, letterSpacing: 0.4,
    cursor: disabled ? 'default' : 'pointer', transition: 'all 0.2s',
    boxShadow: disabled ? 'none' : `0 4px 24px rgba(100,40,200,0.35), 0 1px 0 rgba(255,255,255,0.1) inset`,
  }),

  backBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: 0, background: 'none', border: 'none', cursor: 'pointer',
    color: T.textMuted, fontSize: 12.5, letterSpacing: 0.2,
    marginBottom: 22, transition: 'color 0.15s',
  },

  // ── Create-form elements ───────────────────────────────────────────────────

  label: {
    display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: 1.8,
    textTransform: 'uppercase', color: T.textMuted, marginBottom: 8,
  },
  textarea: (focus) => ({
    width: '100%', minHeight: 155, padding: '13px 15px',
    background: 'rgba(8,2,20,0.6)',
    border: `1px solid ${focus ? T.borderFocus : T.border}`,
    borderRadius: 10, color: T.text, fontSize: 13.5, lineHeight: 1.65,
    resize: 'none', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxShadow: focus ? `0 0 0 3px rgba(120,50,200,0.12)` : 'none',
  }),
  dropZone: (drag) => ({
    width: '100%', padding: '16px',
    background: drag ? 'rgba(100,40,200,0.12)' : 'rgba(8,2,20,0.4)',
    border: `1px dashed ${drag ? T.accentDim : 'rgba(110,55,190,0.3)'}`,
    borderRadius: 10, textAlign: 'center', cursor: 'pointer',
    transition: 'all 0.2s', color: drag ? '#c4a8ff' : T.textMuted, fontSize: 13,
    boxShadow: drag ? `0 0 20px rgba(120,50,200,0.12)` : 'none',
  }),
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '3px 10px', borderRadius: 6,
    background: 'rgba(100,40,200,0.18)', border: '1px solid rgba(130,70,220,0.3)',
    fontSize: 11.5, color: '#c4a8ff', letterSpacing: 0.2,
  },

  // ── Progress ───────────────────────────────────────────────────────────────

  progressSection: { marginTop: 20 },
  progressHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  progressLabel:   { fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: T.textMuted },
  progressPct:     { fontSize: 12, fontWeight: 700, color: T.accent, fontVariantNumeric: 'tabular-nums' },
  progressTrack:   { height: 3, background: 'rgba(60,20,110,0.5)', borderRadius: 2, overflow: 'hidden', marginBottom: 14 },
  progressFill: (pct) => ({
    height: '100%', width: `${pct}%`,
    background: `linear-gradient(90deg, ${T.accent} 0%, #a0c0ff 100%)`,
    borderRadius: 2, transition: 'width 0.4s ease',
    animation: 'progress-glow 2s ease-in-out infinite',
  }),
  logBox: {
    background: 'rgba(4,1,12,0.7)', border: `1px solid rgba(90,40,160,0.25)`,
    borderRadius: 8, padding: '10px 14px', maxHeight: 148, overflowY: 'auto',
    fontFamily: '"SF Mono", "Fira Code", "Courier New", monospace', fontSize: 11.5, lineHeight: 1.8,
  },
  logLine: (last) => ({ display: 'flex', alignItems: 'baseline', gap: 10, color: last ? '#c4a8ff' : 'rgba(160,140,210,0.4)' }),

  errorBox: {
    marginTop: 14, padding: '11px 15px', borderRadius: 8,
    background: T.errorBg, border: `1px solid ${T.errorBorder}`,
    color: '#f08090', fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.5,
  },

  // ── Footer (dev only) ──────────────────────────────────────────────────────

  footer: {
    marginTop: 28, paddingTop: 20, borderTop: `1px solid rgba(100,50,170,0.18)`,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontSize: 11, color: T.textDim, letterSpacing: 0.3,
  },
  footerCode: {
    padding: '1px 6px', borderRadius: 4,
    background: 'rgba(80,30,150,0.2)', border: '1px solid rgba(100,50,180,0.25)',
    fontFamily: 'monospace', fontSize: 10.5, color: 'rgba(180,150,240,0.4)',
  },
  footerDot: { color: 'rgba(120,80,200,0.3)' },
};

// ── Museum row ────────────────────────────────────────────────────────────────

function MuseumRow({ museum, onOpen, onDelete }) {
  const [rowHover, setRowHover]     = useState(false);
  const [enterHover, setEnterHover] = useState(false);
  const [delHover, setDelHover]     = useState(false);

  return (
    <div
      style={S.museumRow(rowHover)}
      onMouseEnter={() => setRowHover(true)}
      onMouseLeave={() => setRowHover(false)}
    >
      <div style={S.museumName}>{museum.name}</div>
      <div style={S.museumMeta}>
        <span>{fmtDate(museum.createdAt)}</span>
        <span style={S.metaDot}>·</span>
        <span>{museum.roomCount} {museum.roomCount === 1 ? 'room' : 'rooms'}</span>
      </div>
      <button
        style={S.btnEnter(enterHover)}
        onMouseEnter={() => setEnterHover(true)}
        onMouseLeave={() => setEnterHover(false)}
        onClick={() => onOpen(museum)}
      >
        Enter
      </button>
      <button
        style={S.btnDelete(delHover)}
        onMouseEnter={() => setDelHover(true)}
        onMouseLeave={() => setDelHover(false)}
        onClick={() => onDelete(museum.id)}
        title="Delete museum"
      >
        ×
      </button>
    </div>
  );
}

// ── Shared card shell ─────────────────────────────────────────────────────────

function CardShell({ children }) {
  return (
    <div style={S.root}>
      <div style={S.card}>
        <div style={S.stripe} />
        <div style={S.body}>{children}</div>
      </div>
    </div>
  );
}

function CardHeader() {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={S.wordmark}>
        <div style={S.logoMark}>⬡</div>
        <span style={S.appName}>Research Museum</span>
      </div>
      <h1 style={S.title}>Science Museum Generator</h1>
      <p style={S.subtitle}>
        Personalised 3D museums of scientific research careers, generated from CV and publication data.
      </p>
    </div>
  );
}

const STAGE_ICONS = { 0:'▸', 1:'▸', 2:'▸', 3:'▸', 4:'▸', 5:'▸', 6:'▸', 7:'▸' };

// ── Lobby ─────────────────────────────────────────────────────────────────────

export function Lobby({ onMuseumReady }) {
  const [saved, setSaved]       = useState(loadSaved);
  const [view, setView]         = useState('list');

  // Create-form state
  const [text, setText]         = useState('');
  const [pdfFiles, setPdfFiles] = useState([]);
  const [pdfNames, setPdfNames] = useState([]);
  const [phase, setPhase]       = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [drag, setDrag]         = useState(false);
  const [progress, setProgress] = useState({ percent: 0, message: '' });
  const [logs, setLogs]         = useState([]);
  const [taFocus, setTaFocus]   = useState(false);
  const fileRef   = useRef();
  const logEndRef = useRef();

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  const addLog = (stage, message, percent) => {
    setLogs(prev => [...prev, { icon: STAGE_ICONS[stage] ?? '▸', message, percent }]);
    setProgress({ percent, message });
  };

  const addText = (extra) => setText(prev =>
    prev.trim() ? prev + '\n\n---\n\n' + extra : extra
  );

  const processFiles = useCallback(async (files) => {
    const pdfs = [...files].filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
    const txts = [...files].filter(f => f.type.startsWith('text/') || f.name.endsWith('.txt'));
    if (!pdfs.length && !txts.length) return;
    setPhase('parsing'); setErrorMsg('');
    try {
      for (const f of txts) addText(await f.text());
      for (const f of pdfs) {
        addText(await extractTextFromPDF(f));
        setPdfNames(prev => [...prev, f.name]);
        setPdfFiles(prev => [...prev, f]);
      }
    } catch (e) { setErrorMsg('Failed to read file: ' + e.message); setPhase('error'); return; }
    setPhase('idle');
  }, []);

  const handleDrop = (e) => { e.preventDefault(); setDrag(false); processFiles(e.dataTransfer.files); };

  function handleDelete(id) {
    setSaved(prev => { const next = prev.filter(m => m.id !== id); writeSaved(next); return next; });
  }

  function handleOpen(museum) { onMuseumReady({ rooms: museum.rooms }); }

  function goToCreate() { setView('create'); setPhase('idle'); setErrorMsg(''); }
  function goToList()   { setView('list');   setPhase('idle'); setErrorMsg(''); }

  const handleGenerate = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setPhase('generating'); setErrorMsg('');
    setLogs([]); setProgress({ percent: 0, message: 'Initialising…' });

    try {
      addLog(0, 'Preparing files…', 2);
      const pdfsBase64 = await Promise.all(
        pdfFiles.map(async f => ({ name: f.name, data: await fileToBase64(f) }))
      );
      const llmOutput = await sortAndStructureHistory(
        trimmed, pdfsBase64,
        ({ stage, message, percent }) => addLog(stage, message, percent),
      );
      addLog(7, 'Constructing 3D museum…', 98);
      const rooms = generateMuseumRooms(llmOutput);
      addLog(7, `Complete — ${rooms.length} room(s) generated`, 100);

      const entry = {
        id: Date.now().toString(),
        name: deriveName(trimmed),
        createdAt: new Date().toISOString(),
        roomCount: rooms.length,
        rooms,
      };
      setSaved(prev => { const next = [entry, ...prev]; writeSaved(next); return next; });

      setTimeout(() => onMuseumReady({ rooms }), 400);
    } catch (e) { setErrorMsg(e.message); setPhase('error'); }
  };

  const busy = phase === 'parsing' || phase === 'generating';

  // ── List view ───────────────────────────────────────────────────────────────

  if (view === 'list') return (
    <CardShell>
      <CardHeader />
      <hr style={S.rule} />

      <div style={S.sectionRow}>
        <span style={S.sectionTitle}>Your Museums</span>
        {saved.length > 0 && <span style={S.countBadge}>{saved.length}</span>}
      </div>

      {saved.length === 0 ? (
        <div style={S.emptyState}>
          <p style={S.emptyText}>No museums yet.</p>
          <p style={S.emptyHint}>Generate your first museum from a CV or publication list.</p>
        </div>
      ) : (
        <div style={{ marginBottom: 4 }}>
          {saved.map(m => (
            <MuseumRow key={m.id} museum={m} onOpen={handleOpen} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <div style={{ marginTop: saved.length === 0 ? 20 : 14 }}>
        <button style={S.btnPrimary(false)} onClick={goToCreate}>
          New Museum
        </button>
      </div>

      {import.meta.env.DEV && (
        <div style={S.footer}>
          <code style={S.footerCode}>cd LLMSorting &amp;&amp; python server.py</code>
          <span style={S.footerDot}>·</span>
          <code style={S.footerCode}>ollama pull llama3</code>
        </div>
      )}
    </CardShell>
  );

  // ── Create view ─────────────────────────────────────────────────────────────

  return (
    <CardShell>
      <button style={S.backBtn} onClick={goToList}>
        ← My Museums
      </button>

      <div style={{ marginBottom: 22 }}>
        <h1 style={{ ...S.title, fontSize: 22 }}>New Museum</h1>
        <p style={S.subtitle}>
          Provide your scientific biography, CV, or publication list to generate a personalised 3D museum.
        </p>
      </div>

      <hr style={S.rule} />

      <label style={S.label}>Research content</label>
      <textarea
        style={S.textarea(taFocus)}
        placeholder={'Paste your CV, biography, list of papers, projects, awards…'}
        value={text}
        onChange={e => setText(e.target.value)}
        onFocus={() => setTaFocus(true)}
        onBlur={() => setTaFocus(false)}
        disabled={busy}
      />

      <div style={{ marginTop: 18 }}>
        <div style={S.label}>Attachments</div>
        <div
          style={S.dropZone(drag)}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={handleDrop}
        >
          {phase === 'parsing' ? 'Extracting text from file…' : 'Click to select or drag PDF / .txt files here'}
        </div>
        <input
          ref={fileRef} type="file"
          accept=".pdf,.txt,text/plain,application/pdf"
          multiple style={{ display: 'none' }}
          onChange={e => processFiles(e.target.files)}
        />
        {pdfNames.length > 0 && (
          <div style={S.tagRow}>
            {pdfNames.map(n => <span key={n} style={S.tag}>{n}</span>)}
          </div>
        )}
      </div>

      <div style={{ marginTop: 24 }}>
        <button
          style={S.btnPrimary(busy || !text.trim())}
          onClick={handleGenerate}
          disabled={busy || !text.trim()}
        >
          {phase === 'generating' ? 'Processing…' : 'Generate Museum'}
        </button>
      </div>

      {phase === 'generating' && (
        <div style={S.progressSection}>
          <div style={S.progressHeader}>
            <span style={S.progressLabel}>Building</span>
            <span style={S.progressPct}>{progress.percent}%</span>
          </div>
          <div style={S.progressTrack}>
            <div style={S.progressFill(progress.percent)} />
          </div>
          {import.meta.env.DEV && (
            <div style={S.logBox}>
              {logs.map((l, i) => {
                const isLast = i === logs.length - 1;
                return (
                  <div key={i} style={S.logLine(isLast)}>
                    <span style={{ minWidth: 34, textAlign: 'right', flexShrink: 0, fontWeight: 600, color: isLast ? T.accent : 'rgba(120,80,200,0.5)' }}>
                      {l.percent}%
                    </span>
                    <span>{l.icon} {l.message}</span>
                  </div>
                );
              })}
              <div ref={logEndRef} />
            </div>
          )}
        </div>
      )}

      {phase === 'error' && <div style={S.errorBox}>Error: {errorMsg}</div>}

      {import.meta.env.DEV && (
        <div style={S.footer}>
          <code style={S.footerCode}>cd LLMSorting &amp;&amp; python server.py</code>
          <span style={S.footerDot}>·</span>
          <code style={S.footerCode}>ollama pull llama3</code>
        </div>
      )}
    </CardShell>
  );
}
