import { useCallback, useEffect, useMemo, useState } from "react";
import { logoutAccount, onUnauthorized, startAttempt } from "./api.js";
import AuthPage from "./AuthPage.jsx";
import Builder from "./Builder.jsx";
import { SharedQuizPage } from "./components.jsx";
import Dashboard from "./Dashboard.jsx";
import Explore from "./Explore.jsx";
import { AdminConsole, History, MyQuizzes } from "./Manage.jsx";
import Player from "./Player.jsx";
import { SubjectDetail, SubjectsList } from "./Subjects.jsx";
import { AppContext, Icon, ToastProvider, initials, navigate, useRoute, useToast } from "./ui.jsx";

const SESSION_KEY = "oqs_session_v1";
const THEME_KEY = "oqs_theme_v1";

function loadSavedSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.token && parsed?.user ? parsed : null;
  } catch {
    return null;
  }
}

function Shell({ session, onSession, theme, onTheme }) {
  const route = useRoute();
  const toast = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchText, setSearchText] = useState(route.query.search || "");
  const [startingQuizId, setStartingQuizId] = useState("");

  useEffect(() => { setSidebarOpen(false); setUserMenuOpen(false); }, [route.path]);

  const startQuiz = useCallback(async (quiz) => {
    setStartingQuizId(quiz.id);
    try {
      const data = await startAttempt(quiz.id, session.token);
      navigate(`/attempt/${data.attempt.id}`);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setStartingQuizId("");
    }
  }, [session.token, toast]);

  async function handleLogout() {
    try { await logoutAccount(session.token); } catch { /* ignore */ }
    onSession(null);
  }

  function submitTopSearch(event) {
    event.preventDefault();
    const q = searchText.trim();
    navigate(q ? `/explore?search=${encodeURIComponent(q)}` : "/explore");
  }

  const ctx = useMemo(() => ({
    token: session.token,
    user: session.user,
    startQuiz,
    startingQuizId
  }), [session, startQuiz, startingQuizId]);

  const seg = route.segments;
  let content;
  if (seg[0] === "explore") content = <Explore />;
  else if (seg[0] === "subjects" && seg[1] && seg[2] === "unit") content = <SubjectDetail subjectKey={seg[1]} unitIndex={Number(seg[3] || 0)} />;
  else if (seg[0] === "subjects" && seg[1]) content = <SubjectDetail subjectKey={seg[1]} />;
  else if (seg[0] === "subjects") content = <SubjectsList />;
  else if (seg[0] === "create") content = <Builder />;
  else if (seg[0] === "edit" && seg[1]) content = <Builder editQuizId={seg[1]} />;
  else if (seg[0] === "my-quizzes") content = <MyQuizzes />;
  else if (seg[0] === "history") content = <History />;
  else if (seg[0] === "admin") content = <AdminConsole />;
  else if (seg[0] === "quiz" && seg[1]) content = <SharedQuizPage quizId={seg[1]} />;
  else if (seg[0] === "attempt" && seg[1]) content = <Player attemptId={seg[1]} />;
  else content = <Dashboard />;

  const active = seg[0] || "dashboard";

  return (
    <AppContext.Provider value={ctx}>
      <div className="shell">
        {sidebarOpen && <div className="scrim" onClick={() => setSidebarOpen(false)} />}
        <aside className={sidebarOpen ? "sidebar open" : "sidebar"}>
          <a className="brand" href="#/"><span className="brand-mark">Q</span> Online Quiz System</a>

          <div className="nav-group">
            <span className="nav-label">Learn</span>
            <button className={active === "dashboard" ? "nav-link active" : "nav-link"} onClick={() => navigate("/")}><Icon name="home" /> Dashboard</button>
            <button className={active === "subjects" ? "nav-link active" : "nav-link"} onClick={() => navigate("/subjects")}><Icon name="book" /> Subjects & Units</button>
            <button className={active === "explore" ? "nav-link active" : "nav-link"} onClick={() => navigate("/explore")}><Icon name="compass" /> Explore Catalog</button>
            <button className={active === "history" ? "nav-link active" : "nav-link"} onClick={() => navigate("/history")}><Icon name="history" /> Attempt History</button>
          </div>

          <div className="nav-group">
            <span className="nav-label">Authoring</span>
            <button className={active === "create" ? "nav-link active" : "nav-link"} onClick={() => navigate("/create")}><Icon name="plus" /> Create Quiz</button>
            <button className={active === "my-quizzes" || active === "edit" ? "nav-link active" : "nav-link"} onClick={() => navigate("/my-quizzes")}><Icon name="edit" /> My Quizzes</button>
          </div>

          {session.user.role === "admin" && (
            <div className="nav-group">
              <span className="nav-label">Teacher / Admin</span>
              <button className={active === "admin" ? "nav-link active" : "nav-link"} onClick={() => navigate("/admin")}><Icon name="shield" /> Teacher Console</button>
            </div>
          )}

          <div className="sidebar-foot">
            <strong><Icon name="sparkle" size={14} /> Powered by Chints AI</strong>
            <span>Draft MCQs & parse syllabi for any course unit with Chints.</span>
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <button type="button" className="icon-button menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Icon name="menu" /></button>
            <form className="top-search" onSubmit={submitTopSearch}>
              <Icon name="search" size={18} />
              <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search quizzes across all topics…" maxLength={100} />
            </form>
            <div className="top-actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate("/create")}><Icon name="plus" size={15} /> New quiz</button>
              <button type="button" className="icon-button" onClick={onTheme} aria-label="Toggle theme" title="Toggle light/dark theme">
                <Icon name={theme === "dark" ? "sun" : "moon"} />
              </button>
              <div className="user-menu">
                <button type="button" className="user-chip" onClick={() => setUserMenuOpen((v) => !v)}>
                  <span className="avatar">{initials(session.user.name)}</span>
                  <span>
                    <b>{session.user.name}</b>
                    <small>{session.user.role === "admin" ? "Teacher (Admin)" : "Student"}</small>
                  </span>
                  <Icon name="chevron" size={16} />
                </button>
                {userMenuOpen && (
                  <div className="popover">
                    <button type="button" onClick={() => navigate("/my-quizzes")}><Icon name="edit" size={16} /> My quizzes</button>
                    <button type="button" onClick={() => navigate("/history")}><Icon name="history" size={16} /> My attempts</button>
                    {session.user.role === "admin" && <button type="button" onClick={() => navigate("/admin")}><Icon name="shield" size={16} /> Admin console</button>}
                    <button type="button" onClick={handleLogout} style={{ color: "var(--danger)" }}><Icon name="logout" size={16} /> Sign out</button>
                  </div>
                )}
              </div>
            </div>
          </header>
          {content}
        </div>
      </div>
    </AppContext.Provider>
  );
}

export default function App() {
  const [session, setSessionState] = useState(loadSavedSession);
  const [theme, setTheme] = useState(() => window.localStorage.getItem(THEME_KEY) || "light");

  const setSession = useCallback((next) => {
    setSessionState(next);
    if (next) window.localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(SESSION_KEY);
  }, []);

  useEffect(() => {
    onUnauthorized(() => setSession(null));
  }, [setSession]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ToastProvider>
      {session ? <Shell session={session} onSession={setSession} theme={theme} onTheme={toggleTheme} /> : <AuthPage onSession={setSession} theme={theme} onTheme={toggleTheme} />}
    </ToastProvider>
  );
}
