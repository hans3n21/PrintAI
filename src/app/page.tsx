"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PromptComposer } from "@/components/chat/PromptComposer";
import { SavedGalleryButton } from "@/components/gallery/SavedGalleryButton";
import { FeedbackWidget } from "@/components/notes/FeedbackWidget";
import { AppNotice } from "@/components/ui/appSurface";
import type { ProductColor, ProductSelection } from "@/lib/types";

export default function LandingPage() {
  const [pendingImages, setPendingImages] = useState<string[]>([]);
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
    if ((!trimmed && pendingImages.length === 0) || loading) return;
    const initialMessage =
      trimmed || "Bitte nutze meine Fotos als Referenz für das Design.";
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initial_message: initialMessage,
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

      if (pendingImages.length > 0) {
        const chatRes = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: data.sessionId,
            message: initialMessage,
            imageBase64List: pendingImages,
          }),
        });
        const chatData = (await chatRes.json()) as {
          complete?: boolean;
          error?: string;
        };

        if (!chatRes.ok) {
          setError(
            typeof chatData.error === "string"
              ? chatData.error
              : `Chat konnte nicht gestartet werden (${chatRes.status}).`
          );
          setLoading(false);
          return;
        }

        setPendingImages([]);
        router.push(
          chatData.complete ? `/designs/${data.sessionId}` : `/chat?s=${data.sessionId}`
        );
        return;
      }

      sessionStorage.setItem(
        `printai_initial_${data.sessionId}`,
        initialMessage
      );
      router.push(`/chat?s=${data.sessionId}`);
    } catch {
      setError(
        pendingImages.length > 0
          ? "Bild-Upload konnte nicht abgeschlossen werden. Bitte versuche es erneut oder nutze zuerst ein einzelnes Foto."
          : "Netzwerkfehler – bitte Internetverbindung prüfen und erneut versuchen."
      );
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl space-y-8">
        <div className="text-center">
          <h1 className="text-5xl font-black tracking-tight text-white sm:text-6xl">
            Print<span className="text-violet-400">AI</span>
          </h1>
          <p className="mt-3 text-lg text-zinc-400">Dein Design. In Minuten.</p>
        </div>

        <div className="space-y-3">
          {error && (
            <AppNotice tone="error">
              {error}
            </AppNotice>
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
            attachmentPreviews={pendingImages}
            onAttachmentsChange={setPendingImages}
          />
        </div>
      </div>
      <SavedGalleryButton />
      <FeedbackWidget />
    </main>
  );
}
