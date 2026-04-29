import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, storageFromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  storageFromMock: vi.fn(),
}));

const {
  runOnboardingMessageMock,
  runForceCompleteOnboardingMock,
  buildCreativeBriefMock,
  buildImagePromptMock,
} = vi.hoisted(() => ({
  runOnboardingMessageMock: vi.fn(),
  runForceCompleteOnboardingMock: vi.fn(),
  buildCreativeBriefMock: vi.fn(),
  buildImagePromptMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: fromMock,
    storage: {
      from: storageFromMock,
    },
  },
}));

vi.mock("@/lib/agents/onboarding", () => ({
  runOnboardingMessage: runOnboardingMessageMock,
  runForceCompleteOnboarding: runForceCompleteOnboardingMock,
}));

vi.mock("@/lib/agents/creativeBrief", () => ({
  buildCreativeBrief: buildCreativeBriefMock,
}));

vi.mock("@/lib/agents/promptBuilder", () => ({
  buildImagePrompt: buildImagePromptMock,
}));

import { POST } from "../route";

function mockSessionUpdate() {
  const updateEq = vi.fn(() => Promise.resolve({ error: null }));
  const update = vi.fn(() => ({ eq: updateEq }));
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    single: vi.fn(() =>
      Promise.resolve({
        data: {
          conversation_history: [],
          status: "onboarding",
          product_selection: { product: "tshirt", product_color: "black", quantity: 1 },
          reference_images: [],
        },
        error: null,
      })
    ),
    update,
  };
  fromMock.mockReturnValue(query);
  return { update, updateEq };
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionUpdate();
    storageFromMock.mockReturnValue({
      upload: vi.fn(() => Promise.resolve({ error: null })),
      getPublicUrl: vi.fn((path: string) => ({
        data: {
          publicUrl: path.includes("_1.")
            ? "https://cdn.example.com/ref-1.png"
            : "https://cdn.example.com/ref-2.png",
        },
      })),
    });
    runOnboardingMessageMock.mockResolvedValue({
      complete: false,
      reply: "Was soll auf das Motiv?",
    });
  });

  it("uploads multiple reference images and passes all of them into onboarding", async () => {
    const response = await POST(
      new Request("https://example.com/api/chat", {
        method: "POST",
        body: JSON.stringify({
          sessionId: "session-1",
          message: "Bitte vereine diese Personen",
          imageBase64List: [
            "data:image/png;base64,AAAA",
            "data:image/jpeg;base64,BBBB",
          ],
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(storageFromMock().upload).toHaveBeenCalledTimes(2);
    expect(runOnboardingMessageMock).toHaveBeenCalledWith(
      [],
      "Bitte vereine diese Personen",
      expect.objectContaining({
        referenceImageUrls: [
          "https://cdn.example.com/ref-1.png",
          "https://cdn.example.com/ref-2.png",
        ],
        referenceImages: expect.arrayContaining([
          expect.objectContaining({ url: "https://cdn.example.com/ref-1.png" }),
          expect.objectContaining({ url: "https://cdn.example.com/ref-2.png" }),
        ]),
      })
    );
    const sessionQuery = fromMock.mock.results[0].value;
    expect(sessionQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_history: [
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("Bitte vereine diese Personen"),
            attachments: [
              {
                url: "https://cdn.example.com/ref-1.png",
                label: "Referenzbild 1",
                kind: "reference",
              },
              {
                url: "https://cdn.example.com/ref-2.png",
                label: "Referenzbild 2",
                kind: "reference",
              },
            ],
          }),
          expect.objectContaining({ role: "assistant" }),
        ],
      })
    );
  });
});
