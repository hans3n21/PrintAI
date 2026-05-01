"use client";

import { Button } from "@/components/ui/button";
import { AppNotice, AppSurface, primaryActionClassName, secondaryActionClassName } from "@/components/ui/appSurface";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ShippingApiRow = {
  country_code?: string;
  label?: unknown;
  amount_cents?: unknown;
  free_from_cents?: unknown | null;
  enabled?: unknown;
};

type PrintfulRef = {
  country_code: string;
  printful_estimate_cents: number | null;
  printful_estimate_label: string | null;
  currency: string | null;
  error?: string | null;
};

const DACH_ORDER = ["DE", "AT", "CH"] as const;

const COUNTRY_TITLE: Record<(typeof DACH_ORDER)[number], string> = {
  DE: "Deutschland",
  AT: "Österreich",
  CH: "Schweiz",
};

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

function eurosFromDb(cents: number | null | undefined) {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "—";
  return eur.format(cents / 100);
}

export function AdminPricingSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingRef, setLoadingRef] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [markupPercent, setMarkupPercent] = useState(50);
  const [markupFixedCents, setMarkupFixedCents] = useState(0);
  const [shopPricesIncludeShipping, setShopPricesIncludeShipping] = useState(false);
  const [shopByCountry, setShopByCountry] = useState<Record<string, ShippingApiRow | undefined>>({});
  const [printfulRefs, setPrintfulRefs] = useState<PrintfulRef[] | null>(null);
  const [refMeta, setRefMeta] = useState<{
    catalog_variant_id?: number;
    technique_used?: string;
    placement_hints_tried?: string[];
    note?: string;
  } | null>(null);

  const fetchPrintfulDach = useCallback(async () => {
    setLoadingRef(true);
    try {
      const response = await fetch("/api/admin/printful/shipping-reference", {
        cache: "no-store",
      });
      const data = (await response.json()) as {
        references?: PrintfulRef[];
        catalog_variant_id?: number;
        technique_used?: string;
        placement_hints_tried?: string[];
        note?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Printful-Schätzung fehlgeschlagen.");
      }
      setPrintfulRefs(data.references ?? []);
      setRefMeta({
        catalog_variant_id: data.catalog_variant_id,
        technique_used: data.technique_used,
        placement_hints_tried: data.placement_hints_tried,
        note: data.note,
      });
    } catch (e) {
      setPrintfulRefs(null);
      setRefMeta(null);
      setNotice(e instanceof Error ? e.message : "Printful-Schätzung fehlgeschlagen.");
    } finally {
      setLoadingRef(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    setNotice(null);
    setLoading(true);
    try {
      const response = await fetch("/api/admin/pricing", { cache: "no-store" });
      const data = (await response.json()) as {
        pricing?: Record<string, unknown>;
        shipping_rates?: ShippingApiRow[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Einstellungen konnten nicht geladen werden.");
      }
      const p = data.pricing ?? {};
      setMarkupPercent(
        typeof p.markup_percent === "number" && Number.isFinite(p.markup_percent)
          ? p.markup_percent
          : 50
      );
      setMarkupFixedCents(
        typeof p.markup_fixed_cents === "number" ? Math.trunc(p.markup_fixed_cents) : 0
      );
      setShopPricesIncludeShipping(p.shop_prices_include_shipping === true);

      const rows = Array.isArray(data.shipping_rates) ? data.shipping_rates : [];
      const next: Record<string, ShippingApiRow | undefined> = {};
      for (const row of rows) {
        const cc =
          typeof row.country_code === "string" ? row.country_code.trim().toUpperCase() : "";
        if (cc && DACH_ORDER.includes(cc as (typeof DACH_ORDER)[number])) next[cc] = row;
      }
      setShopByCountry(next);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Laden fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await fetchSettings();
      await fetchPrintfulDach();
    })();
  }, [fetchPrintfulDach, fetchSettings]);

  async function savePricingOnly() {
    setSaving(true);
    setNotice(null);
    try {
      const payload = {
        markup_percent: Math.max(0, markupPercent),
        markup_fixed_cents: Math.max(0, Math.round(markupFixedCents)),
        shop_prices_include_shipping: shopPricesIncludeShipping,
      };
      const response = await fetch("/api/admin/pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Speichern fehlgeschlagen.");
      }
      await fetchSettings();
      setNotice("Preis-Einstellungen gespeichert (Versandtarife bleiben in der Datenbank wie bisher).");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  function liveCell(country: string) {
    const ref = printfulRefs?.find((r) => r.country_code === country);
    if (!ref) return loadingRef ? "…" : "—";
    if (ref.error) return ref.error;
    if (typeof ref.printful_estimate_cents === "number") {
      return `${eur.format(ref.printful_estimate_cents / 100)} · ${ref.printful_estimate_label ?? ""}`;
    }
    return "—";
  }

  return (
    <AppSurface>
      <h2 className="text-lg font-bold text-zinc-100">Einstellungen: Preise und Versand (DACH)</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Versand hier nur zur Übersicht: was im Shop eingestellt ist (Datenbank) und was Printful aktuell als
        günstige Schätzoption nennt — ohne Bearbeiten der Porto-Zeilen. Mark-up und „Preis inkl. Versand“ könnt
        ihr unten weiter anpassen.
      </p>
      <p className="mt-2 text-xs text-zinc-500">
        Offizielle Printful Übersicht:{" "}
        <Link
          href="https://www.printful.com/shipping"
          target="_blank"
          rel="noreferrer"
          className="text-violet-300 underline underline-offset-2 hover:text-violet-200"
        >
          printful.com/shipping
        </Link>
        . Bei API-Fehlern optional .env:&nbsp;<span className="font-mono">PRINTFUL_STORE_ID</span> setzen,
        wenn euer Schlüssel konto-weit ist.
      </p>

      {notice ? <AppNotice className="mt-4">{notice}</AppNotice> : null}

      {loading ? (
        <p className="mt-6 text-sm text-zinc-500">Laden…</p>
      ) : (
        <>
          <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-700/70">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-zinc-900/80 text-[11px] uppercase tracking-[0.15em] text-zinc-500">
                <tr>
                  <th className="px-4 py-2.5">Land</th>
                  <th className="px-4 py-2.5">Porto Shop (aktuell)</th>
                  <th className="px-4 py-2.5">Gratis ab</th>
                  <th className="px-4 py-2.5">Printful (live, Schätz.)</th>
                </tr>
              </thead>
              <tbody>
                {(DACH_ORDER as readonly string[]).map((cc) => {
                  const shop = shopByCountry[cc];
                  const amt =
                    shop && typeof shop.amount_cents === "number"
                      ? Math.round(shop.amount_cents)
                      : null;
                  const cap =
                    shop && typeof shop.free_from_cents === "number"
                      ? Math.round(shop.free_from_cents)
                      : null;
                  const aktiv = shop && shop.enabled !== false;
                  return (
                    <tr key={cc} className="border-t border-zinc-800 bg-zinc-950/40">
                      <td className="px-4 py-3 font-medium text-zinc-100">
                        {COUNTRY_TITLE[cc as keyof typeof COUNTRY_TITLE]}{" "}
                        <span className="ml-2 font-mono text-xs font-normal text-zinc-500">({cc})</span>
                        {!aktiv && shop ? (
                          <span className="mt-1 block text-[11px] text-amber-200/90">
                            Tarif im Shop derzeit deaktiviert
                          </span>
                        ) : null}
                        {!shop ? (
                          <span className="mt-1 block text-[11px] text-zinc-500">
                            Keine Zeile in shipping_rates für dieses Land — es gilt der Code-Fallback (Migration
                            015).
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-zinc-200">{amt != null ? eurosFromDb(amt) : "—"}</td>
                      <td className="px-4 py-3 text-zinc-300">{cap != null ? eurosFromDb(cap) : "nie"}</td>
                      <td className="px-4 py-3 text-xs text-zinc-300">{liveCell(cc)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {(refMeta?.catalog_variant_id != null || refMeta?.note) && (
            <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
              {refMeta.catalog_variant_id != null ? (
                <>
                  Basis: Katalog-Variante <span className="font-mono">#{refMeta.catalog_variant_id}</span>
                  {refMeta.technique_used ? (
                    <>
                      {" "}
                      · Technik <span className="font-mono">{refMeta.technique_used}</span>
                    </>
                  ) : null}
                  {Array.isArray(refMeta.placement_hints_tried) && refMeta.placement_hints_tried.length > 0 ? (
                    <>
                      {" "}
                      · Placements ausprobiert{" "}
                      <span className="font-mono">{refMeta.placement_hints_tried.join(" → ")}</span>
                    </>
                  ) : null}
                  .{" "}
                </>
              ) : null}
              {refMeta.note}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={secondaryActionClassName("rounded-full")}
              disabled={loadingRef}
              onClick={() => {
                void fetchPrintfulDach();
              }}
            >
              Printful-Schätzung aktualisieren
            </Button>
          </div>

          <div className="mt-10 border-t border-zinc-700/60 pt-6">
            <h3 className="text-sm font-semibold text-zinc-200">Produkt-Preisbildung im Shop</h3>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Aufschlag (% auf Printful-Netto)
              </span>
              <input
                type="number"
                min={0}
                step={1}
                value={markupPercent}
                className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100"
                onChange={(e) => setMarkupPercent(Number(e.target.value))}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Fester Aufschlag (Cent)
              </span>
              <input
                type="number"
                min={0}
                step={10}
                value={markupFixedCents}
                className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100"
                onChange={(e) => setMarkupFixedCents(Number.parseInt(e.target.value || "0", 10))}
              />
            </label>
          </div>

          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-zinc-700/70 bg-zinc-950/40 px-4 py-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-violet-500"
              checked={shopPricesIncludeShipping}
              onChange={(e) => setShopPricesIncludeShipping(e.target.checked)}
            />
            <span className="text-sm text-zinc-200">
              <span className="font-semibold text-zinc-50">Shop-Preise inklusive Versand</span>
              <span className="mt-1 block text-xs font-normal text-zinc-400">
                Kunden zahlen nur Stückpreis × Menge (keine separate Versandposition im Checkout/Konfigurator).
              </span>
            </span>
          </label>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              className={primaryActionClassName()}
              disabled={saving}
              onClick={() => void savePricingOnly()}
            >
              {saving ? "Speichern…" : "Mark-up / inkl. Versand speichern"}
            </Button>
          </div>
          <p className="mt-4 text-[11px] text-zinc-600">
            Versandbetriebe pro Land (und z. B. 4,99 € → 3,49 Änderung): weiterhin per Supabase-Tabelle{" "}
            <span className="font-mono">shipping_rates</span> oder eigener PATCH mit{" "}
            <span className="font-mono">shipping_rates[]</span> — nicht mehr in dieser Ansicht bearbeitbar.
          </p>
        </>
      )}
    </AppSurface>
  );
}
