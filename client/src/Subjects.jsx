import { useState } from "react";
import { createSubject, deleteCustomSubject, fetchSubjects, fetchUnitQuizzes, updateSubjectState } from "./api.js";
import { BackLink, PageHead, QuizCard } from "./components.jsx";
import { Alert, Badge, Empty, Icon, Loading, Modal, copyQuizShareLink, hueFor, navigate, subjectBadge, useApp, useAsync, useToast } from "./ui.jsx";

export function SubjectsList() {
  const { token } = useApp();
  const toast = useToast();
  const [tab, setTab] = useState("enrolled");
  const [showAdd, setShowAdd] = useState(false);
  const [busyKey, setBusyKey] = useState("");
  const [form, setForm] = useState({ name: "", code: "", courseType: "CC", syllabusText: "" });
  const [formError, setFormError] = useState("");

  const { data, loading, error, reload } = useAsync((signal) => fetchSubjects(token, signal), [token]);
  const subjects = data?.subjects || [];

  const enrolled = subjects.filter((s) => s.status === "enrolled");
  const available = subjects.filter((s) => s.status === "available");
  const dropped = subjects.filter((s) => s.status === "dropped");
  const shown = tab === "enrolled" ? enrolled : tab === "available" ? available : tab === "dropped" ? dropped : subjects;

  async function setState(subject, status) {
    setBusyKey(subject.key);
    try {
      await updateSubjectState(subject.key, status, token);
      toast(status === "enrolled" ? `Enrolled in ${subject.name}` : `Updated ${subject.name}`);
      reload();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusyKey("");
    }
  }

  async function removeCustom(subject) {
    if (!window.confirm(`Delete custom subject "${subject.name}" and its quizzes?`)) return;
    setBusyKey(subject.key);
    try {
      await deleteCustomSubject(subject.key, token);
      toast(`Deleted ${subject.name}`);
      reload();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusyKey("");
    }
  }

  async function handleAdd(event) {
    event.preventDefault();
    setBusyKey("add");
    setFormError("");
    try {
      const res = await createSubject(form, token);
      setShowAdd(false);
      setForm({ name: "", code: "", courseType: "CC", syllabusText: "" });
      toast(`Created ${res.subject.name}`);
      navigate(`/subjects/${encodeURIComponent(res.subject.key)}`);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusyKey("");
    }
  }

  return (
    <div className="page">
      <PageHead eyebrow="Curriculum" title="Subjects & Syllabi" subtitle="Enroll in built-in courses or paste your own syllabus to generate structured units and topics.">
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Icon name="plus" size={16} /> Add custom subject</button>
      </PageHead>

      <div className="toolbar">
        <div className="tabs">
          <button className={tab === "enrolled" ? "tab active" : "tab"} onClick={() => setTab("enrolled")}>Enrolled ({enrolled.length})</button>
          <button className={tab === "available" ? "tab active" : "tab"} onClick={() => setTab("available")}>Catalog ({available.length})</button>
          <button className={tab === "all" ? "tab active" : "tab"} onClick={() => setTab("all")}>All ({subjects.length})</button>
          {dropped.length > 0 && <button className={tab === "dropped" ? "tab active" : "tab"} onClick={() => setTab("dropped")}>Dropped ({dropped.length})</button>}
        </div>
      </div>

      <Alert kind="error">{error}</Alert>
      {loading ? <Loading /> : shown.length === 0 ? (
        <Empty icon="book" title={tab === "enrolled" ? "You haven't enrolled in any subjects yet" : "No subjects in this view"}
          action={tab === "enrolled" && available.length > 0 ? <button className="btn btn-primary" onClick={() => setTab("available")}>Browse available courses</button> : <button className="btn btn-primary" onClick={() => setShowAdd(true)}>Add custom subject</button>}>
          Enroll in a course from the catalog or add your own syllabus text.
        </Empty>
      ) : (
        <div className="grid-wide">
          {shown.map((subject) => (
            <article key={subject.key} className="card subject-card" style={{ "--hue": hueFor(subject.key) }}>
              <div className="card-top">
                <div className="row">
                  <span className="subject-icon">{subjectBadge(subject)}</span>
                  <div>
                    <span className="code">{subject.code || (subject.isCustom ? "CUSTOM" : "COURSE")} · {subject.courseType || "Core"}</span>
                    <h3>{subject.name}</h3>
                  </div>
                </div>
                <Badge kind={subject.status}>{subject.status}</Badge>
              </div>
              <p className="text-muted">{subject.description || `${subject.units?.length || 0} structured syllabus units ready for study and practice quizzes.`}</p>
              <div className="meta">
                <span><Icon name="layers" size={16} /> {subject.units?.length || 0} units</span>
                <span><Icon name="list" size={16} /> {(subject.units || []).reduce((n, u) => n + (u.topics?.length || 0), 0)} topics</span>
                {subject.isCustom && <Badge>Personal</Badge>}
              </div>
              <div className="card-foot">
                {subject.status === "enrolled" ? (
                  <>
                    <button className="btn btn-primary" onClick={() => navigate(`/subjects/${encodeURIComponent(subject.key)}`)}>Open units <Icon name="arrowRight" size={16} /></button>
                    <div className="row" style={{ gap: 6 }}>
                      <button className="btn btn-sm" disabled={busyKey === subject.key} onClick={() => setState(subject, "dropped")}>Drop</button>
                      {subject.isCustom && <button className="btn btn-sm btn-danger" disabled={busyKey === subject.key} onClick={() => removeCustom(subject)}><Icon name="trash" size={15} /></button>}
                    </div>
                  </>
                ) : (
                  <>
                    <button className="btn btn-primary" disabled={busyKey === subject.key} onClick={() => setState(subject, "enrolled")}>
                      <Icon name="plus" size={16} /> {busyKey === subject.key ? "Enrolling…" : "Enroll now"}
                    </button>
                    {subject.isCustom && <button className="btn btn-sm btn-danger" disabled={busyKey === subject.key} onClick={() => removeCustom(subject)}><Icon name="trash" size={15} /></button>}
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {showAdd && (
        <Modal title="Add a custom subject" onClose={() => setShowAdd(false)} wide>
          <Alert kind="error">{formError}</Alert>
          <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="form-grid">
              <label className="field">Subject name *<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Operating Systems" minLength={2} maxLength={100} required /></label>
              <label className="field">Course code<input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. UE24CS353A" maxLength={40} /></label>
              <label className="field">Course type<input value={form.courseType} onChange={(e) => setForm({ ...form, courseType: e.target.value })} placeholder="CC / EC / Lab" maxLength={40} /></label>
            </div>
            <label className="field">
              Syllabus text *
              <textarea rows={9} value={form.syllabusText} onChange={(e) => setForm({ ...form, syllabusText: e.target.value })} required minLength={10} maxLength={20000}
                placeholder={"Unit 1: Processes & Threads\n- Process concept and states\n- CPU scheduling algorithms\n- Threads and concurrency\n\nUnit 2: Synchronization & Deadlocks\n- Critical section problem\n- Semaphores and mutexes\n- Deadlock prevention and avoidance"} />
              <small>Start headings with “Unit 1: …”, “Unit 2: …” and list topics on new lines. Chints will automatically split them into units and topics.</small>
            </label>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowAdd(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busyKey === "add"}>{busyKey === "add" ? "Creating…" : "Create & enroll"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export function SubjectDetail({ subjectKey, unitIndex }) {
  const { token } = useApp();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync((signal) => fetchSubjects(token, signal), [token, subjectKey]);
  const subject = (data?.subjects || []).find((s) => s.key === subjectKey);

  async function enrollNow() {
    try {
      await updateSubjectState(subjectKey, "enrolled", token);
      toast(`Enrolled in ${subject.name}`);
      reload();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  if (loading) return <div className="page"><Loading /></div>;
  if (error) return <div className="page"><Alert kind="error">{error}</Alert></div>;
  if (!subject) return <div className="page"><Empty icon="book" title="Subject not found" action={<button className="btn" onClick={() => navigate("/subjects")}>Back to subjects</button>} /></div>;

  if (subject.status !== "enrolled") {
    return (
      <div className="page">
        <BackLink to="/subjects">All subjects</BackLink>
        <Empty icon="book" title={`Enroll in ${subject.name} to access its units`}
          action={<button className="btn btn-primary" onClick={enrollNow}>Enroll in {subject.name}</button>}>
          Once enrolled, you can browse every unit's syllabus topics, take unit quizzes, or create new quizzes for this course.
        </Empty>
      </div>
    );
  }

  if (unitIndex !== null && unitIndex !== undefined) {
    return <UnitDetail subject={subject} unitIndex={unitIndex} />;
  }

  return (
    <div className="page">
      <BackLink to="/subjects">All subjects</BackLink>
      <PageHead eyebrow={`${subject.code || "COURSE"} · ${subject.courseType || "Syllabus"}`} title={subject.name}
        subtitle={subject.description || `${subject.units?.length || 0} units — pick a unit to review topics, take a quiz, or build a new quiz.`}>
        <button className="btn btn-primary" onClick={() => navigate(`/create?subject=${encodeURIComponent(subject.key)}&unit=0`)}>
          <Icon name="plus" size={16} /> Create quiz for {subject.key}
        </button>
      </PageHead>

      <div className="unit-list">
        {(subject.units || []).map((unit, idx) => (
          <button key={idx} type="button" className="card unit-card" onClick={() => navigate(`/subjects/${encodeURIComponent(subject.key)}/unit/${idx}`)}>
            <div className="card-top" style={{ width: "100%" }}>
              <span className="unit-number">U{idx + 1}</span>
              <Badge>{unit.topics?.length || 0} topics</Badge>
            </div>
            <h3>{unit.name}</h3>
            <div className="topic-tags">
              {(unit.topics || []).slice(0, 6).map((t, i) => <span key={i} className="tag">{t.name}</span>)}
              {(unit.topics?.length || 0) > 6 && <span className="tag">+{unit.topics.length - 6} more</span>}
            </div>
            <div className="card-foot" style={{ width: "100%", paddingTop: 6 }}>
              <span className="text-muted" style={{ fontSize: 13 }}>Quizzes & syllabus</span>
              <span style={{ color: "var(--primary)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>Open unit <Icon name="arrowRight" size={15} /></span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function UnitDetail({ subject, unitIndex }) {
  const { token, user } = useApp();
  const toast = useToast();
  const unit = subject.units?.[unitIndex];
  const [tab, setTab] = useState("quizzes");
  const { data, loading, error } = useAsync((signal) => fetchUnitQuizzes(subject.key, unitIndex, token, signal), [subject.key, unitIndex, token]);

  if (!unit) return <div className="page"><Empty title="Unit not found" action={<button className="btn" onClick={() => navigate(`/subjects/${encodeURIComponent(subject.key)}`)}>Back to {subject.name}</button>} /></div>;
  const quizzes = data?.quizzes || [];
  const createUrl = `/create?subject=${encodeURIComponent(subject.key)}&unit=${unitIndex}`;

  return (
    <div className="page">
      <BackLink to={`/subjects/${encodeURIComponent(subject.key)}`}>{subject.name}</BackLink>
      <PageHead eyebrow={`${subject.code || subject.key} · Unit ${unitIndex + 1}`} title={unit.name}
        subtitle={`${unit.topics?.length || 0} syllabus topics · ${quizzes.length} quiz${quizzes.length === 1 ? "" : "zes"} (${user?.role === "admin" ? "all accounts" : "your account + starter quizzes"})`}>
        <button className="btn" onClick={() => navigate(`${createUrl}&ai=1`)}><Icon name="sparkle" size={16} /> Generate with Chints</button>
        <button className="btn btn-primary" onClick={() => navigate(createUrl)}><Icon name="plus" size={16} /> Create quiz for this unit</button>
      </PageHead>

      <div className="toolbar">
        <div className="tabs">
          <button className={tab === "quizzes" ? "tab active" : "tab"} onClick={() => setTab("quizzes")}>Unit quizzes ({quizzes.length})</button>
          <button className={tab === "topics" ? "tab active" : "tab"} onClick={() => setTab("topics")}>Syllabus topics ({unit.topics?.length || 0})</button>
        </div>
      </div>

      {tab === "quizzes" ? (
        <>
          <Alert kind="error">{error}</Alert>
          {loading ? <Loading /> : quizzes.length === 0 ? (
            <Empty icon="list" title="No quizzes for this unit yet"
              action={<button className="btn btn-primary" onClick={() => navigate(createUrl)}><Icon name="plus" size={16} /> Create the first quiz</button>}>
              Build a quiz manually or let Chints draft questions from this unit's syllabus topics.
            </Empty>
          ) : (
            <div className="grid-auto">
              {quizzes.map((quiz) => (
                <QuizCard key={quiz.id} quiz={quiz} showStatus={quiz.isMine || user?.role === "admin"}>
                  <div className="row" style={{ width: "100%", justifyContent: "space-between" }}>
                    <QuizStartButton quiz={quiz} />
                    <div className="row" style={{ gap: 6 }}>
                      <button className="btn btn-sm" onClick={() => copyQuizShareLink(quiz, toast)} title="Copy link to share with students">
                        <Icon name="share" size={14} /> Share
                      </button>
                      {(quiz.isMine || user?.role === "admin") && (
                        <button className="btn btn-sm" onClick={() => navigate(`/edit/${quiz.id}`)}><Icon name="edit" size={14} /> Edit</button>
                      )}
                    </div>
                  </div>
                </QuizCard>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="grid-wide">
          {(unit.topics || []).map((topic, idx) => (
            <div key={idx} className="card card-pad" style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <span className="q-number">{idx + 1}</span>
              <div>
                <h3 style={{ fontSize: 16 }}>{topic.name}</h3>
                <p className="text-muted" style={{ marginTop: 4, fontSize: 13.5 }}>{topic.description || "Core syllabus topic."}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QuizStartButton({ quiz }) {
  const { startQuiz, startingQuizId } = useApp();
  const busy = startingQuizId === quiz.id;
  return (
    <button className="btn btn-primary" type="button" disabled={busy || !quiz.totalQuestions || !quiz.isPublished} onClick={() => startQuiz(quiz)}>
      <Icon name="play" size={16} /> {busy ? "Starting…" : quiz.isPublished ? "Start quiz" : "Draft"}
    </button>
  );
}

