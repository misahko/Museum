import { useState, useRef, useCallback, useEffect } from 'react';
import { extractTextFromPDF } from './pdfParser';
import { sortAndStructureHistory, fileToBase64 } from './llmSorting';
import { generateMuseumRooms } from './museumGenerator';
import { validateContent } from './contentValidator';

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
  accent:      '#7c3aed',
  accentDim:   'rgba(100,50,200,0.5)',
  accentGlow:  'rgba(80,30,180,0.2)',
  surface:     'rgba(6,1,14,0.92)',
  border:      'rgba(80,35,150,0.3)',
  borderFocus: 'rgba(120,65,220,0.65)',
  text:        '#c4b8e8',
  textMuted:   'rgba(150,130,195,0.55)',
  textDim:     'rgba(110,90,160,0.4)',
  errorBg:     'rgba(100,15,35,0.3)',
  errorBorder: 'rgba(160,40,70,0.4)',
};

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  root: {
    position: 'fixed', inset: 0,
    background: `
      radial-gradient(ellipse 50% 40% at 15% 10%, rgba(45,8,100,0.35) 0%, transparent 60%),
      radial-gradient(ellipse 45% 50% at 88% 90%, rgba(30,4,75,0.35) 0%, transparent 55%),
      linear-gradient(170deg, #020005 0%, #06000f 50%, #030008 100%)`,
    fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif',
    color: T.text,
    animation: 'fade-in 0.5s ease-out',
  },

  // ── Full-screen card ────────────────────────────────────────────────────────

  card: {
    position: 'relative', width: '100%', maxWidth: '100%',
    height: '100vh',
    background: T.surface,
    border: 'none',
    backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)',
    overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
  },

  stripe: {
    height: 2, flexShrink: 0,
    background: `linear-gradient(90deg, transparent 0%, ${T.accent} 35%, rgba(80,120,220,0.7) 70%, transparent 100%)`,
    opacity: 0.6,
  },

  // ── Top bar ─────────────────────────────────────────────────────────────────

  topBar: {
    flexShrink: 0,
    padding: '0 40px',
    height: 56,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    borderBottom: `1px solid rgba(70,30,140,0.25)`,
    background: 'rgba(4,1,10,0.5)',
  },
  wordmark: { display: 'flex', alignItems: 'center', gap: 10 },
  logoMark: {
    width: 28, height: 28, borderRadius: 7,
    background: 'rgba(60,20,130,0.35)', border: `1px solid rgba(90,40,170,0.4)`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, flexShrink: 0, boxShadow: `0 0 12px ${T.accentGlow}`,
  },
  appName: { fontSize: 11, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(110,70,190,0.6)' },

  // ── Tab bar ─────────────────────────────────────────────────────────────────

  tabBar: {
    display: 'flex', gap: 2,
    background: 'rgba(4,1,10,0.4)',
    padding: '0 40px',
    borderBottom: `1px solid rgba(70,30,140,0.2)`,
    flexShrink: 0,
  },
  tab: (active) => ({
    padding: '12px 20px',
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 12.5, fontWeight: 600, letterSpacing: 0.4,
    color: active ? '#c0a8f0' : 'rgba(130,100,190,0.45)',
    borderBottom: `2px solid ${active ? T.accent : 'transparent'}`,
    marginBottom: -1,
    transition: 'color 0.15s, border-color 0.15s',
    display: 'flex', alignItems: 'center', gap: 8,
  }),
  tabCount: (active) => ({
    padding: '1px 7px', borderRadius: 10,
    background: active ? 'rgba(100,50,200,0.25)' : 'rgba(60,25,120,0.2)',
    fontSize: 10, fontWeight: 700,
    color: active ? 'rgba(180,140,240,0.8)' : 'rgba(110,80,170,0.5)',
    transition: 'all 0.15s',
  }),

  // ── Panel ───────────────────────────────────────────────────────────────────

  panel: {
    flex: 1, display: 'flex', flexDirection: 'column',
    overflow: 'hidden', padding: '28px 40px',
    maxWidth: 860, width: '100%', alignSelf: 'center',
    boxSizing: 'border-box',
  },

  panelHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16, flexShrink: 0,
  },
  panelTitle: {
    fontSize: 11, fontWeight: 700, letterSpacing: 1.8,
    textTransform: 'uppercase', color: T.textMuted,
  },
  panelCount: {
    padding: '1px 8px', borderRadius: 10,
    background: 'rgba(60,20,120,0.3)', border: '1px solid rgba(80,35,150,0.3)',
    fontSize: 10, fontWeight: 700, color: 'rgba(140,100,210,0.6)',
  },

  panelScroll: { flex: 1, overflowY: 'auto', paddingRight: 4 },

  // ── Museum rows ─────────────────────────────────────────────────────────────

  museumRow: (h) => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 12px', borderRadius: 9, marginBottom: 6,
    background: h ? 'rgba(50,15,110,0.18)' : 'rgba(4,1,10,0.6)',
    border: `1px solid ${h ? 'rgba(100,45,190,0.4)' : 'rgba(65,28,130,0.28)'}`,
    transition: 'background 0.15s, border-color 0.15s',
    boxShadow: h ? '0 0 14px rgba(60,20,140,0.12)' : 'none',
  }),
  museumName: {
    flex: 1, fontSize: 13, fontWeight: 600, color: '#a898c8',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  museumMeta: {
    fontSize: 11, color: T.textMuted, flexShrink: 0,
    display: 'flex', alignItems: 'center', gap: 6,
  },
  metaDot: { color: 'rgba(80,50,140,0.4)', userSelect: 'none' },

  btnEnter: (h) => ({
    padding: '4px 10px', borderRadius: 6, flexShrink: 0,
    background: h ? 'rgba(80,30,160,0.4)' : 'rgba(50,15,110,0.3)',
    border: `1px solid ${h ? 'rgba(110,55,210,0.6)' : 'rgba(80,35,160,0.35)'}`,
    color: h ? '#c0a8f0' : 'rgba(150,110,220,0.7)',
    fontSize: 11, fontWeight: 600, cursor: 'pointer', letterSpacing: 0.2, transition: 'all 0.15s',
  }),
  btnDel: (h) => ({
    width: 24, height: 24, borderRadius: 5, flexShrink: 0, padding: 0,
    background: h ? 'rgba(120,20,40,0.3)' : 'transparent',
    border: `1px solid ${h ? 'rgba(160,40,65,0.45)' : 'rgba(80,35,130,0.22)'}`,
    color: h ? '#d06070' : T.textDim,
    fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }),

  // ── New Museum button (right panel) ─────────────────────────────────────────

  btnNew: (h) => ({
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '4px 10px', borderRadius: 6,
    background: h ? 'rgba(80,30,160,0.4)' : 'rgba(50,15,110,0.28)',
    border: `1px solid ${h ? 'rgba(110,55,210,0.6)' : 'rgba(80,35,160,0.35)'}`,
    color: h ? '#c0a8f0' : 'rgba(140,100,210,0.65)',
    fontSize: 11, fontWeight: 600, cursor: 'pointer', letterSpacing: 0.3,
    transition: 'all 0.15s',
  }),

  // ── States ──────────────────────────────────────────────────────────────────

  emptyState: { padding: '28px 0 8px', textAlign: 'center' },
  emptyText:  { fontSize: 13, color: T.textMuted, marginBottom: 4 },
  emptyHint:  { fontSize: 11.5, color: T.textDim },

  loadingRow: {
    padding: '28px 0', textAlign: 'center',
    fontSize: 12, color: T.textDim, letterSpacing: 0.5,
  },

  // ── Create view card body ───────────────────────────────────────────────────

  createBody: {
    overflowY: 'auto', flex: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '40px',
  },
  createInner: {
    width: '100%', maxWidth: 660,
    background: 'rgba(8,2,18,0.7)',
    border: `1px solid rgba(80,35,150,0.35)`,
    borderRadius: 16,
    padding: '36px 44px 40px',
    backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
    boxShadow: `0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.02)`,
  },

  backBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: 0,
    background: 'none', border: 'none', cursor: 'pointer',
    color: T.textMuted, fontSize: 12, letterSpacing: 0.2,
    marginBottom: 20, transition: 'color 0.15s',
  },
  createTitle: { fontSize: 21, fontWeight: 700, letterSpacing: '-0.3px', color: '#b8a8d8', margin: '0 0 6px' },
  createSub:   { fontSize: 13, lineHeight: 1.65, color: T.textMuted, maxWidth: 480 },
  rule: { border: 'none', borderTop: `1px solid rgba(70,30,130,0.3)`, margin: '20px 0' },

  label: {
    display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: 1.8,
    textTransform: 'uppercase', color: T.textMuted, marginBottom: 8,
  },
  textarea: (focus) => ({
    width: '100%', minHeight: 145, padding: '12px 14px',
    background: 'rgba(2,0,8,0.75)',
    border: `1px solid ${focus ? T.borderFocus : T.border}`,
    borderRadius: 10, color: T.text, fontSize: 13.5, lineHeight: 1.65,
    resize: 'none', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxShadow: focus ? `0 0 0 3px rgba(80,30,160,0.15)` : 'none',
  }),
  dropZone: (drag) => ({
    width: '100%', padding: '14px',
    background: drag ? 'rgba(60,20,130,0.14)' : 'rgba(2,0,8,0.55)',
    border: `1px dashed ${drag ? 'rgba(100,50,190,0.55)' : 'rgba(65,28,130,0.3)'}`,
    borderRadius: 10, textAlign: 'center', cursor: 'pointer',
    transition: 'all 0.2s', color: drag ? 'rgba(160,120,230,0.7)' : T.textMuted, fontSize: 13,
    boxShadow: drag ? `0 0 16px rgba(70,25,150,0.12)` : 'none',
  }),
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '3px 9px', borderRadius: 6,
    background: 'rgba(60,20,120,0.25)', border: '1px solid rgba(80,35,160,0.3)',
    fontSize: 11, color: 'rgba(160,120,220,0.7)',
  },

  btnPrimary: (disabled) => ({
    width: '100%', padding: '11px 0', borderRadius: 10,
    border: disabled ? '1px solid rgba(60,25,110,0.25)' : `1px solid rgba(90,40,170,0.5)`,
    background: disabled ? 'rgba(20,5,45,0.4)' : 'linear-gradient(135deg, rgba(55,15,120,0.95) 0%, rgba(85,30,165,0.95) 100%)',
    color: disabled ? 'rgba(90,65,140,0.5)' : '#b0a0d8',
    fontSize: 14, fontWeight: 600, letterSpacing: 0.4,
    cursor: disabled ? 'default' : 'pointer', transition: 'all 0.2s',
    boxShadow: disabled ? 'none' : `0 4px 20px rgba(60,15,140,0.4), 0 1px 0 rgba(255,255,255,0.06) inset`,
  }),

  progressSection: { marginTop: 18 },
  progressHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  progressLabel:   { fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: T.textMuted },
  progressPct:     { fontSize: 12, fontWeight: 700, color: T.accent, fontVariantNumeric: 'tabular-nums' },
  progressTrack:   { height: 2, background: 'rgba(30,8,65,0.7)', borderRadius: 2, overflow: 'hidden', marginBottom: 12 },
  progressFill: (pct) => ({
    height: '100%', width: `${pct}%`,
    background: `linear-gradient(90deg, ${T.accent} 0%, rgba(80,100,200,0.9) 100%)`,
    borderRadius: 2, transition: 'width 0.4s ease',
    animation: 'progress-glow 2s ease-in-out infinite',
  }),
  logBox: {
    background: 'rgba(2,0,6,0.85)', border: `1px solid rgba(55,22,110,0.3)`,
    borderRadius: 8, padding: '10px 14px', maxHeight: 130, overflowY: 'auto',
    fontFamily: '"SF Mono", "Fira Code", "Courier New", monospace', fontSize: 11.5, lineHeight: 1.8,
  },
  logLine: (last) => ({ display: 'flex', alignItems: 'baseline', gap: 10, color: last ? 'rgba(160,120,220,0.85)' : 'rgba(100,80,150,0.45)' }),
  errorBox: {
    padding: '11px 14px', borderRadius: 8, marginTop: 14,
    background: T.errorBg, border: `1px solid ${T.errorBorder}`,
    color: '#b05060', fontSize: 13, lineHeight: 1.5,
  },

  footer: {
    marginTop: 18, paddingTop: 14, borderTop: `1px solid rgba(60,25,110,0.2)`,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontSize: 11, color: T.textDim, letterSpacing: 0.3,
  },
  footerCode: {
    padding: '1px 6px', borderRadius: 4,
    background: 'rgba(40,12,90,0.3)', border: '1px solid rgba(65,25,130,0.3)',
    fontFamily: 'monospace', fontSize: 10.5, color: 'rgba(110,75,180,0.45)',
  },
  footerDot: { color: 'rgba(70,35,130,0.4)' },
};

