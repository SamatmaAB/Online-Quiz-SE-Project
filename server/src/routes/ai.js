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
            signal: AbortSignal.timeout(30_000)
          });
          if (reply.ok) {
            const payload = await reply.json();
            const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") ?? "";
            const items = extractJsonArray(text);
            const questions = items ? normalizeGenerated(items).slice(0, Math.min(count, MAX_QUESTIONS_PER_QUIZ)) : [];
            if (questions.length) {
              return res.json({ questions, requested: count, difficulty, agent: "Chints", source: "gemini" });
            }
          }
        } catch {
          // Try next model or fall through to Chints built-in syllabus generator
        }
      }
    }

    const fallback = chintsFallbackQuestions(topics, count, context, difficulty);
    return res.json({ questions: fallback, requested: count, difficulty, agent: "Chints", source: "syllabus-engine" });
  } catch (error) { next(error); }
});

export default router;

/**
 * Full Scientific Calculator + Natural-Language Math Evaluator for Chints AI.
 * Supports:
 * - Basic arithmetic: +, -, *, /, %, ^, **, parentheses, implicit multiplication
 * - Percentages: "18% of 250", "18 percent of 250", "45 is what percent of 180", "200 + 15%"
 * - Roots & Powers: "square root of 121", "sqrt 121", "√121", "cube root of 27", "cbrt(27)", "∛27",
 *   "4th root of 81", "12 squared", "5 cubed", "2 to the power of 10"
 * - Factorials, Permutations & Combinations: "5!", "factorial of 6", "10C3", "nCr(10,3)", "10 choose 3", "10P3", "nPr(10,3)"
 * - Scientific Trigonometry (DEG by default like a scientific calculator, or RAD when pi/rad is used):
 *   sin, cos, tan, sec, csc, cot, asin, acos, atan, sinh, cosh, tanh
 * - Logarithms & Exponentials: log (base 10), ln (natural log), log2, log10, "log base 2 of 64", exp, e^x
 * - Number Theory & Stats: gcd, hcf, lcm, mod, abs, floor, ceil, round, min, max, avg/mean, sum, hypot
 * - Constants: pi (π), e
 */
const SCI_HELPERS = {
  fact: (n) => {
    const k = Math.round(Number(n));
    if (!Number.isFinite(k) || k < 0 || k > 170) return NaN;
    let res = 1;
    for (let i = 2; i <= k; i += 1) res *= i;
    return res;
  },
  ncr: (n, r) => {
    const N = Math.round(Number(n));
    const R = Math.round(Number(r));
    if (!Number.isFinite(N) || !Number.isFinite(R) || R < 0 || R > N || N > 170) return 0;
    return SCI_HELPERS.fact(N) / (SCI_HELPERS.fact(R) * SCI_HELPERS.fact(N - R));
  },
  npr: (n, r) => {
    const N = Math.round(Number(n));
    const R = Math.round(Number(r));
    if (!Number.isFinite(N) || !Number.isFinite(R) || R < 0 || R > N || N > 170) return 0;
    return SCI_HELPERS.fact(N) / SCI_HELPERS.fact(N - R);
  },
  gcd: (...args) => {
    const nums = args.map((x) => Math.abs(Math.round(Number(x)))).filter((x) => Number.isFinite(x));
    if (!nums.length) return NaN;
    const gcd2 = (a, b) => (b === 0 ? a : gcd2(b, a % b));
    return nums.reduce((acc, val) => gcd2(acc, val));
  },
  lcm: (...args) => {
    const nums = args.map((x) => Math.abs(Math.round(Number(x)))).filter((x) => Number.isFinite(x));
    if (!nums.length) return NaN;
    const gcd2 = (a, b) => (b === 0 ? a : gcd2(b, a % b));
    return nums.reduce((acc, val) => (acc === 0 || val === 0 ? 0 : Math.abs(acc * val) / gcd2(acc, val)));
  },
  avg: (...args) => (args.length ? args.reduce((a, b) => a + Number(b), 0) / args.length : NaN),
  sum: (...args) => args.reduce((a, b) => a + Number(b), 0),
  root: (x, n = 2) => Math.pow(Number(x), 1 / Number(n)),
  logb: (x, base = 10) => Math.log(Number(x)) / Math.log(Number(base)),
  ln: (x) => Math.log(Number(x)),
  log10: (x) => Math.log10(Number(x)),
  log2: (x) => Math.log2(Number(x)),
  log: (x, base) => (base !== undefined ? Math.log(Number(x)) / Math.log(Number(base)) : Math.log10(Number(x))),
  sqrt: (x) => Math.sqrt(Number(x)),
  cbrt: (x) => Math.cbrt(Number(x)),
  abs: (x) => Math.abs(Number(x)),
  round: (x, d = 0) => Number(Number(x).toFixed(Math.max(0, Math.min(10, Number(d) || 0)))),
  floor: (x) => Math.floor(Number(x)),
  ceil: (x) => Math.ceil(Number(x)),
  exp: (x) => Math.exp(Number(x)),
  pow: (x, y) => Math.pow(Number(x), Number(y)),
  hypot: (...args) => Math.hypot(...args.map(Number)),
  min: (...args) => Math.min(...args.map(Number)),
  max: (...args) => Math.max(...args.map(Number)),
  sinh: (x) => Math.sinh(Number(x)),
  cosh: (x) => Math.cosh(Number(x)),
  tanh: (x) => Math.tanh(Number(x)),
  deg: (r) => (Number(r) * 180) / Math.PI,
  rad: (d) => (Number(d) * Math.PI) / 180
};

