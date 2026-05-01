/** Printful‑Katalogpreiszeilen (Auszug vom `/prices`‑Endpoint). */

export type CatalogPriceRow = {
  id?: number;
  catalog_variant_id?: number;
  techniques?: Array<{
    technique_key?: string | null;
    price?: string | number | null;
    discounted_price?: string | number | null;
  }> | null;
};

export function centsFromCatalogPriceValue(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

/**
 * Map Varianten-ID → Netto-/Listeneinkaufspreis (Cent).
 * Pro Preiszeile können `id` und `catalog_variant_id` vorkommen; beide Varianten referenzieren oft dieselbe Größenvariante –
 * ohne beide Schlüssel fehlen in der UI echte Preise für Teile der Farbpalette.
 */
export function catalogVariantPriceMap(rows: CatalogPriceRow[] | undefined, techniqueKey: string | null) {
  const map = new Map<number, number | null>();

  for (const price of rows ?? []) {
    const techniquePrice =
      price.techniques?.find((item) => item.technique_key === techniqueKey) ??
      price.techniques?.[0];
    const cents = centsFromCatalogPriceValue(
      techniquePrice?.discounted_price ?? techniquePrice?.price
    );
    const keys = new Set<number>();
    if (typeof price.id === "number" && Number.isFinite(price.id)) keys.add(price.id);
    if (typeof price.catalog_variant_id === "number" && Number.isFinite(price.catalog_variant_id)) {
      keys.add(price.catalog_variant_id);
    }
    for (const key of keys) {
      map.set(key, cents);
    }
  }

  return map;
}
