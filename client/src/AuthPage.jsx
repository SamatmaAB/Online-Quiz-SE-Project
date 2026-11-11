import { useState } from "react";
import { completePasswordReset, loginAccount, registerAccount, requestPasswordReset } from "./api.js";
import { Alert, Icon } from "./ui.jsx";

const initialResetToken = new URLSearchParams(window.location.search).get("resetToken") || "";
if (initialResetToken) window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);

const copy = {
  login: { title: "Welcome back", sub: "Sign in to pick up where you left off.", cta: "Sign in" },
  register: { title: "Create your account", sub: "Choose Student or Teacher and start right away.", cta: "Create account" },
  "request-reset": { title: "Reset your password", sub: "We'll email a one-time link if the account exists.", cta: "Send reset link" },
  "complete-reset": { title: "Choose a new password", sub: "Pick something you haven't used before.", cta: "Reset password" }
};

export default function AuthPage({ onSession, theme, onTheme }) {
  const [mode, setMode] = useState(initialResetToken ? "complete-reset" : "login");
  const [resetToken, setResetToken] = useState(initialResetToken);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "", role: "student" });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const switchMode = (next) => { setMode(next); setError(""); setMessage(""); };

  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      if (mode === "login" || mode === "register") {
        const data = mode === "register" ? await registerAccount(form) : await loginAccount(form);
        onSession({ token: data.token, user: data.user });
      } else if (mode === "request-reset") {
        const data = await requestPasswordReset(form.email);
        setMessage(data.message);
      } else {
        if (form.password !== form.confirmPassword) throw new Error("The passwords do not match");
        const data = await completePasswordReset(resetToken, form.password);
        setResetToken("");
        setForm({ name: "", email: "", password: "", confirmPassword: "", role: "student" });
        setMode("login");
        setMessage(data.message || "Password updated. You can sign in now.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const { title, sub, cta } = copy[mode];
  const needsPassword = mode !== "request-reset";

  return (
    <div className="auth">
      <section className="auth-art" aria-hidden="false">
        <a className="brand" href="#/"><span className="brand-mark">Q</span> Online Quiz System</a>
        <div>
          <h1>Learn it. Quiz it. <span>Own it.</span></h1>
          <p>Pick your subjects, work through every unit, and build your own timed quizzes — with Chints AI to draft the questions for you.</p>
        </div>
        <div className="feature-list">
          <div className="feature"><b>Subject library</b><span>SE, DBMS, ML, UI/UX, Kotlin — or add your own syllabus.</span></div>
          <div className="feature"><b>Chints AI + Share Links</b><span>Generated quizzes stay private in your account until you share a direct test link.</span></div>
          <div className="feature"><b>Student & Teacher roles</b><span>Teachers get full admin visibility across all published quizzes and student attempts.</span></div>
        </div>
      </section>

      <section className="auth-form-side">
        <div className="auth-card">
          <div className="row">
            <span className="eyebrow">{mode === "register" ? "Get started" : "Account"}</span>
            <span className="spacer" />
            <button type="button" className="icon-button" onClick={onTheme} aria-label="Toggle theme"><Icon name={theme === "dark" ? "sun" : "moon"} /></button>
          </div>
          <div>
            <h2>{title}</h2>
            <p className="muted" style={{ marginTop: 6 }}>{sub}</p>
          </div>
          <Alert kind="error">{error}</Alert>
          <Alert kind="ok">{message}</Alert>
          <form onSubmit={submit}>
            {mode === "register" && (
              <>
                <div className="field">
                  <span>I am creating an account as a</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setForm((c) => ({ ...c, role: "student" }))}
                      className={form.role === "student" ? "topic-option selected" : "topic-option"}
                      style={{ textAlign: "left", alignItems: "center" }}
                    >
                      <Icon name="user" size={20} />
                      <div>
                        <b>Student</b>
                        <small>Personal quizzes & take shared tests</small>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((c) => ({ ...c, role: "teacher" }))}
                      className={form.role === "teacher" ? "topic-option selected" : "topic-option"}
                      style={{ textAlign: "left", alignItems: "center" }}
                    >
                      <Icon name="shield" size={20} />
                      <div>
                        <b>Teacher</b>
                        <small>Admin access · view all quizzes & results</small>
                      </div>
                    </button>
                  </div>
                </div>
                <label className="field">Full name<input name="name" value={form.name} onChange={update} minLength={2} maxLength={80} autoComplete="name" required /></label>
              </>
            )}
            {mode !== "complete-reset" && <label className="field">Email address<input type="email" name="email" value={form.email} onChange={update} autoComplete="email" maxLength={254} required /></label>}
            {needsPassword && (
              <label className="field">{mode === "complete-reset" ? "New password" : "Password"}
                <span style={{ position: "relative", display: "block" }}>
                  <input type={showPassword ? "text" : "password"} name="password" value={form.password} onChange={update} minLength={8} maxLength={72}
                    autoComplete={mode === "login" ? "current-password" : "new-password"} required style={{ paddingRight: 44 }} />
                  <button type="button" className="icon-button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}
                    style={{ position: "absolute", right: 4, top: 4, width: 36, height: 36, border: 0 }}><Icon name={showPassword ? "eyeOff" : "eye"} size={18} /></button>
                </span>
                {mode === "register" && <small>8–72 characters.</small>}
              </label>
            )}
            {mode === "complete-reset" && <label className="field">Confirm new password<input type="password" name="confirmPassword" value={form.confirmPassword} onChange={update} minLength={8} maxLength={72} autoComplete="new-password" required /></label>}
            <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>
              {busy ? "Please wait…" : mode === "register" ? `Create ${form.role === "teacher" ? "Teacher" : "Student"} account` : cta}
            </button>
          </form>

          <div className="row" style={{ justifyContent: "space-between" }}>
            {mode === "login" && <button type="button" className="link-button" onClick={() => switchMode("request-reset")}>Forgot password?</button>}
            {(mode === "login" || mode === "register") && (
              <button type="button" className="link-button" onClick={() => switchMode(mode === "login" ? "register" : "login")}>
                {mode === "login" ? "New here? Create an account" : "Have an account? Sign in"}
              </button>
            )}
            {(mode === "request-reset" || mode === "complete-reset") && <button type="button" className="link-button" onClick={() => switchMode("login")}>← Back to sign in</button>}
          </div>
        </div>
      </section>
    </div>
  );
}
