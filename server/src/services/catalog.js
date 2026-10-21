const MAX_PAGE_SIZE = 50;

export function parsePagination(query = {}) {
  const page = Number.parseInt(query.page ?? "1", 10);
  const limit = Number.parseInt(query.limit ?? "12", 10);
  if (!Number.isInteger(page) || page < 1) return { error: "page must be a positive integer" };
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    return { error: `limit must be between 1 and ${MAX_PAGE_SIZE}` };
  }
  return { page, limit, skip: (page - 1) * limit };
}

export function normalizeSearch(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 100);
}

export function toPublicQuiz(quiz) {
  const item = typeof quiz.toObject === "function" ? quiz.toObject() : quiz;
  return {
    id: String(item._id ?? item.id),
    title: item.title,
    description: item.description ?? "",
    category: item.category && typeof item.category === "object"
      ? { id: String(item.category._id ?? item.category.id), name: item.category.name, slug: item.category.slug }
      : item.category,
    durationMinutes: item.durationMinutes,
    totalQuestions: item.totalQuestions,
    difficulty: item.difficulty,
    publishedAt: item.publishedAt ?? null
  };
}
