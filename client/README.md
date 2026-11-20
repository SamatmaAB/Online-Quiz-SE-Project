# Online Quiz System client

React + Vite interface for account management, subject and syllabus exploration, quiz creation, catalog search, timed quiz attempts, result review, and the teacher console. Chints provides quiz authoring help and an in-app assistant.

## Development

1. Start the API from the repository root with `npm run server:dev`.
2. In another terminal, run `npm --prefix client install`.
3. Run `npm --prefix client run dev` and open http://localhost:5173.

Vite proxies `/api` requests to the API at http://localhost:5000. Set `CLIENT_ORIGIN` in the server environment if the client uses a different origin.

The catalog UI includes search, category and difficulty filters, sorting, paginated results, and loading/error/empty states. Signed-in users can create and manage quizzes, take timed attempts, and review results. Teachers can access platform management tools.

For API routes, environment variables, and deployment setup, see the repository [README](../README.md) and [deployment guide](../DEPLOYMENT.md).
