import "dotenv/config";
import mongoose from "mongoose";
import User from "../src/models/User.js";
import Quiz from "../src/models/Quiz.js";
import CustomSubject from "../src/models/CustomSubject.js";
import SubjectEnrollment from "../src/models/SubjectEnrollment.js";

const base = "http://127.0.0.1:5000";
const email = `smoke${Date.now()}@example.com`;
await mongoose.connect(process.env.MONGODB_URI);
let token = "";
let failures = 0;

async function call(method, path, body, auth = true) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(auth && token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
  return { status: res.status, data };
}
function check(name, ok, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + extra}`);
  if (!ok) failures += 1;
}

try {
  let r = await call("POST", "/api/auth/register", { name: "Smoke Tester", email, password: "smoke-pass-123" }, false);
  token = r.data.token;
  check("register", r.status === 201 && token, JSON.stringify(r.data));

  r = await call("GET", "/api/subjects");
  check("list subjects (5 built-in)", r.status === 200 && r.data.subjects.length >= 5, JSON.stringify(r.data).slice(0, 200));

  r = await call("PATCH", "/api/subjects/SE/state", { status: "enrolled" });
  check("enroll in SE", r.status === 200, JSON.stringify(r.data));

  r = await call("POST", "/api/subjects/custom", { name: "Compilers", code: "CS501", courseType: "CC", syllabusText: "Unit 1: Lexing\n- Tokens\n- Regex\nUnit 2: Parsing\n- LL(1)\n- LR" });
  const customKey = r.data.subject?.key;
  check("add custom subject with 2 units", r.status === 201 && r.data.subject.units.length === 2, JSON.stringify(r.data));

  const quizBody = (extra = {}) => ({
    title: "Smoke quiz", description: "d", category: "Smoke Category", difficulty: "easy", durationMinutes: 5, isPublished: true,
    questions: [{ prompt: "1+1?", options: ["1", "2"], correctOption: 1 }, { prompt: "2+2?", options: ["3", "4", "5"], correctOption: 1 }], ...extra
  });

  r = await call("POST", "/api/quizzes", quizBody({ subjectKey: "SE", unitIndex: 0 }));
  const quizId = r.data.quiz?.id;
  check("non-admin user creates quiz (auto-creates category, linked to SE unit 1)", r.status === 201 && quizId && r.data.quiz.category.slug === "smoke-category", JSON.stringify(r.data));

  r = await call("POST", "/api/quizzes", quizBody({ isPublished: true, questions: [] }));
  check("publishing with no questions is rejected", r.status === 400, JSON.stringify(r.data));

  r = await call("POST", "/api/quizzes", quizBody({ subjectKey: "SE", unitIndex: 9 }));
  check("invalid unit index rejected", r.status === 400, JSON.stringify(r.data));

  r = await call("POST", "/api/quizzes", quizBody({ title: "Compilers quiz", subjectKey: customKey, unitIndex: 1 }));
  const customQuizId = r.data.quiz?.id;
  check("quiz linked to own custom subject", r.status === 201, JSON.stringify(r.data));

  r = await call("GET", "/api/quizzes?limit=50");
  check("catalogue lists shared quiz", r.data.quizzes.some((q) => q.id === quizId), JSON.stringify(r.data).slice(0, 200));
  check("catalogue hides custom-subject quiz", !r.data.quizzes.some((q) => q.id === customQuizId));
  check("public listing leaks no isPublished/createdBy", r.data.quizzes.every((q) => !("isPublished" in q) && !("createdBy" in q)));

  r = await call("GET", "/api/quizzes/by-unit?subjectKey=SE&unitIndex=0");
  check("by-unit shows seeded + mine", r.status === 200 && r.data.quizzes.length >= 2 && r.data.quizzes.some((q) => q.isMine), JSON.stringify(r.data).slice(0, 300));

  r = await call("GET", "/api/quizzes/mine");
  check("my quizzes lists 2", r.status === 200 && r.data.quizzes.length === 2 && "isPublished" in r.data.quizzes[0], JSON.stringify(r.data).slice(0, 300));

  r = await call("PUT", `/api/quizzes/${quizId}`, quizBody({ title: "Smoke quiz v2", isPublished: false, subjectKey: "SE", unitIndex: 0 }));
  check("owner edits quiz via PUT (to draft)", r.status === 200 && r.data.quiz.title === "Smoke quiz v2" && r.data.quiz.isPublished === false, JSON.stringify(r.data));

  r = await call("GET", "/api/quizzes?limit=50");
  check("draft hidden from catalogue", !r.data.quizzes.some((q) => q.id === quizId));

  r = await call("PATCH", `/api/quizzes/${quizId}`, { isPublished: true });
  check("publish via PATCH", r.status === 200 && r.data.quiz.isPublished === true, JSON.stringify(r.data));

  r = await call("POST", "/api/attempts", { quizId });
  const attemptId = r.data.attempt?.id;
  check("start attempt", r.status === 201 && attemptId, JSON.stringify(r.data));
  const answers = r.data.attempt.questions.map((q) => ({ questionId: q.id, selectedOption: q.options.length === 2 ? 1 : 1 }));
  r = await call("POST", `/api/attempts/${attemptId}/submit`, { answers });
  check("submit scores 2/2", r.status === 200 && r.data.attempt.score === 2, JSON.stringify(r.data).slice(0, 300));

  r = await call("GET", "/api/attempts/mine");
  check("history includes attempt", r.status === 200 && r.data.attempts.length === 1);

  r = await call("GET", "/api/admin/overview");
  check("admin overview forbidden for normal user", r.status === 403, String(r.status));

  r = await call("POST", "/api/ai/generate-questions", { topics: ["Agile"], count: 3 });
  check("AI generate returns clear message without key (or works with one)", r.status === 503 || r.status === 200, JSON.stringify(r.data));

  r = await call("GET", "/api/ai/status");
  check("AI status", r.status === 200 && typeof r.data.enabled === "boolean");

  r = await call("DELETE", `/api/quizzes/${quizId}`);
  check("owner deletes quiz", r.status === 204, String(r.status));

  r = await call("DELETE", `/api/subjects/custom/${customKey}`);
  check("delete custom subject (cascades its quiz)", r.status === 204, String(r.status));
  check("custom quiz removed with subject", !(await Quiz.exists({ _id: customQuizId })));
} finally {
  const user = await User.findOne({ email });
  if (user) {
    await Promise.all([
      Quiz.deleteMany({ createdBy: user._id }),
      CustomSubject.deleteMany({ owner: user._id }),
      SubjectEnrollment.deleteMany({ user: user._id }),
      mongoose.connection.collection("attempts").deleteMany({ user: user._id }),
      user.deleteOne()
    ]);
  }
  await mongoose.disconnect();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
  process.exitCode = failures ? 1 : 0;
}
