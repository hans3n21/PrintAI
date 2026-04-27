import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SloganPicker } from "../SloganPicker";
import type { SloganOption } from "@/lib/types";

const slogans: SloganOption[] = [
  {
    main_text: "Bio-Apfel Rider",
    sub_text: "Knackig unterwegs",
    placement: "top",
    note: "Kurz und witzig",
  },
  {
    main_text: "Vollgas Vitamin",
    sub_text: null,
    placement: "bottom",
    note: "Frech",
  },
];

describe("SloganPicker", () => {
  it("shows only the current slogan until the user opens alternatives", () => {
    render(<SloganPicker slogans={slogans} selectedIndex={0} onSelect={vi.fn()} />);

    expect(screen.getByText("Bio-Apfel Rider")).toBeInTheDocument();
    expect(screen.queryByText("Vollgas Vitamin")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Textvorschlag auswählen/i }));

    expect(screen.getByText("Vollgas Vitamin")).toBeInTheDocument();
  });

  it("selects an alternative and closes the option list", () => {
    const onSelect = vi.fn();
    render(<SloganPicker slogans={slogans} selectedIndex={0} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: /Textvorschlag auswählen/i }));
    fireEvent.click(screen.getByRole("button", { name: /Vollgas Vitamin/i }));

    expect(onSelect).toHaveBeenCalledWith(1);
    expect(screen.queryByText("Vollgas Vitamin")).not.toBeInTheDocument();
  });
});
