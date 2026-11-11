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
// Stage 2
