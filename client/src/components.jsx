import { fetchPublicQuiz } from "./api.js";
import { Alert, Badge, Empty, Icon, Loading, copyQuizShareLink, navigate, useApp, useAsync, useToast } from "./ui.jsx";

export function QuizCard({ quiz, showStatus = false, children }) {
  const { startQuiz, startingQuizId } = useApp();
  const toast = useToast();
  const busy = startingQuizId === quiz.id;
  return (
    <article className="card quiz-card">
      <div className="card-top">
        <Badge>{quiz.category?.name || "General"}</Badge>
        <span className="row" style={{ gap: 6 }}>
          {showStatus && <Badge kind={quiz.isPublished ? "ok" : "draft"}>{quiz.isPublished ? "Published" : "Draft"}</Badge>}
          <Badge kind={quiz.difficulty}>{quiz.difficulty}</Badge>
        </span>
      </div>
      <h3>{quiz.title}</h3>
      <p>{quiz.description || "Test your knowledge with this quiz."}</p>
      <div className="meta">
        <span><Icon name="clock" size={16} /> {quiz.durationMinutes} min</span>
        <span><Icon name="list" size={16} /> {quiz.totalQuestions} questions</span>
        {quiz.source === "ai" && <span><Icon name="sparkle" size={16} /> Chints-drafted</span>}
        {quiz.creatorName && quiz.creatorName !== "System" && <span><Icon name="user" size={15} /> {quiz.creatorName}</span>}
      </div>
      <div className="card-foot">
        {children || (
          <div className="row" style={{ width: "100%", justifyContent: "space-between" }}>
            <button className="btn btn-primary" type="button" disabled={busy || !quiz.totalQuestions} onClick={() => startQuiz(quiz)}>
              <Icon name="play" size={16} /> {busy ? "Starting…" : "Start quiz"}
            </button>
            <button className="btn btn-sm" type="button" onClick={() => copyQuizShareLink(quiz, toast)} title="Copy direct link to share with students">
              <Icon name="share" size={15} /> Share
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

export function SharedQuizPage({ quizId }) {
  const { startQuiz, startingQuizId } = useApp();
  const toast = useToast();
  const { data, loading, error } = useAsync((signal) => fetchPublicQuiz(quizId, signal), [quizId]);
  const quiz = data?.quiz;
  const busy = startingQuizId === quizId;

  if (loading) return <div className="page"><Loading label="Loading shared quiz…" /></div>;
  if (error || !quiz) {
    return (
      <div className="page">
        <Alert kind="error">{error}</Alert>
        <Empty icon="list" title="This shared quiz isn't available" action={<button className="btn btn-primary" onClick={() => navigate("/explore")}>Browse quizzes</button>}>
          Make sure the author has published the quiz before sharing its link.
        </Empty>
      </div>
    );
  }

  return (
    <div className="page">
      <BackLink to="/explore">Explore catalog</BackLink>
      <section className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div className="row" style={{ gap: 8 }}>
          <Badge>{quiz.category?.name || "General"}</Badge>
          <Badge kind={quiz.difficulty}>{quiz.difficulty}</Badge>
          {quiz.source === "ai" && <Badge><Icon name="sparkle" size={13} /> Chints-drafted</Badge>}
        </div>
        <div>
          <p className="eyebrow">Shared Test Link</p>
          <h1 style={{ fontSize: 30, marginTop: 4 }}>{quiz.title}</h1>
          <p className="text-muted" style={{ marginTop: 8 }}>{quiz.description || "You've been invited to take this timed multiple-choice test."}</p>
        </div>
        <div className="meta" style={{ fontSize: 15 }}>
          <span><Icon name="clock" size={18} /> <strong>{quiz.durationMinutes} minutes</strong> duration</span>
          <span><Icon name="list" size={18} /> <strong>{quiz.totalQuestions} questions</strong></span>
          {quiz.creatorName && <span><Icon name="user" size={18} /> Shared by <strong>{quiz.creatorName}</strong></span>}
        </div>
        <div className="row" style={{ paddingTop: 6 }}>
          <button className="btn btn-primary btn-lg" disabled={busy || !quiz.totalQuestions} onClick={() => startQuiz(quiz)}>
            <Icon name="play" size={18} /> {busy ? "Starting test…" : "Start test now"}
          </button>
          <button className="btn btn-lg" onClick={() => copyQuizShareLink(quiz, toast)}>
            <Icon name="share" size={18} /> Copy share link
          </button>
        </div>
      </section>
    </div>
  );
}

export function PageHead({ eyebrow, title, subtitle, children }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="head-actions">{children}</div>}
    </div>
  );
}

export function BackLink({ to, children }) {
  return <button type="button" className="link-button" onClick={() => navigate(to)} style={{ display: "inline-flex", alignItems: "center", gap: 6, width: "fit-content" }}><Icon name="arrowLeft" size={16} /> {children}</button>;
}

export function scoreKind(percentage) {
  return percentage >= 70 ? "ok" : percentage >= 40 ? "warn" : "danger";
}
