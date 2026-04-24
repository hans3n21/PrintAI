/**
 * Anzahl der Gemini-Design-Varianten (1–4). Server (API) und Client (Skeleton)
 * lesen dieselbe Variable — in .env.local setzen und Dev-Server neu starten.
 */
export function getDesignVariantCount(): number {
  const raw = process.env.NEXT_PUBLIC_DESIGN_COUNT;
  const n =
    raw != null && String(raw).trim() !== ""
      ? Number.parseInt(String(raw).trim(), 10)
      : 1;
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(4, n);
}
