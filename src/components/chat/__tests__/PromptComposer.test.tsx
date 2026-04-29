import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PromptComposer } from "../PromptComposer";

describe("PromptComposer voice input", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, "SpeechRecognition");
    Reflect.deleteProperty(window, "webkitSpeechRecognition");
  });

  it("shows a mobile-friendly fallback when speech recognition is unsupported", () => {
    render(<PromptComposer onSend={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Spracheingabe starten" }));

    expect(
      screen.getByText(/Spracheingabe wird von diesem Browser nicht unterstützt/i)
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Was möchtest du gestalten?")).toHaveFocus();
  });

  it("shows a permission message when speech recognition is blocked", () => {
    class BlockedSpeechRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult = null;
      onend: (() => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      start() {
        this.onerror?.({ error: "not-allowed" });
        this.onend?.();
      }
      stop() {}
    }
    window.webkitSpeechRecognition = BlockedSpeechRecognition;

    render(<PromptComposer onSend={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Spracheingabe starten" }));

    expect(screen.getByText(/Mikrofonzugriff wurde blockiert/i)).toBeInTheDocument();
  });

  it("shows a helpful message when speech recognition cannot start", () => {
    class ThrowingSpeechRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult = null;
      onend = null;
      onerror = null;
      start() {
        throw new Error("start failed");
      }
      stop() {}
    }
    window.SpeechRecognition = ThrowingSpeechRecognition;

    render(<PromptComposer onSend={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Spracheingabe starten" }));

    expect(
      screen.getByText(/Spracheingabe konnte nicht gestartet werden/i)
    ).toBeInTheDocument();
  });
});

describe("PromptComposer attachments", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("accepts multiple gallery images and shows them as reference attachments", async () => {
    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      onload: (() => void) | null = null;
      readAsDataURL(file: File) {
        this.result = `data:${file.type};base64,${file.name}`;
        this.onload?.();
      }
    }
    vi.stubGlobal("FileReader", MockFileReader);
    const onAttachmentsChange = vi.fn();
    const { container } = render(
      <PromptComposer
        onSend={vi.fn()}
        attachmentPreviews={[]}
        onAttachmentsChange={onAttachmentsChange}
      />
    );

    const galleryInput = container.querySelectorAll<HTMLInputElement>(
      'input[type="file"][accept="image/*"]'
    )[1];
    expect(galleryInput).toHaveAttribute("multiple");

    fireEvent.change(galleryInput, {
      target: {
        files: [
          new File(["one"], "person-1.png", { type: "image/png" }),
          new File(["two"], "person-2.jpg", { type: "image/jpeg" }),
        ],
      },
    });

    await waitFor(() =>
      expect(onAttachmentsChange).toHaveBeenCalledWith([
        "data:image/png;base64,person-1.png",
        "data:image/jpeg;base64,person-2.jpg",
      ])
    );

    render(
      <PromptComposer
        onSend={vi.fn()}
        attachmentPreviews={[
          "data:image/png;base64,person-1.png",
          "data:image/jpeg;base64,person-2.jpg",
        ]}
        onAttachmentsChange={onAttachmentsChange}
      />
    );

    expect(screen.getByText("2 Referenzbilder gewählt")).toBeInTheDocument();
    expect(screen.getAllByAltText("Gewähltes Referenzbild")).toHaveLength(2);
  });
});
