import { useState } from "react";
import { completePasswordReset, requestPasswordReset } from "./api.js";

const initialResetToken = new URLSearchParams(window.location.search).get("resetToken") || "";
if (initialResetToken) window.history.replaceState({}, document.title, window.location.pathname);

export default function AuthPanel({ session, onSessionChange }) {
  const [mode, setMode] = useState(initialResetToken ? "complete-reset" : "login");
  const [resetToken, setResetToken] = useState(initialResetToken);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/auth/${mode === "register" ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(form)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to authenticate");
      const nextSession = { token: data.token, user: data.user };
      onSessionChange(nextSession);
      setForm({ name: "", email: "", password: "", confirmPassword: "" });
      setMessage(mode === "register" ? "Account created successfully." : "Welcome back!");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}`, Accept: "application/json" }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to log out");
      onSessionChange(null);
      setMessage("You have been logged out.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitPasswordReset(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "request-reset") {
        const data = await requestPasswordReset(form.email);
        setMessage(data.message);
      } else {
        if (form.password !== form.confirmPassword) throw new Error("The passwords do not match");
        const data = await completePasswordReset(resetToken, form.password);
        setMessage(data.message);
        window.history.replaceState({}, document.title, window.location.pathname);
        setResetToken("");
        setForm({ name: "", email: "", password: "", confirmPassword: "" });
        setMode("login");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (session) {
    return <div className="auth-session">
      <span className="user-greeting">Hi, {session.user.name.split(" ")[0]}</span>
      <button type="button" className="auth-trigger" onClick={logout} disabled={busy}>{busy ? "Signing out…" : "Log out"}</button>
      {error && <span className="auth-feedback auth-error" role="alert">{error}</span>}
    </div>;
  }

  return <div className="auth-wrap">
    <button type="button" className="auth-trigger" onClick={() => { setMode((current) => current === "login" ? "register" : "login"); setError(""); setMessage(""); }}>
      {mode === "login" ? "Sign in" : mode === "register" ? "Create account" : "Password help"}
    </button>
    <form className="auth-popover" onSubmit={mode === "request-reset" || mode === "complete-reset" ? submitPasswordReset : submit}>
      <h2>{mode === "register" ? "Create your account" : mode === "request-reset" ? "Reset your password" : mode === "complete-reset" ? "Choose a new password" : "Welcome back"}</h2>
      <p>{mode === "register" ? "Join in and start exploring." : mode === "request-reset" ? "We’ll email you a one-time reset link if the account exists." : mode === "complete-reset" ? "Choose a new password for your Quizly account." : "Sign in to your Quizly account."}</p>
      {mode === "register" && <label>Full name<input name="name" value={form.name} onChange={update} minLength={2} maxLength={80} autoComplete="name" required /></label>}
      {(mode === "login" || mode === "register" || mode === "request-reset") && <label>Email address<input type="email" name="email" value={form.email} onChange={update} autoComplete="email" maxLength={254} required /></label>}
      {(mode === "login" || mode === "register" || mode === "complete-reset") && <label>{mode === "complete-reset" ? "New password" : "Password"}<input type="password" name="password" value={form.password} onChange={update} minLength={8} maxLength={72} autoComplete={mode === "login" ? "current-password" : "new-password"} required /></label>}
      {mode === "complete-reset" && <label>Confirm new password<input type="password" name="confirmPassword" value={form.confirmPassword} onChange={update} minLength={8} maxLength={72} autoComplete="new-password" required /></label>}
      {error && <p className="auth-feedback auth-error" role="alert">{error}</p>}
      {message && <p className="auth-feedback" role="status">{message}</p>}
      <button type="submit" className="auth-submit" disabled={busy}>{busy ? "Please wait…" : mode === "register" ? "Create account" : mode === "request-reset" ? "Send reset link" : mode === "complete-reset" ? "Reset password" : "Sign in"}</button>
      {mode === "login" && <button type="button" className="auth-switch" onClick={() => { setMode("request-reset"); setError(""); setMessage(""); }}>Forgot password?</button>}
      {(mode === "login" || mode === "register") && <button type="button" className="auth-switch" onClick={() => { setMode((current) => current === "login" ? "register" : "login"); setError(""); setMessage(""); }}>
        {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
      </button>}
      {(mode === "request-reset" || mode === "complete-reset") && <button type="button" className="auth-switch" onClick={() => { setMode("login"); setError(""); setMessage(""); if (mode === "complete-reset") { window.history.replaceState({}, document.title, window.location.pathname); setResetToken(""); } }}>Back to sign in</button>}
    </form>
  </div>;
}
