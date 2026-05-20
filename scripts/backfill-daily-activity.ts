/**
 * One-time backfill of `user_daily_activity` from historical `study_attempts` + `study_feed_sessions`.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY. Run:
 *   npx tsx scripts/backfill-daily-activity.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey);

type DailyAgg = {
  user_id: string;
  date: string;
  questions_answered: number;
  questions_correct: number;
  minutes_active: number;
  session_ids: Set<string>;
};

function key(userId: string, date: string) {
  return `${userId}__${date}`;
}

function parseProfileGrade(raw: unknown): number {
  if (typeof raw === "number" && raw >= 1 && raw <= 12) return raw;
  if (typeof raw === "string") {
    if (raw.startsWith("Class ")) {
      const n = parseInt(raw.replace("Class ", ""), 10);
      if (!Number.isNaN(n) && n >= 1 && n <= 12) return n;
    }
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= 12) return n;
  }
  return 10;
}

function getOrCreate(map: Map<string, DailyAgg>, userId: string, date: string): DailyAgg {
  const k = key(userId, date);
  let v = map.get(k);
  if (!v) {
    v = {
      user_id: userId,
      date,
      questions_answered: 0,
      questions_correct: 0,
      minutes_active: 0,
      session_ids: new Set(),
    };
    map.set(k, v);
  }
  return v;
}

async function main() {
  const map = new Map<string, DailyAgg>();
  const pageSize = 1000;

  console.log("[backfill] Scanning study_attempts (answered)…");
  let from = 0;
  for (;;) {
    const { data, error } = await admin
      .from("study_attempts")
      .select("user_id, attempted_at, interaction_type, is_correct")
      .eq("interaction_type", "answered")
      .not("is_correct", "is", null)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data?.length) break;

    for (const row of data) {
      const uid = row.user_id as string;
      const d = (row.attempted_at as string).slice(0, 10);
      const agg = getOrCreate(map, uid, d);
      agg.questions_answered += 1;
      if (row.is_correct === true) agg.questions_correct += 1;
    }

    from += pageSize;
    if (data.length < pageSize) break;
  }

  console.log("[backfill] Scanning study_feed_sessions (ended)…");
  from = 0;
  for (;;) {
    const { data, error } = await admin
      .from("study_feed_sessions")
      .select("id, user_id, ended_at, time_active_secs")
      .not("ended_at", "is", null)
      .not("time_active_secs", "is", null)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data?.length) break;

    for (const row of data) {
      const uid = row.user_id as string;
      const ended = row.ended_at as string;
      const d = ended.slice(0, 10);
      const agg = getOrCreate(map, uid, d);
      const secs = row.time_active_secs as number;
      agg.minutes_active += Math.round(secs / 60);
      agg.session_ids.add(row.id as string);
    }

    from += pageSize;
    if (data.length < pageSize) break;
  }

  const userIds = [...new Set([...map.values()].map((v) => v.user_id))];
  console.log("[backfill] Loading grades for", userIds.length, "users…");
  const gradeMap = new Map<string, number>();
  for (let i = 0; i < userIds.length; i += 200) {
    const chunk = userIds.slice(i, i + 200);
    const { data, error } = await admin.from("profiles").select("id, grade").in("id", chunk);
    if (error) throw error;
    for (const p of data ?? []) {
      gradeMap.set(p.id as string, parseProfileGrade(p.grade));
    }
  }

  const rows = [...map.values()].map((r) => ({
    user_id: r.user_id,
    activity_date: r.date,
    grade: gradeMap.get(r.user_id) ?? 10,
    questions_answered: r.questions_answered,
    questions_correct: r.questions_correct,
    minutes_active: r.minutes_active,
    sessions_count: r.session_ids.size,
  }));

  console.log("[backfill] Upserting", rows.length, "rows…");
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await admin.from("user_daily_activity").upsert(batch, {
      onConflict: "user_id,activity_date",
    });
    if (error) {
      console.error("[backfill] upsert error:", error.message);
      process.exit(1);
    }
  }

  console.log("[backfill] Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
