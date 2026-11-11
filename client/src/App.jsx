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
// Stage 1
