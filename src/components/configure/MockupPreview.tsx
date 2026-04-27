"use client";

interface MockupPreviewProps {
  designUrl: string | null;
  product?: "tshirt" | "hoodie" | "tasse" | "poster";
  productColor: string;
  printArea: "front" | "back" | "both";
}

const COLOR_MAP: Record<string, string> = {
  white: "#ffffff",
  black: "#1a1a1a",
  navy: "#1e3a5f",
  grey: "#6b7280",
};

export function MockupPreview({
  designUrl,
  product = "tshirt",
  productColor,
  printArea,
}: MockupPreviewProps) {
  const bgColor = COLOR_MAP[productColor] ?? "#ffffff";
  const textColor = productColor === "white" ? "#000" : "#fff";
  const productLabel =
    product === "hoodie"
      ? "Hoodie"
      : product === "tasse"
        ? "Tasse"
        : product === "poster"
          ? "Poster"
          : "T-Shirt";

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative flex h-64 w-52 items-center justify-center rounded-xl shadow-xl"
        style={{ backgroundColor: bgColor }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <svg viewBox="0 0 200 220" className="h-full w-full opacity-20" style={{ color: textColor }}>
            <path
              fill="currentColor"
              d="M70 10 L10 50 L30 70 L50 55 L50 210 L150 210 L150 55 L170 70 L190 50 L130 10 L115 30 Q100 40 85 30 Z"
            />
          </svg>
        </div>

        {designUrl && (printArea === "front" || printArea === "both") && (
          <div className="relative z-10 h-32 w-32 overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={designUrl} alt="Design preview" className="h-full w-full object-contain" />
          </div>
        )}

        {!designUrl && (
          <div className="z-10 text-center" style={{ color: textColor }}>
            <p className="text-xs opacity-50">Kein Design gewählt</p>
          </div>
        )}
      </div>

      <p className="text-xs text-zinc-500">
        {productLabel} ·{" "}
        {printArea === "front"
          ? "Vorderseite"
          : printArea === "back"
            ? "Rückseite"
            : "Vorder- & Rückseite"}
      </p>
    </div>
  );
}
