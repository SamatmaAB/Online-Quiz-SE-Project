# Deploy to Vercel

The client and API are separate Vercel projects from this repository. The API requires MongoDB; password reset emails also require SMTP settings.

## 1. Deploy the API

Import this Git repository as a Vercel project and set its **Root Directory** to `server`. Vercel can deploy the Express application from `src/index.js`.

Set these Production environment variables in the API project:

| Variable | Value |
| --- | --- |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | A random secret with at least 32 characters |
| `CLIENT_ORIGIN` | The client project's production URL |

For password reset email, also set `SMTP_HOST`, `SMTP_PORT`, and `MAIL_FROM`. Set `SMTP_USER` and `SMTP_PASS` if your mail host requires authentication. `SMTP_SECURE` is optional; it defaults to secure SMTP for port 465.

After deployment, confirm `https://<api-domain>/api/health` returns `{"status":"ok"}`.

## 2. Deploy the client

Import the same repository as another Vercel project and set its **Root Directory** to `client`. Use the Vite defaults: build command `npm run build` and output directory `dist`.

Set `VITE_API_BASE_URL` to the API project's origin, for example `https://quiz-api.vercel.app` (no trailing slash). Vite embeds this value at build time, so redeploy after changing it.

## 3. Verify

Open the client deployment and check that categories and quizzes load. Then test registration, sign-in, starting and submitting a quiz, and password reset if SMTP is configured. Keep credentials in Vercel's environment settings; do not commit secret values.
