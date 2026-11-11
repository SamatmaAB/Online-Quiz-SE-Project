# Test Cases – Online Quiz Management System

- **Project Name:** Online Quiz Management System  
- **Document Version:** 2.0 (Updated for Sprint 1, Sprint 2 & Sprint 3)  
- **Document Type:** Software Testing & Traceability Documentation  
- **Standard:** IEEE 829 Software Test Documentation  

---

## 1. Introduction

This document specifies the functional, non-functional, security, and Sprint-3 feature test cases for the **Online Quiz Management System**. All test cases have been updated to reflect Sprint 1 (Core Auth, Timed Quiz Engine, Scoring), Sprint 2 (Catalog Filtering, Sorting, Password Reset, Security Hardening), and Sprint 3 (Subject & Unit Syllabus Management, Chints AI Question Generation, Student/Teacher Role Selection, Account-Scoped Quiz Privacy, and Direct Share Links).

---

## 2. Test Cases & SRS Traceability

| Test Case ID | SRS Ref | Test Scenario | Test Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- |
| **TC-01** | FR-01 | Register as Student or Teacher | Select "Student" or "Teacher" on Register, enter name, email, and 8+ char password, and submit. | Account is created (`HTTP 201`), role is assigned (`user` for Student, `admin` for Teacher), and JWT is issued. |
| **TC-02** | FR-02 | Login with valid credentials | Enter a registered email and password, then click **Sign in**. | User logs in (`HTTP 200`) and lands on the full-width Dashboard. |
| **TC-03** | FR-02, SEC-01 | Login with invalid credentials | Enter an incorrect email or password. | System returns `HTTP 401` (`"Invalid email or password"`) without leaking account existence. |
| **TC-04** | FR-02, NFR-03 | Login/Register with empty or invalid fields | Leave fields empty or enter a password under 8 characters. | Form validation and API validation (`HTTP 400`) block submission with clear guidance. |
| **TC-05** | FR-03 | View available quizzes (Role-scoped visibility) | Log in and open **Explore Catalog**. | Students see built-in starter quizzes + their own created quizzes; Teachers (Admins) see all published quizzes across all accounts. |
| **TC-06** | FR-04 | Filter & sort quiz catalog | Filter by Category chip, Difficulty (`easy`/`medium`/`hard`), Search keyword, and Sort (`Newest`, `Title A–Z`, `Shortest`). | Matching published quizzes and pagination metadata are returned (`HTTP 200`). |
| **TC-07** | FR-05 | Start a timed quiz attempt | Click **Start quiz** on any published quiz card. | Attempt is created (`HTTP 201`) with `expiresAt` timestamp and question prompts (without exposing `correctOption`). |
| **TC-08** | FR-06 | Display quiz questions & countdown timer | Open an active attempt in the Quiz Player. | Questions, options (A–D), progress bar, question navigator grid, and live countdown timer are displayed. |
| **TC-09** | FR-07 | Select and auto-save an answer | Select an option for a question. | Selection is highlighted and auto-saved via `PATCH /api/attempts/:id/answers` (`"All answers saved"`). |
| **TC-10** | FR-07 | Change an answer before submission | Select another option for the same question before submitting. | Latest selection replaces previous choice and updates saved state. |
| **TC-11** | FR-08 | Submit a completed quiz | Answer all questions and click **Submit quiz**. | Attempt transitions to `submitted`, score and percentage are calculated, and full answer review is shown. |
| **TC-12** | FR-08 | Block early submission with unanswered questions | Leave one or more questions unanswered while time remains and attempt to submit. | Submission is blocked (`HTTP 400` / UI prompt) asking user to answer remaining questions; auto-submits when timer expires. |
| **TC-13** | FR-09 | View quiz results & answer breakdown | Submit a quiz or open a past attempt from **Attempt History**. | Score ring, percentage, correct/incorrect badge per question, user's choice, and correct answer key are displayed. |
| **TC-14** | FR-08, SEC-02 | Prevent duplicate submission or tampering | Attempt to submit or modify answers on an already submitted/timed-out attempt. | API prevents modification (`HTTP 409` on `PATCH /answers`, idempotent return on `POST /submit`). |
| **TC-15** | SEC-02 | Handle invalid quiz access | Open `#/quiz/<invalidId>` or request `GET /api/quizzes/<invalidId>`. | API returns `HTTP 400` / `HTTP 404` and UI displays an unavailable-quiz state. |
| **TC-16** | SEC-03 | Validate user input & regex escaping | Enter special regex characters (`a.b*+?`) in search or out-of-range fields in quiz creation. | Input is sanitized/escaped safely and invalid payloads return `HTTP 400`. |
| **TC-17** | FR-10, SEC-01 | Logout & token revocation | Click user menu → **Sign out**. | Token SHA-256 hash is stored in `RevokedToken` (`HTTP 200`) and subsequent requests with that JWT return `HTTP 401`. |
| **TC-18** | FR-11 (Sprint 3) | Enroll in built-in Subject & view Unit syllabus | Open **Subjects & Units**, enroll in **Software Engineering (SE)**, and open **Unit 1**. | Subject status becomes `enrolled`; Unit 1 displays its syllabus topics and unit-specific quizzes. |
| **TC-19** | FR-12 (Sprint 3) | Add Custom Subject with Chints syllabus parser | Click **+ Add custom subject**, enter name/code, paste multi-unit syllabus text, and submit. | Chints splits syllabus into numbered units and topics (`HTTP 201`) and enrolls the user automatically. |
| **TC-20** | FR-13 (Sprint 3) | Generate MCQs with Chints AI | In **Quiz Studio**, select syllabus topics (or enter custom topics) and click **Ask Chints for 5 questions**. | Chints (`POST /api/ai/generate-questions`) returns 5 validated 4-option MCQs ready for review/editing (`HTTP 200`). |
| **TC-21** | FR-14 (Sprint 3) | Account-private Student quiz + Shareable Test Link | Create & publish a quiz as a Student, verify a second Student cannot see it in Catalog, then click **Share** and open `#/quiz/:quizId` as the second Student. | Quiz stays private to the creator's catalog (and visible to Teachers/Admins), while anyone with the Share Link `#/quiz/:quizId` can open and take the test. |
| **TC-22** | FR-15 (Sprint 3) | Teacher (Admin) Console oversight | Log in as a Teacher (`role: "admin"`) and open **Teacher Console**. | Teacher views platform KPIs, all student- and teacher-created quizzes, all student attempt results, categories, and user roles. |

