"use client";

// DEPRECATED: Der Place-Schritt wurde in /configure/ integriert.
// Diese Route bleibt für bestehende Sessions mit status="placing" erreichbar,
// wird aber im neuen Flow nicht mehr angesteuert.

import { Header } from "@/components/layout/Header";
import { FeedbackWidget } from "@/components/notes/FeedbackWidget";
import {
  FALLBACK_PLACEMENT_PRODUCT,
  PlacementEditor,
} from "@/components/place/PlacementEditor";
import { AppNotice, PageShell, PageTitle } from "@/components/ui/appSurface";
import { collectDisplayDesignUrls } from "@/lib/designPageGeneration";
import { withPinnedShopPrintfulProductId } from "@/lib/productSelection";
import { supabase } from "@/lib/supabase";
import type { ProductSelection } from "@/lib/types";
import type { ComponentProps } from "react";
import { useEffect, useState } from "react";

type PlacementProduct = ComponentProps<typeof PlacementEditor>["product"];
type PlacementConfig = ComponentProps<typeof PlacementEditor>["initialConfig"];

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
          const { data: session, error: sessionError } = await supabase
            .from("sessions")
            .select("selected_design_url, design_urls, design_assets, config, product_selection")
            .eq("id", sessionId)
            .single();

          if (sessionError) throw new Error(sessionError.message);
          const productSelection = session?.product_selection as ProductSelection | null;
          const selectedPrintfulProductId = productSelection?.printful_product_id;
          let productQuery = supabase
            .from("printful_products")
            .select("id, printful_product_id, title, variants, product_images, print_area, mockup_templates")
            .eq("is_active", true);
          if (Number.isInteger(selectedPrintfulProductId) && selectedPrintfulProductId > 0) {
            productQuery = productQuery.eq("printful_product_id", selectedPrintfulProductId);
          } else {
            productQuery = productQuery
              .order("is_primary", { ascending: false })
              .order("sort_order", { ascending: true, nullsFirst: false });
          }
          const { data: productRows, error: productError } = await productQuery.limit(1);
          if (productError) throw new Error(productError.message);
          const selectedDesignUrl =
            session?.selected_design_url ?? collectDisplayDesignUrls(session ?? {})[0];
          if (!selectedDesignUrl) {
            throw new Error("Kein ausgewähltes Design für diese Session gefunden.");
          }
          const activeProduct = productRows?.[0] as PlacementProduct | undefined;
          const placementProduct = activeProduct ?? FALLBACK_PLACEMENT_PRODUCT;

          const rowPid = (productRows?.[0] as { printful_product_id?: number } | undefined)
            ?.printful_product_id;
          const resolvedRowPid =
            typeof rowPid === "number" && Number.isFinite(rowPid) && rowPid > 0 ? rowPid : 0;

          const hasPinnedPrintfulProductId =
            typeof productSelection?.printful_product_id === "number" &&
            Number.isInteger(productSelection.printful_product_id) &&
            productSelection.printful_product_id > 0;

          if (resolvedRowPid > 0 && !hasPinnedPrintfulProductId) {
            const nextSelection = withPinnedShopPrintfulProductId(productSelection, resolvedRowPid);
            await supabase
              .from("sessions")
              .update({
                product_selection: nextSelection,
                updated_at: new Date().toISOString(),
              })
              .eq("id", sessionId);
          }

          setDesignUrl(selectedDesignUrl);
          setConfig((session.config ?? {}) as PlacementConfig);
          setProduct(placementProduct);
          setSetupWarning(
            activeProduct
              ? null
              : "Kein aktives Printful-Produkt gefunden. Du siehst vorerst eine einfache Vorschau; bitte im Admin-Bereich ein Produkt integrieren und aktivieren."
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
