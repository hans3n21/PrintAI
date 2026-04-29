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
export type ProductColor = "white" | "black" | "navy" | "grey";
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

export type ChatAttachment = {
  url: string;
  label: string;
  kind: "reference";
};

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
}

export interface ProductSelection {
  product: Product;
  product_color: ProductColor;
  quantity: number;
}

export interface ReferenceImageAsset {
  url: string;
  storage_path: string;
  mime: string;
  uploaded_at: string;
  description: string | null;
}

export interface CreativeBrief {
  occasion: EventType;
  product: Product;
  style: Style;
  tone: Tonality;
  theme: string;
  exact_text: string | null;
  must_include_visuals: string[];
  avoid: string[];
  reference_images: ReferenceImageAsset[];
  source_summary: string;
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
  product: Product;
  print_area: "front" | "back" | "both";
  text_override: string | null;
  sizes: Record<string, string>;
  quantity: number;
}

export type ImageProviderName = "gemini" | "openai" | "ideogram";

export interface DesignAsset {
  id: string;
  preview_url: string;
  mockup_url: string | null;
  print_url: string | null;
  source: {
    provider: ImageProviderName;
    prompt: string;
    variant_index: number;
    seed: string | null;
  };
  post_processing: {
    background_removed: boolean;
    print_ready: boolean;
    warnings: string[];
  };
}

export interface Session {
  id: string;
  created_at: string;
  updated_at: string;
  conversation_history: ChatMessage[];
  onboarding_data: OnboardingData | null;
  product_selection: ProductSelection | null;
  creative_brief: CreativeBrief | null;
  creative_brief_url: string | null;
  reference_images: ReferenceImageAsset[];
  prompt_data: PromptData | null;
  design_assets: DesignAsset[];
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
  design_assets?: DesignAsset[];
}

export interface SlogansApiResponse {
  slogans: SloganOption[];
}

export interface OrderApiResponse {
  success: boolean;
  order_id: string;
  message: string;
}
