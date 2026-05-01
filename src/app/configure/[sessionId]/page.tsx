"use client";

import { ColorPicker } from "@/components/configure/ColorPicker";
import { MockupPreview } from "@/components/configure/MockupPreview";
import { TextEditor } from "@/components/configure/TextEditor";
import { Header } from "@/components/layout/Header";
import { FeedbackWidget } from "@/components/notes/FeedbackWidget";
import { Button } from "@/components/ui/button";
import {
  AppSurface,
  AppNotice,
  FieldGroup,
  PageShell,
  PageTitle,
  primaryActionClassName,
  secondaryActionClassName,
} from "@/components/ui/appSurface";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import {
  findPrintfulVariant,
  getPrintfulColorOptions,
  getPrintfulSizeOptions,
  type PrintfulProductVariant,
} from "@/lib/printful/productVariants";
import type { OnboardingData, ProductSelection, SloganOption } from "@/lib/types";
import { ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useRef, useState } from "react";

type ConfigMockup = {
  variant_id: number;
  mockup_url: string;
  color?: string | null;
};

export default function ConfigurePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();

  const [designUrl, setDesignUrl] = useState<string | null>(null);
  const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(null);
  const [productSelection, setProductSelection] = useState<ProductSelection | null>(null);
  const [quantityOverride, setQuantityOverride] = useState(1);
  const [color, setColor] = useState("black");
  const [printArea, setPrintArea] = useState<"front" | "back" | "both">("front");
  const [customText, setCustomText] = useState("");
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [singleSize, setSingleSize] = useState("M");
  const [existingConfig, setExistingConfig] = useState<Record<string, unknown>>({});
  const [printfulVariants, setPrintfulVariants] = useState<PrintfulProductVariant[]>([]);
  const [mockupStatus, setMockupStatus] = useState<string | null>(null);
  const mockupRequestedRef = useRef(false);

  useEffect(() => {
    void (async () => {
      const [{ data }, { data: product }] = await Promise.all([
        supabase
          .from("sessions")
          .select("selected_design_url, selected_slogan, onboarding_data, product_selection, config")
          .eq("id", sessionId)
          .single(),
        supabase
          .from("printful_products")
          .select("variants")
          .eq("printful_product_id", 71)
          .eq("is_active", true)
          .single(),
      ]);

        if (!data) return;
        setDesignUrl(data.selected_design_url);
        const selectedSlogan = data.selected_slogan as SloganOption | null;
        const selectedProduct = data.product_selection as ProductSelection | null;
        setOnboardingData(data.onboarding_data as OnboardingData | null);
        setProductSelection(selectedProduct);
        setExistingConfig((data.config ?? {}) as Record<string, unknown>);
        setQuantityOverride(selectedProduct?.quantity ?? 1);
        const loadedVariants = ((product?.variants ?? []) as PrintfulProductVariant[]);
        setPrintfulVariants(loadedVariants);
        if (selectedProduct?.color) setColor(selectedProduct.color.toLowerCase());
        else if (selectedProduct?.product_color) setColor(selectedProduct.product_color);
        if (selectedProduct?.size) setSingleSize(selectedProduct.size);
        else if (typeof (data.config as { size?: unknown } | null)?.size === "string") {
          setSingleSize((data.config as { size: string }).size);
        }
        if (selectedSlogan?.main_text) setCustomText(selectedSlogan.main_text);
      })();
  }, [sessionId]);

  const names = Array.isArray(onboardingData?.names) ? onboardingData.names : [];
  const quantity = quantityOverride || onboardingData?.group_size || 1;
  const product = productSelection?.product ?? onboardingData?.product ?? "tshirt";
  const colorOptions = useMemo(
    () => getPrintfulColorOptions(printfulVariants),
    [printfulVariants]
  );
  const shownColorOptions = colorOptions.length > 0 ? colorOptions : undefined;
  const effectiveColor =
    colorOptions.length > 0 && !colorOptions.some((option) => option.id === color)
      ? colorOptions[0].id
      : color;
  const sizeOptions = useMemo(
    () => getPrintfulSizeOptions(printfulVariants, effectiveColor),
    [effectiveColor, printfulVariants]
  );
  const shownSizeOptions = useMemo(
    () => (sizeOptions.length > 0 ? sizeOptions : ["XS", "S", "M", "L", "XL", "XXL"]),
    [sizeOptions]
  );
  const selectedSize = names.length > 0
    ? sizes[names[0]] ?? productSelection?.size ?? shownSizeOptions[0]
    : singleSize && shownSizeOptions.includes(singleSize)
      ? singleSize
      : productSelection?.size ?? shownSizeOptions[0];
  const selectedVariant = findPrintfulVariant(
    printfulVariants,
    selectedSize,
    effectiveColor
  );
  const mockups = Array.isArray(existingConfig.mockups)
    ? (existingConfig.mockups as ConfigMockup[])
    : [];

  useEffect(() => {
    if (mockupRequestedRef.current) return;
    if (!designUrl || !existingConfig.placement || mockups.length > 0 || !selectedVariant) return;
    mockupRequestedRef.current = true;
    void (async () => {
      setMockupStatus("Print-Datei und Mockups werden vorbereitet...");
      const nextConfig = {
        ...existingConfig,
        product_color: effectiveColor,
        size: selectedSize,
      };
      await supabase
        .from("sessions")
        .update({
          config: nextConfig,
          product_selection: {
            product,
            product_color: effectiveColor,
            quantity,
            printful_variant_id: selectedVariant.variant_id,
            size: selectedVariant.size,
            color: selectedVariant.color,
          },
        })
        .eq("id", sessionId);

      const printFileResponse = await fetch("/api/print-file/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!printFileResponse.ok) {
        setMockupStatus("Print-Datei konnte nicht erstellt werden.");
        return;
      }
      const printFile = (await printFileResponse.json()) as {
        url?: string;
        storage_path?: string;
      };

      const mockupResponse = await fetch("/api/printful/mockup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!mockupResponse.ok) {
        setMockupStatus("Printful-Mockups konnten nicht erstellt werden.");
        return;
      }
      const mockupData = (await mockupResponse.json()) as {
        mockups?: ConfigMockup[];
      };
      setExistingConfig((prev) => ({
        ...prev,
        print_file: printFile,
        mockups: mockupData.mockups ?? [],
      }));
      setMockupStatus(null);
    })();
  }, [
    designUrl,
    effectiveColor,
    existingConfig,
    mockups.length,
    product,
    quantity,
    selectedSize,
    selectedVariant,
    sessionId,
  ]);

  const unitPrice = 25;
  const discount = quantity >= 20 ? 0.3 : quantity >= 10 ? 0.2 : quantity >= 5 ? 0.1 : 0;
  const total = (unitPrice * quantity * (1 - discount)).toFixed(2);

  const handleCheckout = async () => {
    const checkoutSize = selectedSize;
    const checkoutVariant = selectedVariant;
    await supabase
      .from("sessions")
      .update({
        config: {
          ...existingConfig,
          product,
          product_color: effectiveColor,
          print_area: printArea,
          text_override: customText,
          sizes,
          size: checkoutSize,
          quantity,
        },
        product_selection: checkoutVariant
          ? {
              product,
              product_color: effectiveColor,
              quantity,
              printful_variant_id: checkoutVariant.variant_id,
              size: checkoutVariant.size,
              color: checkoutVariant.color,
            }
          : {
              product,
              product_color: effectiveColor,
              quantity,
              size: checkoutSize,
              color: effectiveColor,
            },
        status: "checkout",
      })
      .eq("id", sessionId);

    router.push(`/checkout/${sessionId}`);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        rightSlot={
          <FeedbackWidget
            triggerVariant="header"
            sessionId={sessionId}
            targetType="page"
            targetRef={`configure:${sessionId}`}
            clientState={{
              designUrl,
              product,
              color: effectiveColor,
              printArea,
              quantity,
              selectedVariant,
            }}
          />
        }
      />
      <main>
        <PageShell>
        <PageTitle
          eyebrow="Konfiguration"
          title="Dein Design konfigurieren"
          description="Passe Farbe, Druckbereich, Text und Menge für die Bestellung an."
        />

        <MockupPreview
          designUrl={designUrl}
          product={product}
          productColor={effectiveColor}
          printArea={printArea}
          mockups={mockups}
        />

        <AppSurface className="space-y-5">
          <ColorPicker
            selected={effectiveColor}
            onChange={setColor}
            colors={shownColorOptions}
          />
          {mockupStatus && <AppNotice>{mockupStatus}</AppNotice>}

        <FieldGroup label="Druckbereich">
          <div className="flex gap-2">
            {(["front", "back", "both"] as const).map((area) => (
              <Button
                key={area}
                variant={printArea === area ? "default" : "outline"}
                size="sm"
                onClick={() => setPrintArea(area)}
                className={
                  printArea === area
                    ? primaryActionClassName("px-4")
                    : secondaryActionClassName("px-4")
                }
              >
                {area === "front" ? "Vorne" : area === "back" ? "Hinten" : "Vorne + Hinten"}
              </Button>
            ))}
          </div>
        </FieldGroup>

        <TextEditor value={customText} onChange={setCustomText} label="Text auf dem Design" />
        </AppSurface>

        {names.length > 0 && (
          <AppSurface className="space-y-3">
            <p className="text-sm font-medium text-zinc-400">Größen ({names.length} Personen)</p>
            <div className="space-y-2">
              {names.map((name) => (
                <div key={name} className="flex items-center justify-between">
                  <span className="text-sm text-zinc-300">{name}</span>
                  <div className="flex gap-1">
                    {shownSizeOptions.map((s) => (
                      <button
                        key={s}
                        onClick={() => setSizes((prev) => ({ ...prev, [name]: s }))}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs transition-colors",
                          sizes[name] === s
                            ? "bg-violet-600 text-white shadow-sm shadow-violet-950/40"
                            : "border border-zinc-700/70 bg-zinc-900/70 text-zinc-400 hover:bg-zinc-800"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </AppSurface>
        )}

        {names.length === 0 && (
          <AppSurface className="space-y-3">
            <p className="text-sm font-medium text-zinc-400">Größe</p>
            <div className="flex flex-wrap gap-2">
              {shownSizeOptions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSingleSize(s)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs transition-colors",
                    selectedSize === s
                      ? "bg-violet-600 text-white shadow-sm shadow-violet-950/40"
                      : "border border-zinc-700/70 bg-zinc-900/70 text-zinc-400 hover:bg-zinc-800"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            {selectedVariant && (
              <p className="text-xs text-zinc-500">
                Printful Variant-ID {selectedVariant.variant_id}
              </p>
            )}
          </AppSurface>
        )}

        <Separator className="border-zinc-800/70" />

        <AppSurface className="space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-400">Menge</span>
          <input
            type="number"
            min={1}
            max={999}
            value={quantityOverride}
            onChange={(e) => setQuantityOverride(Math.max(1, Number.parseInt(e.target.value || "1", 10)))}
            className="w-28 rounded-full border border-zinc-700/80 bg-zinc-950/60 px-4 py-2 text-sm text-zinc-100 outline-none transition focus:border-violet-500"
          />
        </label>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-400">
              {quantity} x {unitPrice} EUR
              {discount > 0 && (
                <span className="ml-1 text-green-400">({discount * 100}% Rabatt)</span>
              )}
            </p>
            <p className="text-xl font-bold text-white">{total} EUR</p>
          </div>
          <Button onClick={() => void handleCheckout()} className={primaryActionClassName("px-6")}>
            <ShoppingCart className="mr-2 h-4 w-4" /> In den Warenkorb
          </Button>
        </div>
        </AppSurface>
        </PageShell>
      </main>
    </div>
  );
}
