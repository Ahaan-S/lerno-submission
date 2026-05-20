# Contributing to Lerno

A few things to know before you start writing code.

---

## Getting set up

Clone the repo and install dependencies:

```bash
git clone https://github.com/Ahaan-S/lerno-submission.git
cd lerno-submission
npm install
```

Copy the example env file and fill in the values:

```bash
cp .env.example .env.local
```

Run the dev server:

```bash
npm run dev
```

The app runs at `http://localhost:3000`. For portal routes, use `http://app.localhost:3000`.

One-time setup for Qdrant indexes (only needed if working on the search pipeline):

```bash
npm run qdrant:setup
```

---

## How we work

We use a simple branch → PR → review flow. Nothing goes into `main` directly.

**Always start by creating a branch:**

```bash
git checkout -b feature/what-youre-building
```

Name branches clearly — `feature/quiz-improvements`, `fix/memory-update-bug`, etc.

When you're done, push your branch and open a Pull Request on GitHub.

---

## A few rules

**Never commit `.env` or `.env.local`.** These are blocked by `.gitignore` but double-check before pushing. If you accidentally stage one, run `git reset HEAD .env.local` before committing.

**Don't push directly to `main`.** Always go through a PR.

**Keep PRs focused.** One feature or fix per PR. If you're working on something big, break it into smaller pieces.

**Write clear commit messages.** Not `fix stuff` — something like `fix: memory not updating after quiz result` is much better.

---

## Codebase overview

| Path | What it does |
|---|---|
| `app/api/tutor/chat/` | Main RAG pipeline — task detection, retrieval, streaming |
| `lib/ai/` | Memory system, prompts, embedding, Qdrant search |
| `lib/chapters.ts` | Chapter/subject data for all grades |
| `app/portal/` | All student-facing pages (dashboard, chat, onboarding) |
| `utils/supabase/` | Supabase client setup (server, browser, admin) |

---

## Questions

Message the team directly. Don't guess at something if you're unsure — especially in `lib/ai/` or anything touching the database.
