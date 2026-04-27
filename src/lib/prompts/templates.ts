import type { OnboardingData, ProductSelection } from "@/lib/types";

export type PrintPromptTemplate = {
  name: string;
  rules: string[];
  negativePrompt: string;
};

const BASE_RULES = [
  "shirt-ready centered chest graphic",
  "clean t-shirt mockup preview",
  "place the artwork naturally on the shirt chest area",
  "clean vector-like edges",
  "high contrast readable typography",
  "avoid tiny details that cannot be printed cleanly",
];

function contrastRule(selection?: ProductSelection | null) {
  if (!selection) return "optimize contrast for the selected fabric color";
  return `optimize contrast for ${selection.product_color} fabric`;
}

export function getPrintPromptTemplate(
  data: OnboardingData,
  selection?: ProductSelection | null
): PrintPromptTemplate {
  const product = selection?.product ?? data.product;
  const name = `${data.event_type}-${product}`;
  const eventRules =
    data.event_type === "verein"
      ? [
          "sports club shirt design",
          "leave clear space for optional player number and name",
          "badge-like composition without copying real club logos",
        ]
      : ["occasion-specific print motif"];

  return {
    name,
    rules: [...BASE_RULES, ...eventRules, contrastRule(selection)],
    negativePrompt:
      "checkerboard transparency pattern, floating PNG preview, cluttered scene, illegible text, watermark, tiny text, low contrast",
  };
}
