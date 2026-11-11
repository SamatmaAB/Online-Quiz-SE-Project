import { useCallback, useEffect, useMemo, useState } from "react";
import { logoutAccount, onUnauthorized, startAttempt } from "./api.js";
import About from "./About.jsx";
import AuthPage from "./AuthPage.jsx";
import Builder from "./Builder.jsx";
import { CAT_BREEDS, CAT_BREED_KEY } from "./ChintsCat.jsx";
import ChintsChat, { TUCKED_KEY } from "./ChintsChat.jsx";
import { SharedQuizPage } from "./components.jsx";
import Dashboard from "./Dashboard.jsx";
import Explore from "./Explore.jsx";
import { AdminConsole, History, MyQuizzes } from "./Manage.jsx";
import Player from "./Player.jsx";
import Profile from "./Profile.jsx";
import Settings from "./Settings.jsx";
import { SubjectDetail, SubjectsList } from "./Subjects.jsx";
import { AppContext, Icon, ToastProvider, initials, navigate, useRoute, useToast } from "./ui.jsx";

const SESSION_KEY = "oqs_session_v1";
const THEME_KEY = "oqs_theme_v1";
const ACCENT_KEY = "oqs_accent_v1";
const SIDEBAR_KEY = "oqs_sidebar_collapsed_v1";

const ACCENTS = {
  indigo: { label: "Indigo", light: ["#5b5bf0", "#8b5cf6"], dark: ["#7c7cff", "#a78bfa"] },
  ocean: { label: "Ocean", light: ["#0284c7", "#06b6d4"], dark: ["#38bdf8", "#22d3ee"] },
  emerald: { label: "Emerald", light: ["#059669", "#10b981"], dark: ["#34d399", "#2dd4bf"] },
  rose: { label: "Rose", light: ["#e11d48", "#f43f5e"], dark: ["#fb7185", "#f472b6"] },
  amber: { label: "Amber", light: ["#d97706", "#f59e0b"], dark: ["#fbbf24", "#fb923c"] }
};

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

