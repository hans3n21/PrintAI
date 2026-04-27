"use client";

import { ChatBubble } from "@/components/chat/ChatBubble";
import { PromptComposer } from "@/components/chat/PromptComposer";
import { QuickReplyButtons } from "@/components/chat/QuickReplyButtons";
import { Header } from "@/components/layout/Header";
import { FeedbackWidget } from "@/components/notes/FeedbackWidget";
import { Button } from "@/components/ui/button";
import { getQuickRepliesForAssistantReply } from "@/lib/chatQuickReplies";
import { supabase } from "@/lib/supabase";
import type { ChatMessage, ProductColor, ProductSelection } from "@/lib/types";
import { Loader2, Sparkles, SkipForward } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

function ChatPageInner() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("s") ?? "";
  const router = useRouter();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [skipLoading, setSkipLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [productSelection, setProductSelection] = useState<ProductSelection | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  let lastAssistant: { index: number; content: string } | null = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") {
      lastAssistant = { index: i, content: messages[i].content };
      break;
    }
  }

  const sendMessage = async (
    text: string,
    imageBase64?: string | null,
    options?: { isVoice?: boolean }
  ) => {
    if (!sessionId || loading) return;
    const img = imageBase64 ?? pendingImage;
    if (!text.trim() && !img) return;

    setLoading(true);
    setQuickReplies([]);

    const displayUser =
      options?.isVoice
        ? `[voice]${text.trim()}`
        : text.trim() ||
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
      setQuickReplies(getQuickRepliesForAssistantReply(String(data.reply ?? "")));
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
              : "Konnte nicht überspringen. Bitte noch kurz per Text antworten.",
        },
      ]);
      setSkipLoading(false);
      return;
    }

    setMessages((prev) => [
      ...prev,
      { role: "user", content: "(Übersprungen: weiter zu Designs)" },
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

  const handleColorChange = (color: ProductColor) => {
    setProductSelection((prev) => {
      const next: ProductSelection = {
        product: prev?.product ?? "tshirt",
        product_color: color,
        quantity: prev?.quantity ?? 1,
      };
      if (sessionId) {
        void supabase
          .from("sessions")
          .update({
            product_selection: next,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sessionId);
      }
      return next;
    });
  };

  const selectedColor = productSelection?.product_color ?? "black";

  useEffect(() => {
    if (!sessionId) return;
    const initial = sessionStorage.getItem(`printai_initial_${sessionId}`);
    const initialImage = sessionStorage.getItem(`printai_initial_image_${sessionId}`);
    if (initial) {
      sessionStorage.removeItem(`printai_initial_${sessionId}`);
      sessionStorage.removeItem(`printai_initial_image_${sessionId}`);
      setTimeout(() => {
        void sendMessage(initial, initialImage);
      }, 0);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("sessions")
        .select("conversation_history, product_selection")
        .eq("id", sessionId)
        .single();
      if (!cancelled && data?.conversation_history) {
        setMessages(data.conversation_history as ChatMessage[]);
      }
      if (!cancelled && data?.product_selection) {
        setProductSelection(data.product_selection as ProductSelection);
      }
    })();
    return () => {
      cancelled = true;
    };
    // sendMessage is intentionally excluded so the initial sessionStorage handoff
    // runs once for a new session instead of re-sending while state changes.
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
          <div className="flex justify-end border-b border-zinc-800 px-4 py-2">
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
            <div className="p-4">
              <PromptComposer
                onSend={(text, options) => void sendMessage(text, undefined, options)}
                disabled={loading || skipLoading}
                loading={loading}
                variant="chat"
                placeholder="Antwort eingeben..."
                selectedColor={selectedColor}
                onColorChange={handleColorChange}
                attachmentPreview={pendingImage}
                onAttachmentChange={setPendingImage}
              />
            </div>
          </div>
        </div>
      </div>
      <FeedbackWidget
        sessionId={sessionId}
        targetType="chat_session"
        targetRef={lastAssistant ? `assistant:${lastAssistant.index}` : undefined}
        assistantOutput={lastAssistant?.content}
        conversationSnapshot={messages}
        clientState={{
          pendingImage: Boolean(pendingImage),
          loading,
          skipLoading,
        }}
      />
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