---

## 3. Test Execution Record

All 22 test cases were executed against the integrated MERN + Chints AI system on **11 November 2026**.

| Test Case ID | Actual Result | Status |
| :--- | :--- | :--- |
| **TC-01** | Student (`role: "user"`) and Teacher (`role: "admin"`) accounts registered and verified (`HTTP 201`). | **Passed** |
| **TC-02** | Valid credentials returned signed 2-hour JWT and user profile (`HTTP 200`). | **Passed** |
| **TC-03** | Invalid password rejected with `HTTP 401 Invalid email or password`. | **Passed** |
| **TC-04** | Short passwords and missing fields rejected by client & server validation (`HTTP 400`). | **Passed** |
| **TC-05** | Student catalog showed only starter + own quizzes; Teacher catalog showed all published quizzes. | **Passed** |
| **TC-06** | Category, difficulty (`easy`/`medium`/`hard`), search, and sort (`title`/`shortest`) returned accurate subsets. | **Passed** |
| **TC-07** | `POST /api/attempts` created timed attempt (`HTTP 201`) with `correctOption` stripped from payload. | **Passed** |
| **TC-08** | Quiz Player rendered question card, option buttons, navigator dots, and live `MM:SS` countdown. | **Passed** |
| **TC-09** | Selecting an option debounced `PATCH /api/attempts/:id/answers` and persisted selection (`HTTP 200`). | **Passed** |
| **TC-10** | Changing an option updated `selectedOption` in state and persisted latest answer in MongoDB. | **Passed** |
| **TC-11** | `POST /api/attempts/:id/submit` scored `2/2` (`100%`) and transitioned status to `submitted`. | **Passed** |
| **TC-12** | Unanswered submission before expiry returned `HTTP 400 Answer every question before submitting`. | **Passed** |
| **TC-13** | Result view displayed score ring, percentage badge, and per-question answer review. | **Passed** |
| **TC-14** | Modifying answers after submission returned `HTTP 409 This attempt is already closed`. | **Passed** |
| **TC-15** | Invalid quiz ID returned `HTTP 400`/`404` and rendered empty error state cleanly. | **Passed** |
| **TC-16** | Special regex characters escaped by `normalizeSearch()`; invalid question counts rejected (`HTTP 400`). | **Passed** |
| **TC-17** | `POST /api/auth/logout` stored SHA-256 token hash in `RevokedToken` and invalidated session. | **Passed** |
| **TC-18** | Enrolling in `SE` unlocked all 4 syllabus units and listed unit quizzes (`HTTP 200`). | **Passed** |
| **TC-19** | Custom syllabus with `Unit 1` and `Unit 2` parsed into structured units & topics (`HTTP 201`). | **Passed** |
| **TC-20** | Chints AI (`gemini-3.8-flash` + syllabus engine fallback) drafted 5 valid 4-option MCQs (`HTTP 200`). | **Passed** |
| **TC-21** | Student-generated quiz remained private to creator + Teachers in listings, and opened via `#/quiz/:quizId` Share Link. | **Passed** |
| **TC-22** | Teacher Console displayed all accounts' quizzes, student attempt scores, categories, and role controls (`HTTP 200`). | **Passed** |

---

## 4. Conclusion

All **22/22** functional, security, and Sprint-3 test cases executed and **Passed** with zero defects. Detailed automated unit test logs, system validation traces, line coverage, and branch coverage metrics are archived in the `docs/` folder.
