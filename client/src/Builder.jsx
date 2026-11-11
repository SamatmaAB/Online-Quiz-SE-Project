import { useEffect, useState } from "react";
import { createQuiz, fetchAiStatus, fetchCategories, fetchManageQuiz, fetchSubjects, generateQuestions, replaceQuiz } from "./api.js";
import { BackLink, PageHead, confirmDeleteQuiz } from "./components.jsx";
import { Alert, Badge, Icon, Loading, navigate, useApp, useRoute, useToast } from "./ui.jsx";

const blankQuestion = () => ({ prompt: "", options: ["", "", "", ""], correctOption: 0 });
const DIFFICULTIES = [
  { value: "easy", label: "Easy", hint: "Recall & definitions" },
  { value: "medium", label: "Medium", hint: "Understanding & application" },
  { value: "hard", label: "Hard", hint: "Reasoning & scenarios" }
];

function modeFromQuery(query) {
  return query.mode === "ai" || query.ai === "1" ? "ai" : "manual";
}

export default function Builder({ editQuizId = null }) {
  const { token } = useApp();
  const route = useRoute();
  const toast = useToast();

  const [mode, setMode] = useState(() => (editQuizId ? "manual" : modeFromQuery(route.query)));
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
  const [questions, setQuestions] = useState(() => (!editQuizId && modeFromQuery(route.query) === "ai" ? [] : [blankQuestion()]));

  // Chints generator state
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [customTopic, setCustomTopic] = useState("");
  const [aiCount, setAiCount] = useState(5);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");

  // Opening the page from "Generate with Chints" vs "Create quiz" picks the matching workspace.
  useEffect(() => {
    if (editQuizId) return;
    const next = modeFromQuery(route.query);
    setMode(next);
    if (next === "manual") setQuestions((curr) => (curr.length ? curr : [blankQuestion()]));
  }, [editQuizId, route.query.mode, route.query.ai]);

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
            setTitle((t) => t || `${found.name} · ${unit.name}`);
            setSelectedTopics((unit.topics || []).map((tp) => tp.name));
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

  function switchMode(next) {
    setMode(next);
    if (next === "manual") setQuestions((curr) => (curr.length ? curr : [blankQuestion()]));
  }

  function handleSubjectChange(nextKey) {
    setSubjectKey(nextKey);
    setUnitIndex(0);
    const found = subjects.find((s) => s.key === nextKey);
    if (found && !category) setCategory(found.name);
    setSelectedTopics((found?.units?.[0]?.topics || []).map((t) => t.name));
  }

  function handleUnitChange(nextIdx) {
    const idx = Number(nextIdx);
    setUnitIndex(idx);
    setSelectedTopics((currentSubject?.units?.[idx]?.topics || []).map((t) => t.name));
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
    setQuestions((curr) => curr.filter((_, i) => i !== idx));
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
      setAiError("Select at least one syllabus topic or type a custom topic first.");
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
      toast(`Chints drafted ${data.questions.length} ${difficulty} question${data.questions.length === 1 ? "" : "s"}${data.source === "gemini" ? "" : " using the built-in syllabus engine"}.`);
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
        toast(publishFlag ? "Quiz updated" : "Saved as draft");
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

  async function deleteThisQuiz() {
    if (await confirmDeleteQuiz({ id: editQuizId, title }, token, toast)) {
      if (subjectKey) navigate(`/subjects/${encodeURIComponent(subjectKey)}/unit/${unitIndex}`);
      else navigate("/my-quizzes");
    }
  }

  if (loading) return <div className="page"><Loading /></div>;

  const aiMode = mode === "ai";

  const aiPanel = (
    <div className={aiMode ? "ai-panel ai-panel-main" : "ai-panel"}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3><Icon name="sparkle" /> {aiMode ? "Generate questions with Chints" : "Need ideas? Ask Chints"}</h3>
        <Badge kind="ok">{aiStatus.liveAi ? "Chints Live AI" : "Chints Ready"}</Badge>
      </div>
      <p className="text-muted" style={{ fontSize: 13.5 }}>
        {aiMode
          ? "Choose the syllabus topics, the difficulty and how many questions you want. Chints drafts them below — review and edit before you publish."
          : "Optional: let Chints draft extra questions from this unit's topics. They are added to your list and you can edit every one."}
      </p>

      <Alert kind="error" onClose={() => setAiError("")}>{aiError}</Alert>

      <div>
        <strong style={{ fontSize: 13 }}>Difficulty</strong>
        <div className="chips" style={{ marginTop: 8 }} role="radiogroup" aria-label="Question difficulty">
          {DIFFICULTIES.map((d) => (
            <button key={d.value} type="button" role="radio" aria-checked={difficulty === d.value} title={d.hint}
              className={difficulty === d.value ? "chip active" : "chip"} onClick={() => setDifficulty(d.value)}>{d.label}</button>
          ))}
        </div>
        <small className="text-muted">{DIFFICULTIES.find((d) => d.value === difficulty)?.hint}. This also becomes the quiz difficulty.</small>
      </div>

      {unitTopics.length > 0 ? (
        <div>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
            <strong style={{ fontSize: 13 }}>Syllabus topics — {selectedTopics.length} of {unitTopics.length} selected</strong>
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="link-button" style={{ fontSize: 12.5 }} onClick={() => setSelectedTopics(unitTopics.map((t) => t.name))}>Select all</button>
              <button type="button" className="link-button" style={{ fontSize: 12.5 }} onClick={() => setSelectedTopics([])}>Clear</button>
            </div>
          </div>
          <div className={aiMode ? "topic-picker" : "topic-scroll"}>
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
      ) : (
        <Alert kind="info">
          {subjectKey
            ? "This unit has no syllabus topics yet — type your own topics below."
            : "Link this quiz to a subject unit (in the details above) to pick syllabus topics, or just type your own topics below."}
        </Alert>
      )}

      <label className="field">
        Extra / custom topics (comma-separated)
        <input value={customTopic} onChange={(e) => setCustomTopic(e.target.value)} placeholder="e.g. BCNF, Deadlocks, backpropagation" />
      </label>

      <label className="field" style={{ maxWidth: 220 }}>
        Number of questions (1–20)
        <input type="number" min={1} max={20} value={aiCount} onChange={(e) => setAiCount(e.target.value)} />
      </label>

      <button type="button" className="btn btn-primary" disabled={aiBusy} onClick={handleGenerateAi}>
        <Icon name="sparkle" size={16} /> {aiBusy ? "Chints is drafting questions…" : `Generate ${aiCount || 0} ${difficulty} question${Number(aiCount) === 1 ? "" : "s"}`}
      </button>
    </div>
  );

  const questionsSection = (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2>{aiMode ? "3. Review & edit questions" : "2. Questions"} ({questions.length})</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setQuestions((c) => [...c, blankQuestion()])}>
          <Icon name="plus" size={15} /> Add question manually
        </button>
      </div>

      {questions.length === 0 && (
        <div className="empty">
          <span className="empty-icon"><Icon name={aiMode ? "sparkle" : "edit"} size={26} /></span>
          <h3>No questions yet</h3>
          <p>{aiMode ? "Use the Chints panel above to generate questions — you can still add your own or edit them afterwards." : "Click “Add question manually” to start writing."}</p>
        </div>
      )}

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
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => save(true)}><Icon name="check" size={16} /> {saving ? "Saving…" : editQuizId ? "Save & publish" : "Publish quiz"}</button>
        </div>
      </div>
    </section>
  );

  const detailsSection = (
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
            {subjects.map((s) => <option key={s.key} value={s.key}>{s.name}{s.code ? ` (${s.code})` : ""}</option>)}
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
  );

  return (
    <div className="page">
      <BackLink to={subjectKey ? `/subjects/${encodeURIComponent(subjectKey)}/unit/${unitIndex}` : "/my-quizzes"}>
        {subjectKey ? "Back to unit" : "My quizzes"}
      </BackLink>

      <PageHead eyebrow={editQuizId ? "Edit quiz" : aiMode ? "Chints AI Studio" : "Quiz Studio"}
        title={editQuizId ? `Editing “${title || "Quiz"}”` : aiMode ? "Generate a quiz with Chints" : "Create a quiz"}
        subtitle={currentSubject
          ? `Linked to ${currentSubject.name}${currentUnit ? ` · ${currentUnit.name}` : ""}.`
          : "Link it to a course unit or publish it to the community catalog. Any signed-in user can author and share quizzes."}>
        {editQuizId && <button type="button" className="btn btn-danger" disabled={saving} onClick={deleteThisQuiz}><Icon name="trash" size={16} /> Delete quiz</button>}
        <button type="button" className="btn" disabled={saving} onClick={() => save(false)}>Save as draft</button>
        <button type="button" className="btn btn-primary" disabled={saving} onClick={() => save(true)}>
          <Icon name="check" size={16} /> {saving ? "Saving…" : editQuizId ? "Save & publish" : "Publish quiz"}
        </button>
      </PageHead>

      <div className="toolbar">
        <div className="tabs" role="tablist" aria-label="How do you want to build this quiz?">
          <button type="button" role="tab" aria-selected={!aiMode} className={!aiMode ? "tab active" : "tab"} onClick={() => switchMode("manual")}><Icon name="edit" size={15} /> Write questions manually</button>
          <button type="button" role="tab" aria-selected={aiMode} className={aiMode ? "tab active" : "tab"} onClick={() => switchMode("ai")}><Icon name="sparkle" size={15} /> Generate with Chints</button>
        </div>
      </div>

      <Alert kind="error" onClose={() => setError("")}>{error}</Alert>

      {aiMode ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {detailsSection}
          <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h2>2. Chints generator</h2>
            {aiPanel}
          </section>
          {questionsSection}
        </div>
      ) : (
        <div className="builder">
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {detailsSection}
            {questionsSection}
          </div>
          <aside className="sticky-side">{aiPanel}</aside>
        </div>
      )}
    </div>
  );
}
