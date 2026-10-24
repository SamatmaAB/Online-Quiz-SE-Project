# Quizly client

React + Vite interface for browsing published quizzes and filtering by category or title.

## Development

1. Start the API from the repository root with `npm run server:dev`.
2. In another terminal, run `npm --prefix client install`.
3. Run `npm --prefix client run dev` and open http://localhost:5173.

Vite proxies `/api` requests to the API at http://localhost:5000. Set `CLIENT_ORIGIN` in the server environment if the client uses a different origin.

The catalog UI includes search, category chips, paginated results, loading/error/empty states, difficulty and quiz metadata. The Start quiz control is intentionally disabled until quiz attempts and submission are implemented in a later sprint.
