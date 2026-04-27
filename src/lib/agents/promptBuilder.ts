import { PROMPT_BUILDER_SYSTEM_PROMPT } from "@/lib/prompts/promptBuilder";
import { getPrintPromptTemplate } from "@/lib/prompts/templates";
import {
  openai,
  OPENAI_CHAT_MODEL,
  stripMarkdownFencedJson,
} from "@/lib/openai";
import type {
  CreativeBrief,
  OnboardingData,
  ProductSelection,
  PromptData,
} from "@/lib/types";

export function buildPromptFromCreativeBrief(
  brief: CreativeBrief,
  productSelection?: ProductSelection | null,
  templateRules?: string[]
): string {
  const product = productSelection?.product ?? brief.product;
  const fabricColor = productSelection?.product_color;
  const productLabel = product === "tshirt" ? "t-shirt" : product;
  const mockupInstruction = fabricColor
    ? `Render a clean mockup preview on a ${fabricColor} ${productLabel}: show the product as the background/foundation and place the artwork naturally on the chest/front print area.`
    : `Render a clean mockup preview on the selected ${productLabel}: show the product as the background/foundation and place the artwork naturally on the chest/front print area.`;
  const safeTemplateRules = (templateRules ?? []).filter(
    (rule) => !/transparent background|isolated motif/i.test(rule)
  );
  const parts = [
    `Create a polished ${productLabel} mockup preview for this creative brief: ${brief.theme}.`,
    mockupInstruction,
    `Source summary: ${brief.source_summary}`,
    `Occasion: ${brief.occasion}. Style: ${brief.style}. Tone: ${brief.tone}. Product: ${brief.product}.`,
  ];

  if (brief.must_include_visuals.length > 0) {
    parts.push(
      `MUST include these visual elements as recognizable parts of the motif: ${brief.must_include_visuals.join(", ")}.`
    );
  }
  if (brief.exact_text?.trim()) {
    parts.push(
      `IMPORTANT: Include exactly this readable text in the design: "${brief.exact_text.trim()}".`
    );
  }
  if (safeTemplateRules.length) {
    parts.push(`Print template rules:\n- ${safeTemplateRules.join("\n- ")}`);
  }
  if (productSelection) {
    parts.push(
      `Selected product: ${productSelection.product}, fabric color: ${productSelection.product_color}, quantity: ${productSelection.quantity}.`
    );
  }
  if (brief.reference_images.length > 0) {
    const descriptions = brief.reference_images
      .map((image, index) =>
        image.description?.trim()
          ? `Reference image ${index + 1}: ${image.description.trim()}`
          : `Reference image ${index + 1}: uploaded user reference (${image.mime})`
      )
      .join("\n");
    parts.push(
      `Use the attached reference image(s) as visual guidance and preserve the important visible subject/style cues.\n${descriptions}`
    );
  }
  if (brief.avoid.length > 0) {
    parts.push(`Avoid: ${brief.avoid.join(", ")}.`);
  }
  parts.push(
    "Safety guide: Keep the scene non-violent and playful; no weapons, blood, injury, gore, fighting, or threatening action.",
    "Technical specs: mockup preview, opaque product background, no checkerboard transparency pattern, clean product silhouette, centered composition, flat design, vector-like clean edges, high contrast readable typography. Do not render a checkerboard."
  );

  return parts.join("\n");
}

export async function buildImagePrompt(
  data: OnboardingData,
  productSelection?: ProductSelection | null
): Promise<PromptData> {
  const template = getPrintPromptTemplate(data, productSelection);
  const response = await openai.chat.completions.create({
    model: OPENAI_CHAT_MODEL,
    messages: [
      { role: "system", content: PROMPT_BUILDER_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Build an image prompt for this session data and print template.\nSession data:\n${JSON.stringify(
          data,
          null,
          2
        )}\n\nPrint template:\n${JSON.stringify(template, null, 2)}`,
      },
    ],
    max_tokens: 600,
    temperature: 0.6,
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const text = stripMarkdownFencedJson(raw);
  return JSON.parse(text) as PromptData;
}
