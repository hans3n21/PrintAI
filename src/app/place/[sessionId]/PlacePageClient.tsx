"use client";

import { Header } from "@/components/layout/Header";
import { FeedbackWidget } from "@/components/notes/FeedbackWidget";
import { PlacementEditor } from "@/components/place/PlacementEditor";
import { AppNotice, PageShell, PageTitle } from "@/components/ui/appSurface";
import { collectDisplayDesignUrls } from "@/lib/designPageGeneration";
import { supabase } from "@/lib/supabase";
import type { ComponentProps } from "react";
import { useEffect, useState } from "react";

type PlacementProduct = ComponentProps<typeof PlacementEditor>["product"];
type PlacementConfig = ComponentProps<typeof PlacementEditor>["initialConfig"];

const BELLA_CANVAS_3001_PRINTFUL_ID = 71;
const FALLBACK_PRODUCT: PlacementProduct = {
  id: "fallback-bella-canvas-3001",
  title: "Bella Canvas 3001 Vorschau",
  variants: [
    { variant_id: 0, color: "Black", color_hex: "#111111" },
    { variant_id: 1, color: "White", color_hex: "#ffffff" },
  ],
  print_area: {
    placement: "front_large",
    area_width: 1800,
    area_height: 2400,
  },
  mockup_templates: [],
};

export function PlacePageClient({ sessionId }: { sessionId: string }) {
  const [designUrl, setDesignUrl] = useState<string | null>(null);
  const [product, setProduct] = useState<PlacementProduct | null>(null);
  const [config, setConfig] = useState<PlacementConfig>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [setupWarning, setSetupWarning] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const [{ data: session, error: sessionError }, { data: productRows, error: productError }] =
            await Promise.all([
              supabase
                .from("sessions")
                .select("selected_design_url, design_urls, design_assets, config")
                .eq("id", sessionId)
                .single(),
              supabase
                .from("printful_products")
                .select("id, title, variants, print_area, mockup_templates")
                .eq("printful_product_id", BELLA_CANVAS_3001_PRINTFUL_ID)
                .eq("is_active", true)
                .limit(1),
            ]);

          if (sessionError) throw new Error(sessionError.message);
          if (productError) throw new Error(productError.message);
          const selectedDesignUrl =
            session?.selected_design_url ?? collectDisplayDesignUrls(session ?? {})[0];
          if (!selectedDesignUrl) {
            throw new Error("Kein ausgewähltes Design für diese Session gefunden.");
          }
          const activeProduct = productRows?.[0] as PlacementProduct | undefined;
          const placementProduct = activeProduct ?? FALLBACK_PRODUCT;

          setDesignUrl(selectedDesignUrl);
          setConfig((session.config ?? {}) as PlacementConfig);
          setProduct(placementProduct);
          setSetupWarning(
            activeProduct
              ? null
              : "Kein aktives Bella Canvas 3001 Produkt gefunden. Du siehst vorerst eine einfache Vorschau; für echte Mockups bitte im Admin-Bereich den Printful-Katalog synchronisieren und das Produkt aktivieren."
          );

          if (!session?.selected_design_url) {
            await supabase
              .from("sessions")
              .update({
                selected_design_url: selectedDesignUrl,
                updated_at: new Date().toISOString(),
              })
              .eq("id", sessionId);
          }
        } catch (loadError) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Placement-Daten konnten nicht geladen werden."
          );
        } finally {
          setLoading(false);
        }
      })();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [sessionId]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        rightSlot={
          <FeedbackWidget
            triggerVariant="header"
            sessionId={sessionId}
            targetType="page"
            targetRef={`place:${sessionId}`}
            designUrlsSnapshot={designUrl ? [designUrl] : []}
            clientState={{
              designUrl,
              productId: product?.id,
              config,
              loading,
            }}
          />
        }
      />
      <main>
        <PageShell>
          <PageTitle
            eyebrow="Platzierung"
            title="Design auf dem Shirt platzieren"
            description="Wähle die Shirtfarbe und positioniere dein Motiv in der Printful-Druckfläche."
          />

          {loading && <p className="text-sm text-zinc-500">Lade Platzierung...</p>}
          {error && <AppNotice tone="error">{error}</AppNotice>}
          {setupWarning && <AppNotice tone="warning">{setupWarning}</AppNotice>}
          {!loading && !error && designUrl && product && (
            <PlacementEditor
              sessionId={sessionId}
              designUrl={designUrl}
              initialConfig={config}
              product={product}
            />
          )}
        </PageShell>
      </main>
    </div>
  );
}
