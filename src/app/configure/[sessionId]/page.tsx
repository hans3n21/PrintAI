"use client";

import { ColorPicker } from "@/components/configure/ColorPicker";
import { MockupPreview } from "@/components/configure/MockupPreview";
import { TextEditor } from "@/components/configure/TextEditor";
import { Header } from "@/components/layout/Header";
import { FeedbackWidget } from "@/components/notes/FeedbackWidget";
import { Button } from "@/components/ui/button";
import {
  AppSurface,
  FieldGroup,
  PageShell,
  PageTitle,
  primaryActionClassName,
  secondaryActionClassName,
} from "@/components/ui/appSurface";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import type { OnboardingData, ProductSelection, SloganOption } from "@/lib/types";
import { ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL"];

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

  useEffect(() => {
    void supabase
      .from("sessions")
      .select("selected_design_url, selected_slogan, onboarding_data, product_selection")
      .eq("id", sessionId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setDesignUrl(data.selected_design_url);
        const selectedSlogan = data.selected_slogan as SloganOption | null;
        const selectedProduct = data.product_selection as ProductSelection | null;
        setOnboardingData(data.onboarding_data as OnboardingData | null);
        setProductSelection(selectedProduct);
        setQuantityOverride(selectedProduct?.quantity ?? 1);
        if (selectedProduct?.product_color) setColor(selectedProduct.product_color);
        if (selectedSlogan?.main_text) setCustomText(selectedSlogan.main_text);
      });
  }, [sessionId]);

  const names = Array.isArray(onboardingData?.names) ? onboardingData.names : [];
  const quantity = quantityOverride || onboardingData?.group_size || 1;
  const product = productSelection?.product ?? onboardingData?.product ?? "tshirt";

  const unitPrice = 25;
  const discount = quantity >= 20 ? 0.3 : quantity >= 10 ? 0.2 : quantity >= 5 ? 0.1 : 0;
  const total = (unitPrice * quantity * (1 - discount)).toFixed(2);

  const handleCheckout = async () => {
    await supabase
      .from("sessions")
      .update({
        config: {
          product,
          product_color: color,
          print_area: printArea,
          text_override: customText,
          sizes,
          quantity,
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
              color,
              printArea,
              quantity,
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
          productColor={color}
          printArea={printArea}
        />

        <AppSurface className="space-y-5">
          <ColorPicker selected={color} onChange={setColor} />

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
                    {SIZE_OPTIONS.map((s) => (
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
