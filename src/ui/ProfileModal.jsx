import { useState, useEffect } from 'react';
import { authService } from '../auth/authService';
import { museumService } from '../services/museumService';
import { getVisits } from '../services/museumStore';

// ── Design tokens (mirror Lobby) ──────────────────────────────────────────────

const T = {
  accent:      '#9060e0',
  border:      'rgba(112,76,196,0.5)',
  borderFocus: 'rgba(148,112,224,0.85)',
  text:        '#e0e0e6',
  textMuted:   'rgba(172,170,188,0.82)',
  textDim:     'rgba(135,133,150,0.65)',
  errorBg:     'rgba(90,15,30,0.6)',
  errorBorder: 'rgba(180,55,75,0.6)',
  successBg:   'rgba(20,90,50,0.5)',
  successBorder: 'rgba(40,160,100,0.45)',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function avatarColor(name) {
  let hash = 0;
  for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 45%, 38%)`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: 1.8, textTransform: 'uppercase',
        color: T.textDim, marginBottom: 12, paddingBottom: 8,
        borderBottom: '1px solid rgba(112,76,196,0.25)',
      }}>{title}</div>
      {children}
    </div>
  );
}

function Field({ label, type = 'text', value, onChange, placeholder, error, success, disabled }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <label style={{
        display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: 1.4,
        textTransform: 'uppercase', color: 'rgba(172,170,188,0.7)', marginBottom: 6,
      }}>{label}</label>}
      <input
        type={type} value={value} onChange={onChange}
        placeholder={placeholder} disabled={disabled}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width: '100%', padding: '9px 12px', boxSizing: 'border-box',
          background: 'rgba(0,0,0,0.38)',
          border: `1px solid ${focused ? T.borderFocus : error ? T.errorBorder : success ? T.successBorder : T.border}`,
          borderRadius: 8, color: T.text, fontSize: 13, outline: 'none',
          fontFamily: 'inherit',
          boxShadow: focused ? '0 0 0 3px rgba(144,96,224,0.15)' : 'none',
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }}
      />
      {error   && <div style={{ fontSize: 11.5, color: '#c06878', marginTop: 4 }}>{error}</div>}
      {success && <div style={{ fontSize: 11.5, color: '#6ed8a0', marginTop: 4 }}>{success}</div>}
    </div>
  );
}

function Btn({ label, onClick, disabled, variant = 'primary', busy }) {
  const [h, setH] = useState(false);
  const isDanger  = variant === 'danger';
  const isGhost   = variant === 'ghost';
  return (
    <button
      onClick={onClick} disabled={disabled || busy}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        padding: '8px 18px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
        cursor: disabled || busy ? 'default' : 'pointer', outline: 'none',
        transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s',
        background: isDanger
          ? (h ? 'rgba(160,30,50,0.45)' : 'rgba(120,20,35,0.35)')
          : isGhost
            ? (h ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)')
            : disabled || busy
              ? 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.02) 100%)'
              : h
                ? 'linear-gradient(135deg, rgba(148,102,230,0.65) 0%, rgba(112,72,202,0.65) 100%)'
                : 'linear-gradient(135deg, rgba(128,88,210,0.5) 0%, rgba(98,60,182,0.5) 100%)',
        border: isDanger
          ? `1px solid ${h ? 'rgba(200,50,70,0.6)' : 'rgba(160,40,60,0.45)'}`
          : isGhost
            ? '1px solid rgba(255,255,255,0.1)'
            : disabled || busy
              ? '1px solid rgba(255,255,255,0.05)'
              : '1px solid rgba(130,88,215,0.55)',
        color: isDanger ? '#e08090' : isGhost ? T.textMuted : disabled || busy ? 'rgba(120,120,128,0.4)' : '#cbbff5',
        boxShadow: h && !disabled && !busy && !isDanger && !isGhost
          ? '0 4px 16px rgba(100,40,220,0.2)' : 'none',
      }}
    >{busy ? 'Saving…' : label}</button>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(112,76,196,0.3)',
      borderRadius: 10, padding: '14px 16px', flex: 1, minWidth: 0,
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#cbbff5', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 10.5, color: T.textDim, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ProfileModal({ user, onUserUpdate, onLogout, onClose }) {
  // Profile edit
  const [name, setName]       = useState(user.name);
  const [nameErr, setNameErr] = useState('');
  const [nameOk, setNameOk]   = useState('');
  const [nameBusy, setNameBusy] = useState(false);

  // Password change
  const [curPass, setCurPass]   = useState('');
  const [newPass, setNewPass]   = useState('');
  const [newPass2, setNewPass2] = useState('');
  const [passErr, setPassErr]   = useState('');
  const [passOk, setPassOk]     = useState('');
  const [passBusy, setPassBusy] = useState(false);

  // Delete account
  const [deletePass, setDeletePass]     = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteErr, setDeleteErr]       = useState('');
  const [deleteBusy, setDeleteBusy]     = useState(false);
  const [showDelete, setShowDelete]     = useState(false);

  // Stats
  const [stats, setStats] = useState(null);

  useEffect(() => {
    museumService.getMyMuseums(user.id).then(museums => {
      const totalVisits = museums.reduce((acc, m) => acc + getVisits(m.id), 0);
      const totalRooms  = museums.reduce((acc, m) => acc + (m.roomCount ?? 0), 0);
      setStats({
        total:     museums.length,
        published: museums.filter(m => m.published).length,
        rooms:     totalRooms,
        visits:    totalVisits,
        joined:    null, // will come from backend
      });
    });
  }, [user.id]);

  async function saveName() {
    if (!name.trim()) { setNameErr('Name cannot be empty.'); return; }
    if (name.trim() === user.name) { setNameErr(''); setNameOk(''); return; }
    setNameBusy(true); setNameErr(''); setNameOk('');
    try {
      const updated = await authService.updateName(user.id, name);
      onUserUpdate(updated);
      setNameOk('Name updated successfully.');
    } catch (e) { setNameErr(e.message); }
    setNameBusy(false);
  }

  async function savePassword() {
    if (!curPass) { setPassErr('Enter your current password.'); return; }
    if (newPass.length < 6) { setPassErr('New password must be at least 6 characters.'); return; }
    if (newPass !== newPass2) { setPassErr('Passwords do not match.'); return; }
    setPassBusy(true); setPassErr(''); setPassOk('');
    try {
      await authService.updatePassword(user.id, curPass, newPass);
      setPassOk('Password changed successfully.');
      setCurPass(''); setNewPass(''); setNewPass2('');
    } catch (e) { setPassErr(e.message); }
    setPassBusy(false);
  }

  async function deleteAccount() {
    if (deleteConfirm !== 'DELETE') { setDeleteErr('Type DELETE to confirm.'); return; }
    setDeleteBusy(true); setDeleteErr('');
    try {
      await authService.deleteAccount(user.id, deletePass);
      onLogout();
    } catch (e) { setDeleteErr(e.message); setDeleteBusy(false); }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(8,8,16,0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '"Segoe UI", system-ui, sans-serif', color: T.text,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <style>{`
        .profile-modal button:focus-visible, .profile-modal input:focus-visible {
          outline: none; box-shadow: 0 0 0 3px rgba(144,96,224,0.32) !important;
        }
      `}</style>

      <div className="profile-modal" style={{
        width: '100%', maxWidth: 520,
        maxHeight: 'calc(100vh - 48px)', overflowY: 'auto',
        margin: '0 16px',
        background: '#1a1a22', border: '1px solid rgba(112,76,196,0.5)',
        borderRadius: 16, padding: '28px 32px',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.05) inset, 0 32px 80px rgba(0,0,0,0.6)',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, flexShrink: 0,
              background: avatarColor(user.name),
              border: '1px solid rgba(255,255,255,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.9)',
              letterSpacing: 1,
            }}>{initials(user.name)}</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#dcdce6', letterSpacing: 2.5, textTransform: 'uppercase' }}>{user.name}</div>
              <div style={{ fontSize: 12.5, color: T.textMuted, marginTop: 2 }}>{user.email}</div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: T.textDim, fontSize: 20, lineHeight: 1, padding: 4, borderRadius: 6,
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = T.text}
          onMouseLeave={e => e.currentTarget.style.color = T.textDim}
          >×</button>
        </div>

        {/* Stats */}
        <Section title="Statistics">
          {stats ? (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <StatCard label="Museums"   value={stats.total}     />
              <StatCard label="Published" value={stats.published} />
              <StatCard label="Rooms"     value={stats.rooms}     sub="across all museums" />
              <StatCard label="Visits"    value={stats.visits}    sub="on your public museums" />
            </div>
          ) : (
            <div style={{ fontSize: 12, color: T.textDim, padding: '8px 0' }}>Loading…</div>
          )}
        </Section>

        {/* Edit name */}
        <Section title="Display name">
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <Field
                value={name} onChange={e => { setName(e.target.value); setNameErr(''); setNameOk(''); }}
                placeholder="Your name" error={nameErr} success={nameOk}
                disabled={nameBusy}
              />
            </div>
            <Btn label="Save" onClick={saveName} busy={nameBusy} disabled={!name.trim()} />
          </div>
        </Section>

        {/* Change password */}
        <Section title="Change password">
          <Field label="Current password" type="password" value={curPass}
            onChange={e => { setCurPass(e.target.value); setPassErr(''); setPassOk(''); }}
            placeholder="Current password" disabled={passBusy} />
          <Field label="New password" type="password" value={newPass}
            onChange={e => { setNewPass(e.target.value); setPassErr(''); setPassOk(''); }}
            placeholder="At least 6 characters" disabled={passBusy} />
          <Field label="Confirm new password" type="password" value={newPass2}
            onChange={e => { setNewPass2(e.target.value); setPassErr(''); setPassOk(''); }}
            placeholder="Repeat new password"
            error={passErr} success={passOk} disabled={passBusy} />
          <Btn label="Change password" onClick={savePassword} busy={passBusy}
            disabled={!curPass || !newPass || !newPass2} />
        </Section>

        {/* Sign out */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 0', marginBottom: 8,
          borderTop: '1px solid rgba(112,76,196,0.25)',
        }}>
          <div style={{ fontSize: 13, color: T.textMuted }}>Signed in as <strong style={{ color: T.text }}>{user.email}</strong></div>
          <Btn label="Sign out" variant="ghost" onClick={onLogout} />
        </div>

        {/* Danger zone */}
        <Section title="Danger zone">
          {!showDelete ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, color: T.textMuted }}>Permanently delete your account and all museums.</div>
              <Btn label="Delete account" variant="danger" onClick={() => setShowDelete(true)} />
            </div>
          ) : (
            <div style={{
              background: T.errorBg, border: `1px solid ${T.errorBorder}`,
              borderRadius: 10, padding: '16px',
            }}>
              <div style={{ fontSize: 13, color: '#e09090', marginBottom: 12, fontWeight: 600 }}>
                This will delete all your museums and versions. This cannot be undone.
              </div>
              <Field label="Your password" type="password" value={deletePass}
                onChange={e => { setDeletePass(e.target.value); setDeleteErr(''); }}
                placeholder="Confirm your password" disabled={deleteBusy} />
              <Field label='Type "DELETE" to confirm' value={deleteConfirm}
                onChange={e => { setDeleteConfirm(e.target.value); setDeleteErr(''); }}
                placeholder="DELETE" error={deleteErr} disabled={deleteBusy} />
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <Btn label="Cancel" variant="ghost" onClick={() => { setShowDelete(false); setDeletePass(''); setDeleteConfirm(''); setDeleteErr(''); }} />
                <Btn label="Delete my account" variant="danger" busy={deleteBusy}
                  disabled={deleteConfirm !== 'DELETE' || !deletePass}
                  onClick={deleteAccount} />
              </div>
            </div>
          )}
        </Section>

      </div>
    </div>
  );
}
