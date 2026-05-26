# Repository Guidelines

## Project Structure & Module Organization

This repository is a compact Node.js/Express application for the Wuhao Zhiyuan decision assistant. Server code lives in `src/`: `server.js` wires routes and middleware, `auth.js` handles sessions, `mbti.js` contains assessment scoring, `ai.js` wraps DashScope/mock replies, `report.js` generates PDFs, and `store.js` manages local JSON persistence. Browser assets live in `public/` (`index.html`, `app.js`, `styles.css`). Operational notes are in `docs/`, while `tasks.md` tracks product scope, deployment state, mock markers, and rollback notes. Tests are colocated with source files, currently `src/mbti.test.js`.

## Build, Test, and Development Commands

- `npm install`: install runtime dependencies from `package-lock.json`.
- `npm start`: run `src/server.js` on `PORT` or the default `18082`.
- `PORT=18082 npm start`: start the local service at `http://127.0.0.1:18082`.
- `npm run dev`: run the same server with `NODE_ENV=development`.
- `npm test`: run all tests with Node's built-in test runner.

## Coding Style & Naming Conventions

Use CommonJS modules (`require`, `module.exports`) and keep changes consistent with the existing two-space indentation style. Prefer small functions with explicit names such as `requireUser`, `scoreMbti`, and `generateReport`. Use camelCase for variables/functions, lowercase route paths, and clear environment variable names such as `SESSION_SECRET` and `DASHSCOPE_MODEL`. Avoid new dependencies unless they remove meaningful complexity.

## Testing Guidelines

Tests use `node:test` and `node:assert/strict`. Name test files with the `*.test.js` suffix and place them near the module under test. Add focused tests for scoring, validation, storage behavior, and route-level regressions when modifying shared logic. Run `npm test` before committing; if a browser or deployment behavior cannot be automated, document the manual check in the PR.

## Commit & Pull Request Guidelines

Recent history uses concise English commit messages such as `Build zhiyuan decision assistant MVP` and `Complete zhiyuan production deployment`, with occasional conventional prefixes like `chore:`. Keep commits short, imperative, and scoped to one change. Pull requests should describe the user-visible change, list verification commands, call out environment/config changes, and include screenshots for UI changes or sample PDF/report output when relevant.

## Security & Configuration Tips

Never commit secrets, API keys, production `.env` files, or generated user data. Configure `SESSION_SECRET`, `DASHSCOPE_API_KEY` or `ALIYUN_API_KEY`, and `DASHSCOPE_MODEL` outside the repository. The app falls back to mock AI replies without an API key; make that explicit when reporting test results. Local persistence uses `data/store.json`, so back it up before destructive data tests.
