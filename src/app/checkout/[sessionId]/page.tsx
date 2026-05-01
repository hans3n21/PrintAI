"use client";

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
import { Images, ShoppingBag } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { use, useEffect, useState } from "react";

type CartLine = {
  color: string;
  size: string;
  quantity: number;
};

type ProductSelection = {
  product_color?: string;
  size?: string;
  quantity?: number;
  printful_product_id?: number;
};

function capitalize(str: string) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function parsePrintArea(raw: unknown) {
  if (raw === "front") return "Vorne";
  if (raw === "back") return "Hinten";
  if (raw === "both") return "Vorne + Hinten";
  return typeof raw === "string" ? raw : "Vorne";
}

function parseCartLines(config: Record<string, unknown>, productSelection: ProductSelection | null): CartLine[] {
  const raw = config.cart_lines;
  if (Array.isArray(raw) && raw.length > 0) {
    const lines: CartLine[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const color = typeof o.color === "string" ? o.color : "";
      const size = typeof o.size === "string" ? o.size : "";
      const quantity = typeof o.quantity === "number" ? o.quantity : 1;
      if (color && size) lines.push({ color, size, quantity });
    }
    if (lines.length > 0) return lines;
  }
  // Fallback auf product_selection / config
  return [{
    color: String(productSelection?.product_color ?? config.product_color ?? "black"),
    size: String(productSelection?.size ?? config.size ?? "M"),
    quantity: Number(productSelection?.quantity ?? config.quantity ?? 1),
  }];
}

export default function CheckoutPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const searchParams = useSearchParams();
  const stripeStatus = searchParams.get("stripe");

  const [loading, setLoading] = useState(false);
  const [designUrl, setDesignUrl] = useState<string | null>(null);
  const [designUrls, setDesignUrls] = useState<string[]>([]);
  const [referenceImages, setReferenceImages] = useState<ReferenceImageAsset[]>([]);
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [productSelection, setProductSelection] = useState<ProductSelection | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [gallerySaved, setGallerySaved] = useState(false);

  useEffect(() => {
    void supabase
      .from("sessions")
      .select("selected_design_url, design_urls, reference_images, config, product_selection")
      .eq("id", sessionId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setDesignUrl(data.selected_design_url);
        setDesignUrls((data.design_urls ?? []) as string[]);
        setReferenceImages((data.reference_images ?? []) as ReferenceImageAsset[]);
        setConfig((data.config ?? {}) as Record<string, unknown>);
        setProductSelection((data.product_selection ?? null) as ProductSelection | null);
      });
  }, [sessionId]);

  const cartLines = parseCartLines(config, productSelection);
  const totalQuantity = cartLines.reduce((sum, l) => sum + l.quantity, 0);
  const printArea = parsePrintArea(config.print_area);

  const handleOrder = async () => {
    setLoading(true);
    setOrderError(null);
    try {
      // Print-Datei erst jetzt erzeugen (placement + design → druckfertige Datei)
      const printFileRes = await fetch("/api/print-file/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const printFileData = (await printFileRes.json()) as { url?: string; error?: string };
      if (!printFileRes.ok) {
        throw new Error(printFileData.error ?? "Print-Datei konnte nicht erstellt werden");
      }

      // Stripe Checkout starten
      const stripeRes = await fetch("/api/checkout/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const stripeData = (await stripeRes.json()) as { url?: string; error?: string };
      if (!stripeRes.ok) {
        throw new Error(stripeData.error ?? "Stripe Checkout konnte nicht gestartet werden");
      }
      if (!stripeData.url) throw new Error("Stripe Checkout URL fehlt");
      window.location.href = stripeData.url;
    } catch (error) {
      setOrderError(error instanceof Error ? error.message : "Bestellung fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGallery = () => {
    saveSessionImagesToGallery({ sessionId, designUrls, referenceImages, selectedDesignUrl: designUrl });
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
            clientState={{ designUrl, config, gallerySaved, loading }}
          />
        }
      />
      <main>
        <PageShell>
          <PageTitle
            eyebrow="Checkout"
            title="Fast fertig!"
            description="Prüfe deine Bestellung und schließe den Kauf ab."
          />

          {/* Design-Vorschau */}
          {designUrl && (
            <AppSurface className="overflow-hidden p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={designUrl}
                alt="Dein Design"
                className="mx-auto h-52 w-auto rounded-2xl object-contain"
              />
            </AppSurface>
          )}

          {/* Bestellübersicht */}
          <AppSurface className="space-y-4">
            <p className="text-sm font-medium text-zinc-400">Deine Bestellung</p>

            {cartLines.map((line, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* Farb-Kreis */}
                  <div
                    className="h-5 w-5 flex-shrink-0 rounded-full border border-zinc-600 shadow-sm"
                    style={{ backgroundColor: line.color === "white" ? "#ffffff" : line.color === "black" ? "#1a1a1a" : line.color }}
                  />
                  <div>
                    <p className="text-sm text-zinc-100">
                      {capitalize(line.color)} · {line.size.toUpperCase()}
                    </p>
                    <p className="text-xs text-zinc-500">{line.quantity} Stück</p>
                  </div>
                </div>
              </div>
            ))}

            <div className="border-t border-zinc-800/60 pt-3">
              <div className="flex justify-between text-sm text-zinc-400">
                <span>Druck</span>
                <span className="text-zinc-200">{printArea}</span>
              </div>
              <div className="flex justify-between text-sm text-zinc-400">
                <span>Gesamt</span>
                <span className="text-zinc-200">{totalQuantity} Stück</span>
              </div>
            </div>
          </AppSurface>

          {/* Stripe-Status nach Rückkehr */}
          {stripeStatus === "success" && (
            <AppNotice tone="success">
              Zahlung erfolgreich übergeben. Die Printful-Bestellung wird nach Webhook-Bestätigung angelegt.
            </AppNotice>
          )}
          {stripeStatus === "cancel" && (
            <AppNotice tone="warning">
              Zahlung abgebrochen. Du kannst den Checkout jederzeit neu starten.
            </AppNotice>
          )}

          <AppNotice tone="neutral">
            Sichere Zahlung per Stripe. Die Bestellung bei Printful wird erst nach bestätigter Zahlung aufgegeben.
          </AppNotice>

          {orderError && <AppNotice tone="error">{orderError}</AppNotice>}

          <Button
            onClick={() => void handleOrder()}
            disabled={loading}
            className={primaryActionClassName("w-full py-6 text-base font-semibold")}
          >
            <ShoppingBag className="mr-2 h-5 w-5" />
            {loading ? "Wird vorbereitet…" : "Jetzt sicher bezahlen"}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSaveGallery}
            className={secondaryActionClassName("mx-auto flex")}
          >
            <Images className="mr-2 h-4 w-4" />
            {gallerySaved ? "Alle Bilder gespeichert" : "Alle Bilder in Galerie speichern"}
          </Button>
        </PageShell>
      </main>
    </div>
  );
}
