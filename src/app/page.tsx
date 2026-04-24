"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NotesFeed } from "@/components/notes/NotesFeed";

const EXAMPLES = [
  "Shirt fuer unseren Fussballverein, 18 Spieler",
  "JGA fuer Lisa, 8 Maedels, Mallorca",
  "Geburtstagsshirt fuer meinen Kumpel Tim, 30 Jahre",
  "Abi 2026, Klasse 10b, ca. 25 Leute",
];

export default function LandingPage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleStart = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initial_message: trimmed }),
      });

      const data = (await res.json()) as { sessionId?: string; error?: string };

      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : `Session konnte nicht erstellt werden (${res.status}).`
        );
        setLoading(false);
        return;
      }

      if (!data.sessionId) {
        setError("Unerwartete Antwort von der Session-API.");
        setLoading(false);
        return;
      }

      sessionStorage.setItem(`printai_initial_${data.sessionId}`, trimmed);
      router.push(`/chat?s=${data.sessionId}`);
    } catch {
      setError("Netzwerkfehler – bitte pruefen ob der Dev-Server laeuft.");
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center">
          <h1 className="text-5xl font-black tracking-tight text-white">
            Print<span className="text-violet-400">AI</span>
          </h1>
          <p className="mt-3 text-lg text-zinc-400">Dein Design. In Minuten.</p>
        </div>

        <div className="space-y-3">
          {error && (
            <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleStart();
              }
            }}
            placeholder="Was moechtest du gestalten?"
            rows={3}
            className="resize-none rounded-2xl border-zinc-700 bg-zinc-900 text-base text-zinc-100 placeholder-zinc-500 focus:border-violet-500"
          />
          <Button
            onClick={() => void handleStart()}
            disabled={!input.trim() || loading}
            className="w-full rounded-2xl bg-violet-600 py-6 text-base font-semibold hover:bg-violet-700 disabled:opacity-40"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 animate-spin" />
                Starte...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Jetzt gestalten <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-center text-xs text-zinc-600">Oder probier ein Beispiel:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setInput(ex)}
                className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        <NotesFeed />
      </div>
    </main>
  );
}
