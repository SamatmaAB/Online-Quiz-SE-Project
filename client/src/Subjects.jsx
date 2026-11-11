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
// Stage 1
