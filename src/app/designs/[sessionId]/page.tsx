"use client";

import ShirtLoadingAnimation from "@/app/Animation-waiting/ShirtLoadingAnimation";
import { DesignGrid } from "@/components/designs/DesignGrid";
import { SloganPicker } from "@/components/designs/SloganPicker";
import { Header } from "@/components/layout/Header";
import { FeedbackWidget } from "@/components/notes/FeedbackWidget";
import { Button } from "@/components/ui/button";
import {
  AppNotice,
  PageShell,
  PageTitle,
  primaryActionClassName,
  secondaryActionClassName,
} from "@/components/ui/appSurface";
import { getDesignPageGenerationState } from "@/lib/designPageGeneration";
import { getDesignVariantCount } from "@/lib/designVariantCount";
import { saveSessionImagesToGallery } from "@/lib/savedGallery";
import { supabase } from "@/lib/supabase";
import type { ChatMessage, ReferenceImageAsset, SloganOption } from "@/lib/types";
import { ArrowRight, Images, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useRef, useState } from "react";

export default function DesignsPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const designCount = getDesignVariantCount();

  const [designs, setDesigns] = useState<string[]>([]);
  const [slogans, setSlogans] = useState<SloganOption[]>([]);
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [referenceImages, setReferenceImages] = useState<ReferenceImageAsset[]>([]);
  const [selectedDesign, setSelectedDesign] = useState<string | null>(null);
  const [selectedSlogan, setSelectedSlogan] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [gallerySaved, setGallerySaved] = useState(false);
  const requestedDesignsRef = useRef(false);
  const requestedSlogansRef = useRef(false);

  const requestDesigns = useCallback(async () => {
    try {
      setGenerationError(null);
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : `Design-Generierung fehlgeschlagen (${response.status})`
        );
      }
    } catch (error) {
      requestedDesignsRef.current = false;
      setLoading(false);
      setRegenerating(false);
      setGenerationError(
        error instanceof Error
          ? error.message
          : "Design-Generierung fehlgeschlagen."
      );
    }
  }, [sessionId]);

  const requestSlogans = useCallback(async () => {
    const response = await fetch("/api/slogans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    if (!response.ok) {
      requestedSlogansRef.current = false;
    }
  }, [sessionId]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("sessions")
        .select("conversation_history, design_urls, slogans, reference_images, status")
        .eq("id", sessionId)
        .single();

      if (!data) return;

      const generationState = getDesignPageGenerationState(data);
      if (generationState.shouldRequestDesigns && !requestedDesignsRef.current) {
        requestedDesignsRef.current = true;
        void requestDesigns();
      }
      if (generationState.shouldRequestSlogans && !requestedSlogansRef.current) {
        requestedSlogansRef.current = true;
        void requestSlogans();
      }

      if (generationState.canShowDesigns) {
        setDesigns(data.design_urls ?? []);
        setSlogans((data.slogans ?? []) as SloganOption[]);
        setConversation((data.conversation_history ?? []) as ChatMessage[]);
        setReferenceImages((data.reference_images ?? []) as ReferenceImageAsset[]);
        saveSessionImagesToGallery({
          sessionId,
          designUrls: data.design_urls ?? [],
          referenceImages: (data.reference_images ?? []) as ReferenceImageAsset[],
        });
        setGallerySaved(true);
        setLoading(false);
        clearInterval(interval);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [requestDesigns, requestSlogans, sessionId]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    setGenerationError(null);
    setGallerySaved(false);
    setDesigns([]);
    setSelectedDesign(null);
    requestedDesignsRef.current = true;
    setLoading(true);
    await requestDesigns();
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

  const handleSaveGallery = () => {
    saveSessionImagesToGallery({
      sessionId,
      designUrls: designs,
      referenceImages,
      selectedDesignUrl: selectedDesign,
    });
    setGallerySaved(true);
  };

  const isWaitingForGeneration = loading || regenerating;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main>
        <PageShell>
        {!isWaitingForGeneration && !generationError && (
          <PageTitle
            eyebrow="Designs"
            title={designCount === 1 ? "Dein Vorschlag" : `Deine ${designCount} Vorschläge`}
            description={designCount === 1 ? "So könnte dein Print aussehen" : "Wähle dein Lieblingsdesign"}
          />
        )}

        {generationError ? (
          <AppNotice tone="error" className="space-y-4">
            <div>
              <p className="font-semibold text-red-100">Generierung fehlgeschlagen</p>
              <p className="mt-1 text-red-200/80">{generationError}</p>
            </div>
            <Button
              type="button"
              onClick={() => void handleRegenerate()}
              disabled={regenerating}
              className={primaryActionClassName()}
            >
              Erneut versuchen
            </Button>
          </AppNotice>
        ) : isWaitingForGeneration ? (
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
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => void handleRegenerate()}
              disabled={regenerating}
              className={secondaryActionClassName("flex-1")}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Neue Vorschläge
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveGallery}
              className={secondaryActionClassName("flex-1")}
            >
              <Images className="mr-2 h-4 w-4" />
              {gallerySaved ? "Bilder gespeichert" : "Alle Bilder speichern"}
            </Button>
            <Button
              onClick={() => void handleContinue()}
              disabled={!selectedDesign}
              className={primaryActionClassName("flex-1")}
            >
              Weiter <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
        </PageShell>
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
