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
          suggestions: ["Explain Q1", "Generate another quiz", "Back to subjects"]
        };

    appendMessagesToActive([promptMsg], `Review: ${quizTitle}`);
    if (tucked) onToggleTuck?.(false);
  }, [isReviewMode, activeAttempt, appendMessagesToActive, tucked, onToggleTuck]);

  const sendMessage = useCallback(async (rawText) => {
    const text = String(rawText ?? input).trim();
    if (!text || busy) return;
    setInput("");
    setShowHistory(false);
    setManualNap(false);

    const userMsg = { id: `u-${Date.now()}`, sender: "user", time: new Date().toISOString(), text };
    appendMessagesToActive([userMsg]);
    setBusy(true);

    try {
      const attemptPayload = activeAttempt
        ? {
            id: activeAttempt.id,
            status: activeAttempt.status,
            quizTitle: activeAttempt.quiz?.title,
            score: activeAttempt.score,
            totalQuestions: activeAttempt.totalQuestions,
            questions: (activeAttempt.questions || []).map((q) => ({
              prompt: q.prompt,
              options: q.options,
              selectedOption: q.selectedOption,
              correctOption: q.correctOption,
              isCorrect: q.isCorrect
            }))
          }
        : null;

      const mode = isExamMode ? "exam" : isReviewMode ? "review" : "general";
      const res = await chatWithChints({ message: text, mode, attemptContext: attemptPayload }, token);

      if (res.action?.type === "navigate" && res.action.path) {
        navigate(res.action.path);
      }

      const defaultSuggestions = isExamMode
        ? ["24 * 15 / 4", "18% of 250", "sqrt(144) + 2^8"]
        : res.action?.path?.startsWith("/subjects")
          ? ["Generate a quiz with Chints", "How do I delete a quiz?"]
          : isReviewMode
            ? ["Yes, explain where I went wrong!", "Explain Q1", "Generate a quiz with Chints"]
            : ["How do I add subjects?", "Generate a quiz with Chints", "Open my profile"];

      appendMessagesToActive([
        {
          id: `c-${Date.now()}`,
          sender: "chints",
          time: new Date().toISOString(),
          text: res.reply || "Meow! 🐾 I'm right here bro! Tell me what you need help with!",
          actionLabel: res.action?.label || "",
          suggestions: defaultSuggestions
        }
      ]);
    } catch (err) {
      appendMessagesToActive([
        {
          id: `e-${Date.now()}`,
          sender: "chints",
          time: new Date().toISOString(),
          text: `Oops, hit a quick snag (${err.message}). Try asking me again!`
        }
      ]);
    } finally {
      setBusy(false);
    }
  }, [input, busy, activeAttempt, isExamMode, isReviewMode, token, appendMessagesToActive]);

  // Allow other components (like Player.jsx "Ask Chints why I was wrong") to trigger a Chints message
  useEffect(() => {
    if (!chintsTrigger) return;
    if (tucked) onToggleTuck?.(false);
    sendMessage(chintsTrigger);
    clearChintsTrigger?.();
  }, [chintsTrigger, clearChintsTrigger, sendMessage, tucked, onToggleTuck]);

  const startNewChat = () => {
    const fresh = createNewThread("New conversation");
    setThreads((curr) => [fresh, ...curr]);
    setActiveThreadId(fresh.id);
    setShowHistory(false);
    toast("Started a new chat with Chints 🐾");
  };

  const deleteThread = (id) => {
    const remaining = threads.filter((t) => t.id !== id);
    if (remaining.length === 0) {
      const fresh = createNewThread("New conversation");
      setThreads([fresh]);
      setActiveThreadId(fresh.id);
    } else {
      setThreads(remaining);
      if (id === activeThread.id) {
        setActiveThreadId(remaining[0].id);
      }
    }
    toast("Chat deleted from history");
  };

  const clearAllHistory = () => {
    const fresh = createNewThread("New conversation");
    setThreads([fresh]);
    setActiveThreadId(fresh.id);
    setShowHistory(false);
    toast("All previous chats deleted");
  };

  const clearCurrentChat = () => {
    setThreads((curr) =>
      curr.map((t) =>
        t.id === activeThread.id
          ? { ...t, title: "New conversation", updatedAt: new Date().toISOString(), messages: [createWelcomeMessage()] }
          : t
      )
    );
    toast("Current chat cleared");
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage(input);
  };

  const contextLabel = pageContextLabel(route.segments, isExamMode, isReviewMode, activeAttempt);

  return (
    <>
      {/* When tucked in, Chints the Virtual Cat sits in the bottom-right corner watching your cursor! */}
      {tucked && (
        <div className="chints-cat-corner">
          <ChintsCat
            breed={catBreed}
            size={92}
            woolTrigger={woolTrigger}
            napRequest={manualNap}
            onStatusText={setCatStatusText}
            onClick={() => onToggleTuck?.(false)}
            badgeText={isExamMode ? "🧮 Calc" : isReviewMode ? "📝 Review" : "Chints 🐾"}
          />
        </div>
      )}

      <aside className={tucked ? "chints-panel tucked" : "chints-panel"} aria-label="Chints AI Assistant">
        {/* Left drag handle to extend/resize the panel width */}
        <div
          className="chints-resize-handle"
          onMouseDown={startResize}
          title="Drag left or right to resize Chints panel"
        />

        {/* Top Header */}
        <div className="chints-panel-head">
          <div className="row" style={{ gap: 8, minWidth: 0 }}>
            <strong style={{ fontSize: 15 }}>🐾 Chints AI</strong>
            <span className="tag" style={{ fontSize: 11, padding: "2px 8px" }}>{currentCat.name}</span>
          </div>

          <div className="row" style={{ gap: 4 }}>
            <button
              type="button"
              className="icon-button chints-head-btn"
              onClick={startNewChat}
              title="Start new chat"
              aria-label="Start new chat"
            >
              <Icon name="plus" size={15} />
            </button>
            <button
              type="button"
              className={showHistory ? "icon-button chints-head-btn active" : "icon-button chints-head-btn"}
              onClick={() => { setShowHistory((v) => !v); setShowInfo(false); }}
              title="Chat history (view or delete old chats)"
              aria-label="Chat history"
            >
              <Icon name="history" size={15} />
            </button>
            <button
              type="button"
              className="icon-button chints-head-btn"
              onClick={clearCurrentChat}
              title="Clear current chat messages"
              aria-label="Clear current chat"
            >
              <Icon name="trash" size={14} />
            </button>
            <button
              type="button"
              className={showInfo ? "icon-button chints-head-btn active" : "icon-button chints-head-btn"}
              onClick={() => { setShowInfo((v) => !v); setShowHistory(false); }}
              title="Shortcuts & cat settings"
              aria-label="Shortcuts"
            >
              <Icon name="info" size={15} />
            </button>
            <button
              type="button"
              className="icon-button chints-head-btn"
              onClick={toggleWide}
              title={panelWidth > 430 ? "Standard width" : "Extend panel wider"}
              aria-label="Toggle panel width"
            >
              <Icon name="layers" size={15} />
            </button>
            <button
              type="button"
              className="icon-button chints-head-btn"
              onClick={() => onToggleTuck?.(true)}
              title="Tuck panel in (show Chints cat in corner)"
              aria-label="Tuck Chints panel in"
            >
              <Icon name="arrowRight" size={15} />
            </button>
          </div>
        </div>

        {/* Interactive Virtual Cat Stage inside the panel */}
        <div className="chints-cat-stage">
          <ChintsCat
            breed={catBreed}
            size={88}
            woolTrigger={woolTrigger}
            napRequest={manualNap}
            onStatusText={setCatStatusText}
            onClick={tossWoolBall}
          />
          <div className="chints-cat-stage-info">
            <b>
              {catStatusText || (isExamMode ? "🧮 Scientific Calculator Mode" : "👀 Watching your cursor!")}
            </b>
            <small>Move your cursor near Chints to play, or click below:</small>
            <div className="row" style={{ gap: 5, marginTop: 5, flexWrap: "wrap" }}>
              <button type="button" className="chints-mini-btn" onClick={tossWoolBall} title="Toss a wool ball for Chints">
                🧶 Wool ball
              </button>
              <button type="button" className="chints-mini-btn" onClick={cycleCatBreed} title="Switch cat breed (6 styles)">
                🐱 Switch cat
              </button>
              <button type="button" className="chints-mini-btn" onClick={() => setManualNap((v) => !v)} title="Toggle cat loaf nap (also sleeps automatically after 5 min idle)">
                {manualNap ? "☀️ Wake" : "💤 Nap"}
              </button>
              <button
                type="button"
                className={showCalc || isExamMode ? "chints-mini-btn active" : "chints-mini-btn"}
                onClick={() => setShowCalc((v) => !v)}
                title="Open Scientific Calculator pad"
              >
                🧮 Sci Calc
              </button>
            </div>
          </div>
        </div>

        {/* Live Context Bar */}
        <div className="chints-context-bar">
          <span>{contextLabel}</span>
          <button
            type="button"
            className="link-button"
            style={{ fontSize: 11.5 }}
            onClick={() => setShowHistory((v) => !v)}
          >
            {showHistory ? "← Back to chat" : savedThreads.length > 0 ? `History (${savedThreads.length})` : "History"}
          </button>
        </div>

        {/* Exam Mode Integrity Notice */}
        {isExamMode && (
          <div className="chints-exam-banner">
            🔒 <b>Live Test Mode:</b> Quiz answers &amp; hints are locked while your test is running! Use Chints as your <b>calculator</b> below.
          </div>
        )}

        {/* Informative Guide & Cat Breed Picker Drawer */}
        {showInfo && (
          <div className="chints-drawer">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>🐱 Choose Chints Cat Style (6 Breeds)</strong>
              <button type="button" className="link-button" onClick={() => setShowInfo(false)}>Close</button>
            </div>
            <div className="chints-cat-pills">
              {Object.values(CAT_BREEDS).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={catBreed === b.id ? "chints-chip active" : "chints-chip"}
                  onClick={() => setCatBreed?.(b.id)}
                >
                  {b.name}
                </button>
              ))}
            </div>
            <strong style={{ marginTop: 4 }}>✨ Quick Actions</strong>
            <div className="chints-info-grid">
              <button type="button" className="chints-info-card" onClick={() => { setShowInfo(false); sendMessage("How do I add subjects?"); }}>
                <b>📚 Add a Custom Subject</b>
                <small>Opens Add Subject &amp; sorts your syllabus into Units &amp; Topics.</small>
              </button>
              <button type="button" className="chints-info-card" onClick={() => { setShowInfo(false); sendMessage("Generate a quiz with Chints"); }}>
                <b>✨ Generate AI Quiz</b>
                <small>Opens Quiz Studio in Chints AI mode (Easy / Medium / Hard).</small>
              </button>
              <button type="button" className="chints-info-card" onClick={() => { setShowInfo(false); sendMessage("How do I delete a quiz?"); }}>
                <b>🗂️ Manage / Delete Quizzes</b>
                <small>Opens My Quizzes to share, edit, or delete published quizzes.</small>
              </button>
              <button type="button" className="chints-info-card" onClick={() => { setShowInfo(false); sendMessage("Open my profile"); }}>
                <b>👤 Profile &amp; Role Switcher</b>
                <small>View stats or switch between Student &amp; Teacher (Admin).</small>
              </button>
            </div>
          </div>
        )}

        {/* Chat History View */}
        {showHistory ? (
          <div className="chints-history-view">
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <strong>Saved Chats ({savedThreads.length})</strong>
              <div className="row" style={{ gap: 6 }}>
                {savedThreads.length > 0 && (
                  <button type="button" className="btn btn-sm btn-danger" onClick={clearAllHistory} title="Delete all chat history">
                    <Icon name="trash" size={13} /> Clear all
                  </button>
                )}
                <button type="button" className="btn btn-sm btn-primary" onClick={startNewChat}>
                  <Icon name="plus" size={13} /> New
                </button>
              </div>
            </div>
            {savedThreads.length === 0 ? (
              <div className="chints-history-empty">
                <p>No saved chats in history.</p>
                <small className="text-muted">Once you send a message to Chints, your conversation will appear here.</small>
              </div>
            ) : (
              <div className="chints-thread-list">
                {savedThreads.map((t) => (
                  <div
                    key={t.id}
                    className={t.id === activeThread.id ? "chints-thread-item active" : "chints-thread-item"}
                  >
                    <button
                      type="button"
                      className="chints-thread-select"
                      onClick={() => { setActiveThreadId(t.id); setShowHistory(false); }}
                    >
                      <b>{t.title}</b>
                      <small>
                        {t.messages.length} {t.messages.length === 1 ? "message" : "messages"} · {new Date(t.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </small>
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger chints-thread-del"
                      onClick={() => deleteThread(t.id)}
                      title="Delete this chat"
                    >
                      <Icon name="trash" size={14} /> Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Active Conversation Feed */
          <div className="chints-feed" ref={feedRef}>
            {messages.map((m) => (
              <div key={m.id} className={m.sender === "user" ? "chints-msg user" : "chints-msg bot"}>
                <div className="chints-msg-meta">
                  <span>{m.sender === "user" ? "You" : "🐱 Chints"}</span>
                  {m.time && <small>{new Date(m.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>}
                </div>
                <div className="chints-bubble">
                  {renderFormattedText(m.text)}
                  {m.actionLabel && (
                    <div className="chints-action-pill">
                      <Icon name="check" size={12} /> {m.actionLabel}
                    </div>
                  )}
                </div>
                {m.sender === "chints" && m.suggestions?.length > 0 && (
                  <div className="chints-chips">
                    {m.suggestions.map((s) => (
                      <button key={s} type="button" className="chints-chip" disabled={busy} onClick={() => sendMessage(s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <div className="chints-msg bot">
                <div className="chints-bubble chints-typing">🐾 Chints is typing…</div>
              </div>
            )}
          </div>
        )}

        {/* Scientific Calculator Pad (Always open in Exam Mode, or toggle via "🧮 Sci Calc") */}
        {(isExamMode || showCalc) && (
          <div className="chints-sci-calc">
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
              <small style={{ fontWeight: 700, fontSize: 11, color: "var(--muted)" }}>
                🧮 Scientific Calculator (DEG mode · supports English or math)
              </small>
              {!isExamMode && (
                <button type="button" className="link-button" style={{ fontSize: 11 }} onClick={() => setShowCalc(false)}>
                  Hide
                </button>
              )}
            </div>
            <div className="chints-calc-bar">
              {[
                { label: "√", val: "sqrt(" },
                { label: "∛", val: "cbrt(" },
                { label: "x²", val: "^2" },
                { label: "xʸ", val: "^" },
                { label: "sin", val: "sin(" },
                { label: "cos", val: "cos(" },
                { label: "tan", val: "tan(" },
                { label: "log₁₀", val: "log10(" },
                { label: "ln", val: "ln(" },
                { label: "log₂", val: "log2(" },
                { label: "n!", val: "!" },
                { label: "nCr", val: "C" },
                { label: "nPr", val: "P" },
                { label: "gcd", val: "gcd(" },
                { label: "lcm", val: "lcm(" },
                { label: "π", val: "pi" },
                { label: "e", val: "e" },
                { label: "% of", val: "% of " },
                { label: "mod", val: " mod " },
                { label: "(", val: "(" },
                { label: ")", val: ")" },
                { label: "+", val: " + " },
                { label: "−", val: " - " },
                { label: "×", val: " * " },
                { label: "÷", val: " / " }
              ].map((op) => (
                <button
                  key={op.label}
                  type="button"
                  className="chints-calc-btn"
                  onClick={() => setInput((curr) => `${curr}${op.val}`)}
                >
                  {op.label}
                </button>
              ))}
              <button
                type="button"
                className="chints-calc-btn"
                onClick={() => setInput("")}
                title="Clear input"
              >
                CLR
              </button>
              <button
                type="button"
                className="chints-calc-btn eq"
                disabled={!input.trim() || busy}
                onClick={() => sendMessage(input)}
                title="Evaluate expression"
              >
                =
              </button>
            </div>
          </div>
        )}

        {/* Bottom Input Box with High-Contrast Readable Text */}
        <form className="chints-input-row" onSubmit={handleSubmit}>
          <input
            className="input chints-text-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isExamMode ? "Calculate e.g. 24 * 15 or 18% of 250…" : "Ask Chints the cat anything…"}
            maxLength={500}
          />
          <button type="submit" className="btn btn-primary btn-sm chints-send" disabled={busy || !input.trim()} title="Send message">
            <Icon name="arrowRight" size={15} />
          </button>
        </form>
      </aside>
    </>
  );
}
export { TUCKED_KEY };
