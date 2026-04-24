import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/openai", () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
  OPENAI_CHAT_MODEL: "gpt-4o-mini",
  stripMarkdownFencedJson: (s: string) => s,
}));

import { openai } from "@/lib/openai";
import type { OnboardingData } from "@/lib/types";
import { generateSlogans } from "../slogans";

const mockData: OnboardingData = {
  event_type: "geburtstag",
  group: false,
  group_size: 1,
  names: ["Tim"],
  date: null,
  style: "cartoon",
  product: "tshirt",
  text_custom: null,
  photo_upload: false,
  insider: "verliert staendig seinen Autoschluessel",
  tonality: "witzig",
};

const mockSlogans = [
  { main_text: "SCHLUESSELMEISTER", sub_text: "Tim | 30 Jahre", placement: "bottom", note: "Test" },
  { main_text: "TIM", sub_text: "Schluessel weg", placement: "both", note: "Test" },
  { main_text: "IRGENDWO DA", sub_text: null, placement: "bottom", note: "Test" },
  { main_text: "30 JAHRE", sub_text: "noch kein Schluessel", placement: "both", note: "Test" },
  { main_text: "LOST & FOUND", sub_text: "Mostly Lost", placement: "bottom", note: "Test" },
];

describe("generateSlogans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 5 slogan options from OpenAI response", async () => {
    vi.mocked(openai.chat.completions.create).mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(mockSlogans) } }],
    } as never);

    const result = await generateSlogans(mockData);

    expect(result).toHaveLength(5);
    expect(result[0]).toHaveProperty("main_text");
    expect(result[0]).toHaveProperty("placement");
  });

  it("passes only relevant fields in the user message", async () => {
    vi.mocked(openai.chat.completions.create).mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(mockSlogans) } }],
    } as never);

    await generateSlogans(mockData);

    const call = vi.mocked(openai.chat.completions.create).mock.calls[0][0];
    const userMsg = call.messages?.find((m) => m.role === "user");
    const content = typeof userMsg?.content === "string" ? userMsg.content : "{}";
    const body = JSON.parse(content);

    expect(body).toHaveProperty("event_type", "geburtstag");
    expect(body).toHaveProperty("insider");
    expect(body).not.toHaveProperty("style");
    expect(body).not.toHaveProperty("product");
  });
});
