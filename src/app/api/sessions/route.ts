import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { initial_message } = await request.json();

  const { data, error } = await supabaseAdmin
    .from("sessions")
    .insert({
      conversation_history: [],
      status: "onboarding",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ sessionId: data.id, initial_message });
}
