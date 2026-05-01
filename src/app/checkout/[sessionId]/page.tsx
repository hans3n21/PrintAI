"use client";

import { ImageGallery } from "@/components/checkout/ImageGallery";
import { Header } from "@/components/layout/Header";
import { FeedbackWidget } from "@/components/notes/FeedbackWidget";
import { Button } from "@/components/ui/button";
import {
  AppNotice,
  AppSurface,
  PageShell,
  PageTitle,
  primaryActionClassName,
  secondaryActionClassName,
} from "@/components/ui/appSurface";
import { saveSessionImagesToGallery } from "@/lib/savedGallery";
import { supabase } from "@/lib/supabase";
import type { ReferenceImageAsset } from "@/lib/types";
import { Images } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { use, useEffect, useState } from "react";

export default function CheckoutPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const searchParams = useSearchParams();
  const stripeStatus = searchParams.get("stripe");
  const [loading, setLoading] = useState(false);
  const [designUrl, setDesignUrl] = useState<string | null>(null);
  const [designUrls, setDesignUrls] = useState<string[]>([]);
  const [referenceImages, setReferenceImages] = useState<ReferenceImageAsset[]>([]);
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [gallerySaved, setGallerySaved] = useState(false);
  const [printFileUrl, setPrintFileUrl] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [mockupCount, setMockupCount] = useState(0);

  useEffect(() => {
    void supabase
      .from("sessions")
      .select("selected_design_url, design_urls, reference_images, config, selected_slogan")
      .eq("id", sessionId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setDesignUrl(data.selected_design_url);
        setDesignUrls((data.design_urls ?? []) as string[]);
        setReferenceImages((data.reference_images ?? []) as ReferenceImageAsset[]);
        const nextConfig = (data.config ?? {}) as Record<string, unknown>;
        setConfig(nextConfig);
        setMockupCount(Array.isArray(nextConfig.mockups) ? nextConfig.mockups.length : 0);
      });
  }, [sessionId]);

  const handleOrder = async () => {
    setLoading(true);
    setOrderError(null);
    try {
      const printFileRes = await fetch("/api/print-file/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const printFileData = (await printFileRes.json()) as {
        url?: string;
        storage_path?: string;
        error?: string;
      };
      if (!printFileRes.ok) {
        throw new Error(printFileData.error ?? "Print-Datei konnte nicht erstellt werden");
      }
      setPrintFileUrl(printFileData.url ?? null);

      const existingMockups = Array.isArray(config.mockups)
        ? (config.mockups as Array<{ variant_id: number; mockup_url: string }>)
        : [];
      if (existingMockups.length > 0) {
        setMockupCount(existingMockups.length);
      } else {
        const mockupRes = await fetch("/api/printful/mockup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const mockupData = (await mockupRes.json()) as {
          mockups?: Array<{ variant_id: number; mockup_url: string }>;
          error?: string;
        };
        if (!mockupRes.ok) {
          throw new Error(mockupData.error ?? "Printful-Mockups konnten nicht erstellt werden");
        }
        setMockupCount(mockupData.mockups?.length ?? 0);
      }

      const res = await fetch("/api/checkout/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Stripe Checkout konnte nicht gestartet werden");
      }
      if (!data.url) throw new Error("Stripe Checkout URL fehlt");
      window.location.href = data.url;
    } catch (error) {
      setOrderError(error instanceof Error ? error.message : "Bestellung fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGallery = () => {
    saveSessionImagesToGallery({
      sessionId,
      designUrls,
      referenceImages,
      selectedDesignUrl: designUrl,
    });
    setGallerySaved(true);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        rightSlot={
          <FeedbackWidget
            triggerVariant="header"
            sessionId={sessionId}
            targetType="page"
            targetRef={`checkout:${sessionId}`}
            designUrlsSnapshot={designUrls}
            clientState={{
              designUrl,
              config,
              gallerySaved,
              loading,
              printFileUrl,
              mockupCount,
            }}
          />
        }
      />
      <main>
      <PageShell>
        <PageTitle
          eyebrow="Checkout"
          title="Zusammenfassung"
          description="Prüfe deine Galerie, Auswahl und Bestelldaten vor dem Demo-Checkout."
        />

        <ImageGallery
          designUrls={designUrls}
          selectedDesignUrl={designUrl}
          referenceImages={referenceImages}
          title="Deine Galerie"
        />

        {designUrl && (
          <AppSurface className="overflow-hidden p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={designUrl} alt="Gewähltes Design" className="h-48 w-full rounded-3xl bg-zinc-950/40 object-contain p-4" />
          </AppSurface>
        )}

        <AppSurface className="space-y-3 text-sm">
          <div className="flex justify-between text-zinc-400">
            <span>Produktfarbe</span>
            <span className="capitalize text-zinc-200">{String(config.product_color ?? "-")}</span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>Druck</span>
            <span className="text-zinc-200">{String(config.print_area ?? "-")}</span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>Menge</span>
            <span className="text-zinc-200">{String(config.quantity ?? 1)} Stück</span>
          </div>
          {printFileUrl && (
            <div className="flex justify-between text-zinc-400">
              <span>Print-Datei</span>
              <a
                href={printFileUrl}
                target="_blank"
                rel="noreferrer"
                className="text-violet-300 hover:text-violet-200"
              >
                öffnen
              </a>
            </div>
          )}
          {mockupCount > 0 && (
            <div className="flex justify-between text-zinc-400">
              <span>Printful-Mockups</span>
              <span className="text-zinc-200">{mockupCount} erstellt</span>
            </div>
          )}
        </AppSurface>

        {stripeStatus === "success" && (
          <AppNotice tone="success">
            Zahlung wurde an Stripe übergeben. Sobald der Webhook bestätigt ist, wird der
            Printful-Draft erstellt.
          </AppNotice>
        )}
        {stripeStatus === "cancel" && (
          <AppNotice tone="warning">
            Zahlung abgebrochen. Du kannst den Checkout jederzeit erneut starten.
          </AppNotice>
        )}
        <AppNotice tone="neutral">
          Sichere Zahlung per Stripe Checkout. Die Printful-Bestellung wird erst nach bestätigter
          Zahlung vorbereitet.
        </AppNotice>
        {orderError && <AppNotice tone="error">{orderError}</AppNotice>}

        <Button
          onClick={() => void handleOrder()}
          disabled={loading}
          className={primaryActionClassName("w-full py-6 text-base font-semibold")}
        >
          {loading ? "Checkout wird vorbereitet..." : "Jetzt sicher bezahlen"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSaveGallery}
          className={secondaryActionClassName("mx-auto flex")}
        >
          <Images className="mr-2 h-4 w-4" />
          {gallerySaved ? "Alle Bilder gespeichert" : "Alle Bilder speichern"}
        </Button>
      </PageShell>
      </main>
    </div>
  );
}
