import { generateDesigns } from "@/lib/agents/generate";
import { buildPromptFromCreativeBrief } from "@/lib/agents/promptBuilder";
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
}, textCustom?: string | null, templateRules?: string[], productSelection?: ProductSelection | null): string {
  const product = productSelection?.product ?? "tshirt";
  const productLabel = product === "tshirt" ? "t-shirt" : product;
  const fabricColor = productSelection?.product_color;
  const safeTemplateRules = (templateRules ?? []).filter(
    (rule) => !/transparent background|isolated motif/i.test(rule)
  );
  const parts: string[] = [];
  parts.push(
    fabricColor
      ? `Render this as a clean mockup preview on a ${fabricColor} ${productLabel}; use the product as the background/foundation and place the artwork naturally on the chest/front print area. Do not render a checkerboard transparency pattern.`
      : `Render this as a clean mockup preview on the selected ${productLabel}; use the product as the background/foundation and place the artwork naturally on the chest/front print area. Do not render a checkerboard transparency pattern.`
  );
  if (promptData.prompt?.trim()) parts.push(promptData.prompt.trim());
  if (safeTemplateRules.length) {
    parts.push(`Print template rules:\n- ${safeTemplateRules.join("\n- ")}`);
  }
  if (productSelection) {
    parts.push(
      `Selected product: ${productSelection.product}, fabric color: ${productSelection.product_color}, quantity: ${productSelection.quantity}.`
    );
  }
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
      .select("prompt_data, onboarding_data, product_selection, creative_brief, reference_images, status")
      .eq("id", sessionId)
      .single();

    if (error || (!session?.prompt_data && !session?.creative_brief)) {
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
          template?.rules,
          productSelection
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
