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
import type { ChatMessage, OnboardingData, ProductSelection } from "@/lib/types";
import { buildCreativeBrief } from "../creativeBrief";

const onboardingData: OnboardingData = {
  event_type: "geburtstag",
  group: false,
  group_size: 1,
  names: ["Hansi"],
  date: null,
  style: "cartoon",
  product: "tshirt",
  text_custom: "Hansi der King",
  photo_upload: false,
  insider: null,
  tonality: "witzig",
};

const productSelection: ProductSelection = {
  product: "tshirt",
  product_color: "black",
  quantity: 1,
};

describe("buildCreativeBrief", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps concrete user motifs from the full conversation as must-include visuals", async () => {
    const history: ChatMessage[] = [
      {
        role: "user",
        content:
          "Ey Kollege ich will ne richtig fette party feiern und mich wie der größte King fühlen. Mein Name ist Hansi. Ick steh uff mopeds, Schweine und Sommer",
      },
      { role: "assistant", content: "Für welchen Anlass brauchst du das Shirt?" },
      { role: "user", content: "Jeburtstag" },
    ];
    vi.mocked(openai.chat.completions.create).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              occasion: "geburtstag",
              product: "tshirt",
              style: "cartoon",
              tone: "witzig",
              theme: "Hansi der King als Geburtstagsmotiv",
              exact_text: "Hansi der King",
              must_include_visuals: ["Krone", "Konfetti"],
              avoid: [],
              reference_images: [],
              source_summary: "Geburtstagsshirt für Hansi im Cartoon-Stil.",
            }),
          },
        },
      ],
    } as never);

    const brief = await buildCreativeBrief(history, onboardingData, productSelection, []);

    expect(brief.must_include_visuals).toEqual(
      expect.arrayContaining(["Mopeds", "Schweine", "Sommer"])
    );
  });
});
