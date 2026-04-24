"use client";

import type { SloganOption } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SloganPickerProps {
  slogans: SloganOption[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

export function SloganPicker({ slogans, selectedIndex, onSelect }: SloganPickerProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-zinc-400">Textvorschlaege</p>
      {slogans.map((slogan, i) => (
        <button
          key={`${slogan.main_text}-${i}`}
          onClick={() => onSelect(i)}
          className={cn(
            "w-full rounded-xl border p-3 text-left transition-all",
            selectedIndex === i
              ? "border-violet-500 bg-violet-600/10"
              : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
          )}
        >
          <p className="font-bold text-white">{slogan.main_text}</p>
          {slogan.sub_text && <p className="text-sm text-zinc-400">{slogan.sub_text}</p>}
        </button>
      ))}
    </div>
  );
}
