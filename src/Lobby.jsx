import { useState, useRef, useCallback, useEffect } from 'react';
import QRCode from 'qrcode';
import { extractTextFromPDF } from './pdfParser';
import { sortAndStructureHistory, fileToBase64 } from './llmSorting';
import { generateMuseumRooms } from './museumGenerator';
import { validateContent } from './contentValidator';
import { getVisits } from './museumStore';
import { SKINS } from './skins';

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
  accentDim:   'rgba(110,60,210,0.6)',
  accentGlow:  'rgba(80,30,180,0.15)',
  surface:     'rgba(10,10,12,0.96)',
  border:      'rgba(100,50,200,0.3)',
  borderHover: 'rgba(120,65,220,0.55)',
  borderFocus: 'rgba(110, 55, 211, 0.62)',
  text:        '#d4d4d8',
  textMuted:   'rgba(160,160,168,0.55)',
  textDim:     'rgba(110,110,118,0.45)',
  errorBg:     'rgba(80,10,20,0.4)',
  errorBorder: 'rgba(140,30,50,0.45)',
  metal:       'rgba(255,255,255,0.06)',
  metalBright: 'rgba(255,255,255,0.1)',
};

const C = { dim: T.textDim }; // shorthand used in ORCID section

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  root: {
    position: 'fixed', inset: 0,
    background: '#060608',
    fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif',
    color: T.text,
  },

  // ── Full-screen card ────────────────────────────────────────────────────────

  card: {
    position: 'relative', width: '100%', maxWidth: '100%',
    height: '100vh',
    background: 'linear-gradient(180deg, #0e0e10 0%, #080809 100%)',
    overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
  },

  stripe: {
    height: 1, flexShrink: 0,
    background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 20%, ${T.accent} 50%, rgba(255,255,255,0.12) 80%, transparent 100%)`,
  },

  // ── Top bar ─────────────────────────────────────────────────────────────────

  topBar: {
    flexShrink: 0,
    padding: '0 40px',
    height: 54,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    borderBottom: `1px solid rgba(100,50,200,0.25)`,
    background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%)',
    boxShadow: '0 1px 0 rgba(100,50,200,0.1)',
  },
  wordmark: { display: 'flex', alignItems: 'center', gap: 10 },
  logoMark: {
    width: 28, height: 28, borderRadius: 7,
    background: 'linear-gradient(135deg, rgba(100,50,200,0.2) 0%, rgba(80,30,160,0.1) 100%)',
    border: `1px solid rgba(100,50,200,0.4)`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, flexShrink: 0,
    boxShadow: `0 1px 0 rgba(255,255,255,0.08) inset, 0 0 10px ${T.accentGlow}`,
    color: 'rgba(180,140,255,0.7)',
  },
  appName: { fontSize: 11, fontWeight: 600, letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(180,180,190,0.35)' },

  // ── Tab bar ─────────────────────────────────────────────────────────────────

  tabBar: {
    display: 'flex', gap: 0,
    padding: '0 40px',
    borderBottom: `1px solid rgba(100,50,200,0.25)`,
    flexShrink: 0,
    background: 'rgba(0,0,0,0.2)',
  },
  tab: (active) => ({
    padding: '13px 22px',
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 12.5, fontWeight: 600, letterSpacing: 0.3,
    color: active ? '#e0e0e4' : 'rgba(140,140,150,0.45)',
    borderBottom: `2px solid ${active ? T.accent : 'transparent'}`,
    marginBottom: -1,
    transition: 'color 0.15s, border-color 0.15s',
    display: 'flex', alignItems: 'center', gap: 8,
  }),
  tabCount: (active) => ({
    padding: '1px 7px', borderRadius: 10,
    background: active ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)',
    border: `1px solid ${active ? 'rgba(124,58,237,0.35)' : 'rgba(255,255,255,0.07)'}`,
    fontSize: 10, fontWeight: 700,
    color: active ? 'rgba(180,140,255,0.85)' : 'rgba(130,130,140,0.5)',
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
    fontSize: 11, fontWeight: 600, letterSpacing: 1.8,
    textTransform: 'uppercase', color: 'rgba(160,160,168,0.45)',
  },
  panelCount: {
    padding: '1px 8px', borderRadius: 10,
    background: 'rgba(100,50,200,0.12)', border: '1px solid rgba(100,50,200,0.3)',
    fontSize: 10, fontWeight: 600, color: 'rgba(160,130,220,0.6)',
  },

  panelScroll: { flex: 1, overflowY: 'auto', paddingRight: 4 },

  // ── Museum rows ─────────────────────────────────────────────────────────────

  museumRow: (h) => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 14px', borderRadius: 9, marginBottom: 5,
    background: h
      ? 'linear-gradient(180deg, rgba(100,50,200,0.1) 0%, rgba(80,30,160,0.04) 100%)'
      : 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.008) 100%)',
    border: `1px solid ${h ? 'rgba(120,65,220,0.45)' : 'rgba(100,50,200,0.22)'}`,
    boxShadow: h
      ? '0 1px 0 rgba(255,255,255,0.05) inset, 0 4px 12px rgba(0,0,0,0.4)'
      : '0 1px 0 rgba(255,255,255,0.03) inset',
    transition: 'all 0.15s',
  }),
  museumName: {
    flex: 1, fontSize: 13, fontWeight: 500, color: '#c8c8cc',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  museumMeta: {
    fontSize: 11, color: T.textMuted, flexShrink: 0,
    display: 'flex', alignItems: 'center', gap: 6,
  },
  metaDot: { color: 'rgba(160,160,168,0.25)', userSelect: 'none' },

  btnEnter: (h) => ({
    padding: '4px 11px', borderRadius: 6, flexShrink: 0,
    background: h
      ? `linear-gradient(135deg, rgba(124,58,237,0.5) 0%, rgba(90,30,200,0.5) 100%)`
      : 'rgba(100,50,200,0.08)',
    border: `1px solid ${h ? 'rgba(140,80,255,0.65)' : 'rgba(100,50,200,0.3)'}`,
    color: h ? '#d4b8ff' : 'rgba(160,130,220,0.65)',
    fontSize: 11, fontWeight: 600, cursor: 'pointer', letterSpacing: 0.2,
    transition: 'all 0.15s',
    boxShadow: h ? '0 1px 0 rgba(255,255,255,0.1) inset' : 'none',
  }),
  btnDel: (h) => ({
    width: 24, height: 24, borderRadius: 5, flexShrink: 0, padding: 0,
    background: h ? 'rgba(140,20,40,0.35)' : 'transparent',
    border: `1px solid ${h ? 'rgba(180,40,60,0.4)' : 'rgba(100,50,200,0.22)'}`,
    color: h ? '#c06070' : T.textDim,
    fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }),

  btnQR: (h) => ({
    width: 26, height: 24, borderRadius: 5, flexShrink: 0, padding: 0,
    background: h ? 'rgba(100,50,200,0.22)' : 'transparent',
    border: `1px solid ${h ? 'rgba(120,65,220,0.5)' : 'rgba(100,50,200,0.22)'}`,
    color: h ? '#c0a8f0' : T.textDim,
    fontSize: 9.5, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
    display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: 0.3,
  }),

  qrOverlay: {
    position: 'fixed', inset: 0, zIndex: 200,
    background: 'rgba(0,0,0,0.72)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  qrModal: {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)',
    border: '1px solid rgba(100,50,200,0.35)',
    borderRadius: 16, padding: '28px 32px', textAlign: 'center', maxWidth: 280,
    boxShadow: '0 24px 60px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.07) inset',
  },

  btnNew: (h) => ({
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '5px 12px', borderRadius: 6,
    background: h
      ? `linear-gradient(135deg, rgba(93, 0, 255, 0.45) 0%, rgba(90,30,200,0.45) 100%)`
      : 'rgba(100,50,200,0.08)',
    border: `1px solid ${h ? 'rgba(125, 55, 255, 0.84)' : 'rgba(87, 25, 210, 0.44)'}`,
    color: h ? '#d4b8ff' : 'rgba(160,130,220,1)',
    fontSize: 11, fontWeight: 600, cursor: 'pointer', letterSpacing: 0.3,
    transition: 'all 0.15s',
    boxShadow: h ? '0 1px 0 rgba(255,255,255,0.1) inset' : 'none',
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
    background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)',
    border: `1px solid rgba(100,50,200,0.35)`,
    borderRadius: 16,
    padding: '36px 44px 40px',
    boxShadow: `0 1px 0 rgba(255,255,255,0.07) inset, 0 24px 60px rgba(0,0,0,0.7), 0 0 30px rgba(80,30,180,0.08)`,
  },

  backBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: 0,
    background: 'none', border: 'none', cursor: 'pointer',
    color: T.textMuted, fontSize: 12, letterSpacing: 0.2,
    marginBottom: 20, transition: 'color 0.15s',
  },
  createTitle: { fontSize: 21, fontWeight: 700, letterSpacing: '-0.3px', color: '#d8d8dc', margin: '0 0 6px' },
  createSub:   { fontSize: 13, lineHeight: 1.65, color: T.textMuted, maxWidth: 480 },
  rule: { border: 'none', borderTop: `1px solid rgba(70,30,130,0.3)`, margin: '20px 0' },

  label: {
    display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: 1.8,
    textTransform: 'uppercase', color: 'rgba(160,160,168,0.5)', marginBottom: 8,
  },
  textarea: (focus) => ({
    width: '100%', minHeight: 145, padding: '12px 14px',
    background: 'rgba(0,0,0,0.4)',
    border: `1px solid ${focus ? T.borderFocus : T.border}`,
    borderRadius: 10, color: '#d0d0d4', fontSize: 13.5, lineHeight: 1.65,
    resize: 'none', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxShadow: focus
      ? `0 0 0 3px rgba(124,58,237,0.12), 0 1px 0 rgba(255,255,255,0.05) inset`
      : '0 1px 0 rgba(255,255,255,0.04) inset',
  }),
  dropZone: (drag) => ({
    width: '100%', padding: '14px',
    background: drag ? 'rgba(124, 58, 237, 0.2)' : 'rgba(0,0,0,0.3)',
    border: `1px dashed ${drag ? 'rgba(124,58,237,0.45)' : 'rgba(255,255,255,0.08)'}`,
    borderRadius: 10, textAlign: 'center', cursor: 'pointer',
    transition: 'all 0.2s', color: drag ? 'rgba(208, 143, 254, 0.55)' : T.textMuted, fontSize: 13,
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
    border: disabled ? '1px solid rgba(255,255,255,0.05)' : `1px solid rgba(124,58,237,0.45)`,
    background: disabled
      ? 'rgba(255,255,255,0.03)'
      : 'linear-gradient(135deg, rgba(124,58,237,0.55) 0%, rgba(90,30,200,0.55) 100%)',
    color: disabled ? 'rgba(120,120,128,0.4)' : '#d4c8f0',
    fontSize: 14, fontWeight: 600, letterSpacing: 0.4,
    cursor: disabled ? 'default' : 'pointer', transition: 'all 0.2s',
    boxShadow: disabled
      ? 'none'
      : `0 4px 20px rgba(100,40,220,0.2), 0 1px 0 rgba(255,255,255,0.1) inset`,
  }),

  progressSection: { marginTop: 18 },
  progressHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  progressLabel:   { fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: T.textMuted },
  progressPct:     { fontSize: 12, fontWeight: 700, color: T.accent, fontVariantNumeric: 'tabular-nums' },
  progressTrack:   { height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginBottom: 12 },
  progressFill: (pct) => ({
    height: '100%', width: `${pct}%`,
    background: `linear-gradient(90deg, ${T.accent} 0%, rgba(160,120,255,0.9) 100%)`,
    borderRadius: 2, transition: 'width 0.4s ease',
    animation: 'progress-glow 2s ease-in-out infinite',
  }),
  logBox: {
    background: 'rgba(0,0,0,0.5)', border: `1px solid rgba(100,50,200,0.2)`,
    borderRadius: 8, padding: '10px 14px', maxHeight: 130, overflowY: 'auto',
    fontFamily: '"SF Mono", "Fira Code", "Courier New", monospace', fontSize: 11.5, lineHeight: 1.8,
  },
  logLine: (last) => ({ display: 'flex', alignItems: 'baseline', gap: 10, color: last ? 'rgba(180,160,240,0.8)' : 'rgba(120,120,130,0.45)' }),
  errorBox: {
    padding: '11px 14px', borderRadius: 8, marginTop: 14,
    background: T.errorBg, border: `1px solid ${T.errorBorder}`,
    color: '#b06070', fontSize: 13, lineHeight: 1.5,
  },

  footer: {
    marginTop: 18, paddingTop: 14, borderTop: `1px solid rgba(100,50,200,0.2)`,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontSize: 11, color: T.textDim, letterSpacing: 0.3,
  },
  footerCode: {
    padding: '1px 6px', borderRadius: 4,
    background: 'rgba(100,50,200,0.08)', border: '1px solid rgba(100,50,200,0.25)',
    fontFamily: 'monospace', fontSize: 10.5, color: 'rgba(140,110,200,0.5)',
  },
  footerDot: { color: 'rgba(120,120,130,0.3)' },
};

// ── QR Modal ──────────────────────────────────────────────────────────────────

function QRModal({ museum, onClose }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    const text = [
      `Museum: ${museum.name}`,
      `ID: ${museum.id}`,
      `URL: ${window.location.origin}?m=${museum.id}`,
    ].join('\n');
    QRCode.toDataURL(text, {
      width: 200, margin: 2,
      color: { dark: '#e0d8ff', light: '#06040e' },
    }).then(setSrc);
  }, [museum]);

  return (
    <div style={S.qrOverlay} onClick={onClose}>
      <div style={S.qrModal} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.8, textTransform: 'uppercase', color: T.textMuted, marginBottom: 16 }}>
          Share Museum
        </div>
        {src
          ? <img src={src} alt="QR" style={{ width: 180, height: 180, borderRadius: 8, display: 'block', margin: '0 auto 14px' }} />
          : <div style={{ width: 180, height: 180, margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textDim, fontSize: 12 }}>Generating…</div>
        }
        <div style={{ fontSize: 11.5, color: T.textMuted, wordBreak: 'break-all', marginBottom: 16 }}>{museum.name}</div>
        <button
          onClick={onClose}
          style={{
            padding: '7px 20px', borderRadius: 7, cursor: 'pointer', transition: 'all 0.15s',
            background: 'rgba(100,50,200,0.18)', border: '1px solid rgba(120,65,220,0.4)',
            color: '#c0a8f0', fontSize: 12, fontWeight: 600,
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ── Museum row ────────────────────────────────────────────────────────────────

function MuseumRow({ museum, onOpen, onDelete, onQR }) {
  const [rh, setRh] = useState(false);
  const [eh, setEh] = useState(false);
  const [dh, setDh] = useState(false);
  const [qh, setQh] = useState(false);
  const visits = getVisits(museum.id);

  return (
    <div style={S.museumRow(rh)} onMouseEnter={() => setRh(true)} onMouseLeave={() => setRh(false)}>
      <div style={S.museumName}>{museum.name}</div>
      <div style={S.museumMeta}>
        <span>{fmtDate(museum.createdAt)}</span>
        {museum.roomCount != null && <>
          <span style={S.metaDot}>·</span>
          <span>{museum.roomCount}r</span>
        </>}
        {visits > 0 && <>
          <span style={S.metaDot}>·</span>
          <span>{visits} {visits === 1 ? 'visit' : 'visits'}</span>
        </>}
      </div>
      <button
        style={S.btnQR(qh)}
        onMouseEnter={() => setQh(true)} onMouseLeave={() => setQh(false)}
        onClick={() => onQR(museum)}
        title="Generate QR code"
      >QR</button>
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
  const [qrMuseum, setQrMuseum] = useState(null);

  // Create-form state
  const [text, setText]           = useState('');
  const [pdfFiles, setPdfFiles]   = useState([]);
  const [pdfNames, setPdfNames]   = useState([]);
  const [phase, setPhase]         = useState('idle');
  const [errorMsg, setErrorMsg]   = useState('');
  const [drag, setDrag]           = useState(false);
  const [progress, setProgress]   = useState({ percent: 0, message: '' });
  const [logs, setLogs]           = useState([]);
  const [taFocus, setTaFocus]     = useState(false);
  const [selectedSkin, setSelectedSkin]   = useState('classic');
  const [selectedScene, setSelectedScene] = useState('procedural');
  const [scenes, setScenes]               = useState([]);
  const [orcid, setOrcid]                 = useState('');
  const [orcidLoading, setOrcidLoading]   = useState(false);
  const [orcidError, setOrcidError]       = useState('');
  const fileRef   = useRef();
  const logEndRef = useRef();

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  // Load available scenes
  useEffect(() => {
    fetch('/scenes.json')
      .then(r => r.json())
      .then(setScenes)
      .catch(() => setScenes([]));
  }, []);

  // ORCID auto-fill
  async function fetchOrcid() {
    const id = orcid.trim();
    if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(id)) {
      setOrcidError('Invalid ORCID format (xxxx-xxxx-xxxx-xxxx)');
      return;
    }
    setOrcidLoading(true); setOrcidError('');
    try {
      const res = await fetch(`https://pub.orcid.org/v3.0/${id}/works`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      const lines = (data.group ?? []).map(g => {
        const w = g['work-summary']?.[0];
        const title = w?.title?.title?.value ?? 'Untitled';
        const year  = w?.['publication-date']?.year?.value ?? '';
        const type  = w?.type?.replace(/-/g, ' ') ?? '';
        return `${year ? year + ' · ' : ''}${title}${type ? ' [' + type + ']' : ''}`;
      });
      if (lines.length === 0) throw new Error('No publications found');
      addText(`ORCID publications (${id}):\n\n` + lines.join('\n'));
    } catch (e) {
      setOrcidError(e.message);
    }
    setOrcidLoading(false);
  }

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

  function handleOpen(museum) {
    onMuseumReady({ rooms: museum.rooms, name: museum.name, id: museum.id });
  }

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
      const sceneModel = scenes.find(s => s.id === selectedScene)?.model ?? null;
      const rooms = generateMuseumRooms(llmOutput, { skinId: selectedSkin, sceneModel });
      addLog(7, `Complete — ${rooms.length} room(s) generated`, 100);

      if (rooms.length === 0) {
        setErrorMsg(
          'No events were extracted from your text — 0 rooms generated.\n' +
          'Make sure the text contains dates, events, publications, or milestones. ' +
          'Check that the Ollama server is running and the model (llama3) is responding correctly.'
        );
        setPhase('error');
        return;
      }

      const entry = {
        id: Date.now().toString(),
        name: deriveName(trimmed),
        createdAt: new Date().toISOString(),
        roomCount: rooms.length,
        rooms,
      };
      setSaved(prev => { const next = [entry, ...prev]; writeSaved(next); return next; });
      setTimeout(() => onMuseumReady({ rooms, name: entry.name, id: entry.id }), 400);
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
                gallery.map(m => <MuseumRow key={m.id} museum={m} onOpen={handleOpen} onQR={setQrMuseum} />)
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
                  <MuseumRow key={m.id} museum={m} onOpen={handleOpen} onDelete={handleDelete} onQR={setQrMuseum} />
                ))
              )
            )}

          </div>
        </div>

        {import.meta.env.DEV && (
          <div style={{ padding: '0 40px', flexShrink: 0 }}><DevFooter /></div>
        )}
      </div>

      {qrMuseum && <QRModal museum={qrMuseum} onClose={() => setQrMuseum(null)} />}
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

          {/* ORCID auto-fill */}
          <div style={{ marginBottom: 16 }}>
            <div style={S.label}>ORCID iD <span style={{ color: C.dim, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional — auto-fills publications)</span></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                placeholder="0000-0000-0000-0000"
                value={orcid}
                onChange={e => { setOrcid(e.target.value); setOrcidError(''); }}
                onKeyDown={e => e.key === 'Enter' && fetchOrcid()}
                disabled={busy || orcidLoading}
                style={{
                  flex: 1, padding: '9px 12px',
                  background: 'rgba(0,0,0,0.4)', border: `1px solid ${T.border}`,
                  borderRadius: 8, color: T.text, fontSize: 13, outline: 'none',
                  fontFamily: 'monospace', letterSpacing: 1,
                }}
              />
              <button
                onClick={fetchOrcid}
                disabled={busy || orcidLoading || !orcid.trim()}
                style={{
                  padding: '9px 14px', borderRadius: 8,
                  background: orcid.trim() ? 'rgba(100,50,200,0.25)' : 'rgba(100,50,200,0.06)',
                  border: `1px solid ${orcid.trim() ? 'rgba(120,65,220,0.5)' : T.border}`,
                  color: orcid.trim() ? '#d4b8ff' : T.textDim,
                  fontSize: 12, fontWeight: 600, cursor: orcid.trim() ? 'pointer' : 'default',
                  whiteSpace: 'nowrap', transition: 'all 0.15s',
                }}
              >
                {orcidLoading ? 'Loading…' : 'Fetch'}
              </button>
            </div>
            {orcidError && <div style={{ fontSize: 11.5, color: '#b05060', marginTop: 5 }}>{orcidError}</div>}
          </div>

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

          {/* Skin */}
          <div style={{ marginTop: 18 }}>
            <div style={S.label}>Visual theme</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {SKINS.map(sk => (
                <button
                  key={sk.id}
                  onClick={() => setSelectedSkin(sk.id)}
                  style={{
                    padding: '5px 12px', borderRadius: 7,
                    background: selectedSkin === sk.id ? 'rgba(100,50,200,0.3)' : 'rgba(100,50,200,0.06)',
                    border: `1px solid ${selectedSkin === sk.id ? 'rgba(130,70,240,0.6)' : T.border}`,
                    color: selectedSkin === sk.id ? '#d4b8ff' : T.textMuted,
                    fontSize: 11.5, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: 7,
                  }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: sk.accentColor, flexShrink: 0, display: 'inline-block' }} />
                  {sk.label}
                </button>
              ))}
            </div>
          </div>

          {/* Scene */}
          {scenes.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={S.label}>Entrance scene</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {scenes.map(sc => (
                  <button
                    key={sc.id}
                    onClick={() => setSelectedScene(sc.id)}
                    style={{
                      padding: '5px 12px', borderRadius: 7,
                      background: selectedScene === sc.id ? 'rgba(100,50,200,0.3)' : 'rgba(100,50,200,0.06)',
                      border: `1px solid ${selectedScene === sc.id ? 'rgba(130,70,240,0.6)' : T.border}`,
                      color: selectedScene === sc.id ? '#d4b8ff' : T.textMuted,
                      fontSize: 11.5, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {sc.label}
                  </button>
                ))}
              </div>
              {scenes.find(s => s.id === selectedScene)?.description && (
                <div style={{ fontSize: 11, color: T.textDim, marginTop: 5 }}>
                  {scenes.find(s => s.id === selectedScene).description}
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 20 }}>
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
