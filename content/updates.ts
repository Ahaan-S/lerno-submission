/**
 * Product updates — each entry is a full post (same shape as blog posts).
 *
 * Images: public/marketing/updates/<slug>/ → /marketing/updates/<slug>/...
 * Optional cover + in-body markdown images (keep visuals few — usually ≤3 files total).
 */
export interface UpdatePost {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  readingTimeMin: number;
  tags: string[];
  content: string;
  coverImage?: string;
  coverAlt?: string;
}

export const UPDATE_POSTS: UpdatePost[] = [
  {
    slug: "study-feed",
    title: "Study Feed — snap-to-card practice",
    description:
      "A vertical practice feed for CBSE-style questions: swipe through cards, answer MCQs and short answers, and sync progress with the same mastery signals as the AI tutor.",
    publishedAt: "2026-04-05",
    readingTimeMin: 8,
    tags: ["Feature"],
    coverImage: "/marketing/updates/study-feed/cover.webp",
    coverAlt: "Study Feed — practice questions in Lerno",
    content: `
Study Feed is Lerno's **practice surface**: a **snap-to-card** feed of questions from your **grade and curriculum**, built for short sessions when you want reps instead of a long chat.

Each card is one question. You answer, see feedback, and move on — the feed keeps serving the next best card for how you are doing.

![Study Feed — question card in the snap viewport](/marketing/updates/study-feed/01-feed-card.webp)

## What you use it for

- **Quick revision** — a few minutes between classes or before a unit test.
- **Mixed practice** — MCQs and short answers drawn from the same **chapter and subject** structure your school follows.
- **Honest reps** — the feed is allowed to **bring questions back** over time (spaced repetition), because that is how memory actually forms.

It pairs naturally with **Ask Mode**: use Ask when you need an explanation, use Study Feed when you need **volume and speed**.

## How a session is scoped

![Study Feed — filters and session controls](/marketing/updates/study-feed/02-filters-session.webp)

You work inside **your profile grade** and filters you choose — for example **subject**, **chapter**, **question type**, **difficulty**, and (when it makes sense) **source** filters for the bank. The feed keeps a **practice session** open so attempts, streaks, and summaries stay tied to that sitting.

Questions come from Lerno's **curated item bank** (NCERT-aligned and exam-style material), not from random web trivia. That keeps difficulty and wording closer to what you will see in school.

## What happens when you answer (system overview)

At a high level:

1. **Session** — you start (or continue) a feed session so the app can batch questions and log progress cleanly.
2. **Next batch** — the server pulls a pool of candidates matching your filters and **scores** them for novelty, spaced repetition, diversity, and a **light nudge from your learner memory** (for example weak topics) — memory **informs** the mix; it does not fully dictate it.
3. **Attempt** — each answer is stored (correct, incorrect, skipped, or marked done for notebook work where relevant).
4. **Short answers** — written responses can be **evaluated with guidance** so you get more than a binary wrong when the question needs it.
5. **Mastery** — after enough signal on a topic, progress can flow into the **same topic mastery path** the tutor uses, so your Ask Mode experience benefits from **real practice**, not only chat.

In short: **filters → ranked queue → attempt → feedback → progress** — on a loop built for mobile-style scrolling.

## Capabilities shipped with Study Feed

- **Snap scrolling** — one dominant card at a time so you stay focused.
- **Multiple question types** — including **short answer** where it fits the syllabus.
- **Session stats** — keep track of how a sitting is going without getting in the way of flow.
- **Filters** — narrow to the unit you are preparing for, without leaving the feed.
- **Shared progress model** — practice in the feed can reinforce what the tutor already thinks you know or still need to work on.

## Honesty and limits

- **The bank is finite** — if filters are very tight, you might see fewer cards until you widen scope or come back another day.
- **Evaluation is automated** — short-answer checking is **guidance**, not a human examiner; use teacher feedback for board-exact phrasing.
- **Streaks and scores are motivational** — they are not official grades or predictions of exam results.

Study Feed is for **building fluency**. Your textbook and past papers stay the source of truth for what “exam perfect” looks like.
`.trim(),
  },
  {
    slug: "ask-mode",
    title: "Ask Mode — free-form NCERT tutoring",
    description:
      "Lerno's first product surface: a chapter-scoped chat that searches your textbook, streams grounded answers, and cites the pages it used.",
    publishedAt: "2026-03-24",
    readingTimeMin: 8,
    tags: ["Feature"],
    coverImage: "/marketing/updates/ask-mode/cover.webp",
    coverAlt: "Ask Mode — NCERT-grounded chat in Lerno",
    content: `
Ask Mode is where Lerno started: a **free-form AI tutor** that behaves like chat, but is constrained to **your grade, subject, and chapter** and backed by **retrieval from your NCERT text** instead of the open web.

Below is what shipped, how it behaves, and where we are honest.

![Ask Mode — chat layout and composer](/marketing/updates/ask-mode/01-chat-shell.webp)

## What you use it for

- **Homework doubts** — short questions when you are stuck on a definition, diagram, or worked example.
- **Exam-style practice** — ask for quick recall questions, short notes, or a slower walkthrough of a topic.
- **Same-book alignment** — every serious answer is built after the system **looks up passages** from the indexed textbook for that chapter, then explains in plain language.

Ask Mode is intentionally **student-led**: you choose the next question. There is no fixed lesson plan (that is what **Learn Mode** is for later in the roadmap).

## How a session is scoped

![Subject, grade, and chapter scope](/marketing/updates/ask-mode/02-chapter-scope.webp)

Each Ask session is tied to **one subject and one chapter** (or the chapter context you opened the chat from). That matters for three reasons:

1. **Search stays in the right book** — retrieval pulls from the correct grade and NCERT mapping, not a random mix of sources.
2. **Answers match what your teacher expects** — vocabulary and examples line up with the chapter you are on.
3. **History stays organised** — you can reopen a thread before a test and it still reflects that unit.

Your profile (grade, access, onboarding) still applies at the account level, but the *tutor’s evidence* is chapter-faithful.

## What happens when you send a message (system overview)

At a high level, each user message runs through the same tutoring pipeline Lerno uses elsewhere:

1. **Intent** — detect the kind of help you probably want (explain, notes, quiz-style prompts, solve a problem, summary) so formatting and length match the ask.
2. **Query preparation** — your text is turned into a **better search query** (clearer wording for the index).
3. **Embeddings + hybrid search** — the query is embedded; Lerno runs **semantic + keyword** retrieval over Qdrant chunks for that curriculum scope, then **merges and ranks** hits.
4. **Depth** — a small **complexity** signal (quick vs standard vs detailed) keeps tiny doubts short and big questions thorough.
5. **Prompting** — a system prompt adds **subject-specific style rules**, **citation rules**, and your **learner memory** (weak topics, pace, preferences) where appropriate.
6. **Generation** — a capable model (**Google Gemini** in our stack) streams the reply token by token.
7. **Citations** — when useful, the model inserts **numbered references** ([1], [2], …) that map back to chunk metadata (chapter, topic, pages where available).
8. **Persistence** — the assistant turn, citations, and retrieval diagnostics are **saved** with the session for history and quality work.

Nothing here replaces your NCERT book — it **routes the model through your book first** (RAG: retrieval-augmented generation).

## Capabilities shipped with Ask Mode

- **Streaming replies** — you read while the answer is still generating, which keeps long explanations tolerable on real networks.
- **Chapter-grounded RAG** — hybrid dense + lexical search, reciprocal-rank style fusion, deduplication, and capped context so prompts stay on-topic.
- **Task-aware answers** — different shapes for explanation vs practice vs “solve this” vs compact notes.
- **Personalisation** — your stored learner profile (from onboarding, chats, and practice) **nudges tone and emphasis** without inventing facts outside retrieved context.
- **Attachments** — **images and PDFs** can be sent with a question; vision-capable models read the page or diagram and still combine with textbook retrieval when relevant.
- **Math and science rendering** — responses use the same **markdown + math** path as the rest of the portal so equations are readable.
- **Feedback and rate limits** — sessions are **rate-limited** per user for stability; message feedback helps us improve bad turns.

## Honesty and limits

- **Models can be wrong** — especially if retrieval misses the right chunk or your question is ambiguous. Treat citations as a **pointer back to NCERT**, not a guarantee.
- **Not for academic dishonesty** — Ask Mode is for **understanding**; it is not meant to ghost-write work your school expects to be wholly yours.
- **Language** — the stack is tuned for **English and mixed English/Hinglish** student queries; quality can vary on other mixes.
`.trim(),
  },
];

export function getUpdatePost(slug: string): UpdatePost | null {
  return UPDATE_POSTS.find((p) => p.slug === slug) ?? null;
}
