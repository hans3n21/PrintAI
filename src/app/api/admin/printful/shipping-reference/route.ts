import { ADMIN_COOKIE_NAME, isAdminCookieValid } from "@/lib/adminAuth";
import { PrintfulApiError, postJson } from "@/lib/printful/client";
import { supabaseAdmin } from "@/lib/supabase";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/** Admin-Vergleich: nur DACH, gemäß Fokus im Shop (Shop-Tabellen können weitere Länder enthalten). */
const DACH_COUNTRIES = ["DE", "AT", "CH"] as const;

type PrintfulRateRow = {
  rate?: string;
  currency?: string;
  shipping_method_name?: string;
};

type PrintfulShippingApi = {
  data?: PrintfulRateRow[];
};

async function requireAdmin() {
  const cookieStore = await cookies();
  if (isAdminCookieValid(cookieStore.get(ADMIN_COOKIE_NAME)?.value)) {
    return null;
  }
  return NextResponse.json({ error: "Admin login required" }, { status: 401 });
}

function eurosToCents(value: string) {
  const n = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function uniquePlacements(primary: string | null | undefined): string[] {
  const hinted =
    typeof primary === "string" && primary.trim()
      ? primary.trim().toLowerCase() === "front"
        ? ["front_large"]
        : [primary.trim()]
      : [];

  const chain = [...hinted, "front_large", "front"];
  return [...new Set(chain)];
}

function summarizePrintfulErrorBody(body: unknown): string {
  if (typeof body === "object" && body !== null) {
    const o = body as Record<string, unknown>;
    if (typeof o.message === "string" && o.message.trim()) return o.message.trim();
    if (typeof o.msg === "string" && o.msg.trim()) return o.msg.trim();

    const result = (o.result ?? o.detail) as unknown;
    if (typeof result === "string" && result.trim()) return result.trim();
    if (typeof result === "object" && result !== null) {
      const r = result as Record<string, unknown>;
      const arr = r.errors ?? r.reasons ?? r.reason;
      if (Array.isArray(arr)) {
        const parts = arr
          .map((item) => {
            if (typeof item === "string") return item;
            if (item && typeof item === "object" && "msg" in item) {
              return String((item as { msg?: unknown }).msg ?? "");
            }
            return "";
          })
          .filter(Boolean);
        if (parts.length) return parts.slice(0, 4).join("; ");
      }
    }

    if (Array.isArray(o.errors)) {
      const texts = o.errors.map((item) =>
        typeof item === "object" && item !== null && "message" in item
          ? String((item as { message?: unknown }).message ?? "")
          : String(item)
      );
      if (texts.some(Boolean)) return texts.filter(Boolean).slice(0, 4).join("; ");
    }
  }
  if (typeof body === "string" && body.trim()) return body.trim().slice(0, 400);
  try {
    return JSON.stringify(body).slice(0, 400);
  } catch {
    return "Printful-Antwort unlesbar";
  }
}

function cheapestFromRatesResponse(response: PrintfulShippingApi): {
  cents: number;
  label: string;
  currency: string;
} | null {
  const rows = response.data ?? [];
  let bestCents = Number.POSITIVE_INFINITY;
  let bestLabel = "";
  let currency = "EUR";

  for (const row of rows) {
    if (!row.rate) continue;
    if ((row.currency ?? "EUR").toUpperCase() !== "EUR") continue;
    const cents = eurosToCents(String(row.rate));
    if (cents == null) continue;
    if (cents < bestCents) {
      bestCents = cents;
      bestLabel =
        typeof row.shipping_method_name === "string" ? row.shipping_method_name.trim() : "Standard";
      currency = "EUR";
    }
  }

  return Number.isFinite(bestCents) ? { cents: Math.round(bestCents), label: bestLabel, currency } : null;
}

/** Printful `/v2/shipping-rates` — mehrere Platzierungen nacheinander (API erwartet u. a. oft `front_large` statt `front`). */
async function cheapestPrintfulShippingForCountry(
  catalogVariantId: number,
  countryCode: string,
  techniqueKey: string,
  printPlacementHint: string | null | undefined
): Promise<{ cents: number; label: string; currency: string } | { error: string }> {
  const placements = uniquePlacements(printPlacementHint);
  const technique = techniqueKey.trim().toLowerCase() || "dtg";
  let lastProblem = "";

  for (const placement of placements) {
    const body = {
      recipient: { country_code: countryCode.trim().toUpperCase() },
      currency: "EUR",
      order_items: [
        {
          source: "catalog",
          quantity: 1,
          catalog_variant_id: catalogVariantId,
          placements: [
            {
              placement,
              technique,
              print_area_type: "simple",
            },
          ],
        },
      ],
    };

    try {
      const response = await postJson<PrintfulShippingApi>(`/v2/shipping-rates`, body);
      const picked = cheapestFromRatesResponse(response);
      if (picked) return picked;
      lastProblem = "Keine EUR-Standardrate in Antwort.";
    } catch (error) {
      if (error instanceof PrintfulApiError) {
        lastProblem = summarizePrintfulErrorBody(error.body);
        continue;
      }
      lastProblem = error instanceof Error ? error.message : String(error);
    }
  }

  return { error: lastProblem ? `Nach ${placements.join(", ")}: ${lastProblem}` : "Keine gültige Rate von Printful" };
}

/** Live-Schätzung Printful für DACH (Vergleich zu euren DB‑Tarifen). */
export async function GET(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const url = new URL(request.url);
  const variantOverride = Number(url.searchParams.get("catalog_variant_id"));
  const variantIdHint = Number.isInteger(variantOverride) ? variantOverride : null;

  const { data: product } = await supabaseAdmin
    .from("printful_products")
    .select("variants, technique, print_area")
    .eq("is_active", true)
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  let catalogVariantId: number | null = variantIdHint;
  const technique =
    typeof (product as { technique?: unknown } | null)?.technique === "string"
      ? String((product as { technique: string }).technique)
      : "dtg";

  const printPlacement =
    (product as { print_area?: { placement?: string | null } | null } | null)?.print_area?.placement ??
    undefined;

  if (catalogVariantId == null || catalogVariantId <= 0) {
    const variants = ((product as { variants?: { variant_id?: unknown }[] } | null)?.variants ??
      []) as { variant_id?: unknown }[];
    const first =
      variants.find((v) => typeof v.variant_id === "number" && Number(v.variant_id) > 0) ?? null;
    const idRaw = first?.variant_id;
    catalogVariantId = typeof idRaw === "number" && Number.isInteger(idRaw) ? idRaw : null;
  }

  if (catalogVariantId == null || catalogVariantId <= 0) {
    return NextResponse.json(
      { error: "Keine aktive Produktvariante für die Schätzung gefunden.", references: [] },
      { status: 400 }
    );
  }

  const references = [];
  for (const country_code of DACH_COUNTRIES) {
    const result = await cheapestPrintfulShippingForCountry(
      catalogVariantId,
      country_code,
      technique,
      printPlacement ?? null
    );
    if ("error" in result) {
      references.push({
        country_code,
        catalog_variant_id: catalogVariantId,
        printful_estimate_cents: null,
        printful_estimate_label: null,
        currency: null,
        error: result.error,
      });
      continue;
    }
    references.push({
      country_code,
      catalog_variant_id: catalogVariantId,
      printful_estimate_cents: result.cents,
      printful_estimate_label: result.label,
      currency: result.currency,
      error: null,
    });
  }

  return NextResponse.json({
    catalog_variant_id: catalogVariantId,
    technique_used: technique,
    placement_hints_tried: uniquePlacements(printPlacement ?? null),
    note:
      "Live-Schätzung über die Printful-API (/v2/shipping-rates), günstigste EUR-Flat/Standard‑Option für 1 Artikel. Kann von Stückzahl, Produkt/Lager und Tageslage abweichen. Übersicht: https://www.printful.com/shipping",
    references,
  });
}
