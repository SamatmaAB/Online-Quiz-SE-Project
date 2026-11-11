import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/auth.js";
import { MAX_QUESTIONS_PER_QUIZ, parseQuestion } from "../services/questions.js";
import { builtInSubjects } from "../services/subjectAccess.js";
import { describeTopic } from "../services/subjects.js";

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
  const raw = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const model = raw === "gemini-3.8-flash" ? "gemini-2.5-flash" : raw;
  return { key: process.env.GEMINI_API_KEY || "", model };
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
 * Chints built-in syllabus generator: crafts topic-specific, difficulty-aware MCQs
 * using syllabus definitions when a teammate runs the project without a GEMINI_API_KEY
 * or when the remote Gemini service is temporarily busy/offline.
 */
export function chintsFallbackQuestions(topics, count, context = "", difficulty = "medium") {
  const enriched = topics.map((t) => {
    const found = allBuiltInTopics.find((b) => b.name.toLowerCase() === t.name.toLowerCase());
    const hasCustomDesc = t.description && t.description !== "From the syllabus you added.";
    const desc = (hasCustomDesc ? t.description : found?.description) || describeTopic(t.name, context);
    return { name: t.name, description: desc };
  });

  const siblingDescriptions = enriched.map((e) => e.description);
  const siblingNames = enriched.map((e) => e.name);

  const backupDescriptions = [
    ...allBuiltInTopics.map((b) => b.description),
    "A static compile-time directive that eliminates runtime state transitions and dynamic allocation.",
    "An unindexed sequential scan that requires full table traversal before returning any element.",
    "A hardware-only bus arbitration signal that bypasses application data structures entirely.",
    "A fixed-size register latch restricted to storing a single boolean flag at boot time."
  ];

  const backupNames = [
    ...allBuiltInTopics.map((b) => b.name),
    "Static Register Latch",
    "Sequential Tape Buffer",
    "Compile-Time Macro Table",
    "Synchronous Bus Polling"
  ];

  const templatesByDifficulty = {
    easy: [
      (t) => ({
        kind: "def",
        prompt: `Which statement best defines "${t.name}"${context ? ` in ${context}` : ""}?`,
        correct: t.description
      }),
      (t) => ({
        kind: "term",
        prompt: `Which syllabus concept is described as: "${t.description.replace(/\.$/, "")}"?`,
        correct: t.name
      }),
      (t) => ({
        kind: "def",
        prompt: `What is the primary purpose of ${t.name}${context ? ` in ${context}` : ""}?`,
        correct: t.description
      })
    ],
    medium: [
      (t) => ({
        kind: "def",
        prompt: `When implementing or applying "${t.name}"${context ? ` (${context})` : ""}, which statement accurately characterizes its behavior?`,
        correct: t.description
      }),
      (t) => ({
        kind: "term",
        prompt: `A developer needs a concept that matches the following specification: "${t.description.replace(/\.$/, "")}". Which topic should they use?`,
        correct: t.name
      }),
      (t) => ({
        kind: "def",
        prompt: `How does "${t.name}" function within ${context || "software and system design"}?`,
        correct: t.description
      })
    ],
    hard: [
      (t) => ({
        kind: "def",
        prompt: `During a system design review${context ? ` for ${context}` : ""}, why would an engineer choose "${t.name}" over alternative approaches?`,
        correct: t.description
      }),
      (t) => ({
        kind: "term",
        prompt: `Consider an architecture requirement described by: "${t.description.replace(/\.$/, "")}". Which syllabus concept directly satisfies this requirement?`,
        correct: t.name
      }),
      (t) => ({
        kind: "def",
        prompt: `Which technical property correctly distinguishes "${t.name}" from other concepts in ${context || "this unit"}?`,
        correct: t.description
      })
    ]
  };

  const templates = templatesByDifficulty[difficulty] || templatesByDifficulty.medium;
  const results = [];

  for (let i = 0; i < count; i += 1) {
    const topic = enriched[i % enriched.length];
    const tpl = templates[i % templates.length](topic);
    let distractors = [];

    if (tpl.kind === "term") {
      const candidates = [
        ...siblingNames.filter((n) => n !== topic.name),
        ...backupNames.filter((n) => n !== topic.name)
      ];
      const unique = [...new Set(candidates)];
      for (let k = 0; k < unique.length && distractors.length < 3; k += 1) {
        distractors.push(unique[(i * 2 + k) % unique.length]);
      }
      distractors = [...new Set(distractors)];
    } else {
      const candidates = [
        ...siblingDescriptions.filter((d) => d !== tpl.correct),
        ...backupDescriptions.filter((d) => d !== tpl.correct)
      ];
      const unique = [...new Set(candidates)];
      for (let k = 0; k < unique.length && distractors.length < 3; k += 1) {
        distractors.push(unique[(i * 2 + k) % unique.length]);
      }
      distractors = [...new Set(distractors)];
    }

    while (distractors.length < 3) {
      distractors.push(`Alternative approach ${distractors.length + 1} unrelated to ${topic.name}`);
    }

    const correctOption = (i * 3 + 1) % 4;
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
      const levelGuide = {
        easy: "Easy: direct recall of definitions and basic facts; one obviously-wrong distractor is fine.",
        medium: "Medium: test understanding and simple application; distractors should be plausible.",
        hard: "Hard: test multi-step reasoning, edge cases, comparisons and scenario-based application; all distractors must be plausible."
      }[difficulty];
      const prompt = `You are Chints, an academic quiz-authoring assistant. Generate exactly ${count} ${difficulty}-difficulty multiple-choice questions for a college-level quiz${context ? ` on "${context}"` : ""}, covering these topics:

${topicLines}

${levelGuide}
Spread the questions evenly across the topics. Each question needs exactly 4 options with exactly one correct answer. Questions must be factually accurate and unambiguous.
Return ONLY a JSON array, with no other text and no markdown fences. Each element must look like:
{"prompt": "...", "options": ["...", "...", "...", "..."], "correctOption": 0}
where correctOption is the zero-based index of the correct option.`;

      const candidateModels = [...new Set([model, "gemini-2.5-flash", "gemini-2.0-flash"])];
      for (const candidate of candidateModels) {
        try {
          const reply = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidate)}:generateContent?key=${encodeURIComponent(key)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }),
// Stage 1
