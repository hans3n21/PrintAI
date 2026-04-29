import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LandingPage from "../page";

const { pushMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/components/gallery/SavedGalleryButton", () => ({
  SavedGalleryButton: () => null,
}));

vi.mock("@/components/notes/FeedbackWidget", () => ({
  FeedbackWidget: () => null,
}));

vi.mock("@/components/chat/PromptComposer", () => ({
  PromptComposer: ({
    onSend,
    onAttachmentsChange,
  }: {
    onSend: (message: string) => void;
    onAttachmentsChange?: (images: string[]) => void;
  }) => {
    useEffect(() => {
      onAttachmentsChange?.([
        "data:image/png;base64,one",
        "data:image/png;base64,two",
        "data:image/png;base64,three",
        "data:image/png;base64,four",
      ]);
    }, [onAttachmentsChange]);

    return (
      <button
        type="button"
        onClick={() => onSend("Bitte daraus ein Gruppenmotiv machen")}
      >
        Starten
      </button>
    );
  },
}));

describe("LandingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window.sessionStorage.__proto__, "setItem");
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ sessionId: "session-1" }))
      .mockResolvedValueOnce(
        Response.json({
          reply: "Okay, ich schaue mir die Referenzen an.",
          complete: false,
          sessionId: "session-1",
        })
      ) as typeof fetch;
  });

  it("sends multiple landing-page reference images directly to chat instead of sessionStorage", async () => {
    render(<LandingPage />);

    fireEvent.click(screen.getByRole("button", { name: "Starten" }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/chat",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("imageBase64List"),
        })
      )
    );
    expect(window.sessionStorage.setItem).not.toHaveBeenCalledWith(
      "printai_initial_session-1",
      expect.any(String)
    );
    expect(window.sessionStorage.setItem).not.toHaveBeenCalledWith(
      "printai_initial_images_session-1",
      expect.any(String)
    );
    expect(pushMock).toHaveBeenCalledWith("/chat?s=session-1");
  });
});
