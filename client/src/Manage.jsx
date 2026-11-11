import { useState } from "react";
import {
  createAdminCategory, deleteQuiz, fetchAdminCategories, fetchAdminOverview, fetchAdminResults, fetchAdminUsers,
  fetchMyAttempts, fetchMyQuizzes, patchQuiz, setUserRole, updateAdminCategory
} from "./api.js";
import { PageHead, scoreKind } from "./components.jsx";
import { Alert, Badge, Empty, Icon, Loading, copyQuizShareLink, formatDate, formatDay, navigate, useApp, useAsync, useToast } from "./ui.jsx";

export function MyQuizzes() {
  const { token, user, startQuiz, startingQuizId } = useApp();
  const toast = useToast();
  const [showAll, setShowAll] = useState(user.role === "admin");
  const { data, loading, error, reload } = useAsync((signal) => fetchMyQuizzes(token, { all: showAll && user.role === "admin" }, signal), [token, showAll, user.role]);
  const quizzes = data?.quizzes || [];

  async function togglePublish(quiz) {
    try {
      await patchQuiz(quiz.id, { isPublished: !quiz.isPublished }, token);
      toast(quiz.isPublished ? "Moved to drafts" : "Published — ready to share!");
      reload();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function remove(quiz) {
    if (!window.confirm(`Delete "${quiz.title}"?`)) return;
    try {
      await deleteQuiz(quiz.id, token);
      toast("Quiz deleted");
      reload();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  return (
    <div className="page">
      <PageHead
        eyebrow="Authoring & Sharing"
        title={showAll && user.role === "admin" ? "All Published & Student Quizzes" : "My Quizzes"}
        subtitle={
          user.role === "admin"
            ? "As a Teacher (Admin), you can view, edit, and share every quiz created by students or teachers."
            : "Quizzes you create or generate with Chints stay private to your account — click Share to copy a test link for others."
        }
      >
        {user.role === "admin" && (
          <div className="tabs">
            <button className={showAll ? "tab active" : "tab"} onClick={() => setShowAll(true)}>All accounts</button>
            <button className={!showAll ? "tab active" : "tab"} onClick={() => setShowAll(false)}>Created by me</button>
          </div>
        )}
        <button className="btn btn-primary" onClick={() => navigate("/create")}><Icon name="plus" size={16} /> Create quiz</button>
      </PageHead>

      <Alert kind="error">{error}</Alert>
      {loading ? <Loading /> : quizzes.length === 0 ? (
        <Empty icon="edit" title="No quizzes here yet"
          action={<button className="btn btn-primary" onClick={() => navigate("/create")}><Icon name="plus" size={16} /> Create your first quiz</button>}>
          Build a quiz manually or generate questions from a course syllabus using Chints AI.
        </Empty>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Subject / Unit</th>
                  <th>Questions</th>
                  <th>Status</th>
                  {showAll && <th>Created By</th>}
                  <th>Updated</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {quizzes.map((quiz) => (
                  <tr key={quiz.id}>
                    <td>
                      <strong>{quiz.title}</strong>
                      <div className="text-muted" style={{ fontSize: 12.5 }}>
                        {quiz.durationMinutes} min · {quiz.difficulty}
                        {quiz.source === "ai" ? " · Chints AI" : ""}
                      </div>
                    </td>
                    <td><Badge>{quiz.category?.name || "General"}</Badge></td>
                    <td>{quiz.subjectKey ? `${quiz.subjectKey} · U${(quiz.unitIndex ?? 0) + 1}` : "—"}</td>
                    <td>{quiz.questionCount}</td>
                    <td><Badge kind={quiz.isPublished ? "ok" : "draft"}>{quiz.isPublished ? "Published" : "Draft"}</Badge></td>
                    {showAll && <td>{quiz.creatorName || "System"}</td>}
                    <td>{formatDay(quiz.updatedAt)}</td>
                    <td>
                      <div className="actions-cell">
                        {quiz.isPublished && quiz.questionCount > 0 && (
                          <>
                            <button className="btn btn-sm btn-primary" onClick={() => copyQuizShareLink(quiz, toast)} title="Copy direct test link to share">
                              <Icon name="share" size={14} /> Share
                            </button>
                            <button className="btn btn-sm" disabled={startingQuizId === quiz.id} onClick={() => startQuiz(quiz)}>
                              <Icon name="play" size={14} /> Try
                            </button>
                          </>
                        )}
                        <button className="btn btn-sm" onClick={() => navigate(`/edit/${quiz.id}`)}><Icon name="edit" size={14} /> Edit</button>
                        <button className="btn btn-sm" onClick={() => togglePublish(quiz)}>{quiz.isPublished ? "Unpublish" : "Publish"}</button>
                        <button className="btn btn-sm btn-danger" onClick={() => remove(quiz)}><Icon name="trash" size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function History() {
  const { token } = useApp();
  const { data, loading, error } = useAsync((signal) => fetchMyAttempts(token, signal), [token]);
  const attempts = data?.attempts || [];

  return (
    <div className="page">
      <PageHead eyebrow="Progress" title="Attempt History" subtitle="Review your past scores and inspect question-by-question breakdowns." />
      <Alert kind="error">{error}</Alert>
      {loading ? <Loading /> : attempts.length === 0 ? (
        <Empty icon="history" title="No quiz attempts yet" action={<button className="btn btn-primary" onClick={() => navigate("/explore")}>Find a quiz</button>}>
          Start any quiz from Explore, your enrolled subjects, or a shared test link.
        </Empty>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Quiz</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Percentage</th>
                  <th>Started</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((a) => (
                  <tr key={a.id}>
                    <td><strong>{a.quiz.title}</strong></td>
                    <td><Badge>{a.quiz.category}</Badge></td>
                    <td><Badge kind={a.status}>{a.status}</Badge></td>
                    <td>{a.status === "in-progress" ? "—" : `${a.score} / ${a.totalQuestions}`}</td>
                    <td>{a.status === "in-progress" ? "—" : <Badge kind={scoreKind(a.percentage)}>{a.percentage}%</Badge>}</td>
                    <td>{formatDate(a.startedAt)}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn btn-sm btn-primary" onClick={() => navigate(`/attempt/${a.id}`)}>
                        {a.status === "in-progress" ? "Resume" : "Review answers"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminConsole() {
  const { token, user, startQuiz, startingQuizId } = useApp();
  const toast = useToast();
  const [tab, setTab] = useState("quizzes");
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");

  const { data, loading, error, reload } = useAsync(async (signal) => {
    const [overview, users, categories, results, allQuizzes] = await Promise.all([
      fetchAdminOverview(token, signal),
      fetchAdminUsers(token, signal),
      fetchAdminCategories(token, signal),
      fetchAdminResults(token, signal),
      fetchMyQuizzes(token, { all: true }, signal)
    ]);
    return { overview, users: users.users, categories: categories.categories, results: results.attempts, quizzes: allQuizzes.quizzes };
  }, [token]);

  if (user.role !== "admin") {
    return <div className="page"><Empty icon="shield" title="Teacher / Admin access required" /></div>;
  }

  async function changeRole(target, nextRole) {
    try {
      await setUserRole(target.id, nextRole, token);
      toast(`${target.email} is now ${nextRole === "admin" ? "Teacher (Admin)" : "Student"}`);
      reload();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function addCategory(event) {
    event.preventDefault();
    if (!catName.trim()) return;
    try {
      await createAdminCategory({ name: catName.trim(), description: catDesc.trim() }, token);
      setCatName("");
      setCatDesc("");
      toast("Category created");
      reload();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function toggleCategory(cat) {
    try {
      await updateAdminCategory(cat.id, { isActive: !cat.isActive }, token);
      toast(`${cat.name} ${cat.isActive ? "disabled" : "enabled"}`);
      reload();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function removeQuiz(quiz) {
    if (!window.confirm(`Delete "${quiz.title}"?`)) return;
    try {
      await deleteQuiz(quiz.id, token);
      toast("Quiz deleted");
      reload();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  return (
    <div className="page">
      <PageHead eyebrow="Teacher & Admin Console" title="Platform Administration" subtitle="View all student- and teacher-generated quizzes, share test links, inspect student results, and manage roles.">
        <button className="btn btn-primary" onClick={() => navigate("/create")}><Icon name="plus" size={16} /> Create & share quiz</button>
      </PageHead>

      <Alert kind="error">{error}</Alert>
      {loading || !data ? <Loading /> : (
        <>
          <section className="stats">
            <div className="card stat"><span className="stat-icon"><Icon name="users" /></span><div><b>{data.overview.users}</b><span>Total accounts ({data.overview.admins} teachers)</span></div></div>
            <div className="card stat"><span className="stat-icon"><Icon name="list" /></span><div><b>{data.overview.quizzes.published}</b><span>Published quizzes ({data.overview.quizzes.drafts} drafts)</span></div></div>
            <div className="card stat"><span className="stat-icon"><Icon name="check" /></span><div><b>{data.overview.attempts}</b><span>Completed attempts</span></div></div>
            <div className="card stat"><span className="stat-icon"><Icon name="award" /></span><div><b>{data.overview.averageScore}%</b><span>Platform average score</span></div></div>
          </section>

          <div className="toolbar">
            <div className="tabs">
              <button className={tab === "quizzes" ? "tab active" : "tab"} onClick={() => setTab("quizzes")}>All Created Quizzes ({data.quizzes.length})</button>
              <button className={tab === "results" ? "tab active" : "tab"} onClick={() => setTab("results")}>Student Results ({data.results.length})</button>
              <button className={tab === "categories" ? "tab active" : "tab"} onClick={() => setTab("categories")}>Categories ({data.categories.length})</button>
              <button className={tab === "users" ? "tab active" : "tab"} onClick={() => setTab("users")}>Students & Teachers ({data.users.length})</button>
            </div>
          </div>

          {tab === "quizzes" && (
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Quiz</th><th>Created By</th><th>Category / Unit</th><th>Questions</th><th>Status</th><th style={{ textAlign: "right" }}>Actions</th></tr>
                  </thead>
                  <tbody>
                    {data.quizzes.map((q) => (
                      <tr key={q.id}>
                        <td>
                          <strong>{q.title}</strong>
                          <div className="text-muted" style={{ fontSize: 12 }}>
                            {q.durationMinutes} min · {q.difficulty}{q.source === "ai" ? " · Chints AI" : ""}
                          </div>
                        </td>
                        <td><strong>{q.creatorName || "System"}</strong></td>
                        <td><Badge>{q.category?.name || "General"}</Badge>{q.subjectKey ? ` · ${q.subjectKey} U${(q.unitIndex ?? 0) + 1}` : ""}</td>
                        <td>{q.questionCount}</td>
                        <td><Badge kind={q.isPublished ? "ok" : "draft"}>{q.isPublished ? "Published" : "Draft"}</Badge></td>
                        <td>
                          <div className="actions-cell">
                            {q.isPublished && q.questionCount > 0 && (
                              <>
                                <button className="btn btn-sm btn-primary" onClick={() => copyQuizShareLink(q, toast)}>
                                  <Icon name="share" size={14} /> Share
                                </button>
                                <button className="btn btn-sm" disabled={startingQuizId === q.id} onClick={() => startQuiz(q)}>
                                  <Icon name="play" size={14} /> Try
                                </button>
                              </>
                            )}
                            <button className="btn btn-sm" onClick={() => navigate(`/edit/${q.id}`)}><Icon name="edit" size={14} /> Edit</button>
                            <button className="btn btn-sm btn-danger" onClick={() => removeQuiz(q)}><Icon name="trash" size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "results" && (
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Student</th><th>Quiz</th><th>Score</th><th>Percentage</th><th>Status</th><th>Submitted</th><th style={{ textAlign: "right" }}>Inspect</th></tr>
                  </thead>
                  <tbody>
                    {data.results.map((r) => (
                      <tr key={r.id}>
                        <td><strong>{r.user?.name || "User"}</strong><div className="text-muted" style={{ fontSize: 12 }}>{r.user?.email || ""}</div></td>
                        <td>{r.quiz.title}</td>
                        <td>{r.score} / {r.totalQuestions}</td>
                        <td><Badge kind={scoreKind(r.percentage)}>{r.percentage}%</Badge></td>
                        <td><Badge kind={r.status}>{r.status}</Badge></td>
                        <td>{formatDate(r.submittedAt || r.startedAt)}</td>
                        <td style={{ textAlign: "right" }}><button className="btn btn-sm" onClick={() => navigate(`/attempt/${r.id}`)}>View</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "categories" && (
            <div className="split">
              <div className="card">
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Name</th><th>Slug</th><th>Quizzes</th><th>Status</th><th style={{ textAlign: "right" }}>Action</th></tr></thead>
                    <tbody>
                      {data.categories.map((c) => (
                        <tr key={c.id}>
                          <td><strong>{c.name}</strong><div className="text-muted" style={{ fontSize: 12 }}>{c.description}</div></td>
                          <td><code>{c.slug}</code></td>
                          <td>{c.quizCount}</td>
                          <td><Badge kind={c.isActive ? "ok" : "danger"}>{c.isActive ? "Active" : "Disabled"}</Badge></td>
                          <td style={{ textAlign: "right" }}>
                            <button className="btn btn-sm" onClick={() => toggleCategory(c)}>{c.isActive ? "Disable" : "Enable"}</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <form className="card card-pad" onSubmit={addCategory} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <h3>New category</h3>
                <label className="field">Name *<input value={catName} onChange={(e) => setCatName(e.target.value)} minLength={2} maxLength={80} required /></label>
                <label className="field">Description<textarea rows={3} value={catDesc} onChange={(e) => setCatDesc(e.target.value)} maxLength={500} /></label>
                <button className="btn btn-primary" type="submit"><Icon name="plus" size={16} /> Add category</button>
              </form>
            </div>
          )}

          {tab === "users" && (
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th style={{ textAlign: "right" }}>Role action</th></tr></thead>
                  <tbody>
                    {data.users.map((u) => (
                      <tr key={u.id}>
                        <td><strong>{u.name}</strong></td>
                        <td>{u.email}</td>
                        <td><Badge kind={u.role === "admin" ? "ok" : ""}>{u.role === "admin" ? "Teacher (Admin)" : "Student"}</Badge></td>
                        <td>{formatDay(u.createdAt)}</td>
                        <td style={{ textAlign: "right" }}>
                          {u.id !== user.id && (
                            <button className="btn btn-sm" onClick={() => changeRole(u, u.role === "admin" ? "user" : "admin")}>
                              {u.role === "admin" ? "Switch to Student" : "Promote to Teacher"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
