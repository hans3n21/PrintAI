/**
 * Anzahl der Design-Varianten (1-2). Server liest DESIGN_COUNT,
 * der Client nutzt NEXT_PUBLIC_DESIGN_COUNT nur als Lade-/Skeleton-Hinweis.
 */
export function getDesignVariantCount(): number {
  const raw = process.env.DESIGN_COUNT ?? process.env.NEXT_PUBLIC_DESIGN_COUNT;
  const n =
    raw != null && String(raw).trim() !== ""
      ? Number.parseInt(String(raw).trim(), 10)
      : 1;
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(2, n);
}
