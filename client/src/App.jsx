import { useEffect, useMemo, useRef, useState } from "react";
import { fetchCategories, fetchQuizzes, saveAttemptAnswers, startAttempt, submitAttempt } from "./api.js";
import AuthPanel from "./AuthPanel.jsx";
import AttemptPanel from "./AttemptPanel.jsx";

const PAGE_SIZE = 9;

function QuizCard({ quiz, signedIn, onStart, busy }) {
  const difficulty = quiz.difficulty || "beginner";
  return (
    <article className="quiz-card">
      <div className="card-topline">
        <span className="category-pill">{quiz.category?.name || "General"}</span>
        <span className={`difficulty difficulty-${difficulty}`}>{difficulty}</span>
      </div>
      <h2>{quiz.title}</h2>
      <p className="quiz-description">{quiz.description || "Test your knowledge with this quiz."}</p>
      <div className="quiz-meta">
        <span><span aria-hidden="true">◷</span> {quiz.durationMinutes} min</span>
        <span><span aria-hidden="true">▤</span> {quiz.totalQuestions} questions</span>
      </div>
      <button className="start-button" type="button" disabled={!signedIn || busy} onClick={() => onStart(quiz)} title={!signedIn ? "Sign in to start this quiz" : "Start a timed quiz attempt"}>
        {busy ? "Starting…" : signedIn ? "Start quiz" : "Sign in to start"} <span aria-hidden="true">→</span>
      </button>
    </article>
  );
}

