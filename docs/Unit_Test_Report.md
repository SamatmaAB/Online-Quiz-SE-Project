# Unit Test Report – Online Quiz Management System

- **Project:** Online Quiz Management System (MERN + Chints AI)
- **Test Runner:** Node.js Built-in Test Runner (`node --test`)
- **Execution Date:** 11 November 2026
- **Total Unit Tests:** 23
- **Passed:** 23 (100%)
- **Failed:** 0

---

## 1. Executive Summary

Automated unit tests verify the core business logic, input validators, security token hashing, scoring mathematics, syllabus parser, and Chints AI output normalizer in isolation from external network services. All **23 unit tests** passed in **1.68 seconds**.

---

## 2. Unit Test Suite Breakdown

| # | Test Suite / File | Test Case Name | Target Module | Duration | Status |
| :- | :--- | :--- | :--- | :--- | :--- |
| 1 | `server.test.js` | `health endpoint reports the API is ready` | `src/app.js` | 40.41 ms | **PASS** |
| 2 | `src/routes/ai.test.js` | `extractJsonArray handles fenced and prose-wrapped replies` | `src/routes/ai.js` | 0.72 ms | **PASS** |
| 3 | `src/routes/ai.test.js` | `normalizeGenerated accepts both option shapes and drops malformed items` | `src/routes/ai.js` | 0.64 ms | **PASS** |
| 4 | `src/routes/ai.test.js` | `chintsFallbackQuestions drafts valid MCQs from syllabus topics when offline` | `src/routes/ai.js` | 0.54 ms | **PASS** |
| 5 | `src/services/attempts.test.js` | `calculateScore computes score and two-decimal percentage accurately` | `src/services/attempts.js` | 1.09 ms | **PASS** |
| 6 | `src/services/attempts.test.js` | `attemptView hides correctOption while in-progress and reveals breakdown on review` | `src/services/attempts.js` | 0.92 ms | **PASS** |
| 7 | `src/services/catalog.test.js` | `pagination defaults to page 1 and 12 items` | `src/services/catalog.js` | 1.59 ms | **PASS** |
| 8 | `src/services/catalog.test.js` | `pagination rejects invalid and excessive values` | `src/services/catalog.js` | 0.46 ms | **PASS** |
| 9 | `src/services/catalog.test.js` | `search input is trimmed, escaped, and bounded` | `src/services/catalog.js` | 0.37 ms | **PASS** |
| 10 | `src/services/catalog.test.js` | `public quiz serializer excludes internal fields` | `src/services/catalog.js` | 0.23 ms | **PASS** |
| 11 | `src/services/passwordReset.test.js` | `reset request stores a hash and expires after fifteen minutes` | `src/services/passwordReset.js` | 4.30 ms | **PASS** |
| 12 | `src/services/passwordReset.test.js` | `unknown accounts produce no reset token` | `src/services/passwordReset.js` | 0.15 ms | **PASS** |
| 13 | `src/services/passwordReset.test.js` | `expired reset tokens cannot be used` | `src/services/passwordReset.js` | 0.47 ms | **PASS** |
| 14 | `src/services/passwordReset.test.js` | `invalid and already-used reset tokens cannot be used (invalid)` | `src/services/passwordReset.js` | 0.19 ms | **PASS** |
| 15 | `src/services/passwordReset.test.js` | `invalid and already-used reset tokens cannot be used (already used)` | `src/services/passwordReset.js` | 0.39 ms | **PASS** |
| 16 | `src/services/passwordReset.test.js` | `a valid token is consumed, changes the password, and revokes older sessions` | `src/services/passwordReset.js` | 0.75 ms | **PASS** |
| 17 | `src/services/questions.test.js` | `parseQuestion validates well-formed multiple-choice questions` | `src/services/questions.js` | 1.29 ms | **PASS** |
| 18 | `src/services/questions.test.js` | `parseQuestion rejects invalid inputs, out-of-range indices, and bad option counts` | `src/services/questions.js` | 0.17 ms | **PASS** |
| 19 | `src/services/questions.test.js` | `slugify normalizes category names into URL-safe slugs` | `src/services/questions.js` | 0.23 ms | **PASS** |
| 20 | `src/services/subjects.test.js` | `parseSyllabus groups topic lines under numbered units` | `src/services/subjects.js` | 1.60 ms | **PASS** |
| 21 | `src/services/subjects.test.js` | `parseSyllabus keeps unnumbered text in a Full Syllabus unit` | `src/services/subjects.js` | 0.15 ms | **PASS** |
| 22 | `src/services/subjects.test.js` | `parseSyllabus ignores blank lines and applies safe unit and topic limits` | `src/services/subjects.js` | 0.55 ms | **PASS** |
| 23 | `src/services/passwordReset.test.js` | `subtest group: invalid and already-used reset tokens` | `src/services/passwordReset.js` | 1.20 ms | **PASS** |

---

## 3. Raw Test Runner Output

```text
✔ health endpoint reports the API is ready (40.4061ms)
✔ extractJsonArray handles fenced and prose-wrapped replies (0.7163ms)
✔ normalizeGenerated accepts both option shapes and drops malformed items (0.6373ms)
✔ chintsFallbackQuestions drafts valid MCQs from syllabus topics when offline (0.5442ms)
✔ calculateScore computes score and two-decimal percentage accurately (1.0891ms)
✔ attemptView hides correctOption while in-progress and reveals breakdown on review (0.9202ms)
✔ pagination defaults to page 1 and 12 items (1.5905ms)
✔ pagination rejects invalid and excessive values (0.4613ms)
✔ search input is trimmed, escaped, and bounded (0.3683ms)
✔ public quiz serializer excludes internal fields (0.2297ms)
✔ reset request stores a hash and expires after fifteen minutes (4.2972ms)
✔ unknown accounts produce no reset token (0.1539ms)
✔ expired reset tokens cannot be used (0.4662ms)
▶ invalid and already-used reset tokens cannot be used
  ✔ invalid (0.1913ms)
  ✔ already used (0.393ms)
✔ invalid and already-used reset tokens cannot be used (1.1971ms)
✔ a valid token is consumed, changes the password, and revokes older sessions (0.7536ms)
✔ parseQuestion validates well-formed multiple-choice questions (1.2938ms)
✔ parseQuestion rejects invalid inputs, out-of-range indices, and bad option counts (0.1666ms)
✔ slugify normalizes category names into URL-safe slugs (0.2261ms)
✔ parseSyllabus groups topic lines under numbered units (1.595ms)
✔ parseSyllabus keeps unnumbered text in a Full Syllabus unit (0.1492ms)
✔ parseSyllabus ignores blank lines and applies safe unit and topic limits (0.5543ms)
ℹ tests 23 | pass 23 | fail 0 | duration_ms 1686.53
```

---

## 4. Reproduce Locally

```bash
npm --prefix server test
```

