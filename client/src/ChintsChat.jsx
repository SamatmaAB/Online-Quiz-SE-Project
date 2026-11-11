import { useCallback, useEffect, useRef, useState } from "react";
import { chatWithChints } from "./api.js";
import ChintsCat, { CAT_BREEDS } from "./ChintsCat.jsx";
import { Icon, navigate, useApp, useRoute, useToast } from "./ui.jsx";

const THREADS_KEY = "oqs_chints_threads_v1";
const TUCKED_KEY = "oqs_chints_tucked_v1";
const WIDTH_KEY = "oqs_chints_width_v1";

function createWelcomeMessage() {
  return {
    id: `welcome-${Date.now()}`,
    sender: "chints",
    time: new Date().toISOString(),
    text: "Meow! 🐾👋 Hey bro! I'm **Chints**, your virtual cat & AI study buddy!\n\nAsk me anything — I can **open pages for you** (*“how do I add subjects?”*), **generate quizzes**, **calculate math** during live tests, and **explain wrong answers** after every quiz!",
    suggestions: [
      "How do I add subjects?",
      "Generate a quiz with Chints",
      "Open my profile",
      "Change theme"
    ]
  };
}

function createNewThread(title = "New conversation") {
  return {
    id: `thread-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title,
    updatedAt: new Date().toISOString(),
    messages: [createWelcomeMessage()]
  };
}

function loadThreads() {
  try {
    const raw = window.localStorage.getItem(THREADS_KEY);
    if (!raw) return [createNewThread("Welcome chat")];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [createNewThread("Welcome chat")];
  } catch {
    return [createNewThread("Welcome chat")];
  }
}

/** Simple formatted text renderer supporting **bold**, `code`, and line breaks. */
function renderFormattedText(text) {
  const lines = String(text || "").split("\n");
  return lines.map((line, lineIdx) => {
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return (
      <span key={lineIdx}>
        {parts.map((part, i) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={i}>{part.slice(2, -2)}</strong>;
          }
          if (part.startsWith("`") && part.endsWith("`")) {
            return <code key={i} className="chints-code">{part.slice(1, -1)}</code>;
          }
          return part;
        })}
        {lineIdx < lines.length - 1 && <br />}
      </span>
    );
  });
}

function pageContextLabel(seg, isExamMode, isReviewMode, activeAttempt) {
  if (isExamMode) return `🧮 Live Quiz: ${activeAttempt?.quiz?.title || "In Progress"} (Calculator-Only)`;
  if (isReviewMode) return `📝 Review: ${activeAttempt?.quiz?.title || "Completed Quiz"} (${activeAttempt?.score}/${activeAttempt?.totalQuestions})`;
  const first = seg[0] || "dashboard";
  const labels = {
    dashboard: "📍 Dashboard Overview",
    subjects: seg[2] === "unit" ? "📍 Unit Topics & Quizzes" : seg[1] ? "📍 Subject Units" : "📍 Subjects & Syllabus",
    explore: "📍 Explore Quiz Catalog",
    create: "📍 Quiz Studio (Create / Generate)",
    edit: "📍 Quiz Studio (Editing Quiz)",
    "my-quizzes": "📍 My Quizzes",
    history: "📍 Attempt History",
    admin: "📍 Teacher / Admin Console",
    profile: "📍 My Profile & Role Settings",
    settings: "📍 Settings & Theme",
    about: "📍 About & Platform Guide"
  };
  return labels[first] || "📍 Online Quiz System";
}

export default function ChintsChat({ tucked, onToggleTuck }) {
  const { token, activeAttempt, chintsTrigger, clearChintsTrigger, catBreed = "ginger", setCatBreed } = useApp();
  const route = useRoute();
  const toast = useToast();

  const [threads, setThreads] = useState(loadThreads);
  const [activeThreadId, setActiveThreadId] = useState(() => loadThreads()[0]?.id || "");
  const [showHistory, setShowHistory] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [woolTrigger, setWoolTrigger] = useState(0);
  const [manualNap, setManualNap] = useState(false);
  const [catStatusText, setCatStatusText] = useState("");
  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = Number(window.localStorage.getItem(WIDTH_KEY));
    return saved >= 310 && saved <= 640 ? saved : 365;
  });

  const feedRef = useRef(null);
  const promptedAttemptIds = useRef(new Set());
  const draggingRef = useRef(false);

  const activeThread = threads.find((t) => t.id === activeThreadId) || threads[0];
  const messages = activeThread?.messages || [];
  // Only count threads that actually contain conversation messages beyond the initial greeting
  const savedThreads = threads.filter((t) => (t.messages?.length || 0) > 1);

  const isExamMode = activeAttempt?.status === "in-progress";
  const isReviewMode = Boolean(activeAttempt && activeAttempt.status && activeAttempt.status !== "in-progress");
  const currentCat = CAT_BREEDS[catBreed] || CAT_BREEDS.ginger;

  // Persist threads in localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(THREADS_KEY, JSON.stringify(threads.slice(0, 25)));
    } catch { /* ignore storage quota */ }
  }, [threads]);

  // Persist panel width and update CSS variable on root
  useEffect(() => {
    window.localStorage.setItem(WIDTH_KEY, String(panelWidth));
    document.documentElement.style.setProperty("--chints-width", `${panelWidth}px`);
  }, [panelWidth]);

  // Scroll chat feed to bottom when messages change
  useEffect(() => {
    if (feedRef.current && !showHistory) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages.length, busy, showHistory, tucked]);

  // Drag-to-resize handler on the left border of the right panel
  const startResize = (event) => {
    event.preventDefault();
    draggingRef.current = true;
    const onMove = (e) => {
      if (!draggingRef.current) return;
      const desired = window.innerWidth - e.clientX;
      const clamped = Math.max(310, Math.min(640, desired));
      setPanelWidth(clamped);
    };
    const onUp = () => {
      draggingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const toggleWide = () => {
    setPanelWidth((curr) => (curr > 430 ? 365 : 510));
  };

  const tossWoolBall = () => {
    setManualNap(false);
    setWoolTrigger((n) => n + 1);
  };

  const cycleCatBreed = () => {
    const keys = Object.keys(CAT_BREEDS);
    const nextIdx = (keys.indexOf(catBreed) + 1) % keys.length;
    const nextKey = keys[nextIdx];
    setCatBreed?.(nextKey);
    toast(`Chints is now ${CAT_BREEDS[nextKey].name}! 🐱`);
  };

  const appendMessagesToActive = useCallback((newMsgs, customTitle = "") => {
    setThreads((curr) => {
      const targetId = curr.some((t) => t.id === activeThreadId) ? activeThreadId : curr[0]?.id;
      return curr.map((t) => {
        if (t.id !== targetId) return t;
        const firstUserText = newMsgs.find((m) => m.sender === "user")?.text;
        const nextTitle =
          customTitle ||
          ((t.title === "New conversation" || t.title === "Welcome chat") && firstUserText
            ? firstUserText.slice(0, 42)
            : t.title);
        return {
          ...t,
          title: nextTitle,
          updatedAt: new Date().toISOString(),
          messages: [...t.messages, ...newMsgs]
        };
      });
    });
  }, [activeThreadId]);

  // Automatically ask the user if they want to see where they went wrong as soon as a test ends!
  useEffect(() => {
    if (!isReviewMode || !activeAttempt?.id) return;
    if (promptedAttemptIds.current.has(activeAttempt.id)) return;
    promptedAttemptIds.current.add(activeAttempt.id);

    const wrongQuestions = (activeAttempt.questions || [])
      .map((q, idx) => ({ ...q, qNum: idx + 1 }))
      .filter((q) => !q.isCorrect);

    const quizTitle = activeAttempt.quiz?.title || "your quiz";
    const scoreText = `${activeAttempt.score}/${activeAttempt.totalQuestions} (${activeAttempt.percentage}%)`;

    const promptMsg = wrongQuestions.length > 0
      ? {
          id: `review-${activeAttempt.id}`,
          sender: "chints",
          time: new Date().toISOString(),
          text: `Meow! 🐾 Great job finishing **${quizTitle}** (${scoreText})! 🎉\n\n**Would you like to see where you went wrong and what would have been the right answer with its explanation?**`,
          suggestions: [
            "Yes, explain where I went wrong!",
            ...wrongQuestions.slice(0, 3).map((q) => `Explain Q${q.qNum}`)
          ]
        }
      : {
          id: `review-${activeAttempt.id}`,
          sender: "chints",
          time: new Date().toISOString(),
          text: `Purr-fect score!! 🐾🎉 You scored **${scoreText}** on **${quizTitle}**! Would you like me to explain any question and why the right answer works?`,
// Stage 1
