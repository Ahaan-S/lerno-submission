# Lerno — AI-Powered NCERT Tutor

> **YCS 2025–26 Submission** · SDG 4: Quality Education

**Live demo → [lerno.in](https://lerno.in)**

Lerno is an AI tutoring platform built for Indian students in grades 6–12. It maps to the NCERT curriculum and gives every student a personal tutor that knows their weak topics, explains concepts at their level, and adapts as they improve — making quality education accessible regardless of where a student lives or whether they can afford private tuition.

---

## SDG Alignment

**Goal 4: Quality Education** — *Ensure inclusive and equitable quality education and promote lifelong learning opportunities for all.*

India has 250 million school students. Most learn from a single textbook (NCERT) but have no access to personalised help outside the classroom. Lerno directly addresses this by:
- Providing 24/7 personalised explanations for every NCERT chapter (grades 6–12)
- Adapting to each student's pace, weak areas, and learning style
- Working entirely in the browser — no app download, no setup

---

## What It Does

| Feature | Description |
|---|---|
| **Ask Mode** | Free-form Q&A — ask anything from any NCERT chapter and get a cited, subject-aware answer |
| **Learn Mode** | Structured chapter-by-chapter guided learning with diagnostics and progress tracking |
| **Study Feed** | Snap-to-card practice questions (MCQ + short answer) for quick revision |
| **Adaptive Memory** | The AI remembers your weak topics, common mistakes, and learning pace across sessions |
| **Vision Input** | Upload a photo of a textbook page or handwritten question and get an explanation |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes, Supabase (Postgres + Auth + Storage) |
| AI / LLM | Google Gemini 2.5 Flash via Vertex AI |
| Embeddings | OpenAI `text-embedding-3-small` |
| Vector Search | Qdrant (hybrid dense + full-text, Reciprocal Rank Fusion) |
| Math Rendering | KaTeX |
| Monitoring | Sentry |

---

## How It Works

**RAG Pipeline** — Student questions go through query rewriting → embedding → hybrid Qdrant search → complexity classification → subject-specific system prompt → Gemini streaming response with `[N]` citations mapped back to NCERT chunk metadata.

**Student Memory** — Per-subject learner profiles track weak/strong topics, recent discussions, common mistakes, and preferred explanation style. Seeded from onboarding; updated by every chat and quiz result. Injected into the system prompt for genuine personalisation.

**Subject-Aware Formatting** — Each subject has its own response format rules. Math answers follow formula → given/find/solution. History answers follow background → events → causes → effects.

---

## Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# Fill in: Supabase, OpenAI, Qdrant, and Vertex AI / Gemini keys (see .env.example)

# 3. Initialize Qdrant vector indexes
npm run qdrant:setup

# 4. Start dev server
npm run dev
# → http://localhost:3000        (marketing site)
# → http://app.localhost:3000    (student portal)
```

> **Note for judges:** The live app at [lerno.in](https://lerno.in) is fully functional. Reach out for a demo account if you'd like to test without signing up.

---

## Project Structure

```
app/
  (marketing)/        # Landing page
  portal/             # Auth, onboarding, learn, ask, study feed
  api/                # API routes (tutor/, learn/, study/)
components/           # Shared UI components
lib/
  ai/                 # LLM pipeline, memory, prompts, RAG
  supabase/           # DB helpers
middleware.ts         # Supabase auth + subdomain routing
supabase_schema.sql   # Full database schema
```
