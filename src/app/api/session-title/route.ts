import { generateSessionTitle } from "@/lib/agents/sessionTitle";
import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { sessionId?: unknown };
    const sessionId =
      typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("onboarding_data, conversation_history, design_urls")
      .eq("id", sessionId)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const title = await generateSessionTitle({
      onboarding_data: (session.onboarding_data ?? null) as Record<string, unknown> | null,
      conversation_history: (session.conversation_history ?? null) as Array<{
        role: string;
        content: string;
      }> | null,
      design_urls: (session.design_urls ?? null) as string[] | null,
    });

    return NextResponse.json({ title });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/session-title]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
