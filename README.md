# Lerno - AI Tutoring for Every CBSE Student

A personal tutor for every student, built around the NCERT curriculum.

**Live demo: https://lerno.in**

---

## Try It (No Setup Needed)

**Option 1 - Use the demo account (instant access):**
- Email: `demo@lerno.in`
- Password: `demo@123`
- Grade 11, all 6 subjects pre-loaded - lands straight on the dashboard

**Option 2 - Sign up with your own account:**
- Go to https://lerno.in and click **Get Started**
- Create an account, complete the short onboarding (picks your grade + subjects)
- Takes about 2 minutes

---

## What It Does

**Ask Mode** is free-form Q&A. You pick your subject and chapter, type your question, and get a proper answer with citations back to the NCERT content. It understands context - if you ask a follow-up, it knows what you were asking before. You can also upload a photo of a textbook page or a handwritten problem and it'll explain it.

**Learn Mode** is more structured. It takes you through a chapter topic by topic, starts with a quick diagnostic to see what you already know, and then guides you through the gaps. It tracks what you've covered and picks up where you left off. The idea is that it works like a tutor who's actually read your textbook, not a generic chatbot.

**Study Feed** is a card-based practice mode - swipe through MCQs and short-answer questions for any chapter you're studying. It's meant for quick 10-minute revision sessions, not deep learning. Both types of questions are auto-evaluated.

---

## Why We Built It

Most students in India have exactly one resource for understanding their syllabus - the NCERT textbook. Private tutors exist but are expensive and unavailable in smaller cities. We wanted to build something that gives every student access to the kind of personalised help that used to only exist if you could afford it. This directly addresses SDG 4 (Quality Education) - not by digitising a textbook, but by making a genuinely responsive learning experience available to anyone with a browser.

---

## How It Works

```
Student question
       │
       ▼
┌─────────────────────┐
│   Task Detection    │  classify: explain / quiz / solve / notes / summary
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│   Query Rewriter    │  Gemini lite model rewrites query for better retrieval
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│     Embedding       │  OpenAI text-embedding-3-small (1536-dim)
└────────┬────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│         Qdrant Hybrid Search        │
│  dense vector + full-text, merged   │
│  via Reciprocal Rank Fusion (RRF)   │
└────────┬────────────────────────────┘
         │  top NCERT chunks
         ▼
┌─────────────────────────────────────┐
│         System Prompt Builder       │
│  subject format rules +             │
│  student memory (weak topics,       │
│  learning pace, past mistakes)      │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────┐
│   Gemini Streaming  │  response with [N] citation markers
└────────┬────────────┘
         │
         ▼
  Citations resolved → saved to DB
```

Each subject also has its own response format rules - maths answers follow a formula -> given/find/solution structure, history uses background -> events -> significance, and so on.

Student memory is per-subject and tracks weak topics, strong topics, common mistakes, and learning pace. It's seeded during onboarding and updated after every session.

---

## Tech Stack

- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Next.js API routes, Supabase (Postgres + Auth + Storage)
- **LLM:** Google Gemini 2.5 Flash via Vertex AI
- **Embeddings:** OpenAI text-embedding-3-small
- **Vector DB:** Qdrant (hybrid search)
- **Math rendering:** KaTeX
- **Auth:** Supabase SSR with cookie-based sessions

---

## Repository Structure

```
app/
  (marketing)/        landing page
  portal/             student-facing app (auth, onboarding, learn, ask, study)
  api/
    tutor/            Ask Mode - chat, sessions, messages, file upload
    learn/            Learn Mode - kickoff, diagnostics, progress, topics
    study/            Study Feed - question feed, attempts, evaluation
components/           shared UI
lib/
  ai/                 RAG pipeline, memory system, prompts, embeddings
  chapters.ts         NCERT chapter/subject data for grades 6–12
hooks/                shared React hooks
utils/supabase/       Supabase client setup (server, browser, admin, middleware)
supabase_schema.sql   full database schema
```

---

## Running Locally

You'll need API keys for Supabase, OpenAI (embeddings), Qdrant, and either Vertex AI or Gemini AI Studio.

```bash
# install dependencies
npm install

# set up env
cp .env.example .env
# fill in the values - comments in .env.example explain each one

# set up Qdrant vector indexes (one-time)
npm run qdrant:setup

# start dev server
npm run dev
```

App runs at `http://localhost:3000` (marketing) and `http://app.localhost:3000` (student portal).

---

## Built By

**Team Lerno** - YCS 2025–26

- Ahaan Sirohia
- Hardik Choudhary
- Siddhant Bajaj
