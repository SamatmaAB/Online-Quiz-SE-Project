import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/* ───────── Icons ───────── */
const paths = {
  home: "m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19a2 2 0 0 1 2-2h13",
  compass: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm3.5-12.5-2 5-5 2 2-5z",
  plus: "M12 5v14M5 12h14",
  edit: "M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16zM14 6l4 4",
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-14v5l3 2",
  history: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2",
  shield: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm10 2-4.3-4.3",
  moon: "M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  menu: "M4 6h16M4 12h16M4 18h16",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  check: "m5 12 5 5 9-10",
  x: "M6 6l12 12M18 6 6 18",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
  chevron: "m6 9 6 6 6-6",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  arrowLeft: "M19 12H5M11 6l-6 6 6 6",
  layers: "m12 3 9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5",
  users: "M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM21 20v-2a4 4 0 0 0-3-3.9M16 2.1a4 4 0 0 1 0 7.8",
  award: "M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.2 14 7 22l5-3 5 3-1.2-8",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-5a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  eyeOff: "M3 3l18 18M10.6 6.2A9.6 9.6 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.2 3.8M6.5 7.5A17 17 0 0 0 2 12s4 7 10 7a9.5 9.5 0 0 0 4-.9",
  play: "M7 4v16l13-8z",
  share: "M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  more: "M5 12h.01M12 12h.01M19 12h.01"
};

export function Icon({ name, size = 20, stroke = 1.9, className = "" }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name] || paths.book} />
    </svg>
  );
}

/* ───────── Helpers ───────── */
export function hueFor(text = "") {
  let hash = 0;
  for (const character of String(text)) hash = (hash * 31 + character.charCodeAt(0)) % 360;
  return (hash + 210) % 360;
}
export const initials = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
export function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
export const formatDay = (value) => (value ? new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—");
export const subjectBadge = (subject) => (subject.code ? subject.code.replace(/[^A-Za-z]/g, "").slice(0, 2) || subject.name[0] : subject.name[0]).toUpperCase();

export function shareQuizUrl(quizId) {
  return `${window.location.origin}${window.location.pathname}#/quiz/${encodeURIComponent(quizId)}`;
}

export async function copyQuizShareLink(quiz, toast) {
  const url = shareQuizUrl(quiz.id || quiz);
  try {
    await navigator.clipboard.writeText(url);
    toast?.("Share link copied! Anyone with this link can take the quiz.");
  } catch {
    window.prompt("Copy this quiz share link:", url);
  }
}

/* ───────── Primitives ───────── */
export function Loading({ label = "Loading…" }) {
  return <div className="loading" role="status"><span className="spinner" /> {label}</div>;
}

export function Empty({ icon = "search", title, children, action }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} size={26} /></span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Alert({ kind = "info", children, onClose }) {
  if (!children) return null;
  return (
    <div className={`alert ${kind}`} role={kind === "error" ? "alert" : "status"}>
      <span style={{ flex: 1 }}>{children}</span>
      {onClose && <button type="button" className="link-button" onClick={onClose} aria-label="Dismiss">✕</button>}
    </div>
  );
}

export function Badge({ kind = "", children }) {
  return <span className={`badge ${kind}`}>{children}</span>;
}

export function Modal({ title, onClose, children, actions, wide = false }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} style={wide ? { width: "min(820px, 100%)" } : undefined}>
        <h2>{title}</h2>
        {children}
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}

export function Ring({ value, label, size = 120, color }) {
  return (
    <div className="ring" style={{ "--value": Math.max(0, Math.min(100, value)), "--size": `${size}px`, ...(color ? { "--ring-color": color } : {}) }}>
      <div><span><b>{Math.round(value)}%</b><br /><small>{label}</small></span></div>
    </div>
  );
}

/* ───────── Toasts ───────── */
const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);
  const push = useCallback((message, kind = "") => {
    const id = ++counter.current;
    setToasts((current) => [...current, { id, message, kind }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4200);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">{toasts.map((toast) => <div key={toast.id} className={`toast ${toast.kind}`}>{toast.message}</div>)}</div>
    </ToastContext.Provider>
  );
}

/* ───────── Hash router ───────── */
function readHash() {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [pathPart, queryPart = ""] = raw.split("?");
  return {
    path: pathPart.startsWith("/") ? pathPart : `/${pathPart}`,
    segments: pathPart.split("/").filter(Boolean).map(decodeURIComponent),
    query: Object.fromEntries(new URLSearchParams(queryPart))
  };
}

export function navigate(path) {
  if (window.location.hash === `#${path}`) window.dispatchEvent(new HashChangeEvent("hashchange"));
  else window.location.hash = path;
}

export function useRoute() {
  const [route, setRoute] = useState(readHash);
  useEffect(() => {
    const onChange = () => setRoute(readHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return useMemo(() => route, [route]);
}

/* ───────── Data hook ───────── */
export function useAsync(loader, deps) {
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: "" }));
    loader(controller.signal)
      .then((data) => { if (!controller.signal.aborted) setState({ loading: false, error: "", data }); })
      .catch((error) => { if (error.name !== "AbortError") setState({ loading: false, error: error.message, data: null }); });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((value) => value + 1) };
}

/* --------- App context (session + shared actions) --------- */
export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

