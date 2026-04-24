"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { KeyboardEvent, useState } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Wenn true, Senden auch ohne Text (z.B. nur Foto-Anhang). */
  hasAttachment?: boolean;
}

export function ChatInput({
  onSend,
  disabled,
  placeholder = "Antwort eingeben...",
  hasAttachment = false,
}: ChatInputProps) {
  const [value, setValue] = useState("");

  const handleSend = () => {
    const trimmed = value.trim();
    if (disabled) return;
    if (!trimmed && !hasAttachment) return;
    onSend(trimmed);
    setValue("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex gap-2 p-4">
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
        onClick={handleSend}
        disabled={disabled || (!value.trim() && !hasAttachment)}
        size="icon"
        className="shrink-0 rounded-xl bg-violet-600 hover:bg-violet-700"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
