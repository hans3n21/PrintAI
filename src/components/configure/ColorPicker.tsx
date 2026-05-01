"use client";

import { cn } from "@/lib/utils";

const COLORS = [
  { id: "white", label: "Weiß", hex: "#ffffff" },
  { id: "black", label: "Schwarz", hex: "#1a1a1a" },
  { id: "navy", label: "Navy", hex: "#1e3a5f" },
  { id: "grey", label: "Grau", hex: "#6b7280" },
];

interface ColorPickerProps {
  selected: string;
  onChange: (color: string) => void;
  colors?: Array<{ id: string; label: string; hex: string }>;
}

export function ColorPicker({ selected, onChange, colors = COLORS }: ColorPickerProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-zinc-400">Produktfarbe</p>
      <div className="flex max-w-full flex-wrap gap-3">
        {colors.map((c) => (
          <button
            key={c.id}
            type="button"
            title={c.label}
            onClick={() => onChange(c.id)}
            className={cn(
              "h-9 w-9 shrink-0 rounded-full border shadow-sm shadow-black/30 transition-all",
              selected === c.id
                ? "scale-110 border-violet-300 ring-2 ring-violet-500/60"
                : "border-zinc-600 hover:-translate-y-0.5 hover:border-zinc-300"
            )}
            style={{ backgroundColor: c.hex }}
          />
        ))}
      </div>
    </div>
  );
}
