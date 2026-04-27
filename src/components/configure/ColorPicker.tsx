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
}

export function ColorPicker({ selected, onChange }: ColorPickerProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-zinc-400">Produktfarbe</p>
      <div className="flex gap-3">
        {COLORS.map((c) => (
          <button
            key={c.id}
            title={c.label}
            onClick={() => onChange(c.id)}
            className={cn(
              "h-8 w-8 rounded-full border-2 transition-all",
              selected === c.id ? "scale-110 border-violet-500" : "border-zinc-600 hover:border-zinc-400"
            )}
            style={{ backgroundColor: c.hex }}
          />
        ))}
      </div>
    </div>
  );
}
