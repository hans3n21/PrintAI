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
import {
  collectDisplayDesignUrls,
  getDesignPageGenerationState,
  resolvePrintDesignUrl,
} from "@/lib/designPageGeneration";
import { getDesignVariantCount } from "@/lib/designVariantCount";
import { saveSessionImagesToGallery, readSavedGallery, writeSavedGallery } from "@/lib/savedGallery";
import { supabase } from "@/lib/supabase";
import type { ChatMessage, DesignAsset, ReferenceImageAsset, SloganOption } from "@/lib/types";
import { ArrowRight, Images, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useRef, useState } from "react";

export default function DesignsPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const designCount = getDesignVariantCount();

  const [designs, setDesigns] = useState<string[]>([]);
  const [designAssets, setDesignAssets] = useState<DesignAsset[]>([]);
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
  const sessionTitleRequestedRef = useRef(false);

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
        .select("conversation_history, design_urls, design_assets, slogans, reference_images, status")
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
        const displayDesigns = collectDisplayDesignUrls(data);
        setDesigns(displayDesigns);
        setDesignAssets((data.design_assets ?? []) as DesignAsset[]);
        setSelectedDesign((current) =>
          current && displayDesigns.includes(current) ? current : displayDesigns[0] ?? null
        );
        setSlogans((data.slogans ?? []) as SloganOption[]);
        setConversation((data.conversation_history ?? []) as ChatMessage[]);
        setReferenceImages((data.reference_images ?? []) as ReferenceImageAsset[]);
        saveSessionImagesToGallery({
          sessionId,
          designUrls: displayDesigns,
          referenceImages: (data.reference_images ?? []) as ReferenceImageAsset[],
        });
        setGallerySaved(true);
        setLoading(false);
        if (!sessionTitleRequestedRef.current) {
          sessionTitleRequestedRef.current = true;
          void fetch("/api/session-title", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          })
            .then((res) => res.json())
            .then((payload: { title?: string }) => {
              if (typeof payload.title === "string" && payload.title.trim()) {
                const gallery = readSavedGallery();
                const title = payload.title.trim();
                const updated = gallery.map((item) =>
                  item.sessionId === sessionId ? { ...item, sessionTitle: title } : item
                );
                writeSavedGallery(updated);
              }
            })
            .catch(() => {});
        }
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
    setDesignAssets([]);
    setSelectedDesign(null);
    requestedDesignsRef.current = true;
    sessionTitleRequestedRef.current = false;
    setLoading(true);
    await supabase
      .from("sessions")
      .update({
        design_urls: [],
        design_assets: [],
        status: "generating",
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
    await requestDesigns();
  };

  const handleContinue = async () => {
    if (!selectedDesign) return;
    await supabase
      .from("sessions")
      .update({
        selected_design_url:
          resolvePrintDesignUrl({ design_assets: designAssets }, selectedDesign) ?? selectedDesign,
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
  const shownDesignCount = designs.length || designCount;

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        rightSlot={
          <FeedbackWidget
            triggerVariant="header"
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
        }
      />
      <main>
        <PageShell>
        {!isWaitingForGeneration && !generationError && (
          <PageTitle
            eyebrow="Designs"
            title={
              shownDesignCount === 1
                ? "Dein Vorschlag"
                : `Deine ${shownDesignCount} Vorschläge`
            }
            description={
              shownDesignCount === 1
                ? "So könnte dein Print aussehen"
                : "Wähle dein Lieblingsdesign"
            }
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
          <ShirtLoadingAnimation variantCount={designCount} />
        ) : (
          <DesignGrid
            urls={designs}
            selectedUrl={selectedDesign}
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
    </div>
  );
}