function systemPrefersDark() {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function Shell({ session, onSession, theme, onTheme, themeCtx }) {
  const route = useRoute();
  const toast = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.localStorage.getItem(SIDEBAR_KEY) === "1");
  const [chintsTucked, setChintsTucked] = useState(() => window.localStorage.getItem(TUCKED_KEY) === "1");
  const [openGroups, setOpenGroups] = useState({ learn: true, authoring: true, admin: true, account: true });
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchText, setSearchText] = useState(route.query.search || "");
  const [startingQuizId, setStartingQuizId] = useState("");
  const [activeAttempt, setActiveAttempt] = useState(null);
  const [chintsTrigger, setChintsTrigger] = useState("");

  useEffect(() => {
    setSidebarOpen(false);
    setUserMenuOpen(false);
    if (route.segments[0] !== "attempt") setActiveAttempt(null);
  }, [route.path, route.segments]);

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      return next;
    });
  };

  const handleMenuButton = () => {
    if (window.innerWidth <= 900) {
      setSidebarOpen((v) => !v);
    } else {
      toggleSidebarCollapsed();
    }
  };

  const toggleGroup = (key) => setOpenGroups((curr) => ({ ...curr, [key]: !curr[key] }));

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

  const setChintsTuck = useCallback((nextVal) => {
    setChintsTucked((prev) => {
      const resolved = typeof nextVal === "boolean" ? nextVal : !prev;
      window.localStorage.setItem(TUCKED_KEY, resolved ? "1" : "0");
      return resolved;
    });
  }, []);

  const askChints = useCallback((promptText) => {
    setChintsTuck(false);
    setChintsTrigger(String(promptText || ""));
  }, [setChintsTuck]);

  const clearChintsTrigger = useCallback(() => {
    setChintsTrigger("");
  }, []);

  const ctx = useMemo(() => ({
    token: session.token,
    user: session.user,
    updateSession: onSession,
    startQuiz,
    startingQuizId,
    activeAttempt,
    setActiveAttempt,
    askChints,
    chintsTrigger,
    clearChintsTrigger,
    ...themeCtx
  }), [session, onSession, startQuiz, startingQuizId, activeAttempt, askChints, chintsTrigger, clearChintsTrigger, themeCtx]);

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
  else if (seg[0] === "profile") content = <Profile />;
  else if (seg[0] === "about") content = <About />;
  else if (seg[0] === "settings") content = <Settings />;
  else if (seg[0] === "quiz" && seg[1]) content = <SharedQuizPage quizId={seg[1]} />;
  else if (seg[0] === "attempt" && seg[1]) content = <Player attemptId={seg[1]} />;
  else content = <Dashboard />;

  const active = seg[0] || "dashboard";
  const shellClasses = [
    "shell",
    sidebarCollapsed ? "sidebar-collapsed" : "",
    chintsTucked ? "chints-tucked" : ""
  ].filter(Boolean).join(" ");

  return (
    <AppContext.Provider value={ctx}>
      <div className={shellClasses}>
        {sidebarOpen && <div className="scrim" onClick={() => setSidebarOpen(false)} />}
        <aside className={sidebarOpen ? "sidebar open" : "sidebar"}>
          <div className="sidebar-top">
            <a className="brand" href="#/"><span className="brand-mark">Q</span> Online Quiz System</a>
            <button
              type="button"
              className="icon-button sidebar-close-btn"
              onClick={handleMenuButton}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <Icon name="arrowLeft" size={17} />
            </button>
          </div>

          <div className="nav-group">
            <button type="button" className="nav-label nav-label-btn" onClick={() => toggleGroup("learn")}>
              <span>Learn</span>
              <Icon name="chevron" size={14} className={openGroups.learn ? "chev open" : "chev"} />
            </button>
            {openGroups.learn && (
              <>
                <button className={active === "dashboard" ? "nav-link active" : "nav-link"} onClick={() => navigate("/")}><Icon name="home" /> Dashboard</button>
                <button className={active === "subjects" ? "nav-link active" : "nav-link"} onClick={() => navigate("/subjects")}><Icon name="book" /> Subjects &amp; Units</button>
                <button className={active === "explore" ? "nav-link active" : "nav-link"} onClick={() => navigate("/explore")}><Icon name="compass" /> Explore Catalog</button>
                <button className={active === "history" ? "nav-link active" : "nav-link"} onClick={() => navigate("/history")}><Icon name="history" /> Attempt History</button>
              </>
            )}
          </div>

          <div className="nav-group">
            <button type="button" className="nav-label nav-label-btn" onClick={() => toggleGroup("authoring")}>
              <span>Authoring</span>
              <Icon name="chevron" size={14} className={openGroups.authoring ? "chev open" : "chev"} />
            </button>
            {openGroups.authoring && (
              <>
                <button className={active === "create" ? "nav-link active" : "nav-link"} onClick={() => navigate("/create")}><Icon name="plus" /> Create Quiz</button>
                <button className={active === "my-quizzes" || active === "edit" ? "nav-link active" : "nav-link"} onClick={() => navigate("/my-quizzes")}><Icon name="edit" /> My Quizzes</button>
              </>
            )}
          </div>

          {session.user.role === "admin" && (
            <div className="nav-group">
              <button type="button" className="nav-label nav-label-btn" onClick={() => toggleGroup("admin")}>
                <span>Teacher / Admin</span>
                <Icon name="chevron" size={14} className={openGroups.admin ? "chev open" : "chev"} />
              </button>
              {openGroups.admin && (
                <button className={active === "admin" ? "nav-link active" : "nav-link"} onClick={() => navigate("/admin")}><Icon name="shield" /> Teacher Console</button>
              )}
            </div>
          )}

          <div className="nav-group">
            <button type="button" className="nav-label nav-label-btn" onClick={() => toggleGroup("account")}>
              <span>Account &amp; Help</span>
              <Icon name="chevron" size={14} className={openGroups.account ? "chev open" : "chev"} />
            </button>
            {openGroups.account && (
              <>
                <button className={active === "profile" ? "nav-link active" : "nav-link"} onClick={() => navigate("/profile")}><Icon name="user" /> My Profile</button>
                <button className={active === "settings" ? "nav-link active" : "nav-link"} onClick={() => navigate("/settings")}><Icon name="palette" /> Settings &amp; Theme</button>
                <button className={active === "about" ? "nav-link active" : "nav-link"} onClick={() => navigate("/about")}><Icon name="info" /> About &amp; Guide</button>
              </>
            )}
          </div>

          <button
            type="button"
            className="sidebar-foot"
            onClick={() => setChintsTuck(false)}
            style={{ textAlign: "left", cursor: "pointer" }}
            title="Open Chints AI panel on the right"
          >
            <strong><Icon name="sparkle" size={14} /> Powered by Chints AI</strong>
            <span>Click to open Chints AI co-pilot on the right →</span>
          </button>
        </aside>

        <div className="main">
          <header className="topbar">
            <button
              type="button"
              className="icon-button menu-button"
              onClick={handleMenuButton}
              aria-label="Toggle sidebar"
              title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            >
              <Icon name="menu" />
            </button>
            {active !== "dashboard" && (
              <button
                type="button"
                className="btn btn-sm topbar-back"
                onClick={() => (window.history.length > 1 ? window.history.back() : navigate("/"))}
                title="Go back"
              >
                <Icon name="arrowLeft" size={15} /> Back
              </button>
            )}
            <form className="top-search" onSubmit={submitTopSearch}>
              <Icon name="search" size={18} />
              <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search quizzes across all topics…" maxLength={100} />
            </form>
            <div className="top-actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate("/create")}><Icon name="plus" size={15} /> New quiz</button>
              <button
                type="button"
                className={chintsTucked ? "btn btn-sm" : "btn btn-sm chints-toggle-active"}
                onClick={() => setChintsTuck()}
                title={chintsTucked ? "Open Chints AI right panel" : "Tuck Chints AI panel in"}
              >
                <Icon name="sparkle" size={15} /> Chints AI
              </button>
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
                    <button type="button" onClick={() => navigate("/profile")}><Icon name="user" size={16} /> My profile</button>
                    <button type="button" onClick={() => navigate("/my-quizzes")}><Icon name="edit" size={16} /> My quizzes</button>
                    <button type="button" onClick={() => navigate("/history")}><Icon name="history" size={16} /> My attempts</button>
                    <button type="button" onClick={() => navigate("/settings")}><Icon name="palette" size={16} /> Settings &amp; theme</button>
                    <button type="button" onClick={() => navigate("/about")}><Icon name="info" size={16} /> About &amp; guide</button>
                    {session.user.role === "admin" && <button type="button" onClick={() => navigate("/admin")}><Icon name="shield" size={16} /> Teacher console</button>}
                    <button type="button" onClick={handleLogout} style={{ color: "var(--danger)" }}><Icon name="logout" size={16} /> Sign out</button>
                  </div>
                )}
              </div>
            </div>
          </header>
          {content}
        </div>

        <ChintsChat tucked={chintsTucked} onToggleTuck={setChintsTuck} />
      </div>
    </AppContext.Provider>
  );
}

