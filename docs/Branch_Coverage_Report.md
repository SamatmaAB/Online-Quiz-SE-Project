# Branch Coverage Report – Online Quiz Management System

- **Project:** Online Quiz Management System
- **Coverage Tool:** Node.js V8 Native Coverage (`node --test --experimental-test-coverage`)
- **Overall Unit Branch Coverage:** **87.27%**
- **Date:** 11 November 2026

---

## 1. Overview

Branch coverage measures the percentage of decision outcomes (`if/else`, ternary `? :`, logical `&&`/`||`, and guard clauses) exercised during automated testing. Across the server codebase, the automated test suite achieves **87.27% branch coverage**, exceeding standard software engineering quality gates (typically 75%–80%).

---

## 2. Decision-Branch Analysis by Subsystem

| Subsystem / Module | Branch % | Key Decision Branches Verified |
| :--- | :--- | :--- |
| **Question & Slug Validation (`src/services/questions.js`)** | **87.50%** | • Non-object / array input guard (`!input \|\| Array.isArray(input)`)<br>• Prompt length bounds (`1..1000` chars)<br>• Option count bounds (`2..6` options) & individual option length (`1..300` chars)<br>• `correctOption` integer & range check (`0 <= correctOption < options.length`)<br>• Empty/null input handling in `slugify()` |
| **Attempt Scoring & Review (`src/services/attempts.js`)** | **92.86%** | • Zero-question division-by-zero guard in `calculateScore()`<br>• Correct vs. incorrect option comparison (`selectedOption === correctOption`)<br>• `review: false` (hides `correctOption` while in-progress) vs. `review: true` (exposes `correctOption` & `isCorrect` after submission)<br>• `includeUser: true` vs. `false` in `attemptView()` |
| **Password Reset Security (`src/services/passwordReset.js`)** | **92.86%** | • Existing account vs. unknown email branch (timing-safe no-op)<br>• Token not found vs. already used (`usedAt !== null`) vs. expired (`expiresAt <= now`)<br>• Valid token consumption, bcrypt hashing, and `tokenVersion` increment |
| **Chints AI Normalizer & Fallback (`src/routes/ai.js`)** | **86.21%** | • Markdown code-fence stripping (` ```json ... ``` `) vs. prose-wrapped JSON array extraction vs. malformed JSON (`null` return)<br>• `options` array format vs. `option_a..option_d` prototype format<br>• Letter answer key (`"a".."d"`) vs. numeric string (`"0"`) vs. integer index<br>• Chints offline syllabus engine template rotation & distractor selection |
| **Syllabus Unit Parser (`src/services/subjects.js`)** | **86.67%** | • Numbered `Unit/Module/Chapter N` regex match vs. bulleted topic line<br>• Unnumbered syllabus fallback (`"Full Syllabus"` unit)<br>• Blank-line skipping and upper bounds (`40` units, `30` topics/unit) |
| **Catalog Pagination & Search (`src/services/catalog.js`)** | **66.67%** | • Default page/limit fallback (`page=1, limit=12`)<br>• Non-integer / negative page rejection<br>• Excessive page size rejection (`limit > 50`)<br>• Non-string search guard & regex special-character escaping |
| **Express App & Mongoose Models (`src/app.js`, `src/models/*`)** | **100.00%** | • `CLIENT_ORIGIN` comma-split & fallback<br>• Schema validation hooks & index registration |

---

## 3. End-to-End Authorization & Visibility Branches (`smoke.js`)

In addition to unit branch testing, the E2E validation script (`server/scripts/smoke.js`) verifies the HTTP route decision branches:
1. **Role Selection Branch (`POST /api/auth/register`):** `"teacher"` → `role: "admin"` vs. `"student"` → `role: "user"`.
2. **Account-Scoped Quiz Visibility Branch (`GET /api/quizzes` & `GET /api/quizzes/by-unit`):**
   - `req.user.role === "admin"` → returns all published quizzes across all student and teacher accounts.
   - `req.user.role === "user"` → returns only `{ createdBy: req.user.id }` + built-in starter quizzes (`{ createdBy: null }`).
   - Direct Share Link (`GET /api/quizzes/:quizId`) → allows any student with the shared URL (`#/quiz/:quizId`) to load and attempt the published test.
3. **Publish Guard Branch (`POST /api/quizzes`, `PUT /api/quizzes/:id`, `PATCH /api/quizzes/:id`):**
   - Rejects `isPublished: true` when `questions.length === 0` (`HTTP 400`/`409`), while allowing `isPublished: false` for empty drafts.


---

## Newly Covered Decision Branches

- `normalizeDifficulty()`: valid difficulty vs. fallback branch (`100%`).
- `computeGradeLetter()`: all 6 grade threshold branches (`S`, `A`, `B`, `C`, `D`, `F`) (`100%`).
- `summarizeCatalogQuizzes()`: `chints` vs. `manual` source counter branches (`100%`).
- `requireAdmin()`: admin pass-through vs. non-admin `403 Forbidden` branch (`100%`).
