"use client";

import { DesignGrid } from "@/components/designs/DesignGrid";
import { SloganPicker } from "@/components/designs/SloganPicker";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { getDesignVariantCount } from "@/lib/designVariantCount";
import { supabase } from "@/lib/supabase";
import type { SloganOption } from "@/lib/types";
import { ArrowRight, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

export default function DesignsPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const designCount = getDesignVariantCount();

  const [designs, setDesigns] = useState<string[]>([]);
  const [slogans, setSlogans] = useState<SloganOption[]>([]);
  const [selectedDesign, setSelectedDesign] = useState<string | null>(null);
  const [selectedSlogan, setSelectedSlogan] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("sessions")
        .select("design_urls, slogans, status")
        .eq("id", sessionId)
        .single();

      if (data && data.design_urls?.length > 0 && data.slogans?.length > 0) {
        setDesigns(data.design_urls);
        setSlogans(data.slogans as SloganOption[]);
        setLoading(false);
        clearInterval(interval);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [sessionId]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    setDesigns([]);
    setSelectedDesign(null);
    await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    setRegenerating(false);
    setLoading(true);
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

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-xl space-y-6 p-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-white">
            {designCount === 1
              ? "Dein Vorschlag"
              : `Deine ${designCount} Vorschlaege`}
          </h2>
          <p className="text-sm text-zinc-500">
            {designCount === 1
              ? "So koennte dein Print aussehen"
              : "Waehle dein Lieblingsdesign"}
          </p>
        </div>

        <DesignGrid
          urls={designs}
          selectedUrl={selectedDesign}
          onSelect={setSelectedDesign}
          loading={loading || regenerating}
          skeletonCount={designCount}
        />

        {!loading && slogans.length > 0 && (
          <SloganPicker
            slogans={slogans}
            selectedIndex={selectedSlogan}
            onSelect={setSelectedSlogan}
          />
        )}

        {!loading && (
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => void handleRegenerate()}
              disabled={regenerating}
              className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Neue Vorschlaege
            </Button>
            <Button
              onClick={() => void handleContinue()}
              disabled={!selectedDesign}
              className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-40"
            >
              Weiter <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
