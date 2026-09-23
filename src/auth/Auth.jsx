import { useState } from "react";
import { authService } from "./authService";

const T = {
  accent: "#9060e0",
  border: "rgba(112,76,196,0.55)",
  borderFocus: "rgba(148,112,224,0.85)",
  text: "#e0e0e6",
  textMuted: "rgba(172,170,188,0.82)",
  textDim: "rgba(135,133,150,0.65)",
  errorBg: "rgba(90,15,30,0.6)",
  errorBorder: "rgba(180,55,75,0.6)",
};

function Field({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
  disabled,
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: "block",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 1.6,
          textTransform: "uppercase",
          color: "rgba(185,185,198,0.75)",
          marginBottom: 7,
        }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          padding: "10px 14px",
          boxSizing: "border-box",
          background: "rgba(0,0,0,0.38)",
          border: `1px solid ${focused ? T.borderFocus : error ? T.errorBorder : T.border}`,
          borderRadius: 9,
          color: T.text,
          fontSize: 13.5,
          outline: "none",
          fontFamily: "inherit",
          boxShadow: focused ? `0 0 0 3px rgba(144,96,224,0.18)` : "none",
          transition: "border-color 0.2s, box-shadow 0.2s",
        }}
      />
      {error && (
        <div style={{ fontSize: 11.5, color: "#c06878", marginTop: 5 }}>
          {error}
        </div>
      )}
    </div>
  );
}

function SubmitBtn({
  label,
  disabled,
  hover,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      style={{
        width: "100%",
        padding: "11px 0",
        borderRadius: 10,
        background: disabled
          ? "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.02) 100%)"
          : hover
            ? "linear-gradient(135deg, rgba(148,102,230,0.7) 0%, rgba(112,72,202,0.7) 100%)"
            : "linear-gradient(135deg, rgba(128,88,210,0.55) 0%, rgba(98,60,182,0.55) 100%)",
        border: disabled
          ? "1px solid rgba(255,255,255,0.05)"
          : "1px solid rgba(128,88,210,0.5)",
        color: disabled ? "rgba(120,120,128,0.4)" : "#cbbff5",
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: 0.4,
        cursor: disabled ? "default" : "pointer",
        outline: "none",
        transition: "background 0.15s, border-color 0.15s, box-shadow 0.15s",
        boxShadow: disabled
          ? "none"
          : hover
            ? "0 4px 24px rgba(120,60,240,0.35), 0 1px 0 rgba(255,255,255,0.12) inset"
            : "0 4px 20px rgba(100,40,220,0.2), 0 1px 0 rgba(255,255,255,0.1) inset",
      }}
    >
      {label}
    </button>
  );
}

function SwitchLink({ label, action, onClick }) {
  const [h, setH] = useState(false);
  return (
    <p
      style={{
        textAlign: "center",
        marginTop: 20,
        fontSize: 13,
        color: T.textMuted,
      }}
    >
      {label}{" "}
      <button
        onClick={onClick}
        type="button"
        onMouseEnter={() => setH(true)}
        onMouseLeave={() => setH(false)}
        onFocus={() => setH(true)}
        onBlur={() => setH(false)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          outline: "none",
          color: h ? "#cbbff5" : T.accent,
          fontWeight: 600,
          fontSize: 13,
          textDecoration: h ? "underline" : "none",
          padding: 0,
          transition: "color 0.15s",
          boxShadow: h ? "0 0 0 2px rgba(144,96,224,0.3)" : "none",
          borderRadius: 4,
        }}
      >
        {action}
      </button>
    </p>
  );
}

