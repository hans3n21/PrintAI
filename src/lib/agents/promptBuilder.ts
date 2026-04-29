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
  const styleGuidance = getStyleGuidance(brief);
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
  if (hasPlacementIntent(brief)) {
    parts.push(
      "Preserve placement intent for future editor workflows: keep front/back, chest/back, logo, sponsor, name, and number instructions visible instead of flattening them into generic decoration."
    );
  }
  if (brief.exact_text?.trim()) {
    parts.push(
      `IMPORTANT: Include exactly this readable text in the design: "${brief.exact_text.trim()}".`
    );
  }
  if (styleGuidance) {
    parts.push(styleGuidance.prompt);
  }
  const actionGuidance = getActionGuidance(brief);
  if (actionGuidance) {
    parts.push(actionGuidance);
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
    styleGuidance?.technicalSpecs ??
      "Technical specs: mockup preview, opaque product background, no checkerboard transparency pattern, clean product silhouette, centered composition, flat design, vector-like clean edges, high contrast readable typography. Do not render a checkerboard."
  );

  return parts.join("\n");
}

function getActionGuidance(brief: CreativeBrief): string | null {
  const actionText = [
    brief.theme,
    brief.source_summary,
    ...brief.must_include_visuals,
  ].join(" ");

  if (/\b(jagen|verfolgen|chase|hunt)\b/i.test(actionText)) {
    return [
      "Action fidelity: preserve the user's chase scene as a playful slapstick chase.",
      "If wording says people jagen/verfolgen something, render it as characters running after it comedically, not threatening and no violence.",
      "Keep the chased subject recognizable as part of the action, not as a standalone mascot replacing the scene.",
    ].join(" ");
  }

  return null;
}

function getStyleGuidance(
  brief: CreativeBrief
): { prompt: string; technicalSpecs: string } | null {
  const styleText = [
    brief.style,
    brief.theme,
    brief.source_summary,
    ...brief.must_include_visuals,
  ]
    .join(" ")
    .toLowerCase();

  if (/\b(aquarell|watercolor|wasserfarbe)\b/.test(styleText)) {
    return {
      prompt:
        "Style fidelity: watercolor painting, soft washes, visible paper texture, translucent pigments, organic edges. Avoid style drift: not vector art, not digital illustration.",
      technicalSpecs:
        "Technical specs: mockup preview, opaque product background, no checkerboard transparency pattern, clean product silhouette, centered composition, print-ready contrast, readable typography. Do not render a checkerboard.",
    };
  }

  if (/\b(minimalistisch|minimalist|minimal|minimalistische)\b/.test(styleText)) {
    return {
      prompt:
        "Style fidelity: minimal composition, few elements, lots of negative space, simple shapes, restrained palette. Avoid style drift: no intricate detail, no busy background, no over-rendered textures.",
      technicalSpecs:
        "Technical specs: mockup preview, opaque product background, no checkerboard transparency pattern, clean product silhouette, centered composition, flat design, clean edges, high contrast readable typography. Do not render a checkerboard.",
    };
  }

  return null;
}

function hasPlacementIntent(brief: CreativeBrief): boolean {
  const text = [
    brief.source_summary,
    brief.theme,
    brief.exact_text ?? "",
    ...brief.must_include_visuals,
  ]
    .join(" ")
    .toLowerCase();

  return /front|back|vorne|hinten|rückseite|rueckseite|brust|logo|sponsor|nummer|name/.test(
    text
  );
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
