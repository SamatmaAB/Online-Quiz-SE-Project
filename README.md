# Online Quiz System

MERN-based online quiz system with secure account access, a searchable quiz catalog, quiz administration, timed attempts, scoring, and a responsive React client.

## Stack

- React + Vite client
- Node.js and Express API
- MongoDB with Mongoose
- bcrypt password hashing and two-hour JWTs
- Helmet, restricted CORS, JSON request-size limit, and authentication rate limiting

## Run locally

1. Install Node.js 20+ and start MongoDB locally or prepare a MongoDB Atlas database.
2. Copy `.env.example` to `server/.env`.
3. Set `MONGODB_URI` and replace `JWT_SECRET` with a random value of at least 32 characters.
4. Start the API in one terminal:
   ```bash
   npm --prefix server install
   npm run server:dev
   ```
5. Start the client in another terminal:
   ```bash
   npm --prefix client install
   npm --prefix client run dev
   ```
6. Open http://localhost:5173. API health is available at http://localhost:5000/api/health.

## API

### Authentication

- `POST /api/auth/register` with `{ "name": "Ada Lovelace", "email": "ada@example.com", "password": "a-long-password" }` returns a bearer token and public profile.
- `POST /api/auth/login` with `{ "email": "ada@example.com", "password": "a-long-password" }` returns a token and public profile.
- `POST /api/auth/logout` with `Authorization: Bearer <token>` revokes the token until it expires. Revoked tokens are stored as SHA-256 hashes and expire automatically.
- Duplicate emails return HTTP 409; invalid inputs return HTTP 400; invalid credentials return HTTP 401.
- `POST /api/auth/password-reset/request` accepts an email address and returns the same response whether or not the account exists. `POST /api/auth/password-reset/complete` accepts `{ "token": "...", "password": "..." }`.

Passwords are hashed and never returned. Public registration always assigns the `user` role; clients cannot self-assign administrator privileges. Keep `server/.env` out of version control.

Password reset emails require `SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM`, and optional `SMTP_USER`/`SMTP_PASS` and `SMTP_SECURE` settings. Reset links expire after 15 minutes, are stored only as SHA-256 hashes, and can be used once. A successful reset invalidates existing login tokens. The request endpoint is rate limited and does not reveal whether an email belongs to an account.

### Quiz discovery

- `GET /api/categories` returns active categories sorted by name.
- `GET /api/quizzes?page=1&limit=9` returns published quizzes with category details and pagination metadata.
- `GET /api/quizzes?category=science` filters by category slug.
- `GET /api/quizzes?search=biology` searches quiz titles. The optional `difficulty` filter accepts `easy`, `medium`, `hard`, `beginner`, `intermediate`, or `advanced`.
- `GET /api/quizzes/:quizId` returns published quiz details and questions without answer keys.

Catalog entries must be published and reference an active category.

### Quiz administration

Send the login token in the `Authorization: Bearer <token>` header. Administrator routes require a database user with the `admin` role. To promote a trusted account locally, run `db.users.updateOne({ email: "admin@example.com" }, { $set: { role: "admin" } })` in `mongosh`.

- `POST /api/quizzes` creates a quiz. Required fields: `title`, an active category name or slug, supported `difficulty`, and positive integer `durationMinutes` (maximum 600). Optional fields: `description`, `isPublished`, and `questions`.
- `PATCH /api/quizzes/:quizId` updates quiz details, duration, difficulty, category, or publication status.
- `POST /api/quizzes/:quizId/questions` adds a question. Use `{ "prompt": "...", "options": ["...", "..."], "correctOption": 0 }`; the correct option index starts at zero.
- `PATCH /api/quizzes/:quizId/questions/:questionId` replaces a question. `DELETE` on the same path removes it.

Questions require 2–6 non-empty options. Correct answers are omitted from catalog and attempt-start responses.

### Timed attempts and results

- `POST /api/attempts` starts an attempt with `{ "quizId": "..." }`. The response includes `startedAt`, `expiresAt`, `remainingSeconds`, and the question set. The server snapshots questions and answer keys so later quiz edits cannot change an existing result.
- `PATCH /api/attempts/:attemptId/answers` saves selected answers during an active attempt. Send `{ "answers": [{ "questionId": "...", "selectedOption": 1 }] }`; an empty array leaves saved answers unchanged.
- `GET /api/attempts/:attemptId` returns the current attempt. Once it expires, this request records a timed-out submission using saved answers.
- `POST /api/attempts/:attemptId/submit` accepts the same answer format. All questions must be answered before the deadline; unanswered questions are permitted after it. Repeated submissions return the saved result.
- `GET /api/attempts/mine` returns the signed-in user's attempt history and answer review for completed attempts.
- `GET /api/attempts/admin/results` returns stored results for administrators. Optional filters: `quizId` and `userId`.

The client can display a countdown using `remainingSeconds`, save answers as they change, and submit when time reaches zero. Expired attempts are also finalized on the next attempt read or history request.

## Client

The client includes a responsive searchable quiz catalog, category filters, timed quiz attempts, answer selection and submission, score review with correct and incorrect answers, and registration, login, logout, and password reset controls.

## Checks

Run API helper tests with `npm --prefix server test` and build the client with `npm --prefix client run build`.
