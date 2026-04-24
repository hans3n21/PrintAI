"use client";

import { useEffect, useState } from "react";

type FeedbackNote = {
  id: string;
  created_at: string;
  page_path: string;
  note: string;
  screenshot_url: string | null;
};

export function NotesFeed() {
  const [notes, setNotes] = useState<FeedbackNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/notes", { cache: "no-store" });
        const data = (await res.json()) as { notes?: FeedbackNote[] };
        if (!active) return;
        setNotes(data.notes ?? []);
      } catch {
        if (!active) return;
        setNotes([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
      <h3 className="text-sm font-semibold text-zinc-200">Notizen & Verbesserungsideen</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Hier seht ihr eure gespeicherten Hinweise und Screenshots.
      </p>

      {loading && <p className="mt-3 text-sm text-zinc-500">Lade Notizen...</p>}
      {!loading && notes.length === 0 && (
        <p className="mt-3 text-sm text-zinc-500">Noch keine Notizen vorhanden.</p>
      )}

      <div className="mt-3 space-y-3">
        {notes.map((n) => (
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
          </article>
        ))}
      </div>
    </section>
  );
}
