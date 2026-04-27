"use client";

import { Input } from "@/components/ui/input";

interface TextEditorProps {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}

export function TextEditor({ value, onChange, label = "Text bearbeiten" }: TextEditorProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-zinc-400">{label}</p>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="z.B. FC Einheit 2026"
        className="rounded-full border-zinc-700/80 bg-zinc-950/60 px-4 text-zinc-100 placeholder:text-zinc-500 focus-visible:border-violet-500 focus-visible:ring-violet-500/20"
      />
    </div>
  );
}
