export const MAX_QUESTIONS_PER_QUIZ = 100;

export const difficulties = new Set(["easy", "medium", "hard", "beginner", "intermediate", "advanced"]);

/** Validates and normalises one multiple-choice question. Returns null when invalid. */
export function parseQuestion(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  const options = Array.isArray(input.options) ? input.options.map((option) => (typeof option === "string" ? option.trim() : "")) : [];
  const correctOption = input.correctOption;
  if (prompt.length < 1 || prompt.length > 1000 || options.length < 2 || options.length > 6 ||
      options.some((option) => option.length < 1 || option.length > 300) ||
      !Number.isInteger(correctOption) || correctOption < 0 || correctOption >= options.length) return null;
  return { prompt, options, correctOption };
}

export function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

