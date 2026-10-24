import { useState } from "react";

export default function AuthPanel() {
  const [mode, setMode] = useState("login");
  const [session, setSession] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
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
      setSession({ token: data.token, user: data.user });
      setForm({ name: "", email: "", password: "" });
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
      setSession(null);
      setMessage("You have been logged out.");
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
      {mode === "login" ? "Sign in" : "Create account"}
    </button>
    <form className="auth-popover" onSubmit={submit}>
      <h2>{mode === "register" ? "Create your account" : "Welcome back"}</h2>
      <p>{mode === "register" ? "Join in and start exploring." : "Sign in to your Quizly account."}</p>
      {mode === "register" && <label>Full name<input name="name" value={form.name} onChange={update} minLength={2} maxLength={80} autoComplete="name" required /></label>}
      <label>Email address<input type="email" name="email" value={form.email} onChange={update} autoComplete="email" maxLength={254} required /></label>
      <label>Password<input type="password" name="password" value={form.password} onChange={update} minLength={8} maxLength={72} autoComplete={mode === "register" ? "new-password" : "current-password"} required /></label>
      {error && <p className="auth-feedback auth-error" role="alert">{error}</p>}
      {message && <p className="auth-feedback" role="status">{message}</p>}
      <button type="submit" className="auth-submit" disabled={busy}>{busy ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}</button>
      <button type="button" className="auth-switch" onClick={() => { setMode((current) => current === "login" ? "register" : "login"); setError(""); setMessage(""); }}>
        {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
      </button>
    </form>
  </div>;
}
