import { useEffect, useRef, useState } from "react";

function secondsRemaining(expiresAt) {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export default function AttemptPanel({ attempt, busy, saveState, error, onAnswerChange, onSubmit, onClose }) {
  const [remainingSeconds, setRemainingSeconds] = useState(() => secondsRemaining(attempt.expiresAt));
  const submitRef = useRef(onSubmit);
  const autoSubmitStarted = useRef(false);
  const isActive = attempt.status === "in-progress";
  const allAnswered = attempt.questions.every((question) => question.selectedOption !== null);

  useEffect(() => { submitRef.current = onSubmit; }, [onSubmit]);

  useEffect(() => {
    if (!isActive) return undefined;
    autoSubmitStarted.current = false;
    const update = () => {
      const seconds = secondsRemaining(attempt.expiresAt);
      setRemainingSeconds(seconds);
      if (seconds === 0 && !autoSubmitStarted.current) {
        autoSubmitStarted.current = true;
        submitRef.current(true);
      }
    };
    update();
    const timer = window.setInterval(update, 500);
    return () => window.clearInterval(timer);
  }, [attempt.expiresAt, attempt.id, isActive]);

  return <section className="attempt-panel" aria-labelledby="attempt-title">
    <div className="attempt-heading">
      <div>
        <p className="eyebrow">TIMED QUIZ</p>
        <h2 id="attempt-title">{attempt.quiz.title}</h2>
        <p className="attempt-meta">{attempt.questions.length} questions · {attempt.durationMinutes} minutes</p>
      </div>
      {isActive && <div className={remainingSeconds <= 60 ? "timer urgent" : "timer"} role="timer" aria-label="Time remaining">
        <span aria-hidden="true">◷</span> {formatTime(remainingSeconds)}
      </div>}
      {!isActive && <button type="button" className="text-button" onClick={onClose}>Back to quizzes</button>}
    </div>

    {error && <p className="attempt-error" role="alert">{error}</p>}

    {!isActive && <div className="result-summary" role="status">
      <span className="result-score">{attempt.score} / {attempt.totalQuestions}</span>
      <span>{attempt.percentage}% correct · {attempt.status === "timed-out" ? "Time expired" : "Submitted"}</span>
    </div>}

    <div className="attempt-questions">
      {attempt.questions.map((question, questionIndex) => (
        <fieldset className="attempt-question" key={question.id}>
          <legend><span>Question {questionIndex + 1}</span>{question.prompt}</legend>
          <div className="answer-options">
            {question.options.map((option, optionIndex) => {
              const selected = question.selectedOption === optionIndex;
              const isCorrect = !isActive && question.correctOption === optionIndex;
              const isWrongSelection = !isActive && selected && !question.isCorrect;
              const className = ["answer-option", selected ? "selected" : "", isCorrect ? "correct" : "", isWrongSelection ? "incorrect" : ""].filter(Boolean).join(" ");
              return isActive ? <label className={className} key={`${question.id}-${optionIndex}`}>
                <input type="radio" name={`answer-${question.id}`} checked={selected} onChange={() => onAnswerChange(question.id, optionIndex)} />
                <span>{option}</span>
              </label> : <div className={className} key={`${question.id}-${optionIndex}`}>
                <span className="answer-marker" aria-hidden="true">{isCorrect ? "✓" : isWrongSelection ? "×" : ""}</span>
                <span>{option}</span>
                {selected && <small>Your answer</small>}
                {isCorrect && !selected && <small>Correct answer</small>}
              </div>;
            })}
          </div>
        </fieldset>
      ))}
    </div>

    {isActive && <div className="attempt-footer">
      <span className="save-status" role="status">{saveState || `${attempt.questions.filter((question) => question.selectedOption !== null).length} of ${attempt.questions.length} answered`}</span>
      <button type="button" className="submit-attempt" onClick={() => onSubmit(false)} disabled={busy || (!allAnswered && remainingSeconds > 0)}>
        {busy ? "Submitting…" : remainingSeconds === 0 ? "Submit timed-out quiz" : "Submit quiz"}
      </button>
    </div>}
  </section>;
}
