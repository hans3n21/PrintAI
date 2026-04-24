"use client";

import { ChatBubble } from "@/components/chat/ChatBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { QuickReplyButtons } from "@/components/chat/QuickReplyButtons";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/lib/types";
import { ImagePlus, Loader2, Sparkles, SkipForward } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ChangeEvent } from "react";

const QUICK_REPLIES: Record<string, string[]> = {
  group: ["Nur fuer mich", "Fuer eine Gruppe"],
  style: ["Cartoon/witzig", "Modern/clean", "Vintage", "Minimalistisch"],
  yn: ["Ja", "Nein"],
};

function ChatPageInner() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("s") ?? "";
  const router = useRouter();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [skipLoading, setSkipLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const sendMessage = async (text: string, imageBase64?: string | null) => {
    if (!sessionId || loading) return;
    const img = imageBase64 ?? pendingImage;
    if (!text.trim() && !img) return;

    setLoading(true);
    setQuickReplies([]);

    const displayUser =
      text.trim() ||
      (img ? "(Foto als Referenz gesendet)" : "");
    setMessages((prev) => [...prev, { role: "user", content: displayUser }]);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        message: text,
        ...(img ? { imageBase64: img } : {}),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            typeof data.error === "string"
              ? data.error
              : "Etwas ist schiefgelaufen. Bitte erneut versuchen.",
        },
      ]);
      setLoading(false);
      return;
    }

    setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    setPendingImage(null);
    setLoading(false);

    if (data.complete) {
      void Promise.all([
        fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        }),
        fetch("/api/slogans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        }),
      ]);
      setTimeout(() => router.push(`/designs/${sessionId}`), 1500);
    } else {
      const reply = String(data.reply ?? "").toLowerCase();
      if (reply.includes("gruppe") || reply.includes("allein")) setQuickReplies(QUICK_REPLIES.group);
      else if (reply.includes("stil") || reply.includes("cartoon") || reply.includes("vintage")) setQuickReplies(QUICK_REPLIES.style);
      else if (reply.includes("ja") || reply.includes("nein") || reply.includes("namen")) setQuickReplies(QUICK_REPLIES.yn);
    }
  };

  const handleSkipOnboarding = async () => {
    if (!sessionId || loading || skipLoading) return;
    setSkipLoading(true);
    setQuickReplies([]);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, forceComplete: true }),
    });
    const data = await res.json();

    if (!res.ok) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            typeof data.error === "string"
              ? data.error
              : "Konnte nicht ueberspringen. Bitte noch kurz per Text antworten.",
        },
      ]);
      setSkipLoading(false);
      return;
    }

    setMessages((prev) => [
      ...prev,
      { role: "user", content: "(Uebersprungen: weiter zu Designs)" },
      { role: "assistant", content: data.reply },
    ]);
    setSkipLoading(false);

    if (data.complete) {
      void Promise.all([
        fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        }),
        fetch("/api/slogans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        }),
      ]);
      setTimeout(() => router.push(`/designs/${sessionId}`), 1500);
    }
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result;
      if (typeof r === "string") setPendingImage(r);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!sessionId) return;
    const initial = sessionStorage.getItem(`printai_initial_${sessionId}`);
    if (initial) {
      sessionStorage.removeItem(`printai_initial_${sessionId}`);
      setTimeout(() => {
        void sendMessage(initial);
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-4 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFileChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-zinc-700 text-zinc-300"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || skipLoading}
              >
                <ImagePlus className="mr-2 h-4 w-4" />
                Foto
              </Button>
              {pendingImage && (
                <span className="text-xs text-violet-400">Referenzbild gewaehlt</span>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-zinc-400 hover:text-white"
              onClick={() => void handleSkipOnboarding()}
              disabled={loading || skipLoading}
            >
              {skipLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <SkipForward className="mr-2 h-4 w-4" />
              )}
              Zu Designs
            </Button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4 pb-2">
            {messages.length === 0 && (
              <div className="flex h-full items-center justify-center">
                <div className="flex items-center gap-2 text-zinc-600">
                  <Sparkles className="h-4 w-4 animate-pulse" />
                  <span className="text-sm">KI startet...</span>
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <ChatBubble key={i} role={m.role} content={m.content} />
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="flex gap-1 rounded-2xl rounded-tl-sm bg-zinc-800 px-4 py-3">
                  {[1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className="h-2 w-2 animate-bounce rounded-full bg-zinc-500"
                      style={{ animationDelay: `${i * 100}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {quickReplies.length > 0 && !loading && (
              <QuickReplyButtons options={quickReplies} onSelect={(v) => void sendMessage(v)} />
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-zinc-800">
            <ChatInput
              onSend={(text) => void sendMessage(text)}
              disabled={loading || skipLoading}
              hasAttachment={!!pendingImage}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatPageInner />
    </Suspense>
  );
}
