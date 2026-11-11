import { deleteQuiz, fetchPublicQuiz } from "./api.js";
import { Alert, Badge, Empty, Icon, Loading, copyQuizShareLink, navigate, useApp, useAsync, useToast } from "./ui.jsx";

/** Asks for confirmation, deletes a quiz and reports the result. Resolves true when the quiz was removed. */
export async function confirmDeleteQuiz(quiz, token, toast) {
  if (!window.confirm(`Delete "${quiz.title}"? This permanently removes the quiz and its questions. Past attempt results are kept.`)) return false;
  try {
    await deleteQuiz(quiz.id, token);
    toast("Quiz deleted");
    return true;
  } catch (err) {
    toast(err.message, "error");
    return false;
  }
}

export function QuizCard({ quiz, showStatus = false, onDeleted, children }) {
  const { token, user, startQuiz, startingQuizId } = useApp();
  const toast = useToast();
  const busy = startingQuizId === quiz.id;
  const canManage = Boolean(onDeleted) && (quiz.isMine || user?.role === "admin");
  async function remove() {
    if (await confirmDeleteQuiz(quiz, token, toast)) onDeleted();
  }
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
        <span><Icon name="list" size={16} /> {quiz.totalQuestions} {quiz.totalQuestions === 1 ? "question" : "questions"}</span>
        {quiz.source === "ai" && <span><Icon name="sparkle" size={16} /> Chints-drafted</span>}
        {quiz.creatorName && quiz.creatorName !== "System" && <span><Icon name="user" size={15} /> {quiz.creatorName}</span>}
      </div>
      <div className="card-foot">
        {children || (
          <div className="row" style={{ width: "100%", justifyContent: "space-between" }}>
            <button className="btn btn-primary" type="button" disabled={busy || !quiz.totalQuestions} onClick={() => startQuiz(quiz)}>
              <Icon name="play" size={16} /> {busy ? "Starting…" : "Start quiz"}
            </button>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn btn-sm" type="button" onClick={() => copyQuizShareLink(quiz, toast)} title="Copy direct link to share with students">
                <Icon name="share" size={15} /> Share
              </button>
              {canManage && <button className="btn btn-sm" type="button" onClick={() => navigate(`/edit/${quiz.id}`)}><Icon name="edit" size={14} /> Edit</button>}
              {canManage && <button className="btn btn-sm btn-danger" type="button" onClick={remove} title="Delete this quiz"><Icon name="trash" size={14} /> Delete</button>}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
// Stage 1
