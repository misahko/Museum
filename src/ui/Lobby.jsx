import { useState, useRef, useCallback, useEffect } from 'react';
import QRCode from 'qrcode';
import { Auth } from '../auth/Auth';
import { extractTextFromPDF } from '../services/pdfParser';
import { sortAndStructureHistory, fileToBase64 } from '../services/llmSorting';
import { generateMuseumRooms } from '../services/museumGenerator';
import { validateContent } from '../services/contentValidator';
import { getVisits } from '../services/museumStore';
import { SKINS } from '../services/skins';
import { museumService } from '../services/museumService';
import { ProfileModal } from './ProfileModal';

function deriveName(text) {
  const first = text.trim().split('\n')[0].trim();
  return first.length > 54 ? first.slice(0, 51) + '…' : first || 'Untitled Museum';
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  accent:      '#9060e0',
  accentDim:   'rgba(134,95,212,0.7)',
  accentGlow:  'rgba(114,78,200,0.2)',
  surface:     'rgba(26,26,30,0.98)',
  border:      'rgba(112,76,196,0.5)',
  borderHover: 'rgba(142,105,222,0.75)',
  borderFocus: 'rgba(142,105,224,0.85)',
  borderSection: 'rgba(255,255,255,0.07)',
  text:        '#e0e0e6',
  textMuted:   'rgba(172,170,188,0.82)',
  textDim:     'rgba(135,133,150,0.65)',
  errorBg:     'rgba(90,15,30,0.6)',
  errorBorder: 'rgba(180,55,75,0.6)',
  metal:       'rgba(255,255,255,0.06)',
  metalBright: 'rgba(255,255,255,0.11)',
};

