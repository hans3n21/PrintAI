"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!password || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Login fehlgeschlagen");
      }
      router.replace("/admin");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <h1 className="text-xl font-bold text-white">Admin Login</h1>
      <p className="mt-1 text-sm text-zinc-500">Interner Bereich für Feedback und Prompts.</p>
      <div className="mt-5 space-y-3">
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          placeholder="Passwort"
          className="border-zinc-700 bg-zinc-950 text-zinc-100"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button
          type="button"
          onClick={() => void submit()}
          disabled={!password || loading}
          className="w-full bg-violet-600 hover:bg-violet-700"
        >
          {loading ? "Prüfe..." : "Einloggen"}
        </Button>
      </div>
    </div>
  );
}
