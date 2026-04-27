import { fireEvent, render, screen } from "@testing-library/react";
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
