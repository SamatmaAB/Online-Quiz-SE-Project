import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/auth.js";
import { MAX_QUESTIONS_PER_QUIZ, parseQuestion } from "../services/questions.js";
import { builtInSubjects } from "../services/subjectAccess.js";

const router = Router();
const aiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 15, standardHeaders: true, legacyHeaders: false, message: { message: "Chints is cooling down — wait a moment and try again" } });
const LETTERS = ["a", "b", "c", "d"];

// Build a lookup of all built-in syllabus topic definitions for Chints's offline fallback.
const allBuiltInTopics = [];
for (const subject of Object.values(builtInSubjects)) {
  for (const unit of subject.units || []) {
    for (const topic of unit.topics || []) {
      if (topic?.name && topic?.description) {
        allBuiltInTopics.push({ name: topic.name, description: topic.description, subject: subject.name, unit: unit.name });
      }
    }
  }
}

function geminiConfig() {
  return { key: process.env.GEMINI_API_KEY || "", model: process.env.GEMINI_MODEL || "gemini-3.8-flash" };
}

/** Pulls a JSON array out of a model reply, tolerating markdown fences and stray prose. */
export function extractJsonArray(text) {
  let body = String(text || "").trim();
  body = body.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    const parsed = JSON.parse(body);
    return Array.isArray(parsed) ? parsed : Array.isArray(parsed?.questions) ? parsed.questions : null;
  } catch {
    const start = body.indexOf("[");
    const end = body.lastIndexOf("]");
    if (start === -1 || end <= start) return null;
    try {
      const parsed = JSON.parse(body.slice(start, end + 1));
      return Array.isArray(parsed) ? parsed : null;
    } catch { return null; }
  }
}

/** Converts the model's a/b/c/d shape (or prompt/options shape) into our question format, dropping malformed items. */
export function normalizeGenerated(items) {
  return items.map((item) => {
    if (!item || typeof item !== "object") return null;
    const prompt = item.prompt ?? item.question_text ?? item.question;
    let options = item.options;
    if (!Array.isArray(options)) options = LETTERS.map((letter) => item[`option_${letter}`]).filter((option) => typeof option === "string");
    let correct = item.correctOption ?? item.correct_option;
    if (typeof correct === "string") {
      const index = LETTERS.indexOf(correct.trim().toLowerCase());
      correct = index >= 0 ? index : Number.parseInt(correct, 10);
    }
    return parseQuestion({ prompt, options, correctOption: correct });
  }).filter(Boolean);
}

/**
 * Chints built-in syllabus generator: crafts topic-specific MCQs using syllabus definitions
 * when a teammate runs the project without a GEMINI_API_KEY or when offline.
 */
export function chintsFallbackQuestions(topics, count, context = "") {
  const enriched = topics.map((t) => {
    const found = allBuiltInTopics.find((b) => b.name.toLowerCase() === t.name.toLowerCase());
    const desc = (t.description && t.description !== "From the syllabus you added." ? t.description : found?.description) ||
      `A key concept in ${context || "this course"} covering how ${t.name} is applied in practice.`;
    return { name: t.name, description: desc };
  });

  const distractorPool = [
    ...enriched.map((e) => e.description),
    ...allBuiltInTopics.map((b) => b.description),
    "An unrelated hardware interrupt mechanism that bypasses application logic.",
    "A deprecated legacy protocol replaced by static file tables.",
    "A purely visual styling rule with no impact on data or system behavior.",
    "A manual compilation step that only runs during hardware cold boot."
  ];

  const templates = [
    (t) => ({
      kind: "def",
      prompt: `Which statement best describes "${t.name}"${context ? ` in ${context}` : ""}?`,
      correct: t.description
    }),
    (t) => ({
      kind: "term",
      prompt: `Which concept is defined as: "${t.description.replace(/\.$/, "")}"?`,
      correct: t.name
    }),
    (t) => ({
      kind: "role",
      prompt: `When working with ${t.name}, what is its primary purpose or characteristic?`,
      correct: t.description
    })
  ];

  const results = [];
  for (let i = 0; i < count; i += 1) {
    const topic = enriched[i % enriched.length];
    const tpl = templates[i % templates.length](topic);
    let distractors;
    if (tpl.kind === "term") {
      const otherNames = [
        ...enriched.filter((e) => e.name !== topic.name).map((e) => e.name),
        ...allBuiltInTopics.filter((b) => b.name !== topic.name).map((b) => b.name),
        "Static Linker Table", "Kernel Page Fault", "Binary Latch Register"
      ];
      distractors = [...new Set(otherNames)].slice(i % 5, (i % 5) + 3);
    } else {
      distractors = [...new Set(distractorPool.filter((d) => d !== tpl.correct))].slice((i * 2) % 9, ((i * 2) % 9) + 3);
    }
    while (distractors.length < 3) distractors.push(`Option ${distractors.length + 2} for ${topic.name}`);

    const correctOption = i % 4;
    const options = [...distractors.slice(0, 3)];
    options.splice(correctOption, 0, tpl.correct.slice(0, 280));
    const validated = parseQuestion({
      prompt: tpl.prompt.slice(0, 950),
      options: options.map((o) => o.slice(0, 280)),
      correctOption
    });
    if (validated) results.push(validated);
  }
  return results;
}

