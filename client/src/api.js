async function request(path, signal) {
  const response = await fetch(path, { headers: { Accept: "application/json" }, signal });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || `Request failed (${response.status})`);
  }
  return response.json();
}

export function fetchCategories(signal) {
  return request("/api/categories", signal);
}

export function fetchQuizzes({ category = "", search = "", page = 1, limit = 9 } = {}, signal) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (category) params.set("category", category);
  if (search.trim()) params.set("search", search.trim());
  return request(`/api/quizzes?${params.toString()}`, signal);
}
