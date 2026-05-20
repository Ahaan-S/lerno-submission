import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

const ALLOWED_ORIGINS = new Set([
  "https://lerno.in",
  "https://www.lerno.in",
  "https://app.lerno.in",
  "http://localhost:3000",
  "http://app.localhost:3000",
]);

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin");
  const headers = new Headers({
    "Cache-Control": "no-store, max-age=0",
    Vary: "Origin",
  });

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
  }

  return headers;
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function GET(request: Request) {
  const headers = corsHeaders(request);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return NextResponse.json({ authenticated: Boolean(user) }, { headers });
}
