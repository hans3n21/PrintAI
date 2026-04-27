"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PromptComposer } from "@/components/chat/PromptComposer";
import { FeedbackWidget } from "@/components/notes/FeedbackWidget";
import type { ProductColor, ProductSelection } from "@/lib/types";

export default function LandingPage() {
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [productSelection, setProductSelection] = useState<ProductSelection>({
    product: "tshirt",
    product_color: "black",
    quantity: 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleStart = async (message: string) => {
    const trimmed = message.trim();
    if ((!trimmed && !pendingImage) || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initial_message: trimmed || "Bitte nutze mein Foto als Referenz für das Design.",
          product_selection: productSelection,
        }),
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

      sessionStorage.setItem(
        `printai_initial_${data.sessionId}`,
        trimmed || "Bitte nutze mein Foto als Referenz für das Design."
      );
      if (pendingImage) {
        sessionStorage.setItem(`printai_initial_image_${data.sessionId}`, pendingImage);
      }
      router.push(`/chat?s=${data.sessionId}`);
    } catch {
      setError("Netzwerkfehler – bitte prüfen, ob der Dev-Server läuft.");
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
          <PromptComposer
            placeholder="Was möchtest du gestalten?"
            onSend={(message) => void handleStart(message)}
            disabled={loading}
            loading={loading}
            variant="landing"
            selectedColor={productSelection.product_color}
            onColorChange={(color: ProductColor) =>
              setProductSelection((prev) => ({ ...prev, product_color: color }))
            }
            attachmentPreview={pendingImage}
            onAttachmentChange={setPendingImage}
          />
        </div>
      </div>
      <FeedbackWidget />
    </main>
  );
}
