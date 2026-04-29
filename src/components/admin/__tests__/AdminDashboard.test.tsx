import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminDashboard } from "../AdminDashboard";

vi.mock("../AdminSessionOverview", () => ({
  AdminSessionOverview: () => <div>Session Übersicht Mock</div>,
}));

vi.mock("@/components/notes/NotesFeed", () => ({
  NotesFeed: () => <div>Feedback Mock</div>,
}));

describe("AdminDashboard", () => {
  it("shows a link back to the start page", () => {
    render(<AdminDashboard />);

    expect(screen.getByRole("link", { name: "Zur Startseite" })).toHaveAttribute(
      "href",
      "/"
    );
  });

  it("shows sessions by default and can switch to feedback", () => {
    render(<AdminDashboard />);

    expect(screen.getByText("Session Übersicht Mock")).toBeInTheDocument();
    expect(screen.queryByText("Feedback Mock")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Feedback" }));

    expect(screen.getByText("Feedback Mock")).toBeInTheDocument();
    expect(screen.queryByText("Session Übersicht Mock")).not.toBeInTheDocument();
  });
});
