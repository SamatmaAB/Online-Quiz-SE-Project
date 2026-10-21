# Online Quiz System

MERN-based online quiz system. The first implementation slice establishes the Express/MongoDB API and secure user registration/login.

## Stack
- Node.js and Express API
- MongoDB with Mongoose
- bcrypt password hashing
- JWT bearer tokens (two-hour expiry)
- Helmet, restricted CORS, JSON request-size limit, and rate limiting on authentication endpoints

## Run the API locally
1. Install Node.js 20 or newer and run MongoDB locally, or create a MongoDB Atlas database.
2. Copy `.env.example` to `server/.env`.
3. Set `MONGODB_URI` and replace `JWT_SECRET` with a long random value of at least 32 characters.
4. From the repository root, run:
   ```bash
   npm --prefix server install
   npm run server:dev
   ```
5. The health endpoint is available at http://localhost:5000/api/health.

## Authentication API
- `POST /api/auth/register` with JSON `{ "name": "Ada Lovelace", "email": "ada@example.com", "password": "a-long-password" }`. Returns HTTP 201 with a bearer token and public profile.
- `POST /api/auth/login` with JSON `{ "email": "ada@example.com", "password": "a-long-password" }`. Returns a token and public profile.
- Duplicate emails return HTTP 409; invalid inputs return HTTP 400; invalid login credentials return HTTP 401.

Passwords are hashed with bcrypt and are never returned by the API. New accounts receive the standard `user` role; the public registration route cannot assign administrator privileges. Keep `server/.env` out of version control. The next client implementation can send the token as `Authorization: Bearer <token>`.

## Quiz and attempt API

Send the login or registration token in the `Authorization: Bearer <token>` header for every authenticated endpoint. Administrator routes require a user whose database role is `admin`; public registration intentionally cannot grant that role. To promote a trusted account locally, connect to the configured database and run `db.users.updateOne({ email: "admin@example.com" }, { $set: { role: "admin" } })` in `mongosh`.

### Quiz catalog
- `GET /api/quizzes` lists published quizzes. Optional filters: `category` and `difficulty` (`easy`, `medium`, or `hard`).
- `GET /api/quizzes/:quizId` returns quiz details and questions without answer keys.
- `POST /api/quizzes` (admin) creates a quiz. Required fields: `title`, `category`, `difficulty`, and positive integer `durationMinutes` (maximum 600). Optional fields: `description`, `isPublished`, and `questions`.
- `PATCH /api/quizzes/:quizId` (admin) updates quiz details, duration, difficulty, category, or publication status.
- `POST /api/quizzes/:quizId/questions` (admin) adds a question. Use `{ "prompt": "...", "options": ["...", "..."], "correctOption": 0 }`; `correctOption` is a zero-based option index.
- `PATCH /api/quizzes/:quizId/questions/:questionId` (admin) replaces a question. `DELETE` on the same path removes it.

Questions need 2–6 non-empty options. Correct answers are never included in catalog or start-attempt responses.

