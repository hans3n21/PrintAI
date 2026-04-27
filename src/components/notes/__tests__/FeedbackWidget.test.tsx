import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FeedbackWidget } from "../FeedbackWidget";
import type { ChatMessage } from "@/lib/types";
import html2canvas from "html2canvas";

vi.mock("html2canvas", () => ({
  default: vi.fn(),
}));

describe("FeedbackWidget", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends session context with the feedback note", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);
    window.history.pushState({}, "", "/designs/session-123");

    const conversation: ChatMessage[] = [
      { role: "user", content: "Shirt für den Verein" },
      { role: "assistant", content: "Welcher Stil?" },
    ];

    render(
      <FeedbackWidget
        sessionId="session-123"
        targetType="chat_message"
        targetRef="assistant:1"
        assistantOutput="Welcher Stil?"
        conversationSnapshot={conversation}
        designUrlsSnapshot={["https://example.com/design.png"]}
        clientState={{ selectedDesignUrl: "https://example.com/design.png" }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Notiz erfassen" }));
    fireEvent.change(screen.getByPlaceholderText("Was sollte verbessert werden?"), {
      target: { value: "Die Rückfrage war zu allgemein." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Notiz speichern" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/notes", expect.anything()));

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init.body));

    expect(body).toMatchObject({
      note: "Die Rückfrage war zu allgemein.",
      page_path: "/designs/session-123",
      session_id: "session-123",
      target_type: "chat_message",
      target_ref: "assistant:1",
      assistant_output: "Welcher Stil?",
      conversation_snapshot: conversation,
      design_urls_snapshot: ["https://example.com/design.png"],
      client_state: { selectedDesignUrl: "https://example.com/design.png" },
    });
  });

  it("does not fall back to desktop screen capture when page screenshot fails", async () => {
    vi.mocked(html2canvas).mockRejectedValue(new Error("canvas failed"));
    const getDisplayMedia = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getDisplayMedia },
      configurable: true,
    });

    render(<FeedbackWidget />);

    fireEvent.click(screen.getByRole("button", { name: "Notiz erfassen" }));
    fireEvent.click(screen.getByRole("button", { name: /Screenshot der aktuellen Seite/i }));

    await waitFor(() =>
      expect(
        screen.getByText(
          "Screenshot konnte nicht erstellt werden. Die Notiz wird trotzdem mit Seiten- und Chat-Kontext gespeichert."
        )
      ).toBeInTheDocument()
    );
    expect(getDisplayMedia).not.toHaveBeenCalled();
  });

  it("closes the note window when clicking outside it", () => {
    render(<FeedbackWidget />);

    fireEvent.click(screen.getByRole("button", { name: "Notiz erfassen" }));
    expect(screen.getByText("Verbesserung notieren")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId("feedback-backdrop"));

    expect(screen.queryByText("Verbesserung notieren")).not.toBeInTheDocument();
  });
});