router.get("/status", requireAuth, (_req, res) => {
  const { key, model } = geminiConfig();
  res.json({ enabled: true, agent: "Chints", liveAi: Boolean(key), model });
});

router.post("/generate-questions", requireAuth, aiLimiter, async (req, res, next) => {
  try {
    const { key, model } = geminiConfig();
    const topics = (Array.isArray(req.body?.topics) ? req.body.topics : [])
      .map((topic) => (typeof topic === "string" ? { name: topic } : topic))
      .filter((topic) => topic && typeof topic.name === "string" && topic.name.trim())
      .slice(0, 30)
      .map((topic) => ({ name: topic.name.trim().slice(0, 160), description: String(topic.description || "").trim().slice(0, 300) }));
    const count = Math.min(Math.max(Number.parseInt(req.body?.count ?? 5, 10) || 5, 1), 20);
    const context = String(req.body?.context || "").trim().slice(0, 160);
    const difficulty = ["easy", "medium", "hard"].includes(req.body?.difficulty) ? req.body.difficulty : "medium";
    if (!topics.length) return res.status(400).json({ message: "Pick or type at least one topic for Chints to generate questions about" });

    if (key) {
      const topicLines = topics.map((topic) => `- ${topic.name}${topic.description ? `: ${topic.description}` : ""}`).join("\n");
      const prompt = `You are Chints, an academic quiz-authoring assistant. Generate exactly ${count} ${difficulty}-difficulty multiple-choice questions for a college-level quiz${context ? ` on "${context}"` : ""}, covering these topics:

${topicLines}

Spread the questions evenly across the topics. Each question needs exactly 4 options with exactly one correct answer. Questions must be factually accurate and unambiguous.
Return ONLY a JSON array, with no other text and no markdown fences. Each element must look like:
{"prompt": "...", "options": ["...", "...", "...", "..."], "correctOption": 0}
where correctOption is the zero-based index of the correct option.`;

      try {
        const reply = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }),
          signal: AbortSignal.timeout(60_000)
        });
        if (reply.ok) {
          const payload = await reply.json();
          const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") ?? "";
          const items = extractJsonArray(text);
          const questions = items ? normalizeGenerated(items).slice(0, Math.min(count, MAX_QUESTIONS_PER_QUIZ)) : [];
          if (questions.length) {
            return res.json({ questions, requested: count, agent: "Chints", source: "gemini" });
          }
        }
      } catch {
        // Fall through to Chints built-in syllabus generator if network/API is unreachable
      }
    }

    const fallback = chintsFallbackQuestions(topics, count, context);
    return res.json({ questions: fallback, requested: count, agent: "Chints", source: "syllabus-engine" });
  } catch (error) { next(error); }
});

export default router;

export function clampQuestionCount(value, min = 1, max = 25, fallback = 5) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
