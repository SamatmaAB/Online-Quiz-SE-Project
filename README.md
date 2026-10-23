# Online Quiz System

A MERN-based online quiz system. This Sprint 1 branch provides secure account registration/login, a public quiz catalog API, category browsing, and a responsive React catalog interface.

## Stack

- React + Vite client
- Node.js + Express API
- MongoDB + Mongoose
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
- `POST /api/auth/register` with JSON `{ "name": "Ada Lovelace", "email": "ada@example.com", "password": "a-long-password" }`. Returns HTTP 201 with a bearer token and public profile.
- `POST /api/auth/login` with JSON `{ "email": "ada@example.com", "password": "a-long-password" }`. Returns a token and public profile.
- Duplicate emails return HTTP 409; invalid inputs return HTTP 400; invalid credentials return HTTP 401.

### Quiz discovery
- `GET /api/categories` returns active categories sorted by name.
- `GET /api/quizzes?page=1&limit=9` returns published quizzes with category details and pagination metadata.
- `GET /api/quizzes?category=science` filters by category slug.
- `GET /api/quizzes?search=biology` searches quiz titles.
- `GET /api/quizzes/:quizId` returns one published quiz's public metadata.

Quiz responses deliberately omit private question/answer content. Catalog entries must be marked `isPublished: true` and reference an active category to appear.

## Security and scope

Passwords are hashed with bcrypt and are never returned by the API. Public registration always assigns the standard `user` role; clients cannot self-assign administrator privileges. Keep `server/.env` out of version control.

The catalog UI includes search, category filters, pagination, and loading/error/empty states. Starting attempts, quiz submission, scoring, logout token invalidation, and administration are outside these Sprint 1 discovery features and need later implementation.

## Tests

Run API helper tests with `npm --prefix server test`. Build the client with `npm --prefix client run build`. These commands should be run locally before merging; this change has not been executed in a live MongoDB environment here.
