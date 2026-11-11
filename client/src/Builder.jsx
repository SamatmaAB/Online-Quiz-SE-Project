import { useEffect, useState } from "react";
import { createQuiz, fetchAiStatus, fetchCategories, fetchManageQuiz, fetchSubjects, generateQuestions, replaceQuiz } from "./api.js";
import { BackLink, PageHead } from "./components.jsx";
import { Alert, Badge, Icon, Loading, navigate, useApp, useRoute, useToast } from "./ui.jsx";

const blankQuestion = () => ({ prompt: "", options: ["", "", "", ""], correctOption: 0 });

export default function Builder({ editQuizId = null }) {
  const { token } = useApp();
  const route = useRoute();
  const toast = useToast();

  const [loading, setLoading] = useState(Boolean(editQuizId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [aiStatus, setAiStatus] = useState({ enabled: false, model: "gemini-3.8-flash" });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [durationMinutes, setDurationMinutes] = useState(10);
  const [subjectKey, setSubjectKey] = useState(route.query.subject || "");
  const [unitIndex, setUnitIndex] = useState(route.query.unit !== undefined ? Number(route.query.unit) : 0);
  const [isPublished, setIsPublished] = useState(true);
  const [source, setSource] = useState("manual");
  const [questions, setQuestions] = useState([blankQuestion()]);

  // AI generator state
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [customTopic, setCustomTopic] = useState("");
  const [aiCount, setAiCount] = useState(5);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetchCategories(controller.signal).catch(() => ({ categories: [] })),
      fetchSubjects(token, controller.signal).catch(() => ({ subjects: [] })),
      fetchAiStatus(token, controller.signal).catch(() => ({ enabled: false }))
    ]).then(([catData, subData, aiData]) => {
      setCategories(catData.categories || []);
      setSubjects(subData.subjects || []);
      setAiStatus(aiData);
      if (!editQuizId && route.query.subject) {
        const found = (subData.subjects || []).find((s) => s.key === route.query.subject);
        if (found) {
          setCategory((c) => c || found.name);
          const uIdx = Number(route.query.unit || 0);
          const unit = found.units?.[uIdx];
          if (unit) {
            setTitle((t) => t || `${found.key} · ${unit.name}`);
            setSelectedTopics((unit.topics || []).slice(0, 5).map((tp) => tp.name));
          }
        }
      }
    });
    return () => controller.abort();
  }, [token, editQuizId, route.query.subject, route.query.unit]);

  useEffect(() => {
    if (!editQuizId) return undefined;
    const controller = new AbortController();
    setLoading(true);
    fetchManageQuiz(editQuizId, token, controller.signal)
      .then(({ quiz, questions: loaded }) => {
        setTitle(quiz.title);
        setDescription(quiz.description || "");
        setCategory(quiz.category?.name || "");
        setDifficulty(quiz.difficulty || "medium");
        setDurationMinutes(quiz.durationMinutes || 10);
        setSubjectKey(quiz.subjectKey || "");
        setUnitIndex(quiz.unitIndex ?? 0);
        setIsPublished(Boolean(quiz.isPublished));
        setSource(quiz.source || "manual");
        setQuestions(loaded.length ? loaded.map((q) => ({ prompt: q.prompt, options: [...q.options], correctOption: q.correctOption })) : [blankQuestion()]);
      })
      .catch((err) => { if (err.name !== "AbortError") setError(err.message); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [editQuizId, token]);

  const currentSubject = subjects.find((s) => s.key === subjectKey);
  const currentUnit = currentSubject?.units?.[unitIndex];
  const unitTopics = currentUnit?.topics || [];

  function handleSubjectChange(nextKey) {
    setSubjectKey(nextKey);
    setUnitIndex(0);
    const found = subjects.find((s) => s.key === nextKey);
    if (found && !category) setCategory(found.name);
    const firstTopics = found?.units?.[0]?.topics || [];
    setSelectedTopics(firstTopics.slice(0, 5).map((t) => t.name));
  }

  function handleUnitChange(nextIdx) {
    const idx = Number(nextIdx);
    setUnitIndex(idx);
    const topics = currentSubject?.units?.[idx]?.topics || [];
    setSelectedTopics(topics.slice(0, 5).map((t) => t.name));
  }

  function toggleTopic(name) {
    setSelectedTopics((curr) => curr.includes(name) ? curr.filter((t) => t !== name) : [...curr, name]);
  }

  function updateQuestion(idx, patch) {
    setQuestions((curr) => curr.map((q, i) => i === idx ? { ...q, ...patch } : q));
  }

  function updateOption(qIdx, oIdx, value) {
    setQuestions((curr) => curr.map((q, i) => i === qIdx ? { ...q, options: q.options.map((opt, j) => j === oIdx ? value : opt) } : q));
  }

  function addOption(qIdx) {
    setQuestions((curr) => curr.map((q, i) => i === qIdx && q.options.length < 6 ? { ...q, options: [...q.options, ""] } : q));
  }

  function removeOption(qIdx, oIdx) {
    setQuestions((curr) => curr.map((q, i) => {
      if (i !== qIdx || q.options.length <= 2) return q;
      const nextOpts = q.options.filter((_, j) => j !== oIdx);
      const nextCorrect = q.correctOption >= nextOpts.length ? 0 : q.correctOption > oIdx ? q.correctOption - 1 : q.correctOption;
      return { ...q, options: nextOpts, correctOption: nextCorrect };
    }));
  }

  function removeQuestion(idx) {
    setQuestions((curr) => curr.length <= 1 ? [blankQuestion()] : curr.filter((_, i) => i !== idx));
  }

  async function handleGenerateAi() {
    setAiError("");
    const topics = [
      ...selectedTopics.map((name) => {
        const match = unitTopics.find((t) => t.name === name);
        return { name, description: match?.description || "" };
      }),
      ...customTopic.split(",").map((s) => s.trim()).filter(Boolean).map((name) => ({ name }))
    ];
    if (!topics.length) {
      setAiError("Select at least one syllabus topic or type a custom topic below.");
      return;
    }
    setAiBusy(true);
    try {
      const context = currentSubject ? `${currentSubject.name} - ${currentUnit?.name || ""}` : title || category;
      const data = await generateQuestions({ topics, count: Number(aiCount) || 5, context, difficulty }, token);
      setQuestions((curr) => {
        const nonEmpty = curr.filter((q) => q.prompt.trim() || q.options.some((o) => o.trim()));
        return [...nonEmpty, ...data.questions];
      });
      setSource("ai");
      toast(`Chints drafted ${data.questions.length} question(s)!`);
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiBusy(false);
    }
  }

  async function save(publishFlag) {
    setError("");
    const cleaned = questions
      .map((q) => ({
        prompt: q.prompt.trim(),
        options: q.options.map((o) => o.trim()).filter(Boolean),
        correctOption: Number(q.correctOption)
      }))
      .filter((q) => q.prompt || q.options.length);

    if (!title.trim() || title.trim().length < 2) return setError("Give your quiz a title (at least 2 characters).");
    if (!category.trim()) return setError("Enter or pick a category (e.g. Software Engineering).");
    if (publishFlag && cleaned.length === 0) return setError("Add at least one complete question before publishing, or save as a draft.");
    for (let i = 0; i < cleaned.length; i += 1) {
      const q = cleaned[i];
      if (!q.prompt) return setError(`Question ${i + 1} is missing its prompt.`);
      if (q.options.length < 2) return setError(`Question ${i + 1} needs at least 2 non-empty options.`);
      if (q.correctOption < 0 || q.correctOption >= q.options.length) return setError(`Pick a valid correct answer for Question ${i + 1}.`);
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      difficulty,
      durationMinutes: Number(durationMinutes) || 10,
      isPublished: Boolean(publishFlag),
      subjectKey: subjectKey ? subjectKey : null,
      unitIndex: subjectKey ? Number(unitIndex) : null,
      source,
      questions: cleaned
    };

    setSaving(true);
    try {
      if (editQuizId) {
        await replaceQuiz(editQuizId, payload, token);
        toast("Quiz updated");
      } else {
        await createQuiz(payload, token);
        toast(publishFlag ? "Quiz published!" : "Draft saved");
      }
      if (subjectKey) navigate(`/subjects/${encodeURIComponent(subjectKey)}/unit/${unitIndex}`);
      else navigate("/my-quizzes");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="page"><Loading /></div>;

  return (
    <div className="page">
      <BackLink to={subjectKey ? `/subjects/${encodeURIComponent(subjectKey)}/unit/${unitIndex}` : "/my-quizzes"}>
        {subjectKey ? "Back to unit" : "My quizzes"}
      </BackLink>

      <PageHead eyebrow={editQuizId ? "Edit quiz" : "Quiz Studio"} title={editQuizId ? `Editing “${title || "Quiz"}”` : "Create a quiz"}
        subtitle="Link it to a course unit or publish it to the open community catalog. Any signed-in user can author and share quizzes.">
        <button type="button" className="btn" disabled={saving} onClick={() => save(false)}>Save as draft</button>
        <button type="button" className="btn btn-primary" disabled={saving} onClick={() => save(true)}>
          <Icon name="check" size={16} /> {saving ? "Saving…" : editQuizId ? "Save & publish" : "Publish quiz"}
        </button>
      </PageHead>

      <Alert kind="error" onClose={() => setError("")}>{error}</Alert>

      <div className="builder">
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <section className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h3>1. Quiz details</h3>
            <div className="form-grid">
              <label className="field" style={{ gridColumn: "1 / -1" }}>
                Quiz title *
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. SE Unit 1 · Agile & Requirements Mastery" maxLength={160} />
              </label>
              <label className="field">
                Category *
                <input list="category-suggestions" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Type or pick a category" maxLength={80} />
                <datalist id="category-suggestions">
                  {categories.map((c) => <option key={c.id} value={c.name} />)}
                </datalist>
                <small>New category names are created automatically.</small>
              </label>
              <label className="field">
                Difficulty
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </label>
              <label className="field">
                Duration (minutes)
                <input type="number" min={1} max={600} value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} />
              </label>
              <label className="field">
                Link to subject (optional)
                <select value={subjectKey} onChange={(e) => handleSubjectChange(e.target.value)}>
                  <option value="">None — General catalog only</option>
                  {subjects.map((s) => <option key={s.key} value={s.key}>{s.name} ({s.code || s.key})</option>)}
                </select>
              </label>
              {subjectKey && (
                <label className="field">
                  Syllabus unit
                  <select value={unitIndex} onChange={(e) => handleUnitChange(e.target.value)}>
                    {(currentSubject?.units || []).map((u, idx) => <option key={idx} value={idx}>{u.name}</option>)}
                  </select>
                </label>
              )}
              <label className="field" style={{ gridColumn: "1 / -1" }}>
                Description
                <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this quiz cover?" maxLength={2000} />
              </label>
            </div>
          </section>

          <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2>2. Questions ({questions.length})</h2>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setQuestions((c) => [...c, blankQuestion()])}>
                <Icon name="plus" size={15} /> Add question
              </button>
            </div>

            {questions.map((q, qIdx) => (
              <div key={qIdx} className="card question-card">
                <div className="question-head">
                  <div className="row">
                    <span className="q-number">Q{qIdx + 1}</span>
                    <span className="text-muted" style={{ fontSize: 13 }}>Click the radio button next to the correct answer</span>
                  </div>
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => removeQuestion(qIdx)} title="Remove question">
                    <Icon name="trash" size={15} /> Remove
                  </button>
                </div>

                <label className="field">
                  Question prompt *
                  <input value={q.prompt} onChange={(e) => updateQuestion(qIdx, { prompt: e.target.value })} placeholder="Enter the question..." maxLength={1000} />
                </label>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {q.options.map((opt, oIdx) => (
                    <div key={oIdx} className={q.correctOption === oIdx ? "option-row correct" : "option-row"}>
                      <input type="radio" name={`correct-${qIdx}`} checked={q.correctOption === oIdx} onChange={() => updateQuestion(qIdx, { correctOption: oIdx })} title="Mark as correct option" />
                      <input className="input" value={opt} onChange={(e) => updateOption(qIdx, oIdx, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + oIdx)}`} maxLength={300} />
                      {q.options.length > 2 && (
                        <button type="button" className="icon-button" onClick={() => removeOption(qIdx, oIdx)} title="Remove option"><Icon name="x" size={15} /></button>
                      )}
                    </div>
                  ))}
                </div>

                {q.options.length < 6 && (
                  <div>
                    <button type="button" className="link-button" onClick={() => addOption(qIdx)}>+ Add another option</button>
                  </div>
                )}
              </div>
            ))}

            <div className="row" style={{ justifyContent: "space-between" }}>
              <button type="button" className="btn" onClick={() => setQuestions((c) => [...c, blankQuestion()])}><Icon name="plus" size={16} /> Add another question</button>
              <div className="row">
                <button type="button" className="btn" disabled={saving} onClick={() => save(false)}>Save draft</button>
                <button type="button" className="btn btn-primary" disabled={saving} onClick={() => save(true)}><Icon name="check" size={16} /> {saving ? "Saving…" : "Publish quiz"}</button>
              </div>
            </div>
          </section>
        </div>

        <aside className="sticky-side">
          <div className="ai-panel">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h3><Icon name="sparkle" /> Generate with Chints</h3>
              <Badge kind="ok">{aiStatus.liveAi ? "Chints Live AI" : "Chints Ready"}</Badge>
            </div>
            <p className="text-muted" style={{ fontSize: 13.5 }}>
              Chints drafts MCQs from this unit's syllabus or any custom topic. Review and edit the questions on the left before publishing.
            </p>

            <Alert kind="error" onClose={() => setAiError("")}>{aiError}</Alert>

            {unitTopics.length > 0 && (
              <div>
                <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                  <strong style={{ fontSize: 13 }}>Unit topics ({selectedTopics.length} selected)</strong>
                  <div className="row" style={{ gap: 8 }}>
                    <button type="button" className="link-button" style={{ fontSize: 12.5 }} onClick={() => setSelectedTopics(unitTopics.map((t) => t.name))}>All</button>
                    <button type="button" className="link-button" style={{ fontSize: 12.5 }} onClick={() => setSelectedTopics([])}>None</button>
                  </div>
                </div>
                <div style={{ maxHeight: 220, overflow: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                  {unitTopics.map((t, i) => {
                    const checked = selectedTopics.includes(t.name);
                    return (
                      <label key={i} className={checked ? "topic-option selected" : "topic-option"} style={{ padding: "8px 10px" }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleTopic(t.name)} />
                        <div><b style={{ fontSize: 13 }}>{t.name}</b></div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <label className="field">
              Custom topics (comma-separated)
              <input value={customTopic} onChange={(e) => setCustomTopic(e.target.value)} placeholder="e.g. BCNF, Deadlocks, backpropagation" />
            </label>

            <label className="field">
              Number of questions (1–20)
              <input type="number" min={1} max={20} value={aiCount} onChange={(e) => setAiCount(e.target.value)} />
            </label>

            <button type="button" className="btn btn-primary" disabled={aiBusy} onClick={handleGenerateAi}>
              <Icon name="sparkle" size={16} /> {aiBusy ? "Chints is drafting questions…" : `Ask Chints for ${aiCount} questions`}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

