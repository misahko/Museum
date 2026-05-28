import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { incrementVisits, getVisits, addEntry, getEntries } from './museumStore';

// ── Tokens ────────────────────────────────────────────────────────────────────

const C = {
  bg:       'rgba(6,4,14,0.88)',
  border:   'rgba(100,50,200,0.3)',
  borderHi: 'rgba(130,70,240,0.55)',
  accent:   '#7c3aed',
  text:     '#c8c8cc',
  muted:    'rgba(160,160,168,0.55)',
  dim:      'rgba(110,110,118,0.45)',
};

// ── Shared panel style ────────────────────────────────────────────────────────

const panel = (extra = {}) => ({
  position: 'absolute',
  background: C.bg,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  boxShadow: `0 1px 0 rgba(255,255,255,0.05) inset, 0 16px 48px rgba(0,0,0,0.7)`,
  fontFamily: '"Segoe UI", system-ui, sans-serif',
  color: C.text,
  overflow: 'hidden',
  ...extra,
});

const hBtn = (active, extra = {}) => ({
  padding: '5px 12px',
  background: active ? 'rgba(100,50,200,0.35)' : 'rgba(100,50,200,0.08)',
  border: `1px solid ${active ? C.borderHi : C.border}`,
  borderRadius: 7,
  color: active ? '#d4b8ff' : 'rgba(160,130,220,0.65)',
  fontSize: 11, fontWeight: 600, cursor: 'pointer', letterSpacing: 0.3,
  transition: 'all 0.15s', pointerEvents: 'auto',
  ...extra,
});

// ── Minimap ───────────────────────────────────────────────────────────────────

