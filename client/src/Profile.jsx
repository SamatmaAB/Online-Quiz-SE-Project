import { useEffect, useState } from "react";
import { changePassword, fetchMyAttempts, fetchMyQuizzes, fetchProfile, fetchSubjects, updateProfile } from "./api.js";
import { BackLink, PageHead, scoreKind } from "./components.jsx";
import { Alert, Badge, Icon, Loading, formatDate, formatDay, hueFor, initials, navigate, subjectBadge, useApp, useAsync, useToast } from "./ui.jsx";

export default function Profile() {
  const { token, user, updateSession } = useApp();
  const toast = useToast();

  const { data, loading, error } = useAsync(async (signal) => {
    const [profileRes, subjectsRes, attemptsRes, quizzesRes] = await Promise.all([
      fetchProfile(token, signal).catch(() => ({ user })),
      fetchSubjects(token, signal).catch(() => ({ subjects: [] })),
      fetchMyAttempts(token, signal).catch(() => ({ attempts: [] })),
      fetchMyQuizzes(token, { all: false }, signal).catch(() => ({ quizzes: [] }))
    ]);
    return {
      profile: profileRes.user || user,
      subjects: subjectsRes.subjects || [],
      attempts: attemptsRes.attempts || [],
      myQuizzes: quizzesRes.quizzes || []
    };
  }, [token]);

  const [name, setName] = useState(user.name || "");
  const [email, setEmail] = useState(user.email || "");
  const [role, setRole] = useState(user.role === "admin" ? "teacher" : "student");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileErr, setProfileErr] = useState("");

  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdErr, setPwdErr] = useState("");

  useEffect(() => {
    if (data?.profile) {
      setName(data.profile.name || "");
      setEmail(data.profile.email || "");
      setRole(data.profile.role === "admin" ? "teacher" : "student");
    }
  }, [data?.profile]);

  async function handleSaveProfile(event) {
    event.preventDefault();
    setProfileErr("");
    setSavingProfile(true);
    try {
      const res = await updateProfile({ name: name.trim(), email: email.trim(), role }, token);
      updateSession?.({ token: res.token, user: res.user });
      toast("Profile updated!");
    } catch (err) {
      setProfileErr(err.message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(event) {
    event.preventDefault();
    setPwdErr("");
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPwdErr("New passwords do not match.");
      return;
    }
    setSavingPwd(true);
    try {
      const res = await changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword
      }, token);
      updateSession?.({ token: res.token, user: res.user });
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast(res.message || "Password updated!");
    } catch (err) {
      setPwdErr(err.message);
    } finally {
      setSavingPwd(false);
    }
  }

  if (loading) return <div className="page"><Loading label="Loading your profile…" /></div>;
  if (error) return <div className="page"><Alert kind="error">{error}</Alert></div>;

  const profile = data?.profile || user;
  const subjects = data?.subjects || [];
  const attempts = data?.attempts || [];
  const myQuizzes = data?.myQuizzes || [];

  const enrolled = subjects.filter((s) => s.status === "enrolled");
  const finished = attempts.filter((a) => a.status !== "in-progress");
  const average = finished.length ? Math.round(finished.reduce((s, a) => s + a.percentage, 0) / finished.length) : 0;
  const best = finished.reduce((m, a) => Math.max(m, Math.round(a.percentage)), 0);

  return (
    <div className="page">
      <BackLink to="/">Dashboard</BackLink>
      <PageHead eyebrow="Account" title="My Profile" subtitle="View your academic progress, manage your account details and role, or update your password.">
        <button className="btn" onClick={() => navigate("/settings")}><Icon name="palette" size={16} /> Theme &amp; appearance</button>
        <button className="btn btn-primary" onClick={() => navigate("/create")}><Icon name="plus" size={16} /> Create a quiz</button>
      </PageHead>

      <section className="card card-pad profile-hero">
        <div className="profile-avatar">{initials(profile.name)}</div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="row" style={{ gap: 8, marginBottom: 4 }}>
            <Badge kind={profile.role === "admin" ? "ok" : "enrolled"}>
              {profile.role === "admin" ? "Teacher (Admin)" : "Student"}
            </Badge>
            {profile.createdAt && <span className="text-muted" style={{ fontSize: 13 }}>Joined {formatDay(profile.createdAt)}</span>}
          </div>
          <h2 style={{ fontSize: 26 }}>{profile.name}</h2>
          <p className="text-muted" style={{ marginTop: 2 }}>{profile.email}</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-sm" onClick={() => navigate("/my-quizzes")}><Icon name="edit" size={14} /> My quizzes ({myQuizzes.length})</button>
          <button className="btn btn-sm" onClick={() => navigate("/history")}><Icon name="history" size={14} /> Attempt history ({attempts.length})</button>
          {profile.role === "admin" && (
            <button className="btn btn-sm btn-primary" onClick={() => navigate("/admin")}><Icon name="shield" size={14} /> Teacher console</button>
          )}
        </div>
      </section>

      <section className="stats">
        <div className="card stat"><span className="stat-icon"><Icon name="check" /></span><div><b>{finished.length}</b><span>Quizzes completed</span></div></div>
        <div className="card stat"><span className="stat-icon"><Icon name="target" /></span><div><b>{average}%</b><span>Average score</span></div></div>
        <div className="card stat"><span className="stat-icon"><Icon name="award" /></span><div><b>{best}%</b><span>Best score</span></div></div>
        <div className="card stat"><span className="stat-icon"><Icon name="edit" /></span><div><b>{myQuizzes.length}</b><span>Quizzes authored</span></div></div>
        <div className="card stat"><span className="stat-icon"><Icon name="book" /></span><div><b>{enrolled.length}</b><span>Enrolled subjects</span></div></div>
      </section>

      <section className="split even">
        <form className="card card-pad" onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>
            <h3><Icon name="user" size={18} /> Edit profile details</h3>
          </div>
          <Alert kind="error" onClose={() => setProfileErr("")}>{profileErr}</Alert>
          <label className="field">
            Full name *
            <input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={80} required />
          </label>
          <label className="field">
            Email address *
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} required />
          </label>
          <div className="field">
            <span>Account role</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button
                type="button"
                onClick={() => setRole("student")}
                className={role === "student" ? "topic-option selected" : "topic-option"}
                style={{ textAlign: "left", alignItems: "center" }}
              >
                <Icon name="user" size={18} />
                <div>
                  <b>Student</b>
                  <small>Personal quizzes &amp; study units</small>
// Stage 2
