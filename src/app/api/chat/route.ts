import { buildCreativeBrief } from "@/lib/agents/creativeBrief";
import { buildImagePrompt } from "@/lib/agents/promptBuilder";
import {
  runForceCompleteOnboarding,
  runOnboardingMessage,
} from "@/lib/agents/onboarding";
import { mergeOnboardingWithProductSelection } from "@/lib/productSelection";
import { supabaseAdmin } from "@/lib/supabase";
import type {
  ChatApiResponse,
  ChatMessage,
  OnboardingData,
  ProductSelection,
  ReferenceImageAsset,
} from "@/lib/types";
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
  dataUrl: string,
  description?: string | null
): Promise<ReferenceImageAsset> {
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
  return {
    url: data.publicUrl,
    storage_path: filename,
    mime: parsed.mime,
    uploaded_at: new Date().toISOString(),
    description: description?.trim() || "Vom Nutzer hochgeladenes Referenzbild",
  };
}

async function exportCreativeBrief(
  sessionId: string,
  brief: unknown
): Promise<string> {
  const filename = `${sessionId}/creative_brief_${Date.now()}.json`;
  const { error } = await supabaseAdmin.storage
    .from("designs")
    .upload(filename, Buffer.from(JSON.stringify(brief, null, 2), "utf-8"), {
      contentType: "application/json",
      upsert: true,
    });
  if (error) throw new Error(`Creative brief export failed: ${error.message}`);
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
  data: OnboardingData,
  productSelection: ProductSelection | null | undefined,
  referenceImages: ReferenceImageAsset[]
) {
  const mergedData = mergeOnboardingWithProductSelection(data, productSelection);
  const completeHistory: ChatMessage[] = [
    ...history,
    { role: "user", content: userContent },
    { role: "assistant", content: summary },
  ];
  const creativeBrief = await buildCreativeBrief(
    completeHistory,
    mergedData,
    productSelection,
    referenceImages
  );
  const creativeBriefUrl = await exportCreativeBrief(sessionId, creativeBrief);
  const promptData = await buildImagePrompt(mergedData, productSelection);

  await supabaseAdmin
    .from("sessions")
    .update({
      conversation_history: completeHistory,
      onboarding_data: mergedData,
      creative_brief: creativeBrief,
      creative_brief_url: creativeBriefUrl,
      reference_images: referenceImages,
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
      .select("conversation_history, status, product_selection, reference_images")
      .eq("id", sessionId)
      .single();

    if (loadError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const history = (session.conversation_history ?? []) as ChatMessage[];
    const productSelection = session.product_selection as ProductSelection | null;
    const existingReferenceImages = (session.reference_images ??
      []) as ReferenceImageAsset[];

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
        result.data,
        productSelection,
        existingReferenceImages
      );
    }

    let referenceImage: ReferenceImageAsset | undefined;
    if (imageBase64?.trim()) {
      referenceImage = await uploadReferenceImage(
        sessionId,
        imageBase64,
        message
          ? `Nutzerreferenz zum Wunsch: ${message.trim()}`
          : "Nutzerreferenz ohne begleitenden Text"
      );
    }
    const referenceImages = referenceImage
      ? [...existingReferenceImages, referenceImage]
      : existingReferenceImages;

    const userLine =
      message.trim() ||
      (referenceImage ? "(Nutzer hat ein Referenzbild gesendet.)" : "");

    if (!userLine) {
      return NextResponse.json(
        { error: "message or imageBase64 required" },
        { status: 400 }
      );
    }

    const result = await runOnboardingMessage(history, userLine, {
      referenceImageUrl: referenceImage?.url,
      productSelection,
      referenceImages,
    });

    const storedUserContent = userHistoryContent(message, referenceImage?.url);

    if (!result.complete) {
      const newHistory: ChatMessage[] = [
        ...history,
        { role: "user", content: storedUserContent },
        { role: "assistant", content: result.reply },
      ];

      await supabaseAdmin
        .from("sessions")
        .update({
          conversation_history: newHistory,
          reference_images: referenceImages,
          updated_at: new Date().toISOString(),
        })
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
      result.data,
      productSelection,
      referenceImages
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
