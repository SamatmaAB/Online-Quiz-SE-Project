import { useEffect, useRef, useState } from "react";
import { fetchAttempt, saveAttemptAnswers, submitAttempt } from "./api.js";
import { BackLink, scoreKind } from "./components.jsx";
import { Alert, Badge, Icon, Loading, Ring, formatDate, navigate, useApp, useToast } from "./ui.jsx";

function secondsLeft(expiresAt) {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function formatClock(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function Player({ attemptId }) {
  const { token, setActiveAttempt, askChints } = useApp();
  const toast = useToast();
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [saveNote, setSaveNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const saveTimer = useRef(null);
  const submitLock = useRef(false);
  const attemptRef = useRef(null);
  attemptRef.current = attempt;

  useEffect(() => {
    setActiveAttempt?.(attempt);
  }, [attempt, setActiveAttempt]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    submitLock.current = false;
    fetchAttempt(attemptId, token, controller.signal)
      .then((data) => {
        setAttempt(data.attempt);
        setRemaining(secondsLeft(data.attempt.expiresAt));
        setCurrentIdx(0);
      })
      .catch((err) => { if (err.name !== "AbortError") setError(err.message); })
      .finally(() => setLoading(false));
    return () => { controller.abort(); window.clearTimeout(saveTimer.current); };
  }, [attemptId, token]);

  useEffect(() => {
    if (!attempt || attempt.status !== "in-progress") return undefined;
    const tick = () => {
      const sec = secondsLeft(attempt.expiresAt);
      setRemaining(sec);
      if (sec === 0 && !submitLock.current) handleSubmit(true);
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt?.id, attempt?.status, attempt?.expiresAt]);

  function selectOption(questionId, optionIndex) {
    if (!attempt || attempt.status !== "in-progress") return;
    const questions = attempt.questions.map((q) => q.id === questionId ? { ...q, selectedOption: optionIndex } : q);
    const next = { ...attempt, questions };
    setAttempt(next);
    setSaveNote("Saving…");
    setError("");
    window.clearTimeout(saveTimer.current);
    const answers = questions.map((q) => ({ questionId: q.id, selectedOption: q.selectedOption }));
    saveTimer.current = window.setTimeout(async () => {
      try {
        await saveAttemptAnswers(next.id, answers, token);
        setSaveNote("All answers saved");
      } catch (err) {
        setSaveNote("");
        setError(err.message);
      }
    }, 300);
  }

  async function handleSubmit(timedOut = false) {
    const curr = attemptRef.current;
    if (!curr || curr.status !== "in-progress" || submitLock.current) return;
    const unanswered = curr.questions.filter((q) => q.selectedOption === null).length;
    if (!timedOut && unanswered > 0) {
      setError(`Please answer all questions before submitting (${unanswered} remaining).`);
      return;
    }
    submitLock.current = true;
    window.clearTimeout(saveTimer.current);
    setSubmitting(true);
    setError("");
    try {
      const answers = curr.questions.map((q) => ({ questionId: q.id, selectedOption: q.selectedOption }));
      const data = await submitAttempt(curr.id, answers, token);
      setAttempt(data.attempt);
      toast(timedOut ? "Time expired — quiz submitted" : `Scored ${data.attempt.score}/${data.attempt.totalQuestions} (${data.attempt.percentage}%)`);
    } catch (err) {
      setError(err.message);
      submitLock.current = false;
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="page"><Loading label="Loading quiz attempt…" /></div>;
  if (!attempt) return <div className="page"><Alert kind="error">{error || "Attempt not found"}</Alert><BackLink to="/explore">Back to quizzes</BackLink></div>;

  const isActive = attempt.status === "in-progress";
  const questions = attempt.questions || [];
  const answeredCount = questions.filter((q) => q.selectedOption !== null).length;
  const currentQ = questions[currentIdx] || questions[0];

  if (!isActive) {
    const wrongCount = questions.filter((q) => !q.isCorrect).length;
    return (
      <div className="page">
        <BackLink to="/history">Attempt history</BackLink>
        <section className="card result-banner">
          <Ring value={attempt.percentage} label={`${attempt.score}/${attempt.totalQuestions}`} size={132} />
          <div style={{ flex: 1, minWidth: 240 }}>
            <div className="row" style={{ gap: 8, marginBottom: 6 }}>
              <Badge>{attempt.quiz.category}</Badge>
              <Badge kind={attempt.quiz.difficulty}>{attempt.quiz.difficulty}</Badge>
              <Badge kind={scoreKind(attempt.percentage)}>{attempt.status === "timed-out" ? "Timed out" : "Submitted"}</Badge>
            </div>
            <h2>{attempt.quiz.title}</h2>
            <p className="text-muted" style={{ marginTop: 6 }}>
              You answered <strong>{attempt.score}</strong> out of <strong>{attempt.totalQuestions}</strong> questions correctly ({attempt.percentage}%) · Completed {formatDate(attempt.submittedAt)}
            </p>
          </div>
          <div className="row">
            <button className="btn" onClick={() => navigate("/explore")}>Explore more quizzes</button>
            <button className="btn btn-primary" onClick={() => navigate("/subjects")}>Back to subjects</button>
          </div>
        </section>

        <section className="card card-pad chints-review-cta">
          <div className="row" style={{ gap: 14, flex: 1, minWidth: 240 }}>
            <span className="stat-icon"><Icon name="sparkle" size={22} /></span>
            <div>
              <h3 style={{ fontSize: 17 }}>
                {wrongCount > 0
                  ? "Would you like to see where you went wrong and what would have been the right answer with its explanation?"
                  : "Perfect score! Would you like Chints to explain the reasoning behind each answer?"}
              </h3>
              <p className="text-muted" style={{ fontSize: 13.5, marginTop: 3 }}>
                {wrongCount > 0
                  ? `You missed ${wrongCount} ${wrongCount === 1 ? "question" : "questions"}. Chints can break down why your choice was wrong and explain the right answer step by step.`
                  : "Ask Chints on the left panel or click below to review any question in detail."}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => askChints?.(wrongCount > 0 ? "Yes, explain where I went wrong!" : "Explain Q1")}
          >
            <Icon name="sparkle" size={16} /> {wrongCount > 0 ? "Yes, explain my wrong answers" : "Explain answers with Chints"}
          </button>
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h2>Answer breakdown</h2>
          {questions.map((q, idx) => (
            <div key={q.id} className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="row"><span className="q-number">Q{idx + 1}</span><strong>{q.prompt}</strong></div>
                <div className="row" style={{ gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => askChints?.(`Explain Q${idx + 1}`)}
                    title="Ask Chints to explain this question"
                  >
                    <Icon name="sparkle" size={14} /> {q.isCorrect ? "Ask Chints to explain" : "Ask Chints why I was wrong"}
                  </button>
                  <Badge kind={q.isCorrect ? "ok" : "danger"}>{q.isCorrect ? "Correct" : "Incorrect"}</Badge>
                </div>
              </div>
              <div className="answer-list">
                {q.options.map((opt, oIdx) => {
                  const selected = q.selectedOption === oIdx;
                  const correct = q.correctOption === oIdx;
                  const cls = ["answer", correct ? "correct" : "", selected && !correct ? "incorrect" : ""].filter(Boolean).join(" ");
                  return (
                    <div key={oIdx} className={cls}>
                      <span className="answer-key">{String.fromCharCode(65 + oIdx)}</span>
                      <span>{opt}</span>
                      {correct && <small>✓ Correct answer</small>}
                      {selected && !correct && <small>✕ Your choice</small>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">{attempt.quiz.category} · {attempt.quiz.difficulty}</p>
          <h1>{attempt.quiz.title}</h1>
        </div>
        <span className="text-muted">{saveNote || `${answeredCount} of ${questions.length} answered`}</span>
      </div>

      <div className="progress"><span style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }} /></div>
      <Alert kind="error" onClose={() => setError("")}>{error}</Alert>

      <div className="player">
        <div className="player-main">
          {currentQ && (
            <div className="card q-card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <Badge>Question {currentIdx + 1} of {questions.length}</Badge>
                {currentQ.selectedOption !== null && <Badge kind="ok">Answered</Badge>}
              </div>
              <div className="q-text">{currentQ.prompt}</div>
              <div className="answer-list">
                {currentQ.options.map((opt, oIdx) => {
                  const selected = currentQ.selectedOption === oIdx;
                  return (
                    <button key={oIdx} type="button" className={selected ? "answer selected" : "answer"} onClick={() => selectOption(currentQ.id, oIdx)}>
                      <span className="answer-key">{String.fromCharCode(65 + oIdx)}</span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
              <div className="player-nav" style={{ marginTop: "auto" }}>
                <button type="button" className="btn" disabled={currentIdx === 0} onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}>
                  <Icon name="arrowLeft" size={16} /> Previous
                </button>
                {currentIdx < questions.length - 1 ? (
                  <button type="button" className="btn btn-primary" onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}>
                    Next <Icon name="arrowRight" size={16} />
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary" disabled={submitting} onClick={() => handleSubmit(false)}>
                    <Icon name="check" size={16} /> {submitting ? "Submitting…" : "Submit quiz"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <aside className="sticky-side">
          <div className={remaining <= 60 ? "timer urgent" : "timer"} role="timer" aria-label="Time remaining">
            <Icon name="clock" size={26} /> {formatClock(remaining)}
          </div>

          <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>Question navigator</strong>
              <span className="text-muted" style={{ fontSize: 13 }}>{answeredCount}/{questions.length}</span>
            </div>
            <div className="navigator">
              {questions.map((q, idx) => {
                const cls = ["nav-dot", idx === currentIdx ? "current" : q.selectedOption !== null ? "answered" : ""].filter(Boolean).join(" ");
                return <button key={q.id} type="button" className={cls} onClick={() => setCurrentIdx(idx)}>{idx + 1}</button>;
              })}
            </div>
            <button type="button" className="btn btn-primary btn-lg" disabled={submitting || answeredCount < questions.length} onClick={() => handleSubmit(false)}>
              <Icon name="check" size={18} /> {submitting ? "Submitting…" : answeredCount < questions.length ? `Answer ${questions.length - answeredCount} more` : "Submit quiz"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

