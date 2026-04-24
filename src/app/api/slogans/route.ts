import { generateSlogans } from "@/lib/agents/slogans";
import { supabaseAdmin } from "@/lib/supabase";
import type { SlogansApiResponse } from "@/lib/types";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { sessionId } = await request.json();

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const { data: session, error } = await supabaseAdmin
    .from("sessions")
    .select("onboarding_data")
    .eq("id", sessionId)
    .single();

  if (error || !session?.onboarding_data) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const slogans = await generateSlogans(session.onboarding_data);

  await supabaseAdmin
    .from("sessions")
    .update({ slogans, updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  const response: SlogansApiResponse = { slogans };
  return NextResponse.json(response);
}
