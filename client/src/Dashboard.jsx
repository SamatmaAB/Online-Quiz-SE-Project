import { fetchMyAttempts, fetchQuizzes, fetchSubjects } from "./api.js";
import { BackLink, PageHead, QuizCard, scoreKind } from "./components.jsx";
import { Alert, Badge, Empty, Icon, Loading, formatDate, hueFor, navigate, subjectBadge, useApp, useAsync } from "./ui.jsx";

export default function Dashboard() {
  const { token, user } = useApp();
  const { data, loading, error, reload } = useAsync(async (signal) => {
    const [subjects, attempts, quizzes] = await Promise.all([
      fetchSubjects(token, signal), fetchMyAttempts(token, signal), fetchQuizzes({ limit: 6, token }, signal)
    ]);
    return { subjects: subjects.subjects, attempts: attempts.attempts, quizzes: quizzes.quizzes };
  }, [token]);

  if (loading) return <div className="page"><Loading /></div>;
  if (error) return <div className="page"><Alert kind="error">{error}</Alert></div>;

  const { subjects, attempts, quizzes } = data;
  const finished = attempts.filter((attempt) => attempt.status !== "in-progress");
  const inProgress = attempts.find((attempt) => attempt.status === "in-progress");
  const average = finished.length ? finished.reduce((sum, attempt) => sum + attempt.percentage, 0) / finished.length : 0;
  const best = finished.reduce((max, attempt) => Math.max(max, attempt.percentage), 0);
  const enrolled = subjects.filter((subject) => subject.status === "enrolled");
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="page">
      <section className="hero">
        <div>
          <p className="eyebrow" style={{ color: "rgba(255,255,255,.8)" }}>Dashboard</p>
          <h1>{greeting}, {user.name.split(" ")[0]} 👋</h1>
          <p>{finished.length ? `You've completed ${finished.length} quiz${finished.length === 1 ? "" : "zes"} with a ${Math.round(average)}% average. Keep the streak going.` : "Ready for your first quiz? Pick a subject, or build a quiz of your own."}</p>
          <div className="hero-actions">
            {inProgress
              ? <button className="btn" type="button" onClick={() => navigate(`/attempt/${inProgress.id}`)}><Icon name="play" size={16} /> Resume “{inProgress.quiz.title}”</button>
              : <button className="btn" type="button" onClick={() => navigate("/explore")}><Icon name="compass" size={16} /> Explore quizzes</button>}
            <button className="btn btn-outline" type="button" onClick={() => navigate("/create")}><Icon name="plus" size={16} /> Create a quiz</button>
          </div>
        </div>
        <Icon name="award" size={120} stroke={1.2} className="hero-art" />
      </section>

      <section className="stats">
        <div className="card stat"><span className="stat-icon"><Icon name="check" /></span><div><b>{finished.length}</b><span>Quizzes completed</span></div></div>
        <div className="card stat"><span className="stat-icon"><Icon name="target" /></span><div><b>{Math.round(average)}%</b><span>Average score</span></div></div>
        <div className="card stat"><span className="stat-icon"><Icon name="award" /></span><div><b>{Math.round(best)}%</b><span>Best score</span></div></div>
        <div className="card stat"><span className="stat-icon"><Icon name="book" /></span><div><b>{enrolled.length}</b><span>Subjects enrolled</span></div></div>
      </section>

      <div className="split">
        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <section>
            <div className="card-title"><h2>Your subjects</h2><button className="link-button" onClick={() => navigate("/subjects")}>Manage subjects →</button></div>
            {enrolled.length === 0
              ? <Empty icon="book" title="No subjects yet" action={<button className="btn btn-primary" onClick={() => navigate("/subjects")}>Choose subjects</button>}>Enroll in a subject to unlock its units and quizzes.</Empty>
              : <div className="grid-auto">{enrolled.map((subject) => (
                <button key={subject.key} className="card subject-card" style={{ "--hue": hueFor(subject.key), textAlign: "left" }} onClick={() => navigate(`/subjects/${encodeURIComponent(subject.key)}`)}>
                  <span className="subject-icon">{subjectBadge(subject)}</span>
                  <h3>{subject.name}</h3>
                  <p className="text-muted">{subject.units?.length || 0} units · {subject.code || (subject.isCustom ? "Custom" : "Course")}</p>
                </button>
              ))}</div>}
          </section>

          <section>
            <div className="card-title"><h2>Fresh quizzes</h2><button className="link-button" onClick={() => navigate("/explore")}>See all →</button></div>
            {quizzes.length === 0
              ? <Empty icon="list" title="No quizzes published yet" action={<button className="btn btn-primary" onClick={() => navigate("/create")}>Create the first one</button>}>Be the first to publish a quiz.</Empty>
              : <div className="grid-auto">{quizzes.map((quiz) => <QuizCard key={quiz.id} quiz={quiz} onDeleted={reload} />)}</div>}
          </section>
        </div>

        <aside className="card card-pad">
          <div className="card-title"><h3>Recent activity</h3><button className="link-button" onClick={() => navigate("/history")}>History →</button></div>
          {attempts.length === 0
            ? <p className="text-muted">Nothing yet — your attempts will show up here.</p>
            : <div className="list">{attempts.slice(0, 7).map((attempt) => (
              <button key={attempt.id} className="list-row" style={{ background: "none", border: 0, borderTop: "1px solid var(--border)", textAlign: "left", width: "100%", color: "inherit" }} onClick={() => navigate(`/attempt/${attempt.id}`)}>
                <div className="grow"><b>{attempt.quiz.title}</b><small>{formatDate(attempt.startedAt)}</small></div>
                {attempt.status === "in-progress" ? <Badge kind="in-progress">In progress</Badge> : <Badge kind={scoreKind(attempt.percentage)}>{attempt.score}/{attempt.totalQuestions}</Badge>}
              </button>
            ))}</div>}
        </aside>
      </div>
    </div>
  );
}

export { BackLink };