export default function App() {
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [catalog, setCatalog] = useState({ quizzes: [], pagination: { page: 1, pages: 0, total: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [session, setSession] = useState(null);
  const [activeAttempt, setActiveAttempt] = useState(null);
  const [attemptBusy, setAttemptBusy] = useState(false);
  const [attemptError, setAttemptError] = useState("");
  const [saveState, setSaveState] = useState("");
  const saveTimer = useRef(null);
  const submitLock = useRef(false);

  useEffect(() => () => window.clearTimeout(saveTimer.current), []);
  useEffect(() => {
    if (!session) {
      window.clearTimeout(saveTimer.current);
      setActiveAttempt(null);
    }
  }, [session]);

  useEffect(() => {
    const controller = new AbortController();
    fetchCategories(controller.signal)
      .then((data) => setCategories(data.categories || []))
      .catch((err) => { if (err.name !== "AbortError") setError(err.message); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetchQuizzes({ category, search, page, limit: PAGE_SIZE }, controller.signal)
      .then(setCatalog)
      .catch((err) => { if (err.name !== "AbortError") setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [category, search, page]);

  const activeCategoryName = useMemo(
    () => categories.find((item) => item.slug === category)?.name,
    [categories, category]
  );

  function submitSearch(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function selectCategory(slug) {
    setCategory(slug);
    setPage(1);
  }

  async function beginAttempt(quiz) {
    if (!session || attemptBusy) return;
    setAttemptBusy(true);
    setAttemptError("");
    setSaveState("");
    submitLock.current = false;
    try {
      const data = await startAttempt(quiz.id, session.token);
      setActiveAttempt(data.attempt);
    } catch (err) {
      setAttemptError(err.message);
    } finally {
      setAttemptBusy(false);
    }
  }

  function changeAnswer(questionId, selectedOption) {
    if (!activeAttempt || activeAttempt.status !== "in-progress") return;
    const questions = activeAttempt.questions.map((question) => question.id === questionId ? { ...question, selectedOption } : question);
    const updatedAttempt = { ...activeAttempt, questions };
    setActiveAttempt(updatedAttempt);
    setSaveState("Saving answers…");
    setAttemptError("");
    window.clearTimeout(saveTimer.current);
    const answers = questions.map((question) => ({ questionId: question.id, selectedOption: question.selectedOption }));
    saveTimer.current = window.setTimeout(async () => {
      try {
        await saveAttemptAnswers(updatedAttempt.id, answers, session.token);
        setSaveState("Answers saved");
      } catch (err) {
        setSaveState("");
        setAttemptError(err.message);
      }
    }, 350);
  }

  async function handleSubmit(timedOut = false) {
    if (!activeAttempt || activeAttempt.status !== "in-progress" || submitLock.current) return;
    if (!timedOut && activeAttempt.questions.some((question) => question.selectedOption === null)) {
      setAttemptError("Answer every question before submitting.");
      return;
    }
    submitLock.current = true;
    window.clearTimeout(saveTimer.current);
    setAttemptBusy(true);
    setAttemptError("");
    setSaveState("");
    try {
      const answers = activeAttempt.questions.map((question) => ({ questionId: question.id, selectedOption: question.selectedOption }));
      const data = await submitAttempt(activeAttempt.id, answers, session.token);
      setActiveAttempt(data.attempt);
      setSaveState("");
    } catch (err) {
      setAttemptError(err.message);
      submitLock.current = false;
    } finally {
      setAttemptBusy(false);
    }
  }

  return (
    <main className="page-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Online Quiz System home"><span className="brand-mark">Q</span> Online Quiz System</a>
        <div className="header-actions"><span className="header-note">Learn something new today</span><AuthPanel session={session} onSessionChange={setSession} /></div>
      </header>

      {activeAttempt && <AttemptPanel
        attempt={activeAttempt}
        busy={attemptBusy}
        saveState={saveState}
        error={attemptError}
        onAnswerChange={changeAnswer}
        onSubmit={handleSubmit}
        onClose={() => { setActiveAttempt(null); setAttemptError(""); setSaveState(""); }}
      />}

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">YOUR NEXT CHALLENGE STARTS HERE</p>
          <h1>Curiosity looks<br /><span>good on you.</span></h1>
          <p className="hero-description">Explore topics, test what you know, and discover what you can learn next.</p>
          <form className="search-form" onSubmit={submitSearch}>
            <label className="sr-only" htmlFor="quiz-search">Search quizzes</label>
            <span aria-hidden="true" className="search-icon">⌕</span>
            <input id="quiz-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search topics or quizzes..." maxLength={100} />
            <button type="submit">Search</button>
          </form>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one"></div><div className="orbit orbit-two"></div>
          <div className="floating-card card-book">✦ <span>Keep exploring</span></div>
          <div className="hero-bubble"><span>Q</span></div>
          <div className="floating-card card-score"><strong>+1</strong><span>New thing learned</span></div>
        </div>
      </section>

      <section className="catalog-section" aria-labelledby="catalog-heading">
        <div className="section-heading">
          <div><p className="eyebrow">THE LIBRARY</p><h2 id="catalog-heading">Find your next <span>quiz.</span></h2></div>
          <p className="result-count">{catalog.pagination.total || 0} quizzes to explore</p>
        </div>

        <div className="category-list" aria-label="Filter quizzes by category">
          <button className={!category ? "category-filter active" : "category-filter"} onClick={() => selectCategory("")} type="button">All topics</button>
          {categories.map((item) => (
            <button key={item.id} className={category === item.slug ? "category-filter active" : "category-filter"} onClick={() => selectCategory(item.slug)} type="button">
              {item.name}
            </button>
          ))}
        </div>

        {activeCategoryName && <p className="filter-summary">Showing quizzes in <strong>{activeCategoryName}</strong></p>}
        {error && <div className="notice error-notice" role="alert"><strong>We couldn’t load the quiz library.</strong><span>{error}</span><button onClick={() => { setError(""); setPage(1); setSearch(search); }} type="button">Try again</button></div>}
        {loading ? <div className="empty-state" role="status"><span className="loader"></span><p>Finding your next challenge…</p></div> :
          !error && catalog.quizzes.length === 0 ? <div className="empty-state"><span className="empty-icon">⌕</span><h3>No quizzes found</h3><p>Try another search or choose a different topic.</p><button className="text-button" onClick={() => { setCategory(""); setSearch(""); setSearchInput(""); setPage(1); }} type="button">Clear filters</button></div> :
          !error && <div className="quiz-grid">{catalog.quizzes.map((quiz) => <QuizCard key={quiz.id} quiz={quiz} signedIn={Boolean(session)} busy={attemptBusy} onStart={beginAttempt} />)}</div>
        }

        {!loading && !error && catalog.pagination.pages > 1 && <nav className="pagination" aria-label="Quiz pages">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>← Previous</button>
          <span>Page {page} of {catalog.pagination.pages}</span>
          <button type="button" disabled={page >= catalog.pagination.pages} onClick={() => setPage((value) => value + 1)}>Next →</button>
        </nav>}
      </section>
      <footer className="site-footer"><a className="brand" href="/"><span className="brand-mark">Q</span> Online Quiz System</a><span>Small steps. Big discoveries.</span></footer>
    </main>
  );
}
