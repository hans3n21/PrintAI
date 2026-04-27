import type { ProductColor } from "@/lib/types";

export const PRODUCT_COLORS: Array<{ id: ProductColor; label: string; hex: string }> = [
  { id: "black", label: "Schwarz", hex: "#1a1a1a" },
  { id: "white", label: "Weiß", hex: "#ffffff" },
  { id: "navy", label: "Navy", hex: "#1e3a5f" },
  { id: "grey", label: "Grau", hex: "#6b7280" },
];