// ── Museum row ────────────────────────────────────────────────────────────────

function MuseumRow({ museum, onOpen, onDelete }) {
  const [rh, setRh] = useState(false);
  const [eh, setEh] = useState(false);
  const [dh, setDh] = useState(false);

  return (
    <div style={S.museumRow(rh)} onMouseEnter={() => setRh(true)} onMouseLeave={() => setRh(false)}>
      <div style={S.museumName}>{museum.name}</div>
      <div style={S.museumMeta}>
        <span>{fmtDate(museum.createdAt)}</span>
        {museum.roomCount != null && <>
          <span style={S.metaDot}>·</span>
          <span>{museum.roomCount}r</span>
        </>}
      </div>
      <button
        style={S.btnEnter(eh)}
        onMouseEnter={() => setEh(true)} onMouseLeave={() => setEh(false)}
        onClick={() => onOpen(museum)}
      >
        Enter
      </button>
      {onDelete && (
        <button
          style={S.btnDel(dh)}
          onMouseEnter={() => setDh(true)} onMouseLeave={() => setDh(false)}
          onClick={() => onDelete(museum.id)}
          title="Delete"
        >×</button>
      )}
    </div>
  );
}

// ── New button ────────────────────────────────────────────────────────────────

function NewBtn({ onClick }) {
  const [h, setH] = useState(false);
  return (
    <button
      style={S.btnNew(h)}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      onClick={onClick}
    >
      + New
    </button>
  );
}

