/**
 * Pre-generates diagnostic questions for the active subjects/chapters and stores
 * them in diagnostic_questions_cache.
 *
 * Run:         npm run seed:diagnostic
 * Regenerate:  npm run seed:diagnostic -- --force
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { generateDiagnosticQuestions } from "@/lib/ai/diagnostic-questions";
import { CHAPTER_DATA_10, CHAPTER_DATA_11 } from "@/lib/chapters";

const FORCE = process.argv.includes("--force");
const DELAY_MS = 2000;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type ChapterEntry = { grade: number; subject: string; chapter_index: number; chapter_name: string };

function chapters(grade: number, subject: string, names: string[], limit?: number): ChapterEntry[] {
  return names
    .slice(0, limit)
    .map((chapter_name, i) => ({ grade, subject, chapter_index: i + 1, chapter_name }));
}

// Only the subjects that are live in the app
const ALL: ChapterEntry[] = [
  // ── Grade 10 ──────────────────────────────────────────────────────────────
  ...chapters(10, "science",          CHAPTER_DATA_10.science[0].items),
  ...chapters(10, "math",             CHAPTER_DATA_10.math[0].items),
  ...chapters(10, "social_history",   CHAPTER_DATA_10.social[0].items),
  ...chapters(10, "social_geography", CHAPTER_DATA_10.social[1].items),
  ...chapters(10, "social_civics",    CHAPTER_DATA_10.social[2].items),
  ...chapters(10, "social_economics", CHAPTER_DATA_10.social[3].items),

  // ── Grade 11 (chapter limits per subject) ─────────────────────────────────
  ...chapters(11, "physics",          CHAPTER_DATA_11.physics[0].items,          7),
  ...chapters(11, "chemistry",        CHAPTER_DATA_11.chemistry[0].items,        6),
  ...chapters(11, "math",             CHAPTER_DATA_11.math[0].items,             9),
  ...chapters(11, "business_studies", CHAPTER_DATA_11.business_studies[0].items, 6),
  ...chapters(11, "accountancy",      CHAPTER_DATA_11.accountancy[0].items,      6),
  ...chapters(11, "economics",        CHAPTER_DATA_11.economics[0].items,        6),
];

async function getAlreadyCached(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("diagnostic_questions_cache")
    .select("grade, subject, chapter_index");
  if (error) { console.error("DB fetch error:", error.message); return new Set(); }
  return new Set((data ?? []).map((r) => `${r.grade}:${r.subject}:${r.chapter_index}`));
}

async function main() {
  console.log(`\nDiagnostic seed — ${FORCE ? "FORCE (regenerate all)" : "skip existing"}`);
  console.log(`Total chapters in scope: ${ALL.length}\n`);

  const cached = FORCE ? new Set<string>() : await getAlreadyCached();
  const todo = ALL.filter((e) => !cached.has(`${e.grade}:${e.subject}:${e.chapter_index}`));

  console.log(`Already cached: ${ALL.length - todo.length} | To generate: ${todo.length}\n`);
  if (todo.length === 0) { console.log("Nothing to do. All chapters already cached."); return; }

  let done = 0, failed = 0;

  for (const entry of todo) {
    const label = `G${entry.grade} / ${entry.subject} / Ch${entry.chapter_index}: ${entry.chapter_name}`;
    process.stdout.write(`[${done + failed + 1}/${todo.length}] ${label} ... `);

    try {
      const questions = await generateDiagnosticQuestions({
        grade: entry.grade,
        subject: entry.subject,
        chapter_index: entry.chapter_index,
        chapter_name: entry.chapter_name,
      });

      if (!questions?.length) {
        console.log("no questions returned, skipping");
        failed++;
      } else {
        const { error } = await supabase
          .from("diagnostic_questions_cache")
          .upsert({
            grade: entry.grade,
            subject: entry.subject,
            chapter_index: entry.chapter_index,
            chapter_name: entry.chapter_name,
            questions,
          }, { onConflict: "grade,subject,chapter_index" });

        if (error) { console.log(`DB error: ${error.message}`); failed++; }
        else { console.log(`${questions.length} questions`); done++; }
      }
    } catch (err) {
      console.log(`error: ${(err as Error).message}`);
      failed++;
    }

    if (done + failed < todo.length) await sleep(DELAY_MS);
  }

  console.log(`\nDone: ${done} | Failed: ${failed}\n`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