export function evaluateMathExpression(rawInput) {
  const text = String(rawInput || "").trim();
  if (!text) return null;

  // Reject obvious non-math study/quiz requests like "explain question 2" or "tell me the answer to question 2"
  if (/\b(answer to|question\s*\d+|q\d+|explain why|who invented|what is a |define |syllabus|subject|quiz|unit\s*\d+)\b/i.test(text) && !/\b(square root|cube root|factorial|percent|sin|cos|tan|log|gcd|lcm|average|mean|calculate|compute)\b/i.test(text)) {
    return null;
  }

  // 1. "X% of Y" or "X percent of Y" (e.g. "18% of 250", "what is 15 percent of 80?")
  const pctOfMatch = text.match(/(-?\d+(?:\.\d+)?)\s*(?:%|percent|pct)\s*of\s*(-?\d+(?:\.\d+)?)/i);
  if (pctOfMatch) {
    const pct = Number.parseFloat(pctOfMatch[1]);
    const base = Number.parseFloat(pctOfMatch[2]);
    if (Number.isFinite(pct) && Number.isFinite(base)) {
      const value = Number(((pct / 100) * base).toFixed(8));
      return { expression: `${pct}% of ${base}`, result: value };
    }
  }

  // 2. "X is what percent of Y" or "what percentage is X of Y"
  const whatPctMatch =
    text.match(/(-?\d+(?:\.\d+)?)\s+is\s+what\s+(?:percent|percentage|%)\s+of\s+(-?\d+(?:\.\d+)?)/i) ||
    text.match(/what\s+(?:percent|percentage|%)\s+is\s+(-?\d+(?:\.\d+)?)\s+of\s+(-?\d+(?:\.\d+)?)/i);
  if (whatPctMatch) {
    const part = Number.parseFloat(whatPctMatch[1]);
    const whole = Number.parseFloat(whatPctMatch[2]);
    if (Number.isFinite(part) && Number.isFinite(whole) && whole !== 0) {
      const value = Number(((part / whole) * 100).toFixed(6));
      return { expression: `(${part} / ${whole}) × 100%`, result: value, note: `${value}%` };
    }
  }

  const useRadians = /\b(rad|radians|pi)\b|π/i.test(text);
  const toRad = (x) => (useRadians ? Number(x) : (Number(x) * Math.PI) / 180);
  const fromRad = (x) => (useRadians ? Number(x) : (Number(x) * 180) / Math.PI);

  // Strip conversational prefixes like "what's the", "whats the", "can you calculate", "tell me", etc.
  let cleaned = text
    .replace(/^(?:hey|hi|yo|bro|chints|please|pls|can you|could you|tell me|what is|what's|whats|what are|calculate|compute|solve|evaluate|find|give me|the|value of|\s)+/gi, "")
    .replace(/[?=]+$/g, "")
    .trim();

  // Natural language math phrase translations -> scientific functions
  cleaned = cleaned
    // Roots: "square root of X", "cube root of X", "4th root of X", "√X", "∛X"
    .replace(/\b(?:the\s+)?square\s+root\s+(?:of\s+)?(-?\d+(?:\.\d+)?|\([^)]+\))/gi, "sqrt($1)")
    .replace(/\b(?:the\s+)?cube\s+root\s+(?:of\s+)?(-?\d+(?:\.\d+)?|\([^)]+\))/gi, "cbrt($1)")
    .replace(/\b(?:the\s+)?fourth\s+root\s+(?:of\s+)?(-?\d+(?:\.\d+)?|\([^)]+\))/gi, "root($1, 4)")
    .replace(/\b(?:the\s+)?fifth\s+root\s+(?:of\s+)?(-?\d+(?:\.\d+)?|\([^)]+\))/gi, "root($1, 5)")
    .replace(/\b(\d+)(?:st|nd|rd|th)?\s+root\s+of\s+(-?\d+(?:\.\d+)?|\([^)]+\))/gi, "root($2, $1)")
    .replace(/√\s*\(/g, "sqrt(")
    .replace(/√\s*(-?\d+(?:\.\d+)?)/g, "sqrt($1)")
    .replace(/∛\s*\(/g, "cbrt(")
    .replace(/∛\s*(-?\d+(?:\.\d+)?)/g, "cbrt($1)")
    // Logarithms in words: "log base 2 of 64", "natural log of 10", "log of 100"
    .replace(/\blog\s*base\s*(\d+(?:\.\d+)?)\s*(?:of\s+)?(-?\d+(?:\.\d+)?|\([^)]+\))/gi, "logb($2, $1)")
    .replace(/\b(?:natural\s+log(?:arithm)?|ln)\s+of\s+(-?\d+(?:\.\d+)?|\([^)]+\))/gi, "ln($1)")
    .replace(/\blog(?:arithm)?\s+of\s+(-?\d+(?:\.\d+)?|\([^)]+\))/gi, "log10($1)")
    // Trigonometry in words: "sine of 30", "cosine of 60", "tangent of 45"
    .replace(/\bsine\s+(?:of\s+)?/gi, "sin ")
    .replace(/\bcosine\s+(?:of\s+)?/gi, "cos ")
    .replace(/\btangent\s+(?:of\s+)?/gi, "tan ")
    .replace(/\b(sqrt|cbrt|sin|cos|tan|sec|csc|cot|asin|acos|atan|sinh|cosh|tanh|ln|log10|log2|log|abs|exp|fact|floor|ceil|round)\s+of\s+/gi, "$1 ")
    // Factorials in words: "factorial of 5", "5 factorial"
    .replace(/\bfactorial\s+(?:of\s+)?(\d+)/gi, "fact($1)")
    .replace(/(\d+)\s+factorial\b/gi, "fact($1)")
    // Combinations & Permutations: "10 choose 3", "10C3", "10P3"
    .replace(/(\d+)\s+choose\s+(\d+)/gi, "ncr($1, $2)")
    .replace(/\b(\d+)\s*C\s*(\d+)\b/g, "ncr($1, $2)")
    .replace(/\b(\d+)\s*P\s*(\d+)\b/g, "npr($1, $2)")
    // GCD / HCF / LCM / Average / Sum in words: "gcd of 24 and 36", "lcm of 12, 18"
    .replace(/\b(?:gcd|hcf|greatest common divisor|highest common factor)\s+(?:of\s+)?([\d,\s]+(?:and\s+\d+)?)/gi, (_, list) => `gcd(${list.replace(/\band\b/gi, ",")})`)
    .replace(/\b(?:lcm|least common multiple)\s+(?:of\s+)?([\d,\s]+(?:and\s+\d+)?)/gi, (_, list) => `lcm(${list.replace(/\band\b/gi, ",")})`)
    .replace(/\b(?:average|mean)\s+(?:of\s+)?([\d.,\s]+(?:and\s+-?\d+(?:\.\d+)?)?)/gi, (_, list) => `avg(${list.replace(/\band\b/gi, ",")})`)
    .replace(/\bsum\s+of\s+([\d.,\s]+(?:and\s+-?\d+(?:\.\d+)?)?)/gi, (_, list) => `sum(${list.replace(/\band\b/gi, ",")})`)
    // Absolute value in words
    .replace(/\babsolute\s+value\s+of\s+(-?\d+(?:\.\d+)?)/gi, "abs($1)")
    // Powers in words: "12 squared", "5 cubed", "2 to the power of 10", "2 raised to 8"
    .replace(/(-?\d+(?:\.\d+)?|\([^)]+\))\s+squared\b/gi, "($1)**2")
    .replace(/(-?\d+(?:\.\d+)?|\([^)]+\))\s+cubed\b/gi, "($1)**3")
    .replace(/\b(?:to\s+the\s+power\s+of|raised\s+to(?:\s+the\s+power\s+of)?|to\s+the\s+power|power\s+of|power)\b/gi, "**")
    .replace(/(-?\d+(?:\.\d+)?)\s+to\s+the\s+(\d+)(?:st|nd|rd|th)\s+power/gi, "($1)**($2)")
    // Remainder / Modulo in words: "remainder of 27 divided by 5", "27 mod 5"
    .replace(/\bremainder\s+(?:of\s+)?(-?\d+(?:\.\d+)?)\s+(?:divided\s+by|\/)\s+(-?\d+(?:\.\d+)?)/gi, "($1 % $2)")
    .replace(/\bmod(?:ulo)?\b/gi, "%")
    // Degree symbols & words (handled by toRad)
    .replace(/°|\b(?:degrees?|deg|radians?|rad)\b/gi, "")
    // Percentages like "200 + 15%" -> "200 + (200 * 15 / 100)" or standalone "25%"
    .replace(/(-?\d+(?:\.\d+)?)\s*([+\-])\s*(\d+(?:\.\d+)?)\s*%/g, "($1 $2 ($1 * $3 / 100))")
    // Factorial operator "5!" -> "fact(5)"
    .replace(/(\d+)\s*!/g, "fact($1)")
    // Function call without parens: e.g. "sqrt 121", "sin 30", "log 100", "ln 10", "abs -5"
    .replace(/\b(sqrt|cbrt|sin|cos|tan|sec|csc|cot|asin|acos|atan|sinh|cosh|tanh|ln|log10|log2|log|abs|exp|fact|floor|ceil|round)\s+(-?\d+(?:\.\d+)?)/gi, "$1($2)")
    // Constants & basic word operators
    .replace(/π|\bpi\b/gi, `(${Math.PI})`)
    .replace(/\be\b(?![a-z])/g, `(${Math.E})`)
    .replace(/\b(?:times|multiplied\s+by)\b/gi, "*")
    .replace(/(\d|\))\s+x\s+(\d|\()/gi, "$1 * $2")
    .replace(/\b(?:divided\s+by|over)\b/gi, "/")
    .replace(/\bplus\b/gi, "+")
    .replace(/\bminus\b/gi, "-")
    .replace(/÷/g, "/")
    .replace(/×/g, "*")
    .replace(/\^/g, "**")
    // Implicit multiplication: "2(3+4)" -> "2*(3+4)", "(2+3)(4+5)" -> "(2+3)*(4+5)", "2sqrt(9)" -> "2*sqrt(9)"
    .replace(/(?<![a-zA-Z0-9_])(\d+(?:\.\d+)?)\s*\(/g, "$1*(")
    .replace(/(\d)\s*(?=(?:sqrt|cbrt|root|sin|cos|tan|sec|csc|cot|asin|acos|atan|sinh|cosh|tanh|ln|log10|log2|logb|log|abs|exp|pow|fact|ncr|npr|gcd|lcm)\b)/gi, "$1*")
    .replace(/\)\s*\(/g, ")*(")
    .replace(/\)\s*(\d)/g, ")*$1")
    .trim();

  if (!cleaned || !/\d/.test(cleaned)) return null;

  const allowedFns = [
    "sqrt", "cbrt", "root", "abs", "round", "floor", "ceil",
    "sin", "cos", "tan", "sec", "csc", "cot", "asin", "acos", "atan", "sinh", "cosh", "tanh",
    "ln", "log10", "log2", "logb", "log", "exp", "pow", "hypot",
    "fact", "ncr", "npr", "gcd", "lcm", "avg", "sum", "min", "max", "deg", "rad"
  ];
  const fnRegex = new RegExp(`\\b(${allowedFns.join("|")})\\b`, "gi");
  const tokenCheck = cleaned.replace(fnRegex, "");

  // Only numbers, operators, parens, commas, decimals, and whitespace may remain
  if (!/^[\d+\-*/%().,\s]+$/.test(tokenCheck)) return null;
  if (!/[+\-*/%()]/.test(cleaned) && !fnRegex.test(cleaned)) {
    return null;
  }

  const trigEnv = {
    ...SCI_HELPERS,
    sin: (x) => Math.sin(toRad(x)),
    cos: (x) => Math.cos(toRad(x)),
    tan: (x) => Math.tan(toRad(x)),
    sec: (x) => 1 / Math.cos(toRad(x)),
    csc: (x) => 1 / Math.sin(toRad(x)),
    cot: (x) => 1 / Math.tan(toRad(x)),
    asin: (x) => fromRad(Math.asin(Number(x))),
    acos: (x) => fromRad(Math.acos(Number(x))),
    atan: (x) => fromRad(Math.atan(Number(x)))
  };

// Stage 2
