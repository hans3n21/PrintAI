export const FEEDBACK_CATEGORIES = [
  "general",
  "bad_text",
  "bad_mockup",
  "not_printable",
  "wrong_product",
  "bad_flow",
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export function normalizeFeedbackCategory(value: unknown): FeedbackCategory {
  return FEEDBACK_CATEGORIES.includes(value as FeedbackCategory)
    ? (value as FeedbackCategory)
    : "general";
}
