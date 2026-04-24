export type EventType =
  | "geburtstag"
  | "jga"
  | "abi"
  | "verein"
  | "firma"
  | "hochzeit"
  | "sonstiges";
export type Style =
  | "cartoon"
  | "anime"
  | "vintage"
  | "modern"
  | "minimalistisch"
  | "realistisch"
  | "pop_art"
  | "sonstiges";
export type Product = "tshirt" | "hoodie" | "tasse" | "poster";
export type Tonality = "witzig" | "ernst" | "elegant" | "frech";
export type SessionStatus =
  | "onboarding"
  | "generating"
  | "designing"
  | "configuring"
  | "checkout"
  | "ordered";

export interface OnboardingData {
  event_type: EventType;
  group: boolean;
  group_size: number | null;
  names: string[] | "tbd" | null;
  date: string | null;
  style: Style;
  product: Product;
  text_custom: string | null;
  photo_upload: boolean;
  insider: string | null;
  tonality: Tonality;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface PromptData {
  prompt: string;
  negative_prompt: string;
  style_suffix: string;
  text_note: string;
}

export interface SloganOption {
  main_text: string;
  sub_text: string | null;
  placement: "top" | "bottom" | "both" | "front_back";
  note: string;
}

export interface SessionConfig {
  product_color: string;
  print_area: "front" | "back" | "both";
  text_override: string | null;
  sizes: Record<string, string>;
  quantity: number;
}

export interface Session {
  id: string;
  created_at: string;
  updated_at: string;
  conversation_history: ChatMessage[];
  onboarding_data: OnboardingData | null;
  prompt_data: PromptData | null;
  design_urls: string[];
  slogans: SloganOption[];
  selected_design_url: string | null;
  selected_slogan: SloganOption | null;
  config: Partial<SessionConfig>;
  status: SessionStatus;
}

export interface ChatApiResponse {
  reply: string;
  complete: boolean;
  summary?: string;
  sessionId: string;
}

export interface GenerateApiResponse {
  design_urls: string[];
}

export interface SlogansApiResponse {
  slogans: SloganOption[];
}

export interface OrderApiResponse {
  success: boolean;
  order_id: string;
  message: string;
}
