"use client";

import { Button } from "@/components/ui/button";
import {
  AppNotice,
  AppSurface,
  primaryActionClassName,
  secondaryActionClassName,
} from "@/components/ui/appSurface";
import { useEffect, useState } from "react";

type PrintfulAdminProduct = {
  id: string;
  printful_product_id: number;
  title: string;
  slug: string;
  technique: string | null;
  variants: unknown[] | null;
  mockup_templates: Array<{
    image_url?: string | null;
    background_url?: string | null;
  }> | null;
  is_active: boolean;
  sort_order: number | null;
};

function getCoverUrl(product: PrintfulAdminProduct) {
  const template = product.mockup_templates?.find(
    (item) => item.image_url || item.background_url
  );
  return template?.image_url ?? template?.background_url ?? null;
}

function variantCount(product: PrintfulAdminProduct) {
  return Array.isArray(product.variants) ? product.variants.length : 0;
}

export function AdminProducts() {
  const [products, setProducts] = useState<PrintfulAdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);

  async function loadProducts() {
    try {
      const response = await fetch("/api/admin/printful/products", {
        cache: "no-store",
      });
      const data = (await response.json()) as {
        products?: PrintfulAdminProduct[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Produkte konnten nicht geladen werden");
      }
      setProducts(data.products ?? []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Produkte konnten nicht geladen werden");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProducts();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function syncCatalog() {
    setSyncing(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/printful/sync-catalog", {
        method: "POST",
      });
      const data = (await response.json()) as {
        synced?: number;
        products?: PrintfulAdminProduct[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Katalog-Sync fehlgeschlagen");
      }
      setProducts(data.products ?? []);
      setNotice(`${data.synced ?? 0} Produkt${data.synced === 1 ? "" : "e"} synchronisiert.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Katalog-Sync fehlgeschlagen");
    } finally {
      setSyncing(false);
    }
  }

  async function patchProduct(
    id: string,
    updates: Pick<Partial<PrintfulAdminProduct>, "is_active" | "sort_order">
  ) {
    setBusyIds((prev) => new Set(prev).add(id));
    setProducts((prev) =>
      prev.map((product) => (product.id === id ? { ...product, ...updates } : product))
    );
    try {
      const response = await fetch("/api/admin/printful/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      const data = (await response.json()) as {
        product?: PrintfulAdminProduct;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Produkt konnte nicht gespeichert werden");
      }
      if (data.product) {
        setProducts((prev) =>
          prev.map((product) => (product.id === id ? data.product! : product))
        );
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Produkt konnte nicht gespeichert werden");
      await loadProducts();
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <AppSurface>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-zinc-100">Produkte</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Printful-Katalogprodukte aktivieren und Reihenfolge fuer die Auswahl pflegen.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => void syncCatalog()}
          disabled={syncing}
          className={primaryActionClassName()}
        >
          {syncing ? "Synchronisiere..." : "Katalog synchronisieren"}
        </Button>
      </div>

      {notice && <AppNotice className="mt-4">{notice}</AppNotice>}
      {loading && <p className="mt-4 text-sm text-zinc-500">Lade Produkte...</p>}
      {!loading && products.length === 0 && (
        <AppNotice className="mt-4">
          Noch keine Printful-Produkte gespeichert. Starte den Katalog-Sync.
        </AppNotice>
      )}

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {products.map((product) => {
          const coverUrl = getCoverUrl(product);
          const busy = busyIds.has(product.id);
          return (
            <article
              key={product.id}
              className="rounded-3xl border border-zinc-700/70 bg-zinc-950/50 p-4"
            >
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="h-28 w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 sm:w-32">
                  {coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={coverUrl}
                      alt={`${product.title} Cover`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-3 text-center text-xs text-zinc-500">
                      Kein Cover
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-zinc-100">
                        {product.title}
                      </h3>
                      <p className="mt-1 text-xs text-zinc-500">
                        Printful #{product.printful_product_id}
                        {product.technique ? ` · ${product.technique}` : ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
                      {variantCount(product)} Varianten
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200">
                      <input
                        type="checkbox"
                        checked={product.is_active}
                        disabled={busy}
                        aria-label={`${product.title} ${
                          product.is_active ? "deaktivieren" : "aktivieren"
                        }`}
                        onChange={(event) =>
                          void patchProduct(product.id, {
                            is_active: event.currentTarget.checked,
                          })
                        }
                        className="h-4 w-4 accent-violet-500"
                      />
                      Aktiv
                    </label>

                    <label className="flex items-center gap-2 text-sm text-zinc-300">
                      Sortierung
                      <input
                        type="number"
                        value={product.sort_order ?? ""}
                        disabled={busy}
                        aria-label={`Sortierung fuer ${product.title}`}
                        onChange={(event) => {
                          const value = Number(event.currentTarget.value);
                          void patchProduct(product.id, {
                            sort_order: Number.isFinite(value) ? value : 0,
                          });
                        }}
                        className="h-9 w-24 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none ring-violet-400/40 focus:ring-2"
                      />
                    </label>
                  </div>

                  <p className="mt-3 text-xs text-zinc-600">{product.slug}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => void loadProducts()}
        className={secondaryActionClassName("mt-4")}
      >
        Produkte neu laden
      </Button>
    </AppSurface>
  );
}
