"use client";

interface MockupPreviewProps {
  designUrl: string | null;
  product?: "tshirt" | "hoodie" | "tasse" | "poster";
  productColor: string;
  printArea: "front" | "back" | "both";
  mockups?: Array<{
    variant_id: number;
    mockup_url: string;
    color?: string | null;
  }>;
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
  mockups = [],
}: MockupPreviewProps) {
  const bgColor = COLOR_MAP[productColor] ?? "#ffffff";
  const textColor = productColor === "white" ? "#000" : "#fff";
  const selectedMockup =
    mockups.find(
      (mockup) => mockup.color?.trim().toLowerCase() === productColor.toLowerCase()
    ) ?? mockups[0];
  const productLabel =
    product === "hoodie"
      ? "Hoodie"
      : product === "tasse"
        ? "Tasse"
        : product === "poster"
          ? "Poster"
          : "T-Shirt";

  return (
    <div className="flex flex-col items-center gap-3 rounded-[2rem] border border-zinc-700/70 bg-zinc-800/80 p-5 shadow-2xl shadow-black/25 ring-1 ring-white/5 backdrop-blur">
      {selectedMockup ? (
        <div className="w-full max-w-sm overflow-hidden rounded-[1.75rem] bg-zinc-950 shadow-2xl shadow-black/30 ring-1 ring-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedMockup.mockup_url}
            alt="Printful Mockup"
            className="h-auto w-full object-contain"
          />
        </div>
      ) : (
        <div
          className="relative flex h-64 w-52 items-center justify-center rounded-[1.75rem] shadow-2xl shadow-black/30 ring-1 ring-white/10"
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
            <div className="absolute inset-0 z-10 overflow-hidden rounded-[1.75rem] bg-black/10 shadow-lg shadow-black/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={designUrl}
                alt="Design preview"
                className="h-full w-full object-contain"
              />
            </div>
          )}

          {!designUrl && (
            <div className="z-10 text-center" style={{ color: textColor }}>
              <p className="text-xs opacity-50">Kein Design gewählt</p>
            </div>
          )}
        </div>
      )}

      {mockups.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {mockups.map((mockup) => (
            <span
              key={`${mockup.variant_id}-${mockup.mockup_url}`}
              className={`rounded-full border px-3 py-1 text-xs ${
                mockup === selectedMockup
                  ? "border-violet-400 bg-violet-500/15 text-violet-100"
                  : "border-zinc-700 bg-zinc-950/40 text-zinc-500"
              }`}
            >
              {mockup.color ?? `Variante ${mockup.variant_id}`}
            </span>
          ))}
        </div>
      )}

      <p className="rounded-full border border-zinc-700/70 bg-zinc-950/40 px-3 py-1 text-xs text-zinc-500">
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
