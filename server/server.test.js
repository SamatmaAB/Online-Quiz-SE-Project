
const { test } = require("node:test");
const assert = require("node:assert/strict");
const app = require("./server");

let server;
let baseUrl;

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())
    );
  }
});

test("returns quizzes sorted by title A-Z by default", async () => {
  const response = await fetch(`${baseUrl}/api/quizzes`);
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(
    data.quizzes.map((quiz) => quiz.title),
    [
      "Data Analytics",
      "Database Management System",
      "Enterprise Business Systems",
      "Machine Learning",
      "Software Engineering"
    ]
  );
});

test("sorts quizzes by shortest duration", async () => {
  const response = await fetch(`${baseUrl}/api/quizzes?sort=duration-asc`);
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(
    data.quizzes.map((quiz) => quiz.duration),
    [15, 20, 30, 30, 45]
  );
});

test("rejects an invalid sorting option", async () => {
  const response = await fetch(`${baseUrl}/api/quizzes?sort=invalid`);
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.equal(data.success, false);
});

test("filters quizzes by search", async () => {
  const response = await fetch(`${baseUrl}/api/quizzes?search=Machine`);
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.total, 1);
  assert.equal(data.quizzes[0].title, "Machine Learning");
});

test("filters quizzes by category", async () => {
  const response = await fetch(`${baseUrl}/api/quizzes?category=Elective`);
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.total, 2);
  assert.ok(data.quizzes.every((quiz) => quiz.category === "Elective"));
});

test("supports pagination", async () => {
  const response = await fetch(`${baseUrl}/api/quizzes?page=1&limit=2`);
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.count, 2);
  assert.equal(data.total, 5);
  assert.equal(data.totalPages, 3);
});

test("combines sorting, search, and category filters", async () => {
  const response = await fetch(
    `${baseUrl}/api/quizzes?sort=title-desc&search=Data&category=Elective`
  );
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.total, 1);
  assert.equal(data.quizzes[0].title, "Data Analytics");
});
