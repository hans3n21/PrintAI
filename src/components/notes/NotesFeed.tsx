"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AppSurface, primaryActionClassName, secondaryActionClassName } from "@/components/ui/appSurface";
import type { ChatMessage } from "@/lib/types";

type FeedbackNote = {
  id: string;
  created_at: string;
  page_path: string;
  note: string;
  category: string | null;
  screenshot_url: string | null;
  resolved: boolean;
  resolved_at: string | null;
  session_id: string | null;
  target_type: string | null;
  target_ref: string | null;
  assistant_output: string | null;
  conversation_snapshot: ChatMessage[] | null;
  design_urls_snapshot: string[] | null;
  client_state: Record<string, unknown> | null;
};

function ContextDetails({ note }: { note: FeedbackNote }) {
  const hasContext =
    note.assistant_output ||
    note.conversation_snapshot?.length ||
    note.design_urls_snapshot?.length ||
    note.client_state;

  if (!hasContext) return null;

  return (
    <details className="mt-3 rounded-2xl border border-zinc-700/70 bg-zinc-900/70 p-3">
      <summary className="cursor-pointer text-xs font-medium text-zinc-300">
        Kontext anzeigen
      </summary>
      {note.assistant_output && (
        <div className="mt-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Bot-Ausgabe</p>
          <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-300">{note.assistant_output}</p>
        </div>
      )}
      {note.conversation_snapshot && note.conversation_snapshot.length > 0 && (
        <div className="mt-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Chatverlauf</p>
          <div className="mt-1 space-y-1">
            {note.conversation_snapshot.map((message, index) => (
              <p key={`${message.role}-${index}`} className="text-xs text-zinc-300">
                <span className="font-semibold text-zinc-100">{message.role}:</span>{" "}
                {message.content}
              </p>
            ))}
          </div>
        </div>
      )}
      {note.design_urls_snapshot && note.design_urls_snapshot.length > 0 && (
        <div className="mt-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Sichtbare Designs</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {note.design_urls_snapshot.map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Feedback-Design" className="rounded border border-zinc-800" />
              </a>
            ))}
          </div>
        </div>
      )}
      {note.client_state && (
        <div className="mt-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Client-State</p>
          <pre className="mt-1 overflow-auto rounded-2xl bg-zinc-950/70 p-3 text-xs text-zinc-300">
            {JSON.stringify(note.client_state, null, 2)}
          </pre>
        </div>
      )}
    </details>
  );
}

export function NotesFeed() {
  const [notes, setNotes] = useState<FeedbackNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);

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
    const timer = window.setTimeout(() => {
      void loadNotes();
    }, 0);
    return () => window.clearTimeout(timer);
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
    <AppSurface className="mt-8">
      <h3 className="text-sm font-semibold text-zinc-200">Notizen & Verbesserungsideen</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Offene Einträge werden zuerst angezeigt. Erledigte Einträge bleiben im Archiv.
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
          <article key={n.id} className="rounded-2xl border border-zinc-700/70 bg-zinc-950/50 p-4">
            <p className="text-sm text-zinc-100">{n.note}</p>
            {n.category && (
              <span className="mt-2 inline-block rounded-full bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                {n.category}
              </span>
            )}
            <p className="mt-1 text-xs text-zinc-500">
              {new Date(n.created_at).toLocaleString("de-DE")} · {n.page_path}
              {n.session_id ? ` · Session ${n.session_id}` : ""}
              {n.target_type ? ` · ${n.target_type}${n.target_ref ? `:${n.target_ref}` : ""}` : ""}
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
            <ContextDetails note={n} />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => void setResolved(n.id, true)}
                disabled={busyId === n.id}
                className={primaryActionClassName("bg-emerald-600 shadow-emerald-950/30 hover:bg-emerald-700")}
              >
                Erledigt
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void deleteNote(n.id)}
                disabled={busyId === n.id}
                className={secondaryActionClassName()}
              >
                Löschen
              </Button>
            </div>
          </article>
        ))}
      </div>

      {!loading && archivedNotes.length > 0 && (
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-zinc-800/70 pt-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Archiv</p>
            <p className="mt-1 text-xs text-zinc-600">
              {archivedNotes.length} erledigte Einträge ausgeblendet.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowArchive((v) => !v)}
            className={secondaryActionClassName()}
          >
            {showArchive ? "Archiv ausblenden" : "Archiv anzeigen"}
          </Button>
        </div>
      )}

      {!loading && showArchive && archivedNotes.length > 0 && (
        <>
          <div className="mt-2 space-y-3">
            {archivedNotes.map((n) => (
              <article
                key={n.id}
                className="rounded-2xl border border-zinc-700/70 bg-zinc-950/40 p-4 opacity-90"
              >
                <p className="text-sm text-zinc-200">{n.note}</p>
                {n.category && (
                  <span className="mt-2 inline-block rounded-full bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                    {n.category}
                  </span>
                )}
                <p className="mt-1 text-xs text-zinc-500">
                  {new Date(n.created_at).toLocaleString("de-DE")} · {n.page_path}
                  {n.session_id ? ` · Session ${n.session_id}` : ""}
                  {n.target_type
                    ? ` · ${n.target_type}${n.target_ref ? `:${n.target_ref}` : ""}`
                    : ""}
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
                <ContextDetails note={n} />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void setResolved(n.id, false)}
                    disabled={busyId === n.id}
                    className={secondaryActionClassName()}
                  >
                    Wieder öffnen
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void deleteNote(n.id)}
                    disabled={busyId === n.id}
                    className={secondaryActionClassName()}
                  >
                    Löschen
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </AppSurface>
  );
}
