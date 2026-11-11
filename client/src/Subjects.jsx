import { useEffect, useState } from "react";
import { createSubject, deleteCustomSubject, fetchSubjects, fetchUnitQuizzes, previewSyllabus, reparseSubject, updateSubjectState } from "./api.js";
import { BackLink, PageHead, QuizCard, confirmDeleteQuiz } from "./components.jsx";
import { Alert, Badge, Empty, Icon, Loading, Modal, copyQuizShareLink, hueFor, navigate, subjectBadge, useApp, useAsync, useRoute, useToast } from "./ui.jsx";

export function SubjectsList() {
  const { token } = useApp();
  const route = useRoute();
  const toast = useToast();
  const [tab, setTab] = useState("enrolled");
  const [showAdd, setShowAdd] = useState(() => route.query.add === "1");
  const [busyKey, setBusyKey] = useState("");
  const [form, setForm] = useState({ name: "", code: "", courseType: "CC", syllabusText: "" });
  const [formError, setFormError] = useState("");
  const [previewUnits, setPreviewUnits] = useState(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  useEffect(() => {
    if (route.query.add === "1") setShowAdd(true);
  }, [route.query.add]);

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

  async function handlePreview() {
    if (!form.syllabusText.trim() || form.syllabusText.trim().length < 10) {
      setFormError("Paste at least 10 characters of syllabus text first.");
      return;
    }
    setPreviewBusy(true);
    setFormError("");
    try {
      const res = await previewSyllabus(form.syllabusText, token);
      setPreviewUnits(res.units || []);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setPreviewBusy(false);
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
      setPreviewUnits(null);
      const uCount = res.subject.units?.length || 0;
      const tCount = (res.subject.units || []).reduce((n, u) => n + (u.topics?.length || 0), 0);
      toast(`Created ${res.subject.name} (${uCount} ${uCount === 1 ? "unit" : "units"} · ${tCount} ${tCount === 1 ? "topic" : "topics"} sorted by Chints)`);
      navigate(`/subjects/${encodeURIComponent(res.subject.key)}`);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusyKey("");
    }
  }

  return (
    <div className="page">
      <BackLink to="/">Dashboard</BackLink>
      <PageHead eyebrow="Curriculum" title="Subjects & Syllabus" subtitle="Enroll in built-in courses or paste your own syllabus to generate structured units and topics.">
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
              <div className="card-top subject-card-top">
                <div className="subject-card-head">
                  <span className="subject-icon">{subjectBadge(subject)}</span>
                  <div style={{ minWidth: 0 }}>
                    <span className="code">{(subject.code || (subject.isCustom ? "CUSTOM" : "COURSE")).toUpperCase()} · {subject.courseType || "Core"}</span>
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
              <textarea rows={8} value={form.syllabusText} onChange={(e) => { setForm({ ...form, syllabusText: e.target.value }); setPreviewUnits(null); }} required minLength={10} maxLength={20000}
                placeholder={"Unit - 1: Processes & Threads\nProcess concept, CPU scheduling algorithms, Threads and concurrency\n\nUnit - 2: Synchronization & Deadlocks\nCritical section problem, Semaphores and mutexes, Deadlock prevention"} />
              <small>Paste any college syllabus (e.g. “Unit - 1”, “Unit 1: …”, “Module 1”, bullet points, or comma/period-separated paragraphs). Chints automatically separates every unit and its topics.</small>
            </label>
            {previewUnits && (
              <div className="card card-pad" style={{ background: "var(--surface-2)", display: "flex", flexDirection: "column", gap: 12, maxHeight: 240, overflow: "auto" }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <strong style={{ fontSize: 13.5 }}><Icon name="sparkle" size={14} /> Chints sorted {previewUnits.length} {previewUnits.length === 1 ? "unit" : "units"} · {previewUnits.reduce((n, u) => n + (u.topics?.length || 0), 0)} topics</strong>
                  <Badge kind="ok">Ready</Badge>
                </div>
                {previewUnits.map((u, idx) => (
                  <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <b style={{ fontSize: 13 }}>{u.name} ({u.topics?.length || 0} {u.topics?.length === 1 ? "topic" : "topics"})</b>
                    <div className="topic-tags">
                      {(u.topics || []).map((t, i) => <span key={i} className="tag">{t.name}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => { setShowAdd(false); setPreviewUnits(null); }}>Cancel</button>
              <button type="button" className="btn" disabled={previewBusy || busyKey === "add"} onClick={handlePreview}>
                <Icon name="sparkle" size={15} /> {previewBusy ? "Sorting with Chints…" : "Preview units & topics"}
              </button>
              <button type="submit" className="btn btn-primary" disabled={busyKey === "add"}>
                <Icon name="check" size={15} /> {busyKey === "add" ? "Sorting with Chints & saving…" : "Create & enroll with Chints"}
              </button>
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
  const [reparsing, setReparsing] = useState(false);

  async function reparse() {
    setReparsing(true);
    try {
      await reparseSubject(subjectKey, token);
      toast("Syllabus re-read — topics updated");
      reload();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setReparsing(false);
    }
  }

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
// Stage 2
