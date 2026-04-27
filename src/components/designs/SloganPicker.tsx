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
        className="flex w-full items-center justify-between gap-3 rounded-[1.5rem] border border-zinc-700/70 bg-zinc-800/80 p-4 text-left shadow-lg shadow-black/20 ring-1 ring-white/5 transition hover:-translate-y-0.5 hover:border-violet-500/70"
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
        <div className="space-y-2 rounded-[1.5rem] border border-zinc-700/70 bg-zinc-800/80 p-2 shadow-xl shadow-black/25 ring-1 ring-white/5 backdrop-blur">
          {slogans.map((slogan, i) => (
            <button
              key={`${slogan.main_text}-${i}`}
              onClick={() => handleSelect(i)}
              className={cn(
                "w-full rounded-2xl border p-3 text-left transition-all",
                selectedIndex === i
                  ? "border-violet-500 bg-violet-600/15"
                  : "border-zinc-700/70 bg-zinc-950/50 hover:border-zinc-500"
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
