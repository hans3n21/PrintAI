export type PrintAreaSelection = "front" | "back" | "both" | string | null | undefined;

export function backPlacementFor(frontPlacement: string) {
  if (frontPlacement.includes("large")) return "back_large";
  return "back";
}

export function placementForPrintArea(printArea: PrintAreaSelection, basePlacement: string) {
  return printArea === "back" ? backPlacementFor(basePlacement) : basePlacement;
}

export function orderFilePlacements(printArea: PrintAreaSelection, basePlacement: string) {
  if (printArea === "back") return [backPlacementFor(basePlacement)];
  if (printArea === "both") return [basePlacement, backPlacementFor(basePlacement)];
  return [basePlacement];
}
