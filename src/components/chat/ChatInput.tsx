"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Send } from "lucide-react";
import { KeyboardEvent, useEffect, useRef, useState } from "react";

interface ChatInputProps {
  onSend: (message: string, options?: { isVoice?: boolean }) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Wenn true, Senden auch ohne Text (z.B. nur Foto-Anhang). */
  hasAttachment?: boolean;
}

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionErrorLike = {
  error?: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

function VoiceWaveform() {
  return (
    <div className="flex h-7 items-center gap-1 rounded-full border border-violet-500/40 bg-violet-500/10 px-3">
      {Array.from({ length: 18 }, (_, i) => (
        <span
          key={i}
          className="w-0.5 animate-pulse rounded-full bg-violet-300"
          style={{
            height: `${8 + ((i * 7) % 18)}px`,
            animationDelay: `${i * 45}ms`,
          }}
        />
      ))}
    </div>
  );
}

export function ChatInput({
  onSend,
  disabled,
  placeholder = "Antwort eingeben...",
  hasAttachment = false,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  const [voicePreview, setVoicePreview] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (disabled) return;
    if (!trimmed && !hasAttachment) return;
    onSend(trimmed);
    setValue("");
  };

  const startVoiceInput = () => {
    if (disabled || listening) return;
    const SpeechRecognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setValue((prev) =>
        prev || "Spracheingabe wird von diesem Browser nicht unterstützt."
      );
      return;
    }

    let finalTranscript = "";
    const recognition = new SpeechRecognition();
    recognition.lang = "de-DE";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalTranscript += result[0].transcript;
        else interim += result[0].transcript;
      }
      setVoicePreview((finalTranscript || interim).trim());
    };
    recognition.onerror = () => {
      setListening(false);
    };
    recognition.onend = () => {
      const spoken = finalTranscript.trim();
      setListening(false);
      setVoicePreview("");
      recognitionRef.current = null;
      if (spoken) onSend(spoken, { isVoice: true });
    };
    recognitionRef.current = recognition;
    setVoicePreview("");
    setListening(true);
    recognition.start();
  };

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-2 p-4">
      {listening && (
        <div className="flex items-center gap-2 text-xs text-violet-200">
          <VoiceWaveform />
          <span className="truncate">
            {voicePreview || "Sprich jetzt..."}
          </span>
        </div>
      )}
      <div className="flex gap-2">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="resize-none rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 placeholder-zinc-500 focus:border-violet-500"
        />
        <Button
          onClick={startVoiceInput}
          disabled={disabled || listening}
          type="button"
          size="icon"
          variant="outline"
          className="shrink-0 rounded-xl border-zinc-700 text-zinc-300"
          aria-label="Spracheingabe starten"
        >
          <Mic className="h-4 w-4" />
        </Button>
        <Button
          onClick={handleSend}
          disabled={disabled || (!value.trim() && !hasAttachment)}
          size="icon"
          className="shrink-0 rounded-xl bg-violet-600 hover:bg-violet-700"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
