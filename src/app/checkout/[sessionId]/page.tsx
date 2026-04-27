"use client";

import { ImageGallery } from "@/components/checkout/ImageGallery";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import type { ReferenceImageAsset } from "@/lib/types";
import { CheckCircle, Package } from "lucide-react";
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

  if (ordered) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 flex-col items-center justify-center gap-6 p-4 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20">
            <CheckCircle className="h-10 w-10 text-green-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Bestellung eingegangen!</h2>
            <p className="mt-2 text-zinc-400">Demo-Modus - keine echte Zahlung erfolgt</p>
            <Badge variant="outline" className="mt-3 border-zinc-700 text-zinc-400">
              Bestell-Nr: {orderId}
            </Badge>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-3 text-sm text-zinc-400">
            <Package className="h-4 w-4" />
            Printify würde jetzt produzieren und direkt versenden.
          </div>
          <div className="w-full max-w-xl">
            <ImageGallery
              designUrls={designUrls}
              selectedDesignUrl={designUrl}
              referenceImages={referenceImages}
              title="Eure Galerie"
            />
          </div>
          <Button
            onClick={() => {
              window.location.href = "/";
            }}
            variant="outline"
            className="border-zinc-700 text-zinc-300"
          >
            Neues Design erstellen
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-xl space-y-6 p-4">
        <h2 className="text-xl font-bold text-white">Zusammenfassung</h2>

        {designUrl && (
          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={designUrl} alt="Gewähltes Design" className="h-48 w-full object-contain p-4" />
          </div>
        )}

        <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm">
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
        </div>

        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-400">
          Demo-Modus: Keine echte Zahlung. Stripe & Printify sind noch nicht angebunden.
        </div>

        <Button
          onClick={() => void handleOrder()}
          disabled={loading}
          className="w-full bg-violet-600 py-6 text-base font-semibold hover:bg-violet-700"
        >
          {loading ? "Bestellung wird aufgegeben..." : "Jetzt bestellen (Demo)"}
        </Button>
      </main>
    </div>
  );
}
