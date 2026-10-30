async function request(path, { signal, method = "GET", body, token } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\\/+$/, "");
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || `Request failed (${response.status})`);
  }
  return response.json();
}

export function fetchCategories(signal) {
  return request("/api/categories", { signal });
}

export function fetchQuizzes({ category = "", search = "", page = 1, limit = 9 } = {}, signal) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (category) params.set("category", category);
  if (search.trim()) params.set("search", search.trim());
  return request(`/api/quizzes?${params.toString()}`, { signal });
}

export function startAttempt(quizId, token) {
  return request("/api/attempts", { method: "POST", body: { quizId }, token });
}

export function saveAttemptAnswers(attemptId, answers, token) {
  return request(`/api/attempts/${encodeURIComponent(attemptId)}/answers`, {
    method: "PATCH", body: { answers }, token
  });
}

export function submitAttempt(attemptId, answers, token) {
  return request(`/api/attempts/${encodeURIComponent(attemptId)}/submit`, {
    method: "POST", body: { answers }, token
  });
}

export function requestPasswordReset(email) {
  return request("/api/auth/password-reset/request", { method: "POST", body: { email } });
}

export function completePasswordReset(token, password) {
  return request("/api/auth/password-reset/complete", { method: "POST", body: { token, password } });
}
