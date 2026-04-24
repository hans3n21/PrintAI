import { supabaseAdmin } from "@/lib/supabase";
import type { OrderApiResponse } from "@/lib/types";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { sessionId } = await request.json();

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const { data: session } = await supabaseAdmin
    .from("sessions")
    .select("config, selected_design_url, onboarding_data")
    .eq("id", sessionId)
    .single();

  const stubOrderId = `stub-${Date.now()}`;

  await supabaseAdmin.from("orders").insert({
    session_id: sessionId,
    status: "stub",
    total_cents: 2500,
    line_items: session,
  });

  await supabaseAdmin
    .from("sessions")
    .update({ status: "ordered", updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  const response: OrderApiResponse = {
    success: true,
    order_id: stubOrderId,
    message: "Bestellung erfolgreich! (Demo-Modus - keine echte Zahlung)",
  };
  return NextResponse.json(response);
}
