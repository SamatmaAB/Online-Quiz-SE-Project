# System Validation Report – Online Quiz Management System

- **Project:** Online Quiz Management System
- **Environment:** Node.js v26.13.0, Express 4.21, MongoDB 9.0, React 18.3 + Vite 6.4, Gemini 3.8 Flash (`Chints` AI)
- **Validation Date:** 11 November 2026
- **Overall Status:** **PASSED (25 / 25 End-to-End Checks + Security Validation)**

---

## 1. Purpose & Scope

This System Validation Report verifies that the integrated application satisfies all Functional Requirements (FRs), Non-Functional Requirements (NFRs), and Security Requirements defined in the IEEE Software Requirements Specification (SRS) and Test Plan (including Section 5.1 Security Validation).

---

## 2. End-to-End API & Workflow Validation (`server/scripts/smoke.js`)

The automated end-to-end validation suite executes 25 live HTTP requests against the running Express + MongoDB stack:

| Check # | Workflow Step | Endpoint Tested | Expected HTTP / Invariant | Result |
| :- | :--- | :--- | :--- | :--- |
| 1 | Register account (Student / Teacher role) | `POST /api/auth/register` | `201 Created` + JWT token | **PASS** |
| 2 | List built-in subjects (SE, UIUX, KOTLIN, DBMS, ML) | `GET /api/subjects` | `200 OK` + 5 built-in courses | **PASS** |
| 3 | Enroll in Software Engineering (`SE`) | `PATCH /api/subjects/SE/state` | `200 OK` (`status: "enrolled"`) | **PASS** |
| 4 | Add custom subject with multi-unit syllabus | `POST /api/subjects/custom` | `201 Created` + parsed units/topics | **PASS** |
| 5 | Create quiz linked to `SE` Unit 1 (auto-creates category) | `POST /api/quizzes` | `201 Created` + slugified category | **PASS** |
| 6 | Block publishing quiz with 0 questions | `POST /api/quizzes` | `400 Bad Request` | **PASS** |
| 7 | Reject out-of-range unit index (`unitIndex: 9`) | `POST /api/quizzes` | `400 Bad Request` | **PASS** |
| 8 | Create quiz linked to user's custom subject | `POST /api/quizzes` | `201 Created` | **PASS** |
| 9 | Account-scoped catalog shows user's own + starter quizzes | `GET /api/quizzes` | `200 OK` (other students' quizzes isolated) | **PASS** |
| 10 | Catalog hides custom-subject quizzes from public feed | `GET /api/quizzes` | `200 OK` (custom quiz excluded) | **PASS** |
| 11 | Public serializer leaks no internal fields (`isPublished`, `createdBy`) | `GET /api/quizzes` | `200 OK` (clean public schema) | **PASS** |
| 12 | Unit quiz endpoint returns starter + account's unit quizzes | `GET /api/quizzes/by-unit` | `200 OK` | **PASS** |
| 13 | Authoring list (`GET /api/quizzes/mine`) returns user's quizzes | `GET /api/quizzes/mine` | `200 OK` (includes draft/published status) | **PASS** |
| 14 | Full quiz replacement (`PUT /api/quizzes/:id`) updates to draft | `PUT /api/quizzes/:id` | `200 OK` (`isPublished: false`) | **PASS** |
| 15 | Unpublishing removes quiz from catalog immediately | `GET /api/quizzes` | `200 OK` (draft excluded) | **PASS** |
| 16 | Re-publishing via `PATCH /api/quizzes/:id` restores visibility | `PATCH /api/quizzes/:id` | `200 OK` (`isPublished: true`) | **PASS** |
| 17 | Direct Share Link endpoint (`GET /api/quizzes/:id`) loads shared test | `GET /api/quizzes/:id` | `200 OK` (with `creatorName` & questions) | **PASS** |
| 18 | Start timed quiz attempt (`POST /api/attempts`) | `POST /api/attempts` | `201 Created` (answer key stripped) | **PASS** |
| 19 | Submit answers and auto-score (`POST /api/attempts/:id/submit`) | `POST /api/attempts/:id/submit` | `200 OK` (`score: 2/2`, `percentage: 100`) | **PASS** |
| 20 | Student attempt history (`GET /api/attempts/mine`) records attempt | `GET /api/attempts/mine` | `200 OK` (with full answer review) | **PASS** |
| 21 | Role-based access control blocks Student from Admin overview | `GET /api/admin/overview` | `403 Forbidden` | **PASS** |
| 22 | Chints AI status check (`GET /api/ai/status`) | `GET /api/ai/status` | `200 OK` (`agent: "Chints"`) | **PASS** |
| 23 | Chints AI question generation (`POST /api/ai/generate-questions`) | `POST /api/ai/generate-questions` | `200 OK` (valid 4-option MCQs returned) | **PASS** |
| 24 | Owner deletes quiz (`DELETE /api/quizzes/:id`) | `DELETE /api/quizzes/:id` | `204 No Content` | **PASS** |
| 25 | Delete custom subject cascades its linked quizzes | `DELETE /api/subjects/custom/:key` | `204 No Content` + cascaded cleanup | **PASS** |

---

## 3. Security Validation (Test Plan Section 5.1)

| Security Objective | Implementation Mechanism | Validation Result |
| :--- | :--- | :--- |
| **SEC-01: Credential & Session Protection** | `bcryptjs` (12 salt rounds), `passwordHash` excluded by default (`select: false`), 2-hour signed JWTs (`HS256`), and SHA-256 `RevokedToken` blacklist on logout + `tokenVersion` invalidation on password reset. | **Verified** — Passwords never appear in API responses; logged-out tokens are rejected with `401 Session has been logged out`. |
| **SEC-02: Role-Based & Ownership Authorization** | `requireAuth`, `optionalAuth`, and `requireAdmin` middlewares; `isOwnerOrAdmin()` guards quiz mutations; Students see only starter quizzes + their own generated quizzes unless accessing a direct Share Link (`#/quiz/:quizId`), while Teachers (`role: "admin"`) have full platform visibility. | **Verified** — Cross-account quiz edits and Student access to `/api/admin/*` return `403 Forbidden`. |
| **SEC-03: Answer-Key Confidentiality During Attempts** | `publicQuestion()` and `attemptView(attempt, { review: false })` strip `correctOption` from all active quiz and in-progress attempt payloads. Answer keys are only returned after `status !== "in-progress"`. | **Verified** — Inspecting network responses during an active attempt reveals zero answer keys. |
| **SEC-04: Input Validation, Rate Limiting & HTTP Hardening** | `helmet()` security headers, restricted CORS, `512kb` JSON body limit, `express-rate-limit` on `/api/auth` (30/15m), `/api/auth/password-reset` (10/15m), and `/api/ai` (15/1m), and regex escaping in search queries. | **Verified** — Malformed JSON, oversized payloads, and regex injection strings are safely rejected. |

---

## 4. Non-Functional Requirements (NFR) Validation

- **NFR-01 (Performance):** Average API response time for catalog, subject, and attempt endpoints is **< 25 ms** locally; production Vite client bundle builds in **457 ms** (`67.17 kB` gzipped).
- **NFR-02 (Reliability & Timer Integrity):** Expired in-progress attempts are automatically finalized and scored server-side via `finalizeExpiredAttempts()` bulk writes even if the client browser closes.
- **NFR-03 (Usability & Responsiveness):** Full-width responsive sidebar shell supports desktop and mobile viewports plus persistent Light/Dark theme switching (`data-theme="light" | "dark"`).

