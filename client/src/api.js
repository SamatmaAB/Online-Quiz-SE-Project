let unauthorizedHandler = null;
export function onUnauthorized(handler) { unauthorizedHandler = handler; }

async function request(path, { signal, method = "GET", body, token, headers: extraHeaders } = {}) {
  const headers = { Accept: "application/json", ...extraHeaders };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
  let response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method, headers, signal,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Can't reach the server. Is the API running?");
  }
  if (response.status === 204) return {};
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token && unauthorizedHandler && !path.startsWith("/api/subjects/hidden")) unauthorizedHandler();
    const error = new Error(payload.message || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

const qs = (params) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value !== "" && value !== null && value !== undefined) search.set(key, String(value)); });
  const text = search.toString();
  return text ? `?${text}` : "";
};

// Auth
export const registerAccount = ({ name, email, password, role = "student" }) => request("/api/auth/register", { method: "POST", body: { name, email, password, role } });
export const loginAccount = ({ email, password }) => request("/api/auth/login", { method: "POST", body: { email, password } });
export const logoutAccount = (token) => request("/api/auth/logout", { method: "POST", token });
export const requestPasswordReset = (email) => request("/api/auth/password-reset/request", { method: "POST", body: { email } });
export const completePasswordReset = (token, password) => request("/api/auth/password-reset/complete", { method: "POST", body: { token, password } });

// Catalogue
export const fetchCategories = (signal) => request("/api/categories", { signal });
export const fetchQuizzes = ({ category = "", search = "", difficulty = "", sort = "", page = 1, limit = 12, token } = {}, signal) =>
  request(`/api/quizzes${qs({ page, limit, category, search: search.trim(), difficulty, sort })}`, { token, signal });
export const fetchPublicQuiz = (quizId, signal) => request(`/api/quizzes/${encodeURIComponent(quizId)}`, { signal });

// Quizzes (authoring)
export const fetchMyQuizzes = (token, { all = false } = {}, signal) => request(`/api/quizzes/mine${qs({ scope: all ? "all" : "" })}`, { token, signal });
export const fetchManageQuiz = (quizId, token, signal) => request(`/api/quizzes/${encodeURIComponent(quizId)}/manage`, { token, signal });
export const createQuiz = (quiz, token) => request("/api/quizzes", { method: "POST", body: quiz, token });
export const replaceQuiz = (quizId, quiz, token) => request(`/api/quizzes/${encodeURIComponent(quizId)}`, { method: "PUT", body: quiz, token });
export const patchQuiz = (quizId, updates, token) => request(`/api/quizzes/${encodeURIComponent(quizId)}`, { method: "PATCH", body: updates, token });
export const deleteQuiz = (quizId, token) => request(`/api/quizzes/${encodeURIComponent(quizId)}`, { method: "DELETE", token });
export const fetchUnitQuizzes = (subjectKey, unitIndex, token, signal) =>
  request(`/api/quizzes/by-unit${qs({ subjectKey, unitIndex })}`, { token, signal });

// AI
export const fetchAiStatus = (token, signal) => request("/api/ai/status", { token, signal });
export const generateQuestions = (payload, token) => request("/api/ai/generate-questions", { method: "POST", body: payload, token });

// Attempts
export const startAttempt = (quizId, token) => request("/api/attempts", { method: "POST", body: { quizId }, token });
export const fetchAttempt = (attemptId, token, signal) => request(`/api/attempts/${encodeURIComponent(attemptId)}`, { token, signal });
export const fetchMyAttempts = (token, signal) => request("/api/attempts/mine", { token, signal });
export const saveAttemptAnswers = (attemptId, answers, token) => request(`/api/attempts/${encodeURIComponent(attemptId)}/answers`, { method: "PATCH", body: { answers }, token });
export const submitAttempt = (attemptId, answers, token) => request(`/api/attempts/${encodeURIComponent(attemptId)}/submit`, { method: "POST", body: { answers }, token });
export const fetchAdminResults = (token, signal) => request("/api/attempts/admin/results", { token, signal });

// Subjects
export const fetchSubjects = (token, signal) => request("/api/subjects", { token, signal });
export const createSubject = (form, token) => request("/api/subjects/custom", { method: "POST", body: form, token });
export const deleteCustomSubject = (key, token) => request(`/api/subjects/custom/${encodeURIComponent(key)}`, { method: "DELETE", token });
export const updateSubjectState = (key, status, token) => request(`/api/subjects/${encodeURIComponent(key)}/state`, { method: "PATCH", body: { status }, token });
export const unlockHiddenSubjects = (password, token) => request("/api/subjects/hidden/unlock", { method: "POST", body: { password }, token });
export const restoreHiddenSubject = (key, token, hiddenToken) =>
  request(`/api/subjects/hidden/${encodeURIComponent(key)}/restore`, { method: "PATCH", token, headers: { "x-hidden-access-token": hiddenToken } });

// Admin
export const fetchAdminOverview = (token, signal) => request("/api/admin/overview", { token, signal });
export const fetchAdminUsers = (token, signal) => request("/api/admin/users", { token, signal });
export const setUserRole = (userId, role, token) => request(`/api/admin/users/${encodeURIComponent(userId)}/role`, { method: "PATCH", body: { role }, token });
export const fetchAdminCategories = (token, signal) => request("/api/admin/categories", { token, signal });
export const createAdminCategory = (body, token) => request("/api/admin/categories", { method: "POST", body, token });
export const updateAdminCategory = (id, body, token) => request(`/api/admin/categories/${encodeURIComponent(id)}`, { method: "PATCH", body, token });
