"use client";

import ShirtLoadingAnimation from "@/app/Animation-waiting/ShirtLoadingAnimation";
import { DesignGrid } from "@/components/designs/DesignGrid";
import { SloganPicker } from "@/components/designs/SloganPicker";
import { Header } from "@/components/layout/Header";
import { FeedbackWidget } from "@/components/notes/FeedbackWidget";
import { Button } from "@/components/ui/button";
import { getDesignPageGenerationState } from "@/lib/designPageGeneration";
import { getDesignVariantCount } from "@/lib/designVariantCount";
import { supabase } from "@/lib/supabase";
import type { ChatMessage, SloganOption } from "@/lib/types";
import { ArrowRight, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";

export default function DesignsPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const designCount = getDesignVariantCount();

  const [designs, setDesigns] = useState<string[]>([]);
  const [slogans, setSlogans] = useState<SloganOption[]>([]);
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [selectedDesign, setSelectedDesign] = useState<string | null>(null);
  const [selectedSlogan, setSelectedSlogan] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const requestedDesignsRef = useRef(false);
  const requestedSlogansRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("sessions")
        .select("conversation_history, design_urls, slogans, status")
        .eq("id", sessionId)
        .single();

      if (!data) return;

      const generationState = getDesignPageGenerationState(data);
      if (generationState.shouldRequestDesigns && !requestedDesignsRef.current) {
        requestedDesignsRef.current = true;
        void fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
      }
      if (generationState.shouldRequestSlogans && !requestedSlogansRef.current) {
        requestedSlogansRef.current = true;
        void fetch("/api/slogans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
      }

      if (generationState.canShowDesigns) {
        setDesigns(data.design_urls ?? []);
        setSlogans((data.slogans ?? []) as SloganOption[]);
        setConversation((data.conversation_history ?? []) as ChatMessage[]);
        setLoading(false);
        clearInterval(interval);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [sessionId]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    setDesigns([]);
    setSelectedDesign(null);
    requestedDesignsRef.current = true;
    await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    setRegenerating(false);
    setLoading(true);
  };

  const handleContinue = async () => {
    if (!selectedDesign) return;
    await supabase
      .from("sessions")
      .update({
        selected_design_url: selectedDesign,
        selected_slogan: selectedSlogan !== null ? slogans[selectedSlogan] : null,
        status: "configuring",
      })
      .eq("id", sessionId);

    router.push(`/configure/${sessionId}`);
  };

  const isWaitingForGeneration = loading || regenerating;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-xl space-y-6 p-4">
        {!isWaitingForGeneration && (
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white">
              {designCount === 1
                ? "Dein Vorschlag"
                : `Deine ${designCount} Vorschläge`}
            </h2>
            <p className="text-sm text-zinc-500">
              {designCount === 1
                ? "So könnte dein Print aussehen"
                : "Wähle dein Lieblingsdesign"}
            </p>
          </div>
        )}

        {isWaitingForGeneration ? (
          <ShirtLoadingAnimation />
        ) : (
          <DesignGrid
            urls={designs}
            selectedUrl={selectedDesign}
            onSelect={setSelectedDesign}
            skeletonCount={designCount}
          />
        )}

        {!loading && slogans.length > 0 && (
          <SloganPicker
            slogans={slogans}
            selectedIndex={selectedSlogan}
            onSelect={setSelectedSlogan}
          />
        )}

        {!loading && (
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => void handleRegenerate()}
              disabled={regenerating}
              className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Neue Vorschläge
            </Button>
            <Button
              onClick={() => void handleContinue()}
              disabled={!selectedDesign}
              className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-40"
            >
              Weiter <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </main>
      <FeedbackWidget
        sessionId={sessionId}
        targetType={selectedDesign ? "design" : "generation"}
        targetRef={selectedDesign ?? sessionId}
        conversationSnapshot={conversation}
        designUrlsSnapshot={designs}
        clientState={{
          selectedDesignUrl: selectedDesign,
          selectedSlogan: selectedSlogan !== null ? slogans[selectedSlogan] : null,
          loading: loading || regenerating,
        }}
      />
    </div>
  );
}
