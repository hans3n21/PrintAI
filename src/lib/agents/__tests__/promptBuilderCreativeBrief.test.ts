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

  it("asks for an isolated artwork layer instead of a product mockup preview", () => {
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

    expect(prompt).toContain("artwork layer");
    expect(prompt).toContain("not a product preview");
    expect(prompt).toContain("TRANSPARENT background");
    expect(prompt).toContain("no shirt");
    expect(prompt).not.toContain("grey t-shirt");
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

  it("keeps team shirt placement notes visible for future editor workflows", () => {
    const brief: CreativeBrief = {
      occasion: "verein",
      product: "tshirt",
      style: "modern",
      tone: "ernst",
      theme: "Vereinsshirt fürs ganze Team",
      exact_text: null,
      must_include_visuals: [
        "Logo vorne",
        "Sponsor unter dem Logo",
        "Name hinten",
        "Nummer auf der Rückseite",
      ],
      avoid: [],
      reference_images: [],
      source_summary:
        "Teamshirt: Logo vorne, Sponsor darunter, Name hinten und Nummer auf der Rückseite.",
    };
    const selection: ProductSelection = {
      product: "tshirt",
      product_color: "navy",
      quantity: 15,
    };

    const prompt = buildPromptFromCreativeBrief(brief, selection, []);

    expect(prompt).toContain("Preserve placement intent");
    expect(prompt).toContain("front/back");
    expect(prompt).toContain("Logo vorne");
    expect(prompt).toContain("Nummer auf der Rückseite");
  });

  it("preserves watercolor style hints instead of forcing vector-like digital art", () => {
    const brief: CreativeBrief = {
      occasion: "sonstiges",
      product: "tshirt",
      style: "sonstiges",
      tone: "elegant",
      theme: "Aquarell-Stil mit zarten Blumen",
      exact_text: null,
      must_include_visuals: ["zarte Blumen"],
      avoid: [],
      reference_images: [],
      source_summary: "Der Nutzer wuenscht ein Motiv im Aquarell-Stil.",
    };

    const prompt = buildPromptFromCreativeBrief(brief, null, []);

    expect(prompt).toContain("Style fidelity");
    expect(prompt).toContain("watercolor painting");
    expect(prompt).toContain("soft washes");
    expect(prompt).toContain("Avoid style drift: not vector art, not digital illustration");
    expect(prompt).not.toContain("vector-like clean edges");
  });

  it("keeps minimalist requests sparse and avoids unnecessary detail", () => {
    const brief: CreativeBrief = {
      occasion: "sonstiges",
      product: "tshirt",
      style: "minimalistisch",
      tone: "elegant",
      theme: "Minimalistisches Bergmotiv",
      exact_text: null,
      must_include_visuals: ["Berge"],
      avoid: [],
      reference_images: [],
      source_summary: "Ein minimalistisches Shirt mit Bergen.",
    };

    const prompt = buildPromptFromCreativeBrief(brief, null, []);

    expect(prompt).toContain("Style fidelity");
    expect(prompt).toContain("minimal composition");
    expect(prompt).toContain("few elements");
    expect(prompt).toContain("lots of negative space");
    expect(prompt).toContain("Avoid style drift: no intricate detail");
  });

  it("turns chase wording into a playful non-threatening scene instruction", () => {
    const brief: CreativeBrief = {
      occasion: "sonstiges",
      product: "tshirt",
      style: "sonstiges",
      tone: "witzig",
      theme: "Aquarell-Brokkoli beim Klappstuhl-Insider",
      exact_text: "Einweihung des chinesischen Klappstuhls",
      must_include_visuals: [
        "Zwei Leute jagen einen Brokkoli",
        "chinesischer Klappstuhl",
      ],
      avoid: [],
      reference_images: [],
      source_summary:
        "Zwei Leute jagen einen Brokkoli bei der Einweihung des chinesischen Klappstuhls.",
    };

    const prompt = buildPromptFromCreativeBrief(brief, null, []);

    expect(prompt).toContain("playful slapstick chase");
    expect(prompt).toContain("Zwei Leute jagen einen Brokkoli");
    expect(prompt).toContain("not threatening");
    expect(prompt).toContain("no violence");
  });
});
