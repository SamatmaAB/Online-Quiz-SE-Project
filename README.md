# Online Quiz System

MERN starter for the tasks assigned to SamatmaAB in Sprint 1. This branch implements only issue #3 (registration) and issue #4 (login/logout). Issues #5 (available quizzes) and #6 (quiz categories) are intentionally left for their assigned teammates.

## Requirements
- Node.js 20+
- MongoDB Community Server or MongoDB Atlas

## Setup
1. Copy server/.env.example to server/.env.
2. Set MONGODB_URI and replace JWT_SECRET with a random secret of at least 32 characters.
3. Install dependencies: npm install, npm --prefix server install, npm --prefix client install.
4. Run npm run dev from the repository root.

The React app runs at http://localhost:5173 and API at http://localhost:5000. The API requires MongoDB to be running.

## Endpoints
- GET /api/health
- POST /api/auth/register — validates name, email and password; hashes passwords using bcrypt; creates a session.
- POST /api/auth/login — verifies credentials and creates a session.
- POST /api/auth/logout — clears the session cookie.
- GET /api/auth/me — returns the current session user.

Security includes HttpOnly SameSite=Lax session cookies, JWT expiry, rate-limited auth routes, bounded JSON body size, Helmet headers and restricted CORS. Use HTTPS in production; add CSRF protection, email verification and password recovery before production launch.

## Tests
Run npm test for validation unit tests. Tests use Node's built-in runner and do not require MongoDB. Dependency installation and a full frontend build should be run locally before merging.
