import { describe, expect, it } from "vitest";
import type { CreativeBrief, ProductSelection } from "@/lib/types";
import { buildPromptFromCreativeBrief } from "../promptBuilder";

describe("buildPromptFromCreativeBrief", () => {
  it("carries must-include visuals into the final image prompt", () => {
    const brief: CreativeBrief = {
      occasion: "geburtstag",
      product: "tshirt",
      style: "cartoon",
      tone: "witzig",
      theme: "Hansi der King feiert Sommerparty",
      exact_text: "Hansi der King",
      must_include_visuals: ["Mopeds", "Schweine", "Sommer"],
      avoid: ["rechteckiger Hintergrund"],
      reference_images: [],
      source_summary: "Hansi will ein witziges Shirt mit Mopeds, Schweinen und Sommer.",
    };
    const selection: ProductSelection = {
      product: "tshirt",
      product_color: "black",
      quantity: 1,
    };

    const prompt = buildPromptFromCreativeBrief(brief, selection, [
      "transparent background or isolated motif",
    ]);

    expect(prompt).toContain("Mopeds");
    expect(prompt).toContain("Schweine");
    expect(prompt).toContain("Sommer");
    expect(prompt).toContain("MUST include these visual elements");
    expect(prompt).toContain("Hansi der King");
  });

  it("asks for a clean product mockup preview instead of a fake transparent background", () => {
    const brief: CreativeBrief = {
      occasion: "sonstiges",
      product: "tshirt",
      style: "cartoon",
      tone: "witzig",
      theme: "Cartoon-Bande",
      exact_text: null,
      must_include_visuals: ["Elefant", "Hase"],
      avoid: [],
      reference_images: [],
      source_summary: "Ein witziges Shirt mit Elefant und Hase.",
    };
    const selection: ProductSelection = {
      product: "tshirt",
      product_color: "grey",
      quantity: 1,
    };

    const prompt = buildPromptFromCreativeBrief(brief, selection, [
      "transparent background or isolated motif",
    ]);

    expect(prompt).toContain("mockup preview");
    expect(prompt).toContain("grey t-shirt");
    expect(prompt).toContain("Do not render a checkerboard");
    expect(prompt).not.toContain("transparent background");
  });

  it("includes uploaded reference image descriptions in the final prompt", () => {
    const brief: CreativeBrief = {
      occasion: "sonstiges",
      product: "tshirt",
      style: "cartoon",
      tone: "witzig",
      theme: "Haustier als Cartoon",
      exact_text: null,
      must_include_visuals: ["Katze"],
      avoid: [],
      reference_images: [
        {
          url: "https://example.com/cat.png",
          storage_path: "session/cat.png",
          mime: "image/png",
          uploaded_at: "2026-04-27T00:00:00.000Z",
          description: "Nutzerfoto einer getigerten Katze",
        },
      ],
      source_summary: "Ein Shirt mit der Katze aus dem Foto.",
    };

    const prompt = buildPromptFromCreativeBrief(brief, null, []);

    expect(prompt).toContain("Use the attached reference image(s)");
    expect(prompt).toContain("Nutzerfoto einer getigerten Katze");
  });

  it("adds a non-violent safety guide to reduce image safety false positives", () => {
    const brief: CreativeBrief = {
      occasion: "sonstiges",
      product: "tshirt",
      style: "cartoon",
      tone: "witzig",
      theme: "wildes Moped-Maskottchen",
      exact_text: null,
      must_include_visuals: ["Moped"],
      avoid: [],
      reference_images: [],
      source_summary: "Ein lautes, freches Moped-Motiv.",
    };

    const prompt = buildPromptFromCreativeBrief(brief, null, []);

    expect(prompt).toContain("Keep the scene non-violent");
    expect(prompt).toContain("no weapons, blood, injury, gore, fighting, or threatening action");
  });
});
