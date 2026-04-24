import { buildImagePrompt } from "@/lib/agents/promptBuilder";
import {
  runForceCompleteOnboarding,
  runOnboardingMessage,
} from "@/lib/agents/onboarding";
import { supabaseAdmin } from "@/lib/supabase";
import type { ChatApiResponse, ChatMessage, OnboardingData } from "@/lib/types";
import { NextResponse } from "next/server";

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const m = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl.trim());
  if (!m) return null;
  try {
    return { mime: m[1], buffer: Buffer.from(m[2], "base64") };
  } catch {
    return null;
  }
}

async function uploadReferenceImage(
  sessionId: string,
  dataUrl: string
): Promise<string> {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    throw new Error("Invalid image data (expected data URL base64)");
  }
  const ext =
    parsed.mime === "image/png"
      ? "png"
      : parsed.mime === "image/jpeg" || parsed.mime === "image/jpg"
        ? "jpg"
        : parsed.mime === "image/webp"
          ? "webp"
          : "bin";
  const filename = `${sessionId}/user_ref_${Date.now()}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from("designs")
    .upload(filename, parsed.buffer, { contentType: parsed.mime, upsert: true });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data } = supabaseAdmin.storage.from("designs").getPublicUrl(filename);
  return data.publicUrl;
}

function userHistoryContent(text: string, refUrl?: string): string {
  const t = text.trim();
  if (refUrl) {
    return t ? `${t}\n(Referenzbild: ${refUrl})` : `(Referenzbild: ${refUrl})`;
  }
  return t;
}

async function finalizeOnboarding(
  sessionId: string,
  history: ChatMessage[],
  userContent: string,
  summary: string,
  data: OnboardingData
) {
  const promptData = await buildImagePrompt(data);

  await supabaseAdmin
    .from("sessions")
    .update({
      conversation_history: [
        ...history,
        { role: "user", content: userContent },
        { role: "assistant", content: summary },
      ],
      onboarding_data: data,
      prompt_data: promptData,
      status: "generating",
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  const response: ChatApiResponse = {
    reply: summary,
    complete: true,
    summary,
    sessionId,
  };
  return NextResponse.json(response);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sessionId = body.sessionId as string | undefined;
    const message = typeof body.message === "string" ? body.message : "";
    const imageBase64 =
      typeof body.imageBase64 === "string" ? body.imageBase64 : undefined;
    const forceComplete = body.forceComplete === true;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const { data: session, error: loadError } = await supabaseAdmin
      .from("sessions")
      .select("conversation_history, status")
      .eq("id", sessionId)
      .single();

    if (loadError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const history = (session.conversation_history ?? []) as ChatMessage[];

    if (forceComplete) {
      const result = await runForceCompleteOnboarding(history);
      if (!result.complete) {
        return NextResponse.json(
          { error: result.reply, sessionId },
          { status: 422 }
        );
      }
      const userContent = "(Onboarding per Button abgeschlossen.)";
      return finalizeOnboarding(
        sessionId,
        history,
        userContent,
        result.summary,
        result.data
      );
    }

    let referenceImageUrl: string | undefined;
    if (imageBase64?.trim()) {
      referenceImageUrl = await uploadReferenceImage(sessionId, imageBase64);
    }

    const userLine =
      message.trim() ||
      (referenceImageUrl ? "(Nutzer hat ein Referenzbild gesendet.)" : "");

    if (!userLine) {
      return NextResponse.json(
        { error: "message or imageBase64 required" },
        { status: 400 }
      );
    }

    const result = await runOnboardingMessage(history, userLine, {
      referenceImageUrl,
    });

    const storedUserContent = userHistoryContent(message, referenceImageUrl);

    if (!result.complete) {
      const newHistory: ChatMessage[] = [
        ...history,
        { role: "user", content: storedUserContent },
        { role: "assistant", content: result.reply },
      ];

      await supabaseAdmin
        .from("sessions")
        .update({ conversation_history: newHistory, updated_at: new Date().toISOString() })
        .eq("id", sessionId);

      const response: ChatApiResponse = {
        reply: result.reply,
        complete: false,
        sessionId,
      };
      return NextResponse.json(response);
    }

    return finalizeOnboarding(
      sessionId,
      history,
      storedUserContent,
      result.summary,
      result.data
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
