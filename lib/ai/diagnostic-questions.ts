import { getChapterLimitForSubject, SUBJECT_LABELS } from "@/lib/chapters";
import { embed } from "@/lib/ai/embed";
import { chat, resolveModel } from "@/lib/ai/llm";
import { searchLearnChunks } from "@/lib/ai/qdrant";
import { resolveSubjectStyleKey } from "@/lib/tutor-subject";

export type DiagnosticQuestion = {
  id: number;
  question: string;
  options: Record<string, string>;
  correct: string;
  topic_hint: string;
};

const DIAGNOSTIC_FORMAT_RULES: Record<string, string> = {
  science: `SCIENCE QUESTION STYLE:
- Prefer concept-application questions (cause/effect, real-world phenomena)
- Include at least one question that checks scientific reasoning, not pure recall`,
  mathematics: `MATHEMATICS QUESTION STYLE:
- Include at least one numerical/algebraic setup question
- Use board-style distractors based on common calculation mistakes`,
  history: `HISTORY QUESTION STYLE:
- Prioritize chronology, causes, consequences, and source/context understanding
- Include one question that distinguishes two similar events/ideas`,
  geography: `GEOGRAPHY QUESTION STYLE:
- Prioritize location-resource-climate-population relationships
- Include one map/data-interpretation style question (described textually)`,
  civics: `CIVICS QUESTION STYLE:
- Prioritize institutions, constitutional principles, and real-life democratic processes
- Include one scenario-based question (what should happen under constitutional norms)`,
  economics: `ECONOMICS QUESTION STYLE:
- Prioritize terms, sector-wise reasoning, and everyday economic decisions
- Include one applied question using Indian context`,
};

export function validateChapterLimit(grade: number, subject: string, chapterIndex: number) {
  const chapterLimit = getChapterLimitForSubject(grade, subject);
  if (chapterLimit != null && Number(chapterIndex) > chapterLimit) {
    return `Chapter ${chapterIndex} is not available for this subject yet`;
  }
  return null;
}

export async function generateDiagnosticQuestions({
  grade,
  subject,
  chapter_index,
  chapter_name,
  topic_indices = [],
}: {
  grade: number;
  subject: string;
  chapter_index: number;
  chapter_name: string;
  topic_indices?: string[];
}): Promise<DiagnosticQuestion[] | null> {
  const queryText = `${chapter_name} key concepts overview`;
  const vector = await embed(queryText);

  const chunks = await searchLearnChunks(
    vector,
    queryText,
    grade,
    subject,
    chapter_index,
    topic_indices,
    15
  );

  const chunkText = chunks
    .slice(0, 8)
    .map((c, i) => `[${i + 1}] ${c.content}`)
    .join("\n\n---\n\n");

  const subjectLabel = SUBJECT_LABELS[subject] ?? subject;
  const styleKey = resolveSubjectStyleKey(subject);
  const formatRules = DIAGNOSTIC_FORMAT_RULES[styleKey] ?? DIAGNOSTIC_FORMAT_RULES.science;

  const prompt = `You are creating a diagnostic quiz for a Grade ${grade} student about Chapter ${chapter_index}: "${chapter_name}" in ${subjectLabel} (NCERT curriculum). These are high school students - pitch the difficulty accordingly.

CONTEXT: This runs BEFORE the student has studied this chapter. Questions 1-4 test general prior knowledge; questions 5-6 are harder and directly test chapter-level concepts.

QUESTION DIFFICULTY - THREE TIERS:

Q1-2 (EASY warm-up):
- Recall-level, based on earlier classes or common knowledge
- A reasonably attentive student should get these right
- Not trivially obvious - still requires some thought

Q3-4 (MEDIUM):
- Based on concepts from earlier grades that are directly prerequisite to this chapter
- Require understanding, not just recall - "why", "what happens if", identify cause/effect
- A student with solid prior-class knowledge should get these; a weak student might not

Q5-6 (HARD, chapter-specific):
- Directly test core concepts from THIS chapter
- Require genuine chapter knowledge or strong inference - not guessable from common sense
- Should feel like NCERT exercise or board exam style
- Examples: interpret a diagram description, apply a formula, identify a specific exception or property, distinguish two similar concepts in this chapter

WRITING RULES:
- Questions: max 15 words, prefer 8-12
- Options: max 7 words each, prefer 3-5
- No paragraph-length stems
- Wrong options must be based on real misconceptions - not obviously wrong
- Each question tests a DIFFERENT concept

${formatRules}

Use the textbook content below - pick the 6 most important concepts and write questions:
---
${chunkText}
---

Generate EXACTLY 6 multiple-choice questions.

Return as JSON:
{
  "questions": [
    {
      "id": 1,
      "question": "...",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "correct": "A",
      "topic_hint": "brief topic label"
    }
  ]
}`;

  const responseText = await chat([{ role: "user", content: prompt }], {
    model: resolveModel(false, true),
    jsonMode: true,
  });

  try {
    const parsed = JSON.parse(responseText) as { questions: DiagnosticQuestion[] };
    return parsed.questions ?? null;
  } catch {
    return null;
  }
}
