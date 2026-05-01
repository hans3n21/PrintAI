import { generateDesigns } from "@/lib/agents/generate";
import { buildPromptFromCreativeBrief } from "@/lib/agents/promptBuilder";
import { getGenerateErrorResponse } from "@/lib/generateErrors";
import { getPrintPromptTemplate } from "@/lib/prompts/templates";
import { supabaseAdmin } from "@/lib/supabase";
import type {
  CreativeBrief,
  GenerateApiResponse,
  OnboardingData,
  ProductSelection,
  ReferenceImageAsset,
} from "@/lib/types";
import { NextResponse } from "next/server";

function buildFinalImagePrompt(promptData: {
  prompt?: string | null;
  negative_prompt?: string | null;
  style_suffix?: string | null;
  text_note?: string | null;
}, textCustom?: string | null, templateRules?: string[]): string {
  const parts: string[] = [];
  parts.push(
    "Create only the print artwork layer, not a product preview, with a TRANSPARENT background. " +
    "The motif must be fully isolated — no shirt, no fabric, no product, no background color, no shadow fill. " +
    "The artwork will be digitally placed onto a garment later. " +
    "Use clean edges, bold outlines, and high contrast suitable for DTG textile printing."
  );
  if (promptData.prompt?.trim()) parts.push(promptData.prompt.trim());
  const safeTemplateRules = (templateRules ?? []);
  if (safeTemplateRules.length) {
    parts.push(`Print design rules:\n- ${safeTemplateRules.join("\n- ")}`);
  }
  if (promptData.style_suffix?.trim()) parts.push(`Style: ${promptData.style_suffix.trim()}`);
  if (textCustom?.trim()) {
    parts.push(
      `IMPORTANT: Include exactly this readable text in the design: "${textCustom.trim()}". Bold, highly legible.`
    );
  } else if (promptData.text_note?.trim()) {
    parts.push(`Text requirement: ${promptData.text_note.trim()}`);
  }
  if (promptData.negative_prompt?.trim()) {
    parts.push(`Avoid: ${promptData.negative_prompt.trim()}`);
  }
  parts.push(
    "Avoid: any shirt silhouette, t-shirt shape, garment mockup, fabric texture, product preview, product background, checkerboard transparency pattern, white fill background.",
    "Safety guide: Keep the scene non-violent and playful; no weapons, blood, injury, gore, fighting, or threatening action."
  );
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
      .select("prompt_data, onboarding_data, product_selection, creative_brief, reference_images, status")
      .eq("id", sessionId)
      .single();

    if (error || (!session?.prompt_data && !session?.creative_brief)) {
      return NextResponse.json(
        { error: "Session or prompt not found" },
        { status: 404 }
      );
    }
    if (session.status !== "generating") {
      return NextResponse.json(
        { error: "Design generation is not pending for this session" },
        { status: 409 }
      );
    }

    const textCustom =
      session.onboarding_data &&
      typeof session.onboarding_data === "object" &&
      "text_custom" in session.onboarding_data &&
      typeof session.onboarding_data.text_custom === "string"
        ? session.onboarding_data.text_custom
        : null;

    const onboardingData = session.onboarding_data as OnboardingData | null;
    const productSelection = session.product_selection as ProductSelection | null;
    const creativeBrief = session.creative_brief as CreativeBrief | null;
    const referenceImages = (session.reference_images ?? []) as ReferenceImageAsset[];
    const template = onboardingData
      ? getPrintPromptTemplate(onboardingData, productSelection)
      : null;
    const finalPrompt = creativeBrief
      ? buildPromptFromCreativeBrief(creativeBrief, productSelection, template?.rules)
      : buildFinalImagePrompt(
          session.prompt_data,
          textCustom,
          template?.rules
        );
    const { urls, assets } = await generateDesigns(
      sessionId,
      finalPrompt,
      referenceImages
    );

    await supabaseAdmin
      .from("sessions")
      .update({
        design_urls: urls,
        design_assets: assets,
        status: "designing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    const response: GenerateApiResponse = { design_urls: urls, design_assets: assets };
    return NextResponse.json(response);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/generate]", message);
    const response = getGenerateErrorResponse(e);
    return NextResponse.json(response.body, { status: response.status });
  }
}
