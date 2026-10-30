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

## Current scope
This branch is an incremental Sprint 1 implementation. Quiz catalog, category filtering, timed attempts, submission, score review, and administrator APIs are not implemented in this initial authentication slice yet.
