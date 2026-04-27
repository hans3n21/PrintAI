"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import html2canvas from "html2canvas";
import { NotebookPen, Camera, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FEEDBACK_CATEGORIES, type FeedbackCategory } from "@/lib/feedback/categories";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

type FeedbackWidgetProps = {
  sessionId?: string;
  targetType?: "page" | "chat_message" | "chat_session" | "design" | "generation";
  targetRef?: string;
  assistantOutput?: string;
  conversationSnapshot?: ChatMessage[];
  designUrlsSnapshot?: string[];
  clientState?: Record<string, unknown>;
  triggerVariant?: "floating" | "header";
};

export function FeedbackWidget({
  sessionId,
  targetType = "page",
  targetRef,
  assistantOutput,
  conversationSnapshot,
  designUrlsSnapshot,
  clientState,
  triggerVariant = "floating",
}: FeedbackWidgetProps = {}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<FeedbackCategory>("general");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const pagePath =
    typeof window === "undefined"
      ? "/"
      : `${window.location.pathname}${window.location.search || ""}`;

  async function captureScreenshot() {
    setError(null);
    try {
      const canvas = await html2canvas(document.documentElement, {
        backgroundColor: "#09090b",
        useCORS: true,
        allowTaint: false,
        scale: 1,
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
        ignoreElements: (element) =>
          element.hasAttribute("data-feedback-screenshot-ignore"),
      });
      setScreenshot(canvas.toDataURL("image/png", 0.9));
    } catch {
      setError(
        "Screenshot konnte nicht erstellt werden. Die Notiz wird trotzdem mit Seiten- und Chat-Kontext gespeichert."
      );
    }
  }

  async function saveNote() {
    if (!note.trim()) return;
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: note.trim(),
          category,
          page_path: pagePath,
          screenshot_base64: screenshot,
          session_id: sessionId,
          target_type: targetType,
          target_ref: targetRef,
          assistant_output: assistantOutput,
          conversation_snapshot: conversationSnapshot,
          design_urls_snapshot: designUrlsSnapshot,
          client_state: clientState,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || `Fehler ${res.status}`);
      }
      setNote("");
      setCategory("general");
      setScreenshot(null);
      setOk("Notiz gespeichert.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  const noteWindow = open ? (
    <div
      data-feedback-screenshot-ignore
      data-testid="feedback-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:p-4 md:items-center"
    >
      <div
        data-feedback-panel
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[2rem] rounded-b-none border border-b-0 border-zinc-700/80 bg-zinc-800/95 p-5 shadow-2xl shadow-black/40 ring-1 ring-white/5 sm:max-w-lg sm:rounded-[2rem] sm:border"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white">Verbesserung notieren</h3>
            <p className="mt-1 text-xs text-zinc-500">Kurze Notiz mit Seitenkontext speichern.</p>
          </div>
          <button
            aria-label="Schließen"
            onClick={() => setOpen(false)}
            className="rounded-full border border-zinc-700/80 bg-zinc-900/80 p-2 text-zinc-400 shadow-sm shadow-black/30 transition hover:border-zinc-500 hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-3 rounded-full border border-zinc-700/60 bg-zinc-950/40 px-3 py-1 text-xs text-zinc-500">
          Seite: {pagePath}
        </p>

        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Was sollte verbessert werden?"
          rows={4}
          className="resize-none rounded-2xl border-zinc-700/80 bg-zinc-950/60 px-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus-visible:border-violet-500 focus-visible:ring-violet-500/20"
        />

        <label className="mt-3 block space-y-2">
          <span className="text-xs font-medium text-zinc-400">Kategorie</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
            className="w-full rounded-2xl border border-zinc-700/80 bg-zinc-950/60 px-4 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-violet-500"
          >
            {FEEDBACK_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void captureScreenshot()}
            className="w-full justify-center whitespace-normal rounded-full border-zinc-700/80 bg-zinc-900/70 text-zinc-200 shadow-sm shadow-black/20 hover:bg-zinc-800 sm:w-auto"
          >
            <Camera className="mr-2 h-4 w-4" />
            Screenshot der aktuellen Seite
          </Button>
          {screenshot && <span className="text-xs text-green-400">Screenshot angehängt</span>}
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        {ok && <p className="mt-3 text-sm text-green-400">{ok}</p>}

        <div className="mt-4 flex flex-col justify-end gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            className="w-full rounded-full border-zinc-700/80 bg-zinc-900/70 text-zinc-300 hover:bg-zinc-800 sm:w-auto"
          >
            Schließen
          </Button>
          <Button
            type="button"
            onClick={() => void saveNote()}
            disabled={!note.trim() || saving}
            className="w-full rounded-full bg-violet-600 shadow-lg shadow-violet-950/40 hover:bg-violet-700 disabled:opacity-40 sm:w-auto"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Speichern...
              </>
            ) : (
              "Notiz speichern"
            )}
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        aria-label="Notiz erfassen"
        data-feedback-screenshot-ignore
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-zinc-700/80 bg-zinc-900/90 px-4 py-2 text-sm text-zinc-100 shadow-lg shadow-black/30 backdrop-blur transition hover:-translate-y-0.5 hover:border-violet-500 hover:bg-zinc-800",
          triggerVariant === "floating" ? "fixed bottom-5 right-5 z-40" : "relative z-10"
        )}
      >
        <NotebookPen className="h-4 w-4" />
        Notiz
      </button>
      {typeof document === "undefined" ? noteWindow : createPortal(noteWindow, document.body)}
    </>
  );
}
