"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type FeedbackNote = {
  id: string;
  created_at: string;
  page_path: string;
  note: string;
  screenshot_url: string | null;
  resolved: boolean;
  resolved_at: string | null;
};

export function NotesFeed() {
  const [notes, setNotes] = useState<FeedbackNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadNotes() {
    try {
      const res = await fetch("/api/notes", { cache: "no-store" });
      const data = (await res.json()) as { notes?: FeedbackNote[] };
      setNotes(data.notes ?? []);
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNotes();
  }, []);

  async function setResolved(id: string, resolved: boolean) {
    setBusyId(id);
    try {
      await fetch("/api/notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, resolved }),
      });
      await loadNotes();
    } finally {
      setBusyId(null);
    }
  }

  async function deleteNote(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/notes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await loadNotes();
    } finally {
      setBusyId(null);
    }
  }

  const openNotes = notes.filter((n) => !n.resolved);
  const archivedNotes = notes.filter((n) => n.resolved);

  return (
    <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
      <h3 className="text-sm font-semibold text-zinc-200">Notizen & Verbesserungsideen</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Offen, erledigt und archiviert inkl. Screenshot-Referenz.
      </p>

      {loading && <p className="mt-3 text-sm text-zinc-500">Lade Notizen...</p>}
      {!loading && notes.length === 0 && (
        <p className="mt-3 text-sm text-zinc-500">Noch keine Notizen vorhanden.</p>
      )}

      {!loading && openNotes.length > 0 && (
        <p className="mt-4 text-xs uppercase tracking-wide text-zinc-500">Offen</p>
      )}
      <div className="mt-2 space-y-3">
        {openNotes.map((n) => (
          <article key={n.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-sm text-zinc-100">{n.note}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {new Date(n.created_at).toLocaleString("de-DE")} · {n.page_path}
            </p>
            {n.screenshot_url && (
              <a
                href={n.screenshot_url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs text-violet-400 hover:text-violet-300"
              >
                Screenshot öffnen
              </a>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => void setResolved(n.id, true)}
                disabled={busyId === n.id}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Erledigt
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void deleteNote(n.id)}
                disabled={busyId === n.id}
                className="border-zinc-700 text-zinc-300"
              >
                Löschen
              </Button>
            </div>
          </article>
        ))}
      </div>

      {!loading && archivedNotes.length > 0 && (
        <>
          <p className="mt-6 text-xs uppercase tracking-wide text-zinc-500">Archiv</p>
          <div className="mt-2 space-y-3">
            {archivedNotes.map((n) => (
              <article
                key={n.id}
                className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 opacity-90"
              >
                <p className="text-sm text-zinc-200">{n.note}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {new Date(n.created_at).toLocaleString("de-DE")} · {n.page_path}
                  {n.resolved_at
                    ? ` · erledigt ${new Date(n.resolved_at).toLocaleString("de-DE")}`
                    : ""}
                </p>
                {n.screenshot_url && (
                  <a
                    href={n.screenshot_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs text-violet-400 hover:text-violet-300"
                  >
                    Screenshot öffnen
                  </a>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void setResolved(n.id, false)}
                    disabled={busyId === n.id}
                    className="border-zinc-700 text-zinc-300"
                  >
                    Wieder öffnen
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void deleteNote(n.id)}
                    disabled={busyId === n.id}
                    className="border-zinc-700 text-zinc-300"
                  >
                    Löschen
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
