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
// Stage 1
