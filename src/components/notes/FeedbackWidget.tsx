"use client";

import { useMemo, useState } from "react";
import html2canvas from "html2canvas";
import { NotebookPen, Camera, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const pagePath = useMemo(() => {
    if (typeof window === "undefined") return "/";
    return `${window.location.pathname}${window.location.search || ""}`;
  }, [open]);

  async function captureScreenshot() {
    setError(null);
    try {
      const canvas = await html2canvas(document.body, {
        backgroundColor: "#09090b",
        useCORS: true,
        scale: 1,
      });
      setScreenshot(canvas.toDataURL("image/png", 0.9));
    } catch {
      setError("Screenshot konnte nicht erstellt werden.");
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
          page_path: pagePath,
          screenshot_base64: screenshot,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || `Fehler ${res.status}`);
      }
      setNote("");
      setScreenshot(null);
      setOk("Notiz gespeichert.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        aria-label="Notiz erfassen"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 shadow-lg transition hover:border-violet-500 hover:bg-zinc-800"
      >
        <NotebookPen className="h-4 w-4" />
        Notiz
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 md:items-center">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-900 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Verbesserung notieren</h3>
              <button
                aria-label="Schließen"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-2 text-xs text-zinc-500">Seite: {pagePath}</p>

            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Was sollte verbessert werden?"
              rows={4}
              className="resize-none border-zinc-700 bg-zinc-950 text-zinc-100"
            />

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void captureScreenshot()}
                className="border-zinc-700 text-zinc-200"
              >
                <Camera className="mr-2 h-4 w-4" />
                Screenshot der aktuellen Seite
              </Button>
              {screenshot && <span className="text-xs text-green-400">Screenshot angehängt</span>}
            </div>

            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
            {ok && <p className="mt-3 text-sm text-green-400">{ok}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="border-zinc-700 text-zinc-300"
              >
                Schließen
              </Button>
              <Button
                type="button"
                onClick={() => void saveNote()}
                disabled={!note.trim() || saving}
                className="bg-violet-600 hover:bg-violet-700"
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
      )}
    </>
  );
}
