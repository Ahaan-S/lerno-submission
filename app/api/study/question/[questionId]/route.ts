import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/** Single study question for deep links (`/study?question=`). */
export async function GET(
    _request: NextRequest,
    context: { params: Promise<{ questionId: string }> },
) {
    const { questionId } = await context.params;
    if (!questionId || questionId.length > 64) {
        return NextResponse.json({ error: "Invalid question id" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
        .from("study_questions")
        .select("*")
        .eq("id", questionId)
        .eq("is_active", true)
        .maybeSingle();

    if (error) {
        console.error("[study/question] query", error.message);
        return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
    }
    if (!data) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ question: data });
}