function MapPanel({ rooms, currentRoomId, onTeleport }) {
  return (
    <div style={panel({ top: 60, left: 16, width: 260, maxHeight: 'calc(100vh - 80px)', overflowY: 'auto' })}>
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.8, textTransform: 'uppercase', color: C.muted }}>
          Map · {rooms.length} rooms
        </span>
      </div>
      <div style={{ padding: '8px 10px' }}>
        {rooms.map((room, i) => {
          const active = room.id === currentRoomId;
          return (
            <button
              key={room.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '9px 10px', marginBottom: 4,
                background: active ? 'rgba(100,50,200,0.2)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${active ? C.borderHi : 'rgba(100,50,200,0.2)'}`,
                borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                pointerEvents: 'auto', transition: 'all 0.15s',
                boxShadow: active ? `0 0 0 1px ${C.accent}22` : 'none',
              }}
              onClick={() => onTeleport(room.id)}
            >
              <span style={{
                width: 22, height: 22, borderRadius: 5, flexShrink: 0,
                background: active ? C.accent : 'rgba(100,50,200,0.2)',
                border: `1px solid ${active ? C.accent : C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: active ? '#fff' : C.muted,
              }}>{i + 1}</span>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: active ? 600 : 400, color: active ? '#e0d8ff' : C.text }}>
                  {room.id.replace('gen-', 'Room ')}
                </div>
                {room.year && (
                  <div style={{ fontSize: 10.5, color: C.muted, marginTop: 1 }}>{room.year}</div>
                )}
              </div>
              {active && (
                <span style={{ marginLeft: 'auto', fontSize: 9, color: C.accent, fontWeight: 700, letterSpacing: 1 }}>
                  HERE
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Search ────────────────────────────────────────────────────────────────────

function SearchPanel({ rooms, onTeleport, onClose }) {
  const [q, setQ] = useState('');
  const inputRef = useRef();

  useEffect(() => { inputRef.current?.focus(); }, []);

  const allExhibits = rooms.flatMap(r =>
    (r.exhibits ?? []).map(e => ({ ...e, roomId: r.id, roomLabel: r.id.replace('gen-', 'Room ') }))
  );

  const results = q.trim().length < 2 ? [] : allExhibits.filter(e => {
    const needle = q.toLowerCase();
    return e.title?.toLowerCase().includes(needle) || e.body?.toLowerCase().includes(needle);
  }).slice(0, 10);

  return (
    <div style={panel({ top: 60, left: '50%', transform: 'translateX(-50%)', width: 540 })}>
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}` }}>
        <input
          ref={inputRef}
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && onClose()}
          placeholder="Search exhibits…"
          style={{
            width: '100%', background: 'none', border: 'none', outline: 'none',
            color: C.text, fontSize: 14, fontFamily: 'inherit',
          }}
        />
      </div>
      {q.trim().length >= 2 && (
        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {results.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: C.muted, fontSize: 13 }}>
              No results
            </div>
          ) : results.map((e, i) => (
            <button
              key={i}
              style={{
                display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left',
                background: 'none', border: 'none', borderBottom: `1px solid rgba(100,50,200,0.12)`,
                cursor: 'pointer', pointerEvents: 'auto', transition: 'background 0.1s',
              }}
              onClick={() => { onTeleport(e.roomId); onClose(); }}
              onMouseEnter={ev => ev.currentTarget.style.background = 'rgba(100,50,200,0.1)'}
              onMouseLeave={ev => ev.currentTarget.style.background = 'none'}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e0d8ff', marginBottom: 2 }}>
                {e.title ?? '(untitled)'}
              </div>
              {e.body && (
                <div style={{ fontSize: 11.5, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.body.slice(0, 80)}
                </div>
              )}
              <div style={{ fontSize: 10.5, color: C.dim, marginTop: 3 }}>{e.roomLabel}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── QR code ───────────────────────────────────────────────────────────────────

function QRPanel({ museumName, museumId }) {
  const [src, setSrc] = useState('');
  const url = `${window.location.origin}${window.location.pathname}?m=${museumId}`;

  useEffect(() => {
    QRCode.toDataURL(url, {
      width: 200, margin: 2,
      color: { dark: '#e0d8ff', light: '#06040e' },
    }).then(setSrc);
  }, [url]);

  return (
    <div style={panel({ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 240, textAlign: 'center' })}>
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.8, textTransform: 'uppercase', color: C.muted }}>
          Share Museum
        </span>
      </div>
      <div style={{ padding: '16px 18px 18px' }}>
        {src && <img src={src} alt="QR" style={{ width: 160, height: 160, borderRadius: 8, display: 'block', margin: '0 auto 10px' }} />}
        <div style={{ fontSize: 12, fontWeight: 500, color: C.text, marginBottom: 4 }}>{museumName}</div>
        <div style={{ fontSize: 9.5, color: C.dim, wordBreak: 'break-all', fontFamily: 'monospace' }}>{url}</div>
      </div>
    </div>
  );
}

// ── Guestbook ─────────────────────────────────────────────────────────────────

function GuestbookPanel({ museumId }) {
  const [entries, setEntries] = useState(() => getEntries(museumId));
  const [author, setAuthor]   = useState('');
  const [message, setMessage] = useState('');
  const [mFocus, setMFocus]   = useState(false);

  function submit() {
    if (!message.trim()) return;
    setEntries(addEntry(museumId, author, message));
    setMessage('');
  }

  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  return (
    <div style={panel({ top: 60, right: 16, width: 300, maxHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' })}>
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.8, textTransform: 'uppercase', color: C.muted }}>
          Guestbook · {entries.length}
        </span>
      </div>

      {/* Entries list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {entries.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: C.dim, fontSize: 12.5 }}>
            Be the first to leave a note.
          </div>
        ) : entries.map(e => (
          <div key={e.id} style={{
            padding: '10px 0', borderBottom: `1px solid rgba(100,50,200,0.12)`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: '#c8b8f0' }}>{e.author}</span>
              <span style={{ fontSize: 10.5, color: C.dim }}>{fmtDate(e.date)}</span>
            </div>
            <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5 }}>{e.message}</div>
          </div>
        ))}
      </div>

      {/* Form */}
      <div style={{ padding: '10px 12px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
        <input
          placeholder="Your name (optional)"
          value={author}
          onChange={e => setAuthor(e.target.value)}
          style={{
            width: '100%', background: 'rgba(0,0,0,0.35)', border: `1px solid ${C.border}`,
            borderRadius: 7, padding: '7px 10px', color: C.text, fontSize: 12,
            outline: 'none', marginBottom: 7, boxSizing: 'border-box', fontFamily: 'inherit',
            pointerEvents: 'auto',
          }}
        />
        <textarea
          placeholder="Leave a note…"
          value={message}
          onChange={e => setMessage(e.target.value)}
          onFocus={() => setMFocus(true)}
          onBlur={() => setMFocus(false)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), submit())}
          rows={2}
          style={{
            width: '100%', background: 'rgba(0,0,0,0.35)',
            border: `1px solid ${mFocus ? 'rgba(130,70,240,0.55)' : C.border}`,
            borderRadius: 7, padding: '7px 10px', color: C.text, fontSize: 12,
            outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
            marginBottom: 7, pointerEvents: 'auto',
          }}
        />
        <button
          onClick={submit}
          disabled={!message.trim()}
          style={{
            width: '100%', padding: '7px', borderRadius: 7,
            background: message.trim() ? 'rgba(100,50,200,0.35)' : 'rgba(100,50,200,0.08)',
            border: `1px solid ${message.trim() ? C.borderHi : C.border}`,
            color: message.trim() ? '#d4b8ff' : C.dim,
            fontSize: 12, fontWeight: 600, cursor: message.trim() ? 'pointer' : 'default',
            pointerEvents: 'auto', transition: 'all 0.15s',
          }}
        >
          Post · Enter
        </button>
      </div>
    </div>
  );
}

// ── HUD root ──────────────────────────────────────────────────────────────────

export function HUD({ rooms, currentRoomId, onTeleport, museumName, museumId, onExit }) {
  const [panel, setPanel] = useState(null); // 'map' | 'search' | 'qr' | 'book'
  const [visits]          = useState(() => incrementVisits(museumId));

  const toggle = (name) => setPanel(p => p === name ? null : name);

  // Release pointer lock so HUD panels can receive mouse clicks
  useEffect(() => {
    if (panel && document.pointerLockElement) {
      document.exitPointerLock();
    }
  }, [panel]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'm' || e.key === 'M') toggle('map');
      if (e.key === 'f' || e.key === 'F') toggle('search');
      if (e.key === 'q' || e.key === 'Q') toggle('qr');
      if (e.key === 'b' || e.key === 'B') toggle('book');
      if (e.key === 'Escape') setPanel(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>

      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 52, padding: '0 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 100%)',
        pointerEvents: 'none',
      }}>
        {/* Museum name + visitors */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(200,190,230,0.8)', letterSpacing: 0.3 }}>
            {museumName}
          </span>
          <span style={{
            fontSize: 10.5, color: 'rgba(160,130,220,0.55)', letterSpacing: 0.3,
            padding: '1px 7px', borderRadius: 10,
            background: 'rgba(100,50,200,0.12)', border: '1px solid rgba(100,50,200,0.25)',
          }}>
            {visits} {visits === 1 ? 'visit' : 'visits'}
          </span>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'auto' }}>
          {[
            { key: 'map',    label: 'Map',       hint: 'M' },
            { key: 'search', label: 'Search',    hint: 'F' },
            { key: 'qr',     label: 'QR',        hint: 'Q' },
            { key: 'book',   label: 'Guestbook', hint: 'B' },
          ].map(({ key, label, hint }) => (
            <button
              key={key}
              style={hBtn(panel === key)}
              onClick={() => toggle(key)}
            >
              {label}
              <span style={{ marginLeft: 4, fontSize: 9, opacity: 0.45, letterSpacing: 0.5 }}>{hint}</span>
            </button>
          ))}

          <div style={{ width: 1, height: 18, background: 'rgba(100,50,200,0.3)', margin: '0 2px' }} />

          <button style={hBtn(false, { background: 'rgba(140,20,40,0.18)', borderColor: 'rgba(160,40,65,0.35)', color: 'rgba(200,100,110,0.7)' })} onClick={onExit}>
            ← Exit
          </button>
        </div>
      </div>

      {/* Crosshair */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        color: 'rgba(255,255,255,0.6)', fontSize: 18, userSelect: 'none',
      }}>·</div>

      {/* Hints */}
      <div style={{
        position: 'absolute', bottom: 16, left: '50%',
        transform: 'translateX(-50%)',
        color: 'rgba(160,150,200,0.4)', fontSize: 11.5,
        userSelect: 'none', letterSpacing: 0.3, whiteSpace: 'nowrap',
      }}>
        WASD · move &nbsp;·&nbsp; mouse · look &nbsp;·&nbsp; ESC · release
      </div>

      {/* Panels */}
      {panel === 'map'    && <MapPanel    rooms={rooms} currentRoomId={currentRoomId} onTeleport={id => { onTeleport(id); }} />}
      {panel === 'search' && <SearchPanel rooms={rooms} onTeleport={onTeleport} onClose={() => setPanel(null)} />}
      {panel === 'qr'     && <QRPanel     museumName={museumName} museumId={museumId} />}
      {panel === 'book'   && <GuestbookPanel museumId={museumId} />}

    </div>
  );
}
