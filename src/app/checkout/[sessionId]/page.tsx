"use client";

import { ImageGallery } from "@/components/checkout/ImageGallery";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/badge";
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
import { CheckCircle, Images, Package } from "lucide-react";
import { use, useEffect, useState } from "react";

export default function CheckoutPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const [ordered, setOrdered] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [designUrl, setDesignUrl] = useState<string | null>(null);
  const [designUrls, setDesignUrls] = useState<string[]>([]);
  const [referenceImages, setReferenceImages] = useState<ReferenceImageAsset[]>([]);
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [gallerySaved, setGallerySaved] = useState(false);

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
        setConfig((data.config ?? {}) as Record<string, unknown>);
      });
  }, [sessionId]);

  const handleOrder = async () => {
    setLoading(true);
    const res = await fetch("/api/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    const data = await res.json();
    setOrderId(data.order_id);
    setOrdered(true);
    setLoading(false);
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

  if (ordered) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 flex-col items-center justify-center p-4 text-center">
          <AppSurface className="flex w-full max-w-xl flex-col items-center gap-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-green-500/30 bg-green-500/15 shadow-lg shadow-green-950/20">
            <CheckCircle className="h-10 w-10 text-green-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Bestellung eingegangen!</h2>
            <p className="mt-2 text-zinc-400">Demo-Modus - keine echte Zahlung erfolgt</p>
            <Badge variant="outline" className="mt-3 rounded-full border-zinc-700/80 bg-zinc-900/70 text-zinc-400">
              Bestell-Nr: {orderId}
            </Badge>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-zinc-700/70 bg-zinc-950/40 px-4 py-3 text-sm text-zinc-400">
            <Package className="h-4 w-4" />
            Printify würde jetzt produzieren und direkt versenden.
          </div>
          <Button
            onClick={() => {
              window.location.href = "/";
            }}
            variant="outline"
            className={secondaryActionClassName()}
          >
            Neues Design erstellen
          </Button>
          </AppSurface>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
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
        </AppSurface>

        <AppNotice tone="warning">
          Demo-Modus: Keine echte Zahlung. Stripe & Printify sind noch nicht angebunden.
        </AppNotice>

        <Button
          onClick={() => void handleOrder()}
          disabled={loading}
          className={primaryActionClassName("w-full py-6 text-base font-semibold")}
        >
          {loading ? "Bestellung wird aufgegeben..." : "Jetzt bestellen (Demo)"}
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
