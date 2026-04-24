import { generateDesigns } from "@/lib/agents/generate";
import { supabaseAdmin } from "@/lib/supabase";
import type { GenerateApiResponse } from "@/lib/types";
import { NextResponse } from "next/server";

function buildFinalImagePrompt(promptData: {
  prompt?: string | null;
  negative_prompt?: string | null;
  style_suffix?: string | null;
  text_note?: string | null;
}, textCustom?: string | null): string {
  const parts: string[] = [];
  if (promptData.prompt?.trim()) parts.push(promptData.prompt.trim());
  if (promptData.style_suffix?.trim()) parts.push(`Style: ${promptData.style_suffix.trim()}`);
  if (textCustom?.trim()) {
    parts.push(
      `IMPORTANT: Include exactly this readable text in the design: "${textCustom.trim()}". Place it at the top, bold, highly legible.`
    );
  } else if (promptData.text_note?.trim()) {
    parts.push(`Text requirement: ${promptData.text_note.trim()}`);
  }
  if (promptData.negative_prompt?.trim()) {
    parts.push(`Avoid: ${promptData.negative_prompt.trim()}`);
  }
  return parts.join("\n");
}

export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("prompt_data, onboarding_data, status")
      .eq("id", sessionId)
      .single();

    if (error || !session?.prompt_data) {
      return NextResponse.json(
        { error: "Session or prompt not found" },
        { status: 404 }
      );
    }

    const textCustom =
      session.onboarding_data &&
      typeof session.onboarding_data === "object" &&
      "text_custom" in session.onboarding_data &&
      typeof session.onboarding_data.text_custom === "string"
        ? session.onboarding_data.text_custom
        : null;

    const finalPrompt = buildFinalImagePrompt(session.prompt_data, textCustom);
    const urls = await generateDesigns(sessionId, finalPrompt);

    await supabaseAdmin
      .from("sessions")
      .update({
        design_urls: urls,
        status: "designing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    const response: GenerateApiResponse = { design_urls: urls };
    return NextResponse.json(response);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/generate]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