// ── Empty / loading states ────────────────────────────────────────────────────

function EmptyState({ text, hint }) {
  return (
    <div style={S.emptyState}>
      <p style={S.emptyText}>{text}</p>
      {hint && <p style={S.emptyHint}>{hint}</p>}
    </div>
  );
}

const STAGE_ICONS = { 0:'▸', 1:'▸', 2:'▸', 3:'▸', 4:'▸', 5:'▸', 6:'▸', 7:'▸' };

// ── Lobby ─────────────────────────────────────────────────────────────────────

export function Lobby({ onMuseumReady }) {
  const [saved, setSaved]     = useState(loadSaved);
  const [gallery, setGallery] = useState(null); // null = loading
  const [view, setView]       = useState('home'); // 'home' | 'create'
  const [tab, setTab]         = useState('gallery'); // 'gallery' | 'mine'

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

  // Fetch gallery from DB
  useEffect(() => {
    fetch('/api/museums')
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => setGallery(Array.isArray(data) ? data : []))
      .catch(() => setGallery([]));
  }, []);

  // Personal museum management
  function handleDelete(id) {
    setSaved(prev => { const next = prev.filter(m => m.id !== id); writeSaved(next); return next; });
  }

  function handleOpen(museum) { onMuseumReady({ rooms: museum.rooms }); }

  // File processing
  const addLog = (stage, message, percent) => {
    setLogs(prev => [...prev, { icon: STAGE_ICONS[stage] ?? '▸', message, percent }]);
    setProgress({ percent, message });
  };

  const addText = (extra) => setText(prev => prev.trim() ? prev + '\n\n---\n\n' + extra : extra);

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

  const handleGenerate = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setPhase('generating'); setErrorMsg('');
    setLogs([]); setProgress({ percent: 0, message: 'Validating content…' });

    try {
      addLog(0, 'Validating content…', 2);
      const validation = await validateContent(trimmed);
      if (!validation.ok) { setErrorMsg(validation.reason); setPhase('error'); return; }

      addLog(0, 'Preparing files…', 5);
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

  const DevFooter = () => import.meta.env.DEV ? (
    <div style={S.footer}>
      <code style={S.footerCode}>cd LLMSorting &amp;&amp; python server.py</code>
      <span style={S.footerDot}>·</span>
      <code style={S.footerCode}>ollama pull llama3</code>
    </div>
  ) : null;

  // ── Home view (tabs, full screen) ────────────────────────────────────────

  if (view === 'home') return (
    <div style={S.root}>
      <div style={S.card}>
        <div style={S.stripe} />

        {/* Top bar */}
        <div style={S.topBar}>
          <div style={S.wordmark}>
            <div style={S.logoMark}>⬡</div>
            <span style={S.appName}>Research Museum</span>
          </div>
          {tab === 'mine' && <NewBtn onClick={() => setView('create')} />}
        </div>

        {/* Tab bar */}
        <div style={S.tabBar}>
          <button style={S.tab(tab === 'gallery')} onClick={() => setTab('gallery')}>
            Gallery
            {gallery?.length > 0 && <span style={S.tabCount(tab === 'gallery')}>{gallery.length}</span>}
          </button>
          <button style={S.tab(tab === 'mine')} onClick={() => setTab('mine')}>
            My Museums
            {saved.length > 0 && <span style={S.tabCount(tab === 'mine')}>{saved.length}</span>}
          </button>
        </div>

        {/* Panel content */}
        <div style={S.panel}>
          <div style={S.panelScroll}>

            {tab === 'gallery' && (
              gallery === null ? (
                <div style={S.loadingRow}>Loading…</div>
              ) : gallery.length === 0 ? (
                <EmptyState text="No museums in the gallery." hint="Check back later." />
              ) : (
                gallery.map(m => <MuseumRow key={m.id} museum={m} onOpen={handleOpen} />)
              )
            )}

            {tab === 'mine' && (
              saved.length === 0 ? (
                <EmptyState
                  text="No personal museums yet."
                  hint="Click «+ New» to generate your first museum."
                />
              ) : (
                saved.map(m => (
                  <MuseumRow key={m.id} museum={m} onOpen={handleOpen} onDelete={handleDelete} />
                ))
              )
            )}

          </div>
        </div>

        {import.meta.env.DEV && (
          <div style={{ padding: '0 40px', flexShrink: 0 }}><DevFooter /></div>
        )}
      </div>
    </div>
  );

  // ── Create view ───────────────────────────────────────────────────────────

  return (
    <div style={S.root}>
      <div style={S.card}>
        <div style={S.stripe} />
        <div style={S.createBody}>
         <div style={S.createInner}>

          <button style={S.backBtn} onClick={() => { setView('home'); setPhase('idle'); setErrorMsg(''); }}>
            ← Museums
          </button>

          <h1 style={S.createTitle}>New Museum</h1>
          <p style={S.createSub}>
            Provide your scientific biography, CV, or publication list to generate a personalised 3D museum.
          </p>

          <hr style={S.rule} />

          <label style={S.label}>Research content</label>
          <textarea
            style={S.textarea(taFocus)}
            placeholder="Paste your CV, biography, list of papers, projects, awards…"
            value={text}
            onChange={e => setText(e.target.value)}
            onFocus={() => setTaFocus(true)}
            onBlur={() => setTaFocus(false)}
            disabled={busy}
          />

          <div style={{ marginTop: 16 }}>
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

          <div style={{ marginTop: 22 }}>
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
                        <span style={{ minWidth: 34, textAlign: 'right', flexShrink: 0, fontWeight: 600, color: isLast ? T.accent : 'rgba(100,60,180,0.5)' }}>
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

          {phase === 'error' && <div style={S.errorBox}>{errorMsg}</div>}

          <DevFooter />
         </div>
        </div>
      </div>
    </div>
  );
}
