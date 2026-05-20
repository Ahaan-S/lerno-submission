export interface BlogPost {
  slug: string;
  title: string;
  description: string;   // meta description + card excerpt
  publishedAt: string;   // ISO date
  readingTimeMin: number;
  tags: string[];
  content: string;       // markdown
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "how-lernos-ai-tutor-works",
    title: "How Lerno's AI Tutor Works",
    description:
      "Most chatbots guess from the whole web. Lerno looks up your NCERT first, then answers — here is the simple version of how that works.",
    publishedAt: "2026-04-14",
    readingTimeMin: 6,
    tags: ["Product"],
    content: `
Most AI chatbots answer from everything they have seen on the internet. That is fine for general questions — it is risky for board exams, where wording, diagrams, and definitions need to match **your** textbook.

Lerno does something simpler to describe: it **searches your NCERT like a smart index**, pulls the best-matching passages, and only then asks the AI to explain *using that material*. That pattern is called **RAG** (retrieval-augmented generation): retrieve first, generate second.

## Built for NCERT, not the whole web

Your session is tied to **grade, subject, and usually a chapter**. So the tutor is not mixing random sources or another board’s syllabus — it stays inside the book you are actually studying.

The goal is not a wall of pasted textbook text. It is an answer that **lines up with NCERT** and still reads like a tutor talking to you.

## From your message to the answer

Roughly this happens in order:

1. **Scope** — Your question is handled in the subject/chapter (or learn session) you picked, so search stays in the right part of the book.

2. **Task shape** — Lerno notices whether you want something like a normal explanation, short notes, a quiz, a problem worked out, or a summary — so the reply format matches what you asked.

3. **Search query** — Your message is cleaned up into a clearer search query (typos, casual phrasing, shorthand).

4. **Embeddings** — That query is turned into a numeric “meaning fingerprint” so the system can find relevant paragraphs even if your words do not match the book word-for-word.

5. **Hybrid search** — Lerno searches the textbook index in two ways at once: **by meaning** and **by keywords** (names, dates, exact NCERT terms). Results are merged so neither signal is ignored.

6. **Ranking** — Overlaps are removed and the best chunks are chosen so the model gets a **tight bundle of context**, not a pile of repeats.

7. **Length** — A quick guess decides if you need a short answer, a normal one, or a deeper one — so a small doubt does not turn into an essay.

8. **Instructions + you** — A system prompt keeps answers faithful to what was retrieved. **Subject rules** nudge format (for example maths vs history). **Your memory** (weak topics, pace, preferences from onboarding and usage) personalises the tone and emphasis.

9. **Generation** — A capable model (today, **Google Gemini** in Lerno’s setup) writes the answer, usually **streaming** so you can read as it appears. Photos or PDF pages can go to a **vision** model when you attach them.

10. **Citations** — When it makes sense, you see numbered markers like [1] or [2] that point back to **chapter/topic/page**-style source info so you can check the book.

11. **Save** — The reply and citations are stored with your chat so you can revisit them later.

*In one line:* find the right pages → pick answer style → search the book → rank → add rules and your profile → write → cite → save.

## Ask, Learn, and Study Feed

**Ask Mode** — You ask whatever you want, one message at a time; the steps above run each time.

**Learn Mode** — Same engine, but the app **walks you through a chapter** in order so you are less likely to skip gaps.

**Study Feed** — Quick practice cards. How you do there also feeds the same **mastery picture** as chat, so “weak topics” are not only what you said you found hard — they can reflect what you actually missed in practice.

## What Lerno is not

Lerno is a **study helper**, not a way to skip thinking or submit work that should be your own. The AI can still slip up (wrong retrieval, ambiguous question, model mistake), so **always cross-check definitions and laws** against NCERT, especially when marks depend on exact phrasing.

Your teacher and your textbook stay the final authority. Lerno is there to get you to “I get it” faster — with the book still in the loop.
`.trim(),
  },

  {
    slug: "how-to-score-90-in-cbse-class-10-boards",
    title: "How to Score 90+ in CBSE Class 10 Board Exams",
    description:
      "The students who score 90+ in boards aren't necessarily smarter. They're more organised. Here's the exact study approach that works.",
    publishedAt: "2026-04-10",
    readingTimeMin: 5,
    tags: ["Study Tips"],
    content: `
Every year, students want to know the same thing: what separates students who score 90+ from those who don't?

The answer isn't coaching classes or thick guide books. It's how well you know your NCERT textbook — and how consistently you practice.

## Start with NCERT, end with NCERT

CBSE board questions are directly derived from NCERT. Not "inspired by" — directly from. The official marking scheme, released after each exam, references NCERT language exactly.

That means:

- NCERT definitions are marking-scheme definitions
- NCERT examples are board exam examples
- NCERT diagrams are the diagrams examiners want to see

Students who score 90+ typically read each NCERT chapter at least three times: once for understanding, once for key points, once for revision.

## Chapter by chapter, not subject by subject

A common mistake is studying one full subject in one go. Chapters get confused, topics blur, and nothing sticks properly.

Better approach: one chapter at a time, rotating across subjects. Finish Chapter 1 of Science, then Chapter 1 of Maths, then Chapter 1 of Social Science. This keeps content fresh and prevents the fatigue that comes from spending five straight hours on one book.

## Practice with CBSE previous year questions

After finishing a chapter, immediately practice with previous year questions from that chapter. CBSE recycles question patterns, especially in Science and Maths. Seeing the same pattern four or five times means you'll recognise it instantly in the exam.

The goal isn't just to answer correctly — it's to recognise the type of question and know the approach before you've finished reading it.

## Use active recall, not re-reading

Re-reading feels productive. It isn't.

After reading a topic, close the book and try to explain it — out loud, on paper, or by typing it into Lerno. The struggle to remember is what builds memory. Passive re-reading just creates the feeling of familiarity without actual retention.

## Revision in the final month

The last 30 days before boards should not be for learning new things. They should be for:

1. **NCERT revision** — all exercises, all in-text questions, all examples
2. **Previous year papers** — at least five full papers, timed
3. **Your mistake list** — a running log of every error you made during practice

Students who do this and score 90+ aren't smarter. They're more organised. Start that mistake list from day one.
`.trim(),
  },

  {
    slug: "ncert-is-enough-for-cbse",
    title: "NCERT Is All You Need for CBSE — Here's Why",
    description:
      "Students spend thousands on guides and reference books. Most of it is unnecessary. Here's why NCERT alone is enough for the CBSE board exam.",
    publishedAt: "2026-04-07",
    readingTimeMin: 3,
    tags: ["Study Tips"],
    content: `
Every year, students spend thousands on reference books, guides, and supplementary material. Most of it isn't necessary for the CBSE board exam.

Here's something toppers know and rarely say out loud: **NCERT is enough**.

## Where CBSE questions actually come from

CBSE designs its board papers using NCERT content as the primary source. The official marking scheme — released after each exam — references NCERT language directly.

That means if your answer uses a definition from a guide book, even if technically correct, it might not score full marks. The examiner is trained to look for NCERT-specific phrasing. They've seen it so many times they notice when it's missing.

## What "knowing NCERT" actually means

Reading the chapter once is not knowing NCERT. Knowing NCERT means:

- You can reproduce key definitions accurately
- You understand the in-text examples, not just the end-of-chapter exercises
- You can explain diagrams without looking at them
- You've solved every exercise, including the ones marked "not for examinations"

Most students skip one or two of these. That's exactly where marks are lost.

## When reference books actually help

Reference books are useful in exactly two situations:

1. **Extra practice problems** — especially for Maths, where volume of practice matters more than variety of sources
2. **Difficult explanations** — some NCERT passages are terse; an alternative explanation of the same concept can help it click

Neither case requires buying a full reference book. A good AI tutor covers both — it can re-explain any NCERT concept in a different way, and generate chapter-specific practice questions on demand.

## The real advantage of sticking to NCERT

Students who stick to NCERT spend their cognitive energy on depth, not breadth. They understand fewer things, but understand them completely.

In a board exam where partial marks are given for partially correct answers, depth wins every time. A student who has truly understood Chapter 1 will score more on a Chapter 1 question than a student who has skimmed Chapters 1–5 from four different sources.

One textbook. Every page. That's the strategy.
`.trim(),
  },
];

export function getBlogPost(slug: string): BlogPost | null {
  return BLOG_POSTS.find((p) => p.slug === slug) ?? null;
}