export function Auth({ onAuth, onClose }) {
  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [errors, setErrors] = useState({});
  const [apiErr, setApiErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [btnH, setBtnH] = useState(false);
  const [btnF, setBtnF] = useState(false);

  function switchMode(m) {
    setMode(m);
    setErrors({});
    setApiErr("");
    setName("");
    setEmail("");
    setPass("");
    setPass2("");
  }

  function validate() {
    const e = {};
    if (mode === "register") {
      const trimmedName = name.trim();
      if (!trimmedName) {
        e.name = "Name is required.";
      } else if (trimmedName.length < 3) {
        e.name = "Name must be at least 3 characters.";
      }
    }
    if (!/\S+@\S+\.\S+/.test(email)) e.email = "Enter a valid email.";
    if (pass.length < 6) e.pass = "At least 6 characters.";
    if (mode === "register" && pass !== pass2)
      e.pass2 = "Passwords do not match.";
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setApiErr("");
    setBusy(true);
    try {
      const user =
        mode === "login"
          ? await authService.login(email, pass)
          : await authService.register(name, email, pass);
      onAuth(user);
    } catch (err) {
      setApiErr(err.message);
    } finally {
      setBusy(false);
    }
  }

  const isLogin = mode === "login";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background: onClose ? "rgba(10,10,16,0.82)" : "#111213",
        backdropFilter: onClose ? "blur(6px)" : "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif',
        color: T.text,
      }}
      onClick={
        onClose
          ? (e) => {
              if (e.target === e.currentTarget) onClose();
            }
          : undefined
      }
    >
      <style>{`
        .auth-root button:focus-visible, .auth-root input:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(144,96,224,0.32) !important;
        }
      `}</style>

      <div
        className="auth-root"
        style={{
          width: "100%",
          maxWidth: 420,
          padding: "0 20px",
          boxSizing: "border-box",
          position: "relative",
        }}
      >
        {onClose && (
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: -8,
              right: 20,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: T.textDim,
              fontSize: 20,
              lineHeight: 1,
              padding: 4,
              borderRadius: 6,
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = T.text)}
            onMouseLeave={(e) => (e.currentTarget.style.color = T.textDim)}
          >
            ×
          </button>
        )}
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              margin: "0 auto 14px",
              background:
                "linear-gradient(135deg, rgba(128,88,210,0.35) 0%, rgba(90,55,175,0.2) 100%)",
              border: "1px solid rgba(130,88,215,0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              boxShadow: "0 0 20px rgba(100,60,220,0.2)",
            }}
          >
            ⬡
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 2.5,
              textTransform: "uppercase",
              color: "rgba(190,188,210,0.6)",
            }}
          >
            Research Museum
          </div>
        </div>

        {/* Card */}
        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(112,76,196,0.55)",
            borderRadius: 16,
            padding: "32px 36px 28px",
            boxShadow:
              "0 0 0 1px rgba(255,255,255,0.05) inset, 0 24px 60px rgba(0,0,0,0.55)",
          }}
        >
          <h2
            style={{
              margin: "0 0 6px",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "-0.3px",
              color: "#dcdce6",
            }}
          >
            {isLogin ? "Sign in" : "Create account"}
          </h2>
          <p style={{ margin: "0 0 24px", fontSize: 13, color: T.textMuted }}>
            {isLogin ? "Welcome back." : "Start building your museum."}
          </p>

          <form onSubmit={handleSubmit} noValidate>
            {!isLogin && (
              <Field
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                error={errors.name}
                disabled={busy}
              />
            )}
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              error={errors.email}
              disabled={busy}
            />
            <Field
              label="Password"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder={isLogin ? "Password" : "At least 6 characters"}
              error={errors.pass}
              disabled={busy}
            />
            {!isLogin && (
              <Field
                label="Confirm password"
                type="password"
                value={pass2}
                onChange={(e) => setPass2(e.target.value)}
                placeholder="Repeat password"
                error={errors.pass2}
                disabled={busy}
              />
            )}

            {apiErr && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  marginBottom: 16,
                  background: T.errorBg,
                  border: `1px solid ${T.errorBorder}`,
                  color: "#c06878",
                  fontSize: 13,
                }}
              >
                {apiErr}
              </div>
            )}

            <SubmitBtn
              label={
                busy
                  ? isLogin
                    ? "Signing in…"
                    : "Creating…"
                  : isLogin
                    ? "Sign in"
                    : "Create account"
              }
              disabled={busy}
              hover={btnH}
              onMouseEnter={() => setBtnH(true)}
              onMouseLeave={() => setBtnH(false)}
              onFocus={() => setBtnF(true)}
              onBlur={() => setBtnF(false)}
            />
          </form>

          <SwitchLink
            label={
              isLogin ? "Don't have an account?" : "Already have an account?"
            }
            action={isLogin ? "Sign up" : "Sign in"}
            onClick={() => switchMode(isLogin ? "register" : "login")}
          />
        </div>
      </div>
    </div>
  );
}
