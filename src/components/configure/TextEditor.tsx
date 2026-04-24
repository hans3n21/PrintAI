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
        className="border-zinc-700 bg-zinc-900 text-zinc-100"
      />
    </div>
  );
}