export default function App() {
  const [session, setSessionState] = useState(loadSavedSession);
  const [themePref, setThemePref] = useState(() => {
    const saved = window.localStorage.getItem(THEME_KEY);
    return ["light", "dark", "system"].includes(saved) ? saved : "system";
  });
  const [accent, setAccent] = useState(() => {
    const saved = window.localStorage.getItem(ACCENT_KEY);
    return ACCENTS[saved] ? saved : "indigo";
  });
  const [catBreed, setCatBreedState] = useState(() => {
    const saved = window.localStorage.getItem(CAT_BREED_KEY);
    return CAT_BREEDS[saved] ? saved : "ginger";
  });
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  const setCatBreed = useCallback((nextBreed) => {
    if (CAT_BREEDS[nextBreed]) {
      setCatBreedState(nextBreed);
      window.localStorage.setItem(CAT_BREED_KEY, nextBreed);
    }
  }, []);

  const setSession = useCallback((next) => {
    setSessionState(next);
    if (next) window.localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(SESSION_KEY);
  }, []);

  useEffect(() => {
    onUnauthorized(() => setSession(null));
  }, [setSession]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event) => setSystemDark(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const theme = themePref === "system" ? (systemDark ? "dark" : "light") : themePref;

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    window.localStorage.setItem(THEME_KEY, themePref);
    window.localStorage.setItem(ACCENT_KEY, accent);
    if (accent === "indigo") {
      ["--primary", "--primary-2", "--primary-soft", "--grad"].forEach((name) => root.style.removeProperty(name));
    } else {
      const [first, second] = ACCENTS[accent][theme];
      root.style.setProperty("--primary", first);
      root.style.setProperty("--primary-2", second);
      root.style.setProperty("--primary-soft", `color-mix(in srgb, ${first} ${theme === "dark" ? 22 : 12}%, var(--surface))`);
      root.style.setProperty("--grad", `linear-gradient(135deg, ${first} 0%, ${second} 100%)`);
    }
  }, [theme, themePref, accent]);

  const toggleTheme = () => setThemePref(theme === "dark" ? "light" : "dark");

  const themeCtx = useMemo(
    () => ({ themePref, setThemePref, accent, setAccent, accents: ACCENTS, catBreed, setCatBreed, catBreeds: CAT_BREEDS }),
    [themePref, accent, catBreed, setCatBreed]
  );

  return (
    <ToastProvider>
      {session
        ? <Shell session={session} onSession={setSession} theme={theme} onTheme={toggleTheme} themeCtx={themeCtx} />
        : <AuthPage onSession={setSession} theme={theme} onTheme={toggleTheme} />}
    </ToastProvider>
  );
}
