
import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";

const API = "http://localhost:5000/api";

function App() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [quizError, setQuizError] = useState("");

  const [token, setToken] = useState(
    () => localStorage.getItem("quizToken") || ""
  );
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("quizUser") || "null");
    } catch {
      return null;
    }
  });

  const [authMode, setAuthMode] = useState("");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [attempt, setAttempt] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [resultError, setResultError] = useState("");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [page, setPage] = useState("quizzes");

  const submitLock = useRef(false);

  const apiRequest = useCallback(
    async (path, options = {}) => {
      const headers = {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      };

      const response = await fetch(`${API}${path}`, {
        ...options,
        headers,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Something went wrong.");
      }

      return data;
    },
    [token]
  );

  const loadQuizzes = useCallback(async () => {
    try {
      const data = await apiRequest("/quizzes");
      setQuizzes(data.quizzes || []);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  useEffect(() => {
    loadQuizzes();
  }, [loadQuizzes]);

  async function openQuiz(quiz) {
    setSelectedQuiz(quiz);
    setQuestions([]);
    setAnswers({});
    setAttempt(null);
    setResult(null);
    setQuizError("");
    setResultError("");
    setPage("quiz");
    setLoadingQuiz(true);

    try {
      const data = await apiRequest(`/quizzes/${quiz.id}`);
      const quizData = data.quiz || data;
      setSelectedQuiz(quizData);
      setQuestions(quizData.questions || []);
    } catch (err) {
      setQuizError(err.message);
    } finally {
      setLoadingQuiz(false);
    }
  }

  async function handleAuth(event) {
    event.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    try {
      const endpoint = authMode === "register" ? "register" : "login";
      const body =
        authMode === "register"
          ? authForm
          : { email: authForm.email, password: authForm.password };

      const data = await apiRequest(`/auth/${endpoint}`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      localStorage.setItem("quizToken", data.token);
      localStorage.setItem("quizUser", JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      setAuthMode("");
      setAuthForm({ name: "", email: "", password: "" });
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("quizToken");
    localStorage.removeItem("quizUser");
    setToken("");
    setUser(null);
    setAttempt(null);
    setResult(null);
    setAnswers({});
    setPage("quizzes");
  }

  async function startQuiz() {
    if (!token) {
      setAuthMode("login");
      setAuthError("Please log in before starting a quiz.");
      return;
    }

    try {
      setQuizError("");
      setSubmitting(false);
      submitLock.current = false;

      const data = await apiRequest(
        `/quizzes/${selectedQuiz.id}/attempts`,
        { method: "POST" }
      );

      setAttempt(data.attempt);
      setAnswers({});
      setResult(null);
      setPage("quiz");
      setSecondsLeft(
        Math.max(
          0,
          Math.ceil(
            (new Date(data.attempt.deadline).getTime() - Date.now()) / 1000
          )
        )
      );
    } catch (err) {
      setQuizError(err.message);
    }
  }

  const submitQuiz = useCallback(
    async (automatic = false) => {
      if (!attempt || submitLock.current) return;

      submitLock.current = true;
      setSubmitting(true);
      setQuizError("");

      try {
        const submittedAnswers = questions
          .filter((question) => {
            const id = question._id || question.id;
            return answers[id] !== undefined;
          })
          .map((question) => ({
            questionId: question._id || question.id,
            selectedOption: answers[question._id || question.id],
          }));

        await apiRequest(`/attempts/${attempt.id}/submit`, {
          method: "POST",
          body: JSON.stringify({ answers: submittedAnswers }),
        });

        const data = await apiRequest(`/attempts/${attempt.id}`);
        setResult(data.result || data.attempt || data);
        setAttempt(null);
        setPage("result");
        setResultError("");
      } catch (err) {
        setQuizError(err.message);
        submitLock.current = false;
      } finally {
        setSubmitting(false);
      }
    },
    [attempt, questions, answers, apiRequest]
  );

  useEffect(() => {
    if (!attempt || page !== "quiz") return undefined;

    const updateTimer = () => {
      const remaining = Math.max(
        0,
        Math.ceil(
          (new Date(attempt.deadline).getTime() - Date.now()) / 1000
        )
      );

      setSecondsLeft(remaining);

      if (remaining === 0) {
        submitQuiz(true);
      }
    };

    updateTimer();
    const timerId = setInterval(updateTimer, 1000);
    return () => clearInterval(timerId);
  }, [attempt, page, submitQuiz]);

  async function loadHistory() {
    if (!token) {
      setAuthMode("login");
      setAuthError("Please log in to view your previous attempts.");
      return;
    }

    setPage("history");
    setHistoryLoading(true);
    setHistoryError("");

    try {
      const data = await apiRequest("/attempts/mine");
      setHistory(data.attempts || []);
    } catch (err) {
      setHistoryError(err.message);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function openResult(attemptId) {
    try {
      const data = await apiRequest(`/attempts/${attemptId}`);
      setResult(data.result || data.attempt || data);
      setResultError("");
      setPage("result");
    } catch (err) {
      setResultError(err.message);
      setPage("result");
    }
  }

  function backToQuizzes() {
    setPage("quizzes");
    setSelectedQuiz(null);
    setQuestions([]);
    setAnswers({});
    setAttempt(null);
    setResult(null);
    setQuizError("");
    submitLock.current = false;
  }

  function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  if (authMode) {
    return (
      <main className="page">
        <button className="start-button" onClick={() => setAuthMode("")}>
          â† Back
        </button>

        <section className="quiz-section">
          <h1>{authMode === "register" ? "Create Account" : "Login"}</h1>
          <p>
            {authMode === "register"
              ? "Register to start quizzes and save your results."
              : "Log in to start quizzes and view your attempts."}
          </p>

          <form onSubmit={handleAuth} className="quiz-card">
            {authMode === "register" && (
              <label>
                Full name
                <input
                  required
                  minLength={2}
                  maxLength={80}
                  value={authForm.name}
                  onChange={(e) =>
                    setAuthForm({ ...authForm, name: e.target.value })
                  }
                />
              </label>
            )}

            <label>
              Email
              <input
                required
                type="email"
                value={authForm.email}
                onChange={(e) =>
                  setAuthForm({ ...authForm, email: e.target.value })
                }
              />
            </label>

            <label>
              Password
              <input
                required
                type="password"
                minLength={8}
                maxLength={72}
                value={authForm.password}
                onChange={(e) =>
                  setAuthForm({ ...authForm, password: e.target.value })
                }
              />
            </label>

            {authError && <p className="error">{authError}</p>}

            <button className="start-button" disabled={authLoading}>
              {authLoading
                ? "Please wait..."
                : authMode === "register"
                  ? "Register"
                  : "Login"}
            </button>

            <p>
              {authMode === "login"
                ? "Don't have an account?"
                : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === "login" ? "register" : "login");
                  setAuthError("");
                }}
              >
                {authMode === "login" ? "Register" : "Login"}
              </button>
            </p>
          </form>
        </section>
      </main>
    );
  }

  if (page === "result") {
    const percentage =
      result?.totalPoints > 0
        ? Math.round((result.score / result.totalPoints) * 100)
        : result?.percentage;

    return (
      <main className="page">
        <button className="start-button" onClick={backToQuizzes}>
          â† Back to quizzes
        </button>
        <section className="quiz-section">
          <h1>Quiz Results</h1>
          {resultError && <p className="error">{resultError}</p>}

          {result && (
            <>
              <h2>{result.quiz?.title || selectedQuiz?.title || "Completed Quiz"}</h2>
              <p>
                Score: {result.score ?? 0} / {result.totalPoints ?? 0}
              </p>
              {percentage !== undefined && (
                <h2>{percentage}%</h2>
              )}
              <p>
                Correct answers:{" "}
                {result.answers?.filter((answer) => answer.isCorrect).length ??
                  result.correctAnswers ??
                  "See your results below"}
              </p>

              {(result.questions || []).map((question, index) => (
                <article className="quiz-card" key={question.id || question._id || index}>
                  <h3>{index + 1}. {question.prompt}</h3>
                  <p>
                    Your answer:{" "}
                    {question.options?.[question.selectedOption] ??
                      "Not answered"}
                  </p>
                  <p>
                    Correct answer:{" "}
                    {question.options?.[question.correctOption] ??
                      "Not available"}
                  </p>
                  <p>{question.isCorrect ? "Correct" : "Incorrect"}</p>
                </article>
              ))}
            </>
          )}

          <button className="start-button" onClick={loadHistory}>
            View Previous Attempts
          </button>
        </section>
      </main>
    );
  }

  if (page === "history") {
    return (
      <main className="page">
        <button className="start-button" onClick={backToQuizzes}>
          â† Back to quizzes
        </button>
        <section className="quiz-section">
          <h1>Previous Quiz Attempts</h1>
          {historyLoading && <p className="status">Loading attempts...</p>}
          {historyError && <p className="error">{historyError}</p>}
          {!historyLoading && !historyError && history.length === 0 && (
            <p className="status">You have no previous attempts yet.</p>
          )}

          {history.map((item) => (
            <article className="quiz-card" key={item.id || item._id}>
              <h3>{item.quiz?.title || item.quizTitle || "Quiz attempt"}</h3>
              <p>Status: {item.status}</p>
              <p>
                Score: {item.score ?? 0} / {item.totalPoints ?? 0}
              </p>
              <p>
                Date:{" "}
                {item.submittedAt
                  ? new Date(item.submittedAt).toLocaleString()
                  : item.createdAt
                    ? new Date(item.createdAt).toLocaleString()
                    : "Not available"}
              </p>
              {(item.status === "submitted" || item.status === "expired") && (
                <button
                  className="start-button"
                  onClick={() => openResult(item.id || item._id)}
                >
                  View Results
                </button>
              )}
            </article>
          ))}
        </section>
      </main>
    );
  }

  if (selectedQuiz) {
    return (
      <main className="page">
        <button className="start-button" onClick={backToQuizzes}>
          â† Back to quizzes
        </button>

        <header className="hero">
          <p className="eyebrow">PES UNIVERSITY | SEMESTER 5</p>
          <h1>{selectedQuiz.title}</h1>
          <p>{selectedQuiz.description}</p>
          <p>Course Code: {selectedQuiz.courseCode || "N/A"}</p>
          <p>Duration: {selectedQuiz.durationMinutes || 5} minutes</p>
        </header>

        {user && (
          <p className="status">
            Logged in as {user.name} ({user.email})
            {" Â· "}
            <button onClick={logout}>Logout</button>
          </p>
        )}

        {loadingQuiz && <p className="status">Loading questions...</p>}
        {quizError && <p className="error">{quizError}</p>}

        {!loadingQuiz && !quizError && questions.length === 0 && (
          <p className="status">No questions are available in this quiz.</p>
        )}

        {!loadingQuiz && questions.length > 0 && (
          <section className="quiz-section">
            <h2>Quiz Questions</h2>

            {!attempt && !result && (
              <>
                <p>
                  {questions.length} questions. Start when you are ready.
                </p>
                <button className="start-button" onClick={startQuiz}>
                  Start Quiz
                </button>
              </>
            )}

            {attempt && (
              <>
                <h2 className="timer-heading">⏱️ Time remaining: {formatTime(secondsLeft)}</h2>
                <p>
                  Answered {Object.keys(answers).length} of {questions.length}
                  {" "}questions.
                </p>

                {questions.map((question, index) => {
                  const id = question._id || question.id || String(index);

                  return (
                    <article className="quiz-card" key={id}>
                      <h3>{index + 1}. {question.prompt}</h3>
                      {(question.options || []).map((option, optionIndex) => (
                        <label
                          key={optionIndex}
                          style={{
                            display: "block",
                            padding: "10px",
                            margin: "8px 0",
                            border: "1px solid #ddd",
                            borderRadius: "6px",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="radio"
                            name={`question-${id}`}
                            checked={answers[id] === optionIndex}
                            disabled={submitting}
                            onChange={() =>
                              setAnswers((previous) => ({
                                ...previous,
                                [id]: optionIndex,
                              }))
                            }
                          />{" "}
                          {option}
                        </label>
                      ))}
                    </article>
                  );
                })}

                <button
                  className="start-button"
                  disabled={submitting}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Are you sure you want to submit your answers?"
                      )
                    ) {
                      submitQuiz(false);
                    }
                  }}
                >
                  {submitting ? "Submitting..." : "Submit Quiz"}
                </button>
              </>
            )}

            {quizError && <p className="error">{quizError}</p>}
          </section>
        )}
      </main>
    );
  }

  return (
    <main className="page">
      <header className="hero">
        <p className="eyebrow">PES UNIVERSITY | SEMESTER 5</p>
        <h1>Available Quizzes</h1>
        <p>
          Select a subject and prepare for your semester exams with
          subject-wise quizzes.
        </p>

        <div>
          {user ? (
            <>
              <span>Welcome, {user.name} </span>
              <button onClick={logout}>Logout</button>
              {" "}
              <button className="start-button" onClick={loadHistory}>
                Previous Attempts
              </button>
            </>
          ) : (
            <>
              <button
                className="start-button"
                onClick={() => {
                  setAuthMode("login");
                  setAuthError("");
                }}
              >
                Login
              </button>
              {" "}
              <button onClick={() => {
                setAuthMode("register");
                setAuthError("");
              }}>
                Register
              </button>
            </>
          )}
        </div>
      </header>

      <section className="quiz-section">
        <div className="section-heading">
          <h2>Explore Your Subjects</h2>
          {!loading && !error && (
            <span>{quizzes.length} quizzes available</span>
          )}
        </div>

        {loading && <p className="status">Loading quizzes...</p>}
        {error && <p className="error">{error}</p>}

        {!loading && !error && quizzes.length === 0 && (
          <p className="status">No quizzes are available right now.</p>
        )}

        {!loading && !error && quizzes.length > 0 && (
          <div className="quiz-grid">
            {quizzes.map((quiz) => (
              <article className="quiz-card" key={quiz.id}>
                <span className="category">{quiz.category}</span>
                <h3>{quiz.title}</h3>
                <p className="course-code">Course Code: {quiz.courseCode}</p>
                <p className="description">{quiz.description}</p>
                <p>Duration: {quiz.durationMinutes} minutes</p>
                <button
                  className="start-button"
                  onClick={() => openQuiz(quiz)}
                >
                  View Quiz â†’
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default App;

