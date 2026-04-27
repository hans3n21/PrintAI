"use client";

import { Button } from "@/components/ui/button";
import {
  detectCameraCapability,
  getDesktopCaptureLabel,
  type CameraCapability,
} from "@/lib/cameraCapability";
import { PRODUCT_COLORS } from "@/lib/productOptions";
import { cn } from "@/lib/utils";
import type { ProductColor } from "@/lib/types";
import { Camera, ImagePlus, Mic, Palette, Send, Sparkles, Video, X } from "lucide-react";
import {
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";

type SendOptions = { isVoice?: boolean };

type PromptComposerProps = {
  onSend: (message: string, options?: SendOptions) => void;
  disabled?: boolean;
  placeholder?: string;
  selectedColor?: ProductColor;
  onColorChange?: (color: ProductColor) => void;
  attachmentPreview?: string | null;
  onAttachmentChange?: (imageBase64: string | null) => void;
  variant?: "landing" | "chat";
  loading?: boolean;
};

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

function getVoiceErrorMessage(error?: string) {
  if (error === "not-allowed" || error === "service-not-allowed") {
    return "Mikrofonzugriff wurde blockiert. Bitte erlaube das Mikrofon im Browser oder nutze die Diktierfunktion deiner Handy-Tastatur.";
  }
  if (error === "no-speech") {
    return "Ich habe keine Sprache erkannt. Tippe erneut auf das Mikrofon oder nutze die Diktierfunktion deiner Tastatur.";
  }
  if (error === "audio-capture") {
    return "Kein Mikrofon gefunden. Prüfe die Mikrofonfreigabe oder nutze die Tastatur-Diktierfunktion.";
  }
  return "Spracheingabe ist auf diesem Gerät gerade nicht verfügbar. Nutze alternativ die Diktierfunktion deiner Handy-Tastatur.";
}

export function PromptComposer({
  onSend,
  disabled = false,
  placeholder = "Was möchtest du gestalten?",
  selectedColor,
  onColorChange,
  attachmentPreview,
  onAttachmentChange,
  variant = "chat",
  loading = false,
}: PromptComposerProps) {
  const [value, setValue] = useState("");
  const [showColors, setShowColors] = useState(false);
  const [listening, setListening] = useState(false);
  const [voicePreview, setVoicePreview] = useState("");
  const [voiceNotice, setVoiceNotice] = useState("");
  const [cameraCapability, setCameraCapability] =
    useState<CameraCapability>("unknown");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const hasAttachment = Boolean(attachmentPreview);
  const canSend = !disabled && !loading && (value.trim() || hasAttachment);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!canSend) return;
    onSend(trimmed);
    setValue("");
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") onAttachmentChange?.(result);
    };
    reader.readAsDataURL(file);
  };

  const startVoiceInput = () => {
    if (disabled || loading || listening) return;
    setVoiceNotice("");
    const SpeechRecognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceNotice(
        "Spracheingabe wird von diesem Browser nicht unterstützt. Nutze alternativ die Diktierfunktion deiner Handy-Tastatur."
      );
      textareaRef.current?.focus();
      return;
    }

    let finalTranscript = "";
    let hadRecognitionError = false;
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
    recognition.onerror = (event) => {
      hadRecognitionError = true;
      setListening(false);
      setVoicePreview("");
      setVoiceNotice(getVoiceErrorMessage(event.error));
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      const spoken = finalTranscript.trim();
      setListening(false);
      setVoicePreview("");
      recognitionRef.current = null;
      if (hadRecognitionError) return;
      if (spoken) onSend(spoken, { isVoice: true });
      else setVoiceNotice("Ich habe nichts verstanden. Bitte versuche es erneut oder nutze die Handy-Diktierfunktion.");
    };
    recognitionRef.current = recognition;
    setVoicePreview("");
    setListening(true);
    try {
      recognition.start();
    } catch {
      setListening(false);
      setVoicePreview("");
      recognitionRef.current = null;
      setVoiceNotice(
        "Spracheingabe konnte nicht gestartet werden. Bitte prüfe die Mikrofonfreigabe oder nutze die Handy-Diktierfunktion."
      );
      textareaRef.current?.focus();
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCameraCapability(detectCameraCapability(navigator.mediaDevices));
    }, 0);
    return () => {
      window.clearTimeout(timer);
      recognitionRef.current?.stop();
    };
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className={cn(
        "rounded-[2rem] border border-zinc-700 bg-zinc-800/80 px-5 pb-4 pt-5 shadow-2xl shadow-black/25 transition-colors focus-within:border-violet-500 focus-within:shadow-violet-950/30",
        variant === "landing" ? "min-h-52" : "min-h-36"
      )}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || loading}
        rows={variant === "landing" ? 5 : 3}
        className="min-h-20 w-full resize-none bg-transparent px-1 text-base leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-400 disabled:opacity-60"
      />

      {(listening || voiceNotice || attachmentPreview) && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-violet-200">
          {listening && (
            <>
              <VoiceWaveform />
              <span className="max-w-52 truncate">{voicePreview || "Sprich jetzt..."}</span>
            </>
          )}
          {voiceNotice && (
            <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-yellow-200">
              {voiceNotice}
            </div>
          )}
          {attachmentPreview && (
            <div className="flex items-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 py-1 pl-1 pr-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attachmentPreview}
                alt="Gewähltes Referenzbild"
                className="h-7 w-7 rounded-full object-cover"
              />
              <span>Referenzbild gewählt</span>
              <button
                type="button"
                className="rounded-full p-0.5 text-violet-200 hover:bg-violet-500/20"
                onClick={() => onAttachmentChange?.(null)}
                aria-label="Referenzbild entfernen"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <input
            ref={selfieInputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={onFileChange}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFileChange}
          />
          <ComposerIconButton
            label="Selfie aufnehmen"
            disabled={disabled || loading}
            onClick={() => selfieInputRef.current?.click()}
            className="md:hidden"
          >
            <Camera className="h-4 w-4" />
          </ComposerIconButton>
          <ComposerIconButton
            label={getDesktopCaptureLabel(cameraCapability)}
            disabled={disabled || loading}
            onClick={() => selfieInputRef.current?.click()}
            className="hidden md:flex"
          >
            <Video className="h-4 w-4" />
          </ComposerIconButton>
          <ComposerIconButton
            label="Bild hochladen"
            disabled={disabled || loading}
            onClick={() => galleryInputRef.current?.click()}
          >
            <ImagePlus className="h-4 w-4" />
          </ComposerIconButton>
          <ComposerIconButton
            label="Spracheingabe starten"
            disabled={disabled || loading || listening}
            onClick={startVoiceInput}
          >
            <Mic className="h-4 w-4" />
          </ComposerIconButton>
          {selectedColor && onColorChange && (
            <div className="flex items-center gap-2 overflow-hidden">
              <ComposerIconButton
                label="Produktfarbe auswählen"
                disabled={disabled || loading}
                active={showColors}
                onClick={() => setShowColors((current) => !current)}
              >
                <Palette className="h-4 w-4" />
              </ComposerIconButton>
              <div
                className={cn(
                  "flex items-center gap-1.5 transition-all duration-300",
                  showColors
                    ? "max-w-56 translate-x-0 opacity-100"
                    : "max-w-0 -translate-x-3 opacity-0"
                )}
              >
                {PRODUCT_COLORS.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => onColorChange(color.id)}
                    className={cn(
                      "h-8 w-8 shrink-0 rounded-full border transition",
                      selectedColor === color.id
                        ? "border-violet-300 ring-2 ring-violet-500/60"
                        : "border-zinc-600 hover:border-zinc-300"
                    )}
                    style={{ backgroundColor: color.hex }}
                    aria-label={`Farbe ${color.label} auswählen`}
                    title={color.label}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <Button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          size="icon"
          className="h-11 w-11 shrink-0 rounded-full bg-violet-600 shadow-lg shadow-violet-950/40 transition hover:-translate-y-0.5 hover:bg-violet-700 hover:shadow-violet-900/50 disabled:opacity-40 disabled:hover:translate-y-0"
          aria-label="Nachricht senden"
        >
          {loading ? (
            <Sparkles className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

function ComposerIconButton({
  children,
  label,
  disabled,
  active,
  className,
  onClick,
}: {
  children: ReactNode;
  label: string;
  disabled?: boolean;
  active?: boolean;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700/80 bg-zinc-900/80 text-zinc-200 shadow-sm shadow-black/30 transition hover:-translate-y-0.5 hover:border-zinc-500 hover:bg-zinc-800 hover:text-white hover:shadow-md hover:shadow-black/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0",
        active && "border-violet-500/70 bg-violet-600/20 text-white shadow-violet-950/30",
        className
      )}
    >
      {children}
    </button>
  );
}
