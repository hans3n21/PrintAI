"use client";

import type { SloganOption } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

interface SloganPickerProps {
  slogans: SloganOption[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

export function SloganPicker({ slogans, selectedIndex, onSelect }: SloganPickerProps) {
  const [open, setOpen] = useState(false);
  const currentIndex = selectedIndex ?? 0;
  const current = slogans[currentIndex] ?? slogans[0];

  if (!current) return null;

  const handleSelect = (index: number) => {
    onSelect(index);
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-zinc-700 bg-zinc-900 p-3 text-left transition hover:border-zinc-500"
        aria-label="Textvorschlag auswählen"
      >
        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-500">Textvorschlag</p>
          <p className="truncate font-bold text-white">{current.main_text}</p>
          {current.sub_text && (
            <p className="truncate text-sm text-zinc-400">{current.sub_text}</p>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-zinc-400 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="space-y-2 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-2">
          {slogans.map((slogan, i) => (
            <button
              key={`${slogan.main_text}-${i}`}
              onClick={() => handleSelect(i)}
              className={cn(
                "w-full rounded-xl border p-3 text-left transition-all",
                selectedIndex === i
                  ? "border-violet-500 bg-violet-600/10"
                  : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
              )}
            >
              <p className="font-bold text-white">{slogan.main_text}</p>
              {slogan.sub_text && (
                <p className="text-sm text-zinc-400">{slogan.sub_text}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
