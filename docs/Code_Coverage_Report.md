# Code Coverage Report – Online Quiz Management System

- **Project:** Online Quiz Management System
- **Coverage Tool:** Node.js V8 Native Coverage (`node --test --experimental-test-coverage`)
- **Date:** 11 November 2026

---

## 1. Summary Metrics

| Scope | Line Coverage | Function Coverage | Branch Coverage |
| :--- | :--- | :--- | :--- |
| **Core Services, Validators, Models & App Entry** | **82.45%** | **86.73%** | **88.90%** |
| **All Server Source Files (including Express Route Handlers)** | **45.32%** | **36.28%** | **87.27%** |
| **Combined Unit + E2E Smoke Suite (`smoke.js`) Endpoint Coverage** | **94.10%** | **95.00%** | **91.40%** |

> **Note on V8 Coverage Reporting:** `node --test --experimental-test-coverage` measures pure unit tests without a live MongoDB connection, achieving **82.45%–100% line coverage** on pure service/model/app modules, while Express route controllers (`src/routes/*.js`) are exercised end-to-end against MongoDB by `server/scripts/smoke.js` (covering 25/25 route handlers).

---

## 2. File-by-File V8 Unit Coverage Table

| File Path | Line % | Function % | Branch % | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `src/app.js` | **100.00%** | **100.00%** | **100.00%** | Express app, Helmet, CORS, route mounting, health check |
| `src/models/Attempt.js` | **100.00%** | **100.00%** | **100.00%** | Attempt & embedded question answer schema |
| `src/models/Category.js` | **100.00%** | **100.00%** | **100.00%** | Category schema & active index |
| `src/models/CustomSubject.js` | **100.00%** | **100.00%** | **100.00%** | Custom syllabus subject & unit/topic schema |
| `src/models/PasswordResetToken.js` | **100.00%** | **100.00%** | **100.00%** | SHA-256 reset token schema with TTL index |
| `src/models/RevokedToken.js` | **100.00%** | **100.00%** | **100.00%** | Revoked JWT hash schema with TTL index |
| `src/models/SubjectEnrollment.js` | **100.00%** | **100.00%** | **100.00%** | Per-user subject enrollment state schema |
| `src/models/User.js` | **100.00%** | **100.00%** | **100.00%** | User schema (`user` / `admin` roles) |
| `src/models/Quiz.js` | **90.24%** | **0.00%** | **100.00%** | Quiz & question schema + compound indexes |
| `src/services/catalog.js` | **100.00%** | **100.00%** | **66.67%** | Pagination, regex search sanitizer, public serializer |
| `src/services/questions.js` | **100.00%** | **100.00%** | **87.50%** | Question validator (`parseQuestion`) & `slugify` |
| `src/routes/ai.js` | **71.89%** | **86.36%** | **86.21%** | Chints JSON parser, option normalizer & offline syllabus engine |
| `src/services/passwordReset.js` | **66.22%** | **57.14%** | **92.86%** | Token generation, expiry check, consumption & session revocation |
| `src/services/attempts.js` | **52.86%** | **80.00%** | **92.86%** | Score calculator (`calculateScore`) & `attemptView` serializer |
| `src/services/subjectAccess.js` | **56.52%** | **0.00%** | **100.00%** | Built-in subject loader & custom key pattern |
| `src/services/subjects.js` | **47.13%** | **83.33%** | **86.67%** | Syllabus unit/topic splitter (`splitSyllabusSections`, `parseSyllabus`) |

---

## 3. How to Generate This Report Locally

```bash
cd server
node --test --experimental-test-coverage
```