const C = { dim: T.textDim }; // shorthand used in ORCID section

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  root: {
    position: 'fixed', inset: 0,
    background: '#111213',
    fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif',
    color: T.text,
  },

  // ── Full-screen card ────────────────────────────────────────────────────────

  card: {
    position: 'relative', width: '100%', maxWidth: '100%',
    height: '100vh',
    background: '#191a1c',
    overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
  },

  stripe: {
    height: 2, flexShrink: 0,
    background: `linear-gradient(90deg, transparent 0%, rgba(135,95,210,0.4) 20%, ${T.accent} 50%, rgba(135,95,210,0.4) 80%, transparent 100%)`,
  },

  // ── Top bar ─────────────────────────────────────────────────────────────────

  topBar: {
    flexShrink: 0,
    padding: '0 40px',
    height: 54,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    borderBottom: `1px solid rgba(112,76,196,0.5)`,
    background: 'rgba(255,255,255,0.03)',
    boxShadow: '0 1px 12px rgba(82,52,168,0.15)',
  },
  wordmark: { display: 'flex', alignItems: 'center', gap: 10 },
  logoMark: {
    width: 28, height: 28, borderRadius: 7,
    background: 'linear-gradient(135deg, rgba(114,78,200,0.3) 0%, rgba(78,68,140,0.2) 100%)',
    border: `1px solid rgba(130,88,215,0.55)`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, flexShrink: 0,
    boxShadow: `0 1px 0 rgba(255,255,255,0.1) inset, 0 0 14px ${T.accentGlow}`,
    color: 'rgba(182,145,242,0.9)',
  },
  appName: { fontSize: 11, fontWeight: 600, letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(190,188,210,0.65)' },

  // ── Tab bar ─────────────────────────────────────────────────────────────────

  tabBar: {
    display: 'flex', gap: 0,
    padding: '0 40px',
    borderBottom: `1px solid rgba(112,76,196,0.5)`,
    flexShrink: 0,
    background: 'rgba(0,0,0,0.25)',
    boxShadow: '0 1px 0 rgba(82,52,168,0.1)',
  },
  tab: (active, focused) => ({
    padding: '13px 0', width: 140, justifyContent: 'center',
    background: focused ? 'rgba(144,96,224,0.08)' : 'none',
    border: 'none', cursor: 'pointer', outline: 'none',
    fontSize: 12.5, fontWeight: 600, letterSpacing: 0.3,
    color: active || focused ? '#f0f0f8' : 'rgba(160,158,180,0.65)',
    borderBottom: `2px solid ${active ? T.accent : focused ? 'rgba(144,96,224,0.5)' : 'transparent'}`,
    marginBottom: -1,
    transition: 'color 0.15s, border-color 0.15s, background 0.15s',
    display: 'flex', alignItems: 'center', gap: 8,
    borderRadius: '6px 6px 0 0',
  }),
  tabCount: (active) => ({
    padding: '1px 7px', borderRadius: 10,
    background: active ? 'rgba(135,95,210,0.22)' : 'rgba(255,255,255,0.06)',
    border: `1px solid ${active ? 'rgba(135,95,210,0.5)' : 'rgba(255,255,255,0.1)'}`,
    fontSize: 10, fontWeight: 700,
    color: active ? 'rgba(182,145,242,0.95)' : 'rgba(140,138,158,0.6)',
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
    textTransform: 'uppercase', color: 'rgba(175,172,200,0.75)',
  },
  panelCount: {
    padding: '1px 8px', borderRadius: 10,
    background: 'rgba(108,72,188,0.2)', border: '1px solid rgba(128,92,210,0.55)',
    fontSize: 10, fontWeight: 600, color: 'rgba(178,140,240,0.9)',
  },

  panelScroll: { flex: 1, overflowY: 'auto', paddingRight: 4 },

  // ── Search bar ───────────────────────────────────────────────────────────────

  searchBar: {
    display: 'flex', gap: 8, marginBottom: 18, flexShrink: 0, alignItems: 'center',
  },
  searchInput: (f) => ({
    flex: 1, padding: '8px 14px',
    background: 'rgba(0,0,0,0.35)',
    border: `1px solid ${f ? T.borderFocus : T.border}`,
    borderRadius: 8, color: T.text, fontSize: 13,
    outline: 'none', fontFamily: 'inherit',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxShadow: f ? `0 0 0 3px rgba(135,95,210,0.15)` : 'none',
  }),

  // ── Museum tiles ─────────────────────────────────────────────────────────────

  tileGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
    gap: 12,
  },
  tile: (h) => ({
    display: 'flex', flexDirection: 'column',
    padding: '16px 16px 12px',
    borderRadius: 10, cursor: 'default',
    background: h
      ? 'linear-gradient(160deg, rgba(114,78,200,0.16) 0%, rgba(78,68,140,0.09) 100%)'
      : 'linear-gradient(160deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
    border: `1px solid ${h ? 'rgba(142,105,222,0.7)' : 'rgba(112,76,196,0.45)'}`,
    boxShadow: h
      ? '0 4px 20px rgba(82,52,168,0.22), 0 1px 0 rgba(255,255,255,0.08) inset'
      : '0 4px 20px rgba(0,0,0,0), 0 1px 0 rgba(255,255,255,0) inset',
    transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s',
    minHeight: 148,
  }),
  tileName: {
    fontSize: 13, fontWeight: 600, color: '#d8d8dc',
    lineHeight: 1.45, marginBottom: 8, flex: 1,
    display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
  },
  tileMeta: {
    fontSize: 10.5, color: T.textMuted, marginBottom: 10,
    display: 'flex', flexWrap: 'wrap', gap: '2px 8px',
  },
  tileActions: {
    display: 'flex', gap: 5,
  },
  tileBtnEnter: (h) => ({
    flex: 1, padding: '5px 0', borderRadius: 6,
    background: h
      ? 'linear-gradient(135deg, rgba(128,88,210,0.3) 0%, rgba(98,60,182,0.4) 100%)'
      : 'linear-gradient(135deg, rgba(105,68,192,0.08) 0%, rgba(90,55,168,0.06) 100%)',
    border: `1px solid ${h ? 'rgba(142,105,222,0.65)' : 'rgba(105,68,192,0.28)'}`,
    color: h ? '#bda8f8' : 'rgba(160,115,230,0.7)',
    fontSize: 11, fontWeight: 600, cursor: 'pointer', letterSpacing: 0.2,
    transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s, color 0.15s',
    outline: 'none',
    boxShadow: h ? '0 0 0 2px rgba(144,96,224,0.35), 0 1px 0 rgba(255,255,255,0.1) inset' : '0 0 0 0 transparent',
  }),
  tileBtnIcon: (h, danger) => ({
    width: 28, height: 28, borderRadius: 6, flexShrink: 0, padding: 0,
    background: danger
      ? (h ? 'rgba(140,20,40,0.35)' : 'transparent')
      : (h ? 'rgba(105,68,192,0.22)' : 'transparent'),
    border: `1px solid ${danger
      ? (h ? 'rgba(180,40,60,0.4)' : 'rgba(105,68,192,0.22)')
      : (h ? 'rgba(118,80,204,0.5)' : 'rgba(105,68,192,0.22)')}`,
    color: danger ? (h ? '#c06070' : T.textDim) : (h ? '#c0a8f0' : T.textDim),
    fontSize: 10, fontWeight: 700, cursor: 'pointer',
    transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s, color 0.15s',
    display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: 0.3,
    outline: 'none',
    boxShadow: h ? `0 0 0 2px ${danger ? 'rgba(200,60,80,0.35)' : 'rgba(144,96,224,0.35)'}` : '0 0 0 0 transparent',
  }),

  qrOverlay: {
    position: 'fixed', inset: 0, zIndex: 200,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  qrModal: {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.04) 100%)',
    border: '1px solid rgba(120,70,220,0.45)',
    borderRadius: 16, padding: '28px 32px', textAlign: 'center', maxWidth: 280,
    boxShadow: '0 24px 60px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.14) inset',
  },

  btnNew: (h) => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 18px', borderRadius: 8, flexShrink: 0, alignSelf: 'stretch',
    background: h
      ? `linear-gradient(135deg, rgba(110,74,200,0.45) 0%, rgba(98,60,182,0.45) 100%)`
      : `linear-gradient(135deg, rgba(105,68,192,0.08) 0%, rgba(90,55,168,0.06) 100%)`,
    border: `1px solid ${h ? 'rgba(130,88,215,0.84)' : 'rgba(98,60,182,0.44)'}`,
    color: h ? '#bda8f8' : 'rgba(160,115,230,1)',
    fontSize: 13, fontWeight: 600, cursor: 'pointer', letterSpacing: 0.3,
    transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s, color 0.15s',
    boxShadow: h ? '0 1px 0 rgba(255,255,255,0.1) inset' : '0 0 0 0 transparent',
    whiteSpace: 'nowrap',
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
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid rgba(112,76,196,0.55)`,
    borderRadius: 16,
    padding: '36px 44px 40px',
    boxShadow: `0 0 0 1px rgba(255,255,255,0.05) inset, 0 24px 60px rgba(0,0,0,0.6), 0 0 40px rgba(82,52,168,0.12)`,
  },

  backBtn: (h) => ({
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '4px 8px', margin: '-4px -8px 16px',
    background: 'none', border: 'none', cursor: 'pointer', outline: 'none',
    borderRadius: 6,
    color: h ? T.text : T.textMuted, fontSize: 12, letterSpacing: 0.2,
    transition: 'color 0.15s, box-shadow 0.15s',
    boxShadow: h ? '0 0 0 2px rgba(144,96,224,0.35)' : '0 0 0 0 transparent',
  }),
  createTitle: { fontSize: 21, fontWeight: 700, letterSpacing: '-0.3px', color: '#d8d8dc', margin: '0 0 6px' },
  createSub:   { fontSize: 13, lineHeight: 1.65, color: T.textMuted, maxWidth: 480 },
  rule: { border: 'none', borderTop: `1px solid rgba(112,76,196,0.45)`, margin: '20px 0' },

  label: {
    display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: 1.8,
    textTransform: 'uppercase', color: 'rgba(185,185,198,0.75)', marginBottom: 8,
  },
  textarea: (focus) => ({
    width: '100%', minHeight: 145, padding: '12px 14px',
    background: 'rgba(0,0,0,0.4)',
    border: `1px solid ${focus ? T.borderFocus : T.border}`,
    borderRadius: 10, color: '#e4e4ec', fontSize: 13.5, lineHeight: 1.65,
    resize: 'none', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxShadow: focus
      ? `0 0 0 3px rgba(135,95,210,0.18)`
      : 'none',
  }),
  dropZone: (drag) => ({
    width: '100%', padding: '14px',
    background: drag ? 'rgba(135,95,210,0.15)' : 'rgba(0,0,0,0.3)',
    border: `1px dashed ${drag ? 'rgba(152,136,208,0.7)' : 'rgba(112,76,196,0.5)'}`,
    borderRadius: 10, textAlign: 'center', cursor: 'pointer',
    transition: 'all 0.2s', color: drag ? 'rgba(188,162,225,0.85)' : T.textMuted, fontSize: 13,
  }),
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '3px 9px', borderRadius: 6,
    background: 'rgba(60,20,120,0.25)', border: '1px solid rgba(80,35,160,0.3)',
    fontSize: 11, color: 'rgba(140,88,205,0.7)',
  },

  btnPrimary: (disabled) => ({
    width: '100%', padding: '11px 0', borderRadius: 10,
    border: disabled ? '1px solid rgba(255,255,255,0.05)' : `1px solid rgba(128,88,210,0.45)`,
    background: disabled
      ? 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.02) 100%)'
      : 'linear-gradient(135deg, rgba(128,88,210,0.55) 0%, rgba(98,60,182,0.55) 100%)',
    color: disabled ? 'rgba(120,120,128,0.4)' : '#bda8f8',
    fontSize: 14, fontWeight: 600, letterSpacing: 0.4,
    cursor: disabled ? 'default' : 'pointer',
    transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s, color 0.2s',
    boxShadow: disabled
      ? '0 0 0 0 transparent'
      : `0 4px 20px rgba(100,40,220,0.2), 0 1px 0 rgba(255,255,255,0.1) inset`,
  }),

  progressSection: { marginTop: 18 },
  progressHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  progressLabel:   { fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: T.textMuted },
  progressPct:     { fontSize: 12, fontWeight: 700, color: T.accent, fontVariantNumeric: 'tabular-nums' },
  progressTrack:   { height: 2, background: 'rgba(255,255,255,0.14)', borderRadius: 2, overflow: 'hidden', marginBottom: 12 },
  progressFill: (pct) => ({
    height: '100%', width: `${pct}%`,
    background: `linear-gradient(90deg, ${T.accent} 0%, rgba(140,124,192,0.9) 100%)`,
    borderRadius: 2, transition: 'width 0.4s ease',
    animation: 'progress-glow 2s ease-in-out infinite',
  }),
  logBox: {
    background: 'rgba(0,0,0,0.28)', border: `1px solid rgba(120,70,220,0.3)`,
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
    marginTop: 18, paddingTop: 14, borderTop: `1px solid rgba(112,76,196,0.45)`,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontSize: 11, color: T.textDim, letterSpacing: 0.3,
  },
  footerCode: {
    padding: '1px 6px', borderRadius: 4,
    background: 'rgba(108,72,188,0.15)', border: '1px solid rgba(112,76,196,0.45)',
    fontFamily: 'monospace', fontSize: 10.5, color: 'rgba(160,115,230,0.7)',
  },
  footerDot: { color: 'rgba(120,120,130,0.4)' },
};

// ── QR Modal ──────────────────────────────────────────────────────────────────

function QRModal({ museum, onClose }) {
  const [src, setSrc] = useState('');
  const url = `${window.location.origin}${window.location.pathname}?m=${museum.id}`;

  useEffect(() => {
    QRCode.toDataURL(url, {
      width: 220, margin: 2,
      color: { dark: '#e0d8ff', light: '#06040e' },
    }).then(setSrc);
  }, [url]);

  return (
    <div style={S.qrOverlay} onClick={onClose}>
      <div style={S.qrModal} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.8, textTransform: 'uppercase', color: T.textMuted, marginBottom: 16 }}>
          Share Museum
        </div>
        {src
          ? <img src={src} alt="QR" style={{ width: 190, height: 190, borderRadius: 8, display: 'block', margin: '0 auto 12px' }} />
          : <div style={{ width: 190, height: 190, margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textDim, fontSize: 12 }}>Generating…</div>
        }
        <div style={{ fontSize: 12.5, fontWeight: 500, color: '#c8c8cc', marginBottom: 6 }}>{museum.name}</div>
        <div style={{ fontSize: 10.5, color: T.textDim, wordBreak: 'break-all', marginBottom: 16, fontFamily: 'monospace' }}>{url}</div>
        <button
          onClick={onClose}
          style={{
            padding: '7px 20px', borderRadius: 7, cursor: 'pointer', transition: 'all 0.15s',
            background: 'rgba(105,68,192,0.18)', border: '1px solid rgba(118,80,204,0.4)',
            color: '#c0a8f0', fontSize: 12, fontWeight: 600,
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ── Versions modal ────────────────────────────────────────────────────────────

function VersionsModal({ museum, userId, onRestore, onClose }) {
  const [versions, setVersions] = useState(museum.versions ?? []);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    const v = await museumService.saveVersion(userId, museum.id);
    setVersions(prev => [v, ...prev]);
    setBusy(false);
  }

  async function handleRestore(versionId) {
    setBusy(true);
    const updated = await museumService.restoreVersion(userId, museum.id, versionId);
    onRestore(updated);
    onClose();
  }

  async function handleDelete(versionId) {
    await museumService.deleteVersion(userId, museum.id, versionId);
    setVersions(prev => prev.filter(v => v.id !== versionId));
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: 420, background: '#1c1c24', border: '1px solid rgba(112,76,196,0.55)',
        borderRadius: 14, padding: '24px 28px', boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
        fontFamily: '"Segoe UI", system-ui, sans-serif',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#dcdce6' }}>Version history</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16 }}>{museum.name}</div>

        <button
          onClick={handleSave} disabled={busy}
          style={{
            width: '100%', padding: '8px 0', marginBottom: 16, borderRadius: 8,
            background: 'linear-gradient(135deg, rgba(128,88,210,0.35) 0%, rgba(98,60,182,0.35) 100%)',
            border: '1px solid rgba(130,88,215,0.55)', color: '#cbbff5',
            fontSize: 12, fontWeight: 600, cursor: busy ? 'default' : 'pointer',
          }}
        >{busy ? 'Saving…' : '+ Save current version'}</button>

        {versions.length === 0
          ? <div style={{ textAlign: 'center', color: T.textDim, fontSize: 12, padding: '20px 0' }}>No versions saved yet.</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
              {versions.map(v => (
                <div key={v.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(112,76,196,0.3)',
                  borderRadius: 8, padding: '8px 12px',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#d0d0d8' }}>{v.label}</div>
                    <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>{fmtDate(v.savedAt)}</div>
                  </div>
                  <button onClick={() => handleRestore(v.id)} disabled={busy}
                    style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      background: 'rgba(128,88,210,0.2)', border: '1px solid rgba(130,88,215,0.45)', color: '#cbbff5' }}>
                    Restore
                  </button>
                  <button onClick={() => handleDelete(v.id)} disabled={busy}
                    style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                      background: 'transparent', border: '1px solid rgba(180,40,60,0.3)', color: T.textDim }}>
                    ×
                  </button>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  );
}

// ── Museum tile ───────────────────────────────────────────────────────────────

function MuseumTile({ museum, userId, onOpen, onDelete, onQR, onRename, onPublish, onVersionRestore }) {
  const [h, setH]         = useState(false);
  const [eh, setEh]       = useState(false);
  const [qh, setQh]       = useState(false);
  const [dh, setDh]       = useState(false);
  const [ph, setPh]       = useState(false);
  const [hh, setHh]       = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameVal, setNameVal] = useState(museum.name);
  const [showVersions, setShowVersions] = useState(false);
  const visits = getVisits(museum.id);
  const inputRef = useRef();

  function startEdit() { setEditing(true); setTimeout(() => inputRef.current?.select(), 0); }
  function commitEdit() {
    setEditing(false);
    if (nameVal.trim() && nameVal.trim() !== museum.name) onRename(museum.id, nameVal.trim());
    else setNameVal(museum.name);
  }

  return (
    <div style={S.tile(h)} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>

      {/* Name — double-click to rename */}
      {editing ? (
        <input
          ref={inputRef}
          value={nameVal}
          onChange={e => setNameVal(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setEditing(false); setNameVal(museum.name); } }}
          style={{
            flex: 1, marginBottom: 8, padding: '2px 6px',
            background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(130,88,215,0.7)',
            borderRadius: 5, color: '#e0e0e6', fontSize: 13, fontWeight: 600,
            outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
          }}
        />
      ) : (
        <div
          style={{ ...S.tileName, cursor: onRename ? 'text' : 'default' }}
          onDoubleClick={onRename ? startEdit : undefined}
          title={onRename ? 'Double-click to rename' : undefined}
        >{museum.name}</div>
      )}

      {/* Meta */}
      <div style={S.tileMeta}>
        {museum.createdAt && <span>{fmtDate(museum.createdAt)}</span>}
        {museum.roomCount != null && <span>{museum.roomCount} rooms</span>}
        {visits > 0 && <span>{visits} {visits === 1 ? 'visit' : 'visits'}</span>}
        {onPublish && (
          <span style={{
            padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 600,
            background: museum.published ? 'rgba(40,160,100,0.18)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${museum.published ? 'rgba(40,180,110,0.45)' : 'rgba(255,255,255,0.1)'}`,
            color: museum.published ? '#6ed8a0' : T.textDim,
          }}>{museum.published ? 'Public' : 'Private'}</span>
        )}
      </div>

      {/* Actions row 1 — owner only */}
      {(onPublish || onVersionRestore) && (
        <div style={{ display: 'flex', gap: 5, marginBottom: 5 }}>
          {onPublish && (
            <button
              style={{ ...S.tileBtnIcon(ph, false), flex: 1, width: 'auto', fontSize: 10.5 }}
              onMouseEnter={() => setPh(true)} onMouseLeave={() => setPh(false)}
              onFocus={() => setPh(true)} onBlur={() => setPh(false)}
              onClick={() => onPublish(museum.id, !museum.published)}
              title={museum.published ? 'Make private' : 'Publish to gallery'}
            >{museum.published ? 'Unpublish' : 'Publish'}</button>
          )}
          {onVersionRestore && (
            <button
              style={S.tileBtnIcon(hh, false)}
              onMouseEnter={() => setHh(true)} onMouseLeave={() => setHh(false)}
              onFocus={() => setHh(true)} onBlur={() => setHh(false)}
              onClick={() => setShowVersions(true)} title="Version history"
            >⟳</button>
          )}
        </div>
      )}

      {/* Actions row 2 */}
      <div style={S.tileActions}>
        <button
          style={S.tileBtnIcon(qh, false)}
          onMouseEnter={() => setQh(true)} onMouseLeave={() => setQh(false)}
          onFocus={() => setQh(true)} onBlur={() => setQh(false)}
          onClick={() => onQR(museum)} title="QR code"
        >QR</button>
        <button
          style={S.tileBtnEnter(eh)}
          onMouseEnter={() => setEh(true)} onMouseLeave={() => setEh(false)}
          onFocus={() => setEh(true)} onBlur={() => setEh(false)}
          onClick={() => onOpen(museum)}
        >Enter →</button>
        {onDelete && (
          <button
            style={S.tileBtnIcon(dh, true)}
            onMouseEnter={() => setDh(true)} onMouseLeave={() => setDh(false)}
            onFocus={() => setDh(true)} onBlur={() => setDh(false)}
            onClick={() => onDelete(museum.id)} title="Delete"
          >×</button>
        )}
      </div>

      {showVersions && (
        <VersionsModal
          museum={museum} userId={userId}
          onRestore={m => onVersionRestore(m)}
          onClose={() => setShowVersions(false)}
        />
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
      onFocus={() => setH(true)} onBlur={() => setH(false)}
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

export function Lobby({ onMuseumReady, user, onAuth, onLogout }) {
  const [saved, setSaved]       = useState([]);
  const [gallery, setGallery]   = useState(null);
  const [view, setView]         = useState('home');
  const [tab, setTab]           = useState('gallery');
  const [qrMuseum, setQrMuseum] = useState(null);
  const [search, setSearch]     = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const [tabFocus, setTabFocus]       = useState(null);
  const [backActive, setBackActive]   = useState(false);
  const [showAuth, setShowAuth]       = useState(false);
  const [showProfile, setShowProfile] = useState(false);

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
  const [orcidFocus, setOrcidFocus]       = useState(false);
  const [fetchFocus, setFetchFocus]       = useState(false);
  const [fetchHover, setFetchHover]       = useState(false);
  const [generateFocus, setGenerateFocus] = useState(false);
  const [generateHover, setGenerateHover] = useState(false);
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

  // Load gallery (published museums)
  useEffect(() => {
    museumService.getGallery()
      .then(setGallery)
      .catch(() => setGallery([]));
  }, []);

  // Load user's museums when user changes
  useEffect(() => {
    if (!user) { setSaved([]); return; }
    museumService.getMyMuseums(user.id).then(setSaved);
  }, [user?.id]);

  // ── Museum handlers ────────────────────────────────────────────────────────

  async function handleDelete(id) {
    await museumService.remove(user.id, id);
    setSaved(prev => prev.filter(m => m.id !== id));
    setGallery(await museumService.getGallery());
  }

  async function handleRename(id, newName) {
    const updated = await museumService.rename(user.id, id, newName);
    setSaved(prev => prev.map(m => m.id === id ? updated : m));
    if (updated.published) setGallery(await museumService.getGallery());
  }

  async function handlePublish(id, published) {
    const updated = await museumService.setPublished(user.id, id, published);
    setSaved(prev => prev.map(m => m.id === id ? updated : m));
    setGallery(await museumService.getGallery());
  }

  async function handleVersionRestore(updatedMuseum) {
    setSaved(prev => prev.map(m => m.id === updatedMuseum.id ? updatedMuseum : m));
  }

  function handleOpen(museum, fromGallery = false) {
    onMuseumReady({ rooms: museum.rooms, name: museum.name, id: museum.id, fromGallery });
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

      const name = deriveName(trimmed);
      const entry = await museumService.create(user.id, { name, rooms, roomCount: rooms.length });
      setSaved(prev => [entry, ...prev]);
      setTimeout(() => onMuseumReady({ rooms: entry.rooms, name: entry.name, id: entry.id }), 400);
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

  const focusStyle = (
    <style>{`
      .lobby-root button:focus-visible, .lobby-root input:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px rgba(144,96,224,0.32) !important;
      }
    `}</style>
  );

  if (view === 'home') return (
    <div style={S.root} className="lobby-root">
      {focusStyle}
      <div style={{
        ...S.card,
        width: 'min(66.666vw, 960px)',
        height: 'calc(100vh - 32px)',
        margin: '32px auto 0',
        borderRadius: '12px 12px 0 0',
        borderLeft:  '1px solid rgba(112,76,196,0.5)',
        borderRight: '1px solid rgba(112,76,196,0.5)',
        borderTop:   '1px solid rgba(112,76,196,0.5)',
        boxShadow: '-12px 0 40px rgba(0,0,0,0.5), 12px 0 40px rgba(0,0,0,0.5), 0 0 0 0 transparent',
      }}>
        <div style={S.stripe} />

        {/* Top bar */}
        <div style={S.topBar}>
          <div style={S.wordmark}>
            <div style={S.logoMark}>⬡</div>
            <span style={S.appName}>Research Museum</span>
          </div>
          {user ? (
            <button
              onClick={() => setShowProfile(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '0', borderRadius: 8, cursor: 'pointer',
                background: 'none', border: 'none',
                color: 'rgba(190,188,210,0.65)', fontSize: 11, fontWeight: 600,
                letterSpacing: 2.5, textTransform: 'uppercase',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'rgba(220,218,240,0.9)'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(190,188,210,0.65)'}
            >
              <span>{user.name}</span>
              <div style={{
                width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                background: `hsl(${[...user.name].reduce((h,c) => c.charCodeAt(0) + ((h<<5)-h), 0) % 360}, 45%, 38%)`,
                border: '1px solid rgba(255,255,255,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.9)', letterSpacing: 0.5,
              }}>{user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)}</div>
            </button>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              style={{
                padding: '6px 16px', borderRadius: 7, cursor: 'pointer',
                background: 'linear-gradient(135deg, rgba(128,88,210,0.25) 0%, rgba(98,60,182,0.2) 100%)',
                border: `1px solid rgba(130,88,215,0.55)`,
                color: '#cbbff5', fontSize: 12, fontWeight: 600,
                transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(148,102,230,0.4) 0%, rgba(112,72,202,0.35) 100%)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(128,88,210,0.25) 0%, rgba(98,60,182,0.2) 100%)'; }}
            >Sign in</button>
          )}
        </div>

        {/* Tab bar */}
        <div style={S.tabBar}>
          <button
            style={S.tab(tab === 'gallery', tabFocus === 'gallery')}
            onClick={() => setTab('gallery')}
            onMouseEnter={() => setTabFocus('gallery')} onMouseLeave={() => setTabFocus(null)}
            onFocus={() => setTabFocus('gallery')} onBlur={() => setTabFocus(null)}
          >
            Gallery
            {gallery?.length > 0 && <span style={S.tabCount(tab === 'gallery')}>{gallery.length}</span>}
          </button>
          <button
            style={S.tab(tab === 'mine', tabFocus === 'mine')}
            onClick={() => setTab('mine')}
            onMouseEnter={() => setTabFocus('mine')} onMouseLeave={() => setTabFocus(null)}
            onFocus={() => setTabFocus('mine')} onBlur={() => setTabFocus(null)}
          >
            My Museums
            {user && saved.length > 0 && <span style={S.tabCount(tab === 'mine')}>{saved.length}</span>}
          </button>
        </div>

        {/* Panel content */}
        <div style={{ ...S.panel, maxWidth: '100%', padding: '24px 40px' }}>

          {/* Search bar + New button */}
          <div style={S.searchBar}>
            <input
              style={S.searchInput(searchFocus)}
              placeholder="Search museums…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setSearchFocus(true)}
              onBlur={() => setSearchFocus(false)}
            />
            {tab === 'mine' && user && <NewBtn onClick={() => setView('create')} />}
          </div>

          <div style={S.panelScroll}>
            {tab === 'gallery' && (() => {
              if (gallery === null) return <div style={S.loadingRow}>Loading…</div>;
              const filtered = gallery.filter(m => m.name?.toLowerCase().includes(search.toLowerCase()));
              if (gallery.length === 0) return <EmptyState text="No museums in the gallery." hint="Check back later." />;
              if (filtered.length === 0) return <EmptyState text="No results." hint={`No gallery museums match "${search}".`} />;
              return <div style={S.tileGrid}>{filtered.map(m => <MuseumTile key={m.id} museum={m} onOpen={m => handleOpen(m, true)} onQR={setQrMuseum} userId={null} />)}</div>;
            })()}

            {tab === 'mine' && (() => {
              if (!user) return (
                <div style={{ ...S.emptyState, paddingTop: 40 }}>
                  <div style={{ fontSize: 32, marginBottom: 16, opacity: 0.4 }}>🔒</div>
                  <p style={S.emptyText}>Sign in to create and manage your museums.</p>
                  <button
                    onClick={() => setShowAuth(true)}
                    style={{
                      marginTop: 14, padding: '8px 24px', borderRadius: 8, cursor: 'pointer',
                      background: 'linear-gradient(135deg, rgba(128,88,210,0.45) 0%, rgba(98,60,182,0.45) 100%)',
                      border: '1px solid rgba(130,88,215,0.65)',
                      color: '#cbbff5', fontSize: 13, fontWeight: 600,
                      transition: 'background 0.15s',
                    }}
                  >Sign in</button>
                </div>
              );
              const filtered = saved.filter(m => m.name?.toLowerCase().includes(search.toLowerCase()));
              if (saved.length === 0) return <EmptyState text="No personal museums yet." hint="Click «+ New» to generate your first museum." />;
              if (filtered.length === 0) return <EmptyState text="No results." hint={`No museums match "${search}".`} />;
              return <div style={S.tileGrid}>{filtered.map(m => <MuseumTile key={m.id} museum={m} userId={user.id} onOpen={handleOpen} onDelete={handleDelete} onQR={setQrMuseum} onRename={handleRename} onPublish={handlePublish} onVersionRestore={handleVersionRestore} />)}</div>;
            })()}
          </div>
        </div>

        {import.meta.env.DEV && (
          <div style={{ padding: '0 40px', flexShrink: 0 }}><DevFooter /></div>
        )}
      </div>

      {qrMuseum && <QRModal museum={qrMuseum} onClose={() => setQrMuseum(null)} />}
      {showAuth && (
        <Auth onAuth={u => { onAuth(u); setShowAuth(false); }} onClose={() => setShowAuth(false)} />
      )}
      {showProfile && user && (
        <ProfileModal
          user={user}
          onUserUpdate={u => { onAuth(u); }}
          onLogout={() => { onLogout(); setShowProfile(false); }}
          onClose={() => setShowProfile(false)}
        />
      )}
    </div>
  );

  // ── Create view ───────────────────────────────────────────────────────────

  return (
    <div style={S.root} className="lobby-root">
      {focusStyle}
      <div style={S.card}>
        <div style={S.stripe} />
        <div style={S.createBody}>
         <div style={S.createInner}>

          <button
            style={S.backBtn(backActive)}
            onClick={() => { setView('home'); setPhase('idle'); setErrorMsg(''); }}
            onMouseEnter={() => setBackActive(true)} onMouseLeave={() => setBackActive(false)}
            onFocus={() => setBackActive(true)} onBlur={() => setBackActive(false)}
          >
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
                onFocus={() => setOrcidFocus(true)}
                onBlur={() => setOrcidFocus(false)}
                style={{
                  flex: 1, padding: '9px 12px',
                  background: 'rgba(0,0,0,0.4)',
                  border: `1px solid ${orcidFocus ? T.borderFocus : T.border}`,
                  borderRadius: 8, color: T.text, fontSize: 13, outline: 'none',
                  fontFamily: 'monospace', letterSpacing: 1,
                  boxShadow: orcidFocus ? `0 0 0 3px rgba(144,96,224,0.18)` : 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
              />
              <button
                onClick={fetchOrcid}
                disabled={busy || orcidLoading || !orcid.trim()}
                onMouseEnter={() => setFetchHover(true)} onMouseLeave={() => setFetchHover(false)}
                onFocus={() => setFetchFocus(true)} onBlur={() => setFetchFocus(false)}
                style={{
                  padding: '9px 14px', borderRadius: 8,
                  background: orcid.trim()
                    ? fetchHover
                      ? 'linear-gradient(135deg, rgba(128,88,210,0.45) 0%, rgba(98,60,182,0.45) 100%)'
                      : 'linear-gradient(135deg, rgba(105,68,192,0.25) 0%, rgba(90,55,175,0.2) 100%)'
                    : 'linear-gradient(135deg, rgba(105,68,192,0.06) 0%, rgba(90,55,168,0.04) 100%)',
                  border: `1px solid ${fetchFocus ? T.borderFocus : fetchHover && orcid.trim() ? 'rgba(142,105,222,0.8)' : orcid.trim() ? 'rgba(118,80,204,0.5)' : T.border}`,
                  color: orcid.trim() ? (fetchHover ? '#d0beff' : '#bda8f8') : T.textDim,
                  fontSize: 12, fontWeight: 600, cursor: orcid.trim() ? 'pointer' : 'default',
                  whiteSpace: 'nowrap', outline: 'none',
                  transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s, color 0.15s',
                  boxShadow: fetchFocus ? `0 0 0 3px rgba(144,96,224,0.18)` : '0 0 0 0 transparent',
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
                    background: selectedSkin === sk.id ? 'rgba(105,68,192,0.3)' : 'rgba(105,68,192,0.06)',
                    border: `1px solid ${selectedSkin === sk.id ? 'rgba(130,70,240,0.6)' : T.border}`,
                    color: selectedSkin === sk.id ? '#bda8f8' : T.textMuted,
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
                      background: selectedScene === sc.id ? 'rgba(105,68,192,0.3)' : 'rgba(105,68,192,0.06)',
                      border: `1px solid ${selectedScene === sc.id ? 'rgba(130,70,240,0.6)' : T.border}`,
                      color: selectedScene === sc.id ? '#bda8f8' : T.textMuted,
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
              style={{
                ...S.btnPrimary(busy || !text.trim()),
                outline: 'none',
                background: busy || !text.trim()
                  ? 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.02) 100%)'
                  : generateHover
                    ? 'linear-gradient(135deg, rgba(148,102,230,0.7) 0%, rgba(112,72,202,0.7) 100%)'
                    : 'linear-gradient(135deg, rgba(128,88,210,0.55) 0%, rgba(98,60,182,0.55) 100%)',
                boxShadow: generateFocus && !(busy || !text.trim())
                  ? `0 0 0 3px rgba(144,96,224,0.22), 0 4px 20px rgba(100,40,220,0.25), 0 1px 0 rgba(255,255,255,0.12) inset`
                  : generateHover && !(busy || !text.trim())
                    ? `0 4px 24px rgba(120,60,240,0.35), 0 1px 0 rgba(255,255,255,0.14) inset`
                    : S.btnPrimary(busy || !text.trim()).boxShadow,
              }}
              onClick={handleGenerate}
              disabled={busy || !text.trim()}
              onMouseEnter={() => setGenerateHover(true)} onMouseLeave={() => setGenerateHover(false)}
              onFocus={() => setGenerateFocus(true)} onBlur={() => setGenerateFocus(false)}
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
