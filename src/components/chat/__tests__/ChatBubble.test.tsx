import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatBubble } from "../ChatBubble";

describe("ChatBubble", () => {
  it("renders assistant message with left alignment class", () => {
    const { container } = render(<ChatBubble role="assistant" content="Hallo!" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("justify-start");
  });

  it("renders user message with right alignment class", () => {
    const { container } = render(<ChatBubble role="user" content="Hi" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("justify-end");
  });

  it("displays message content", () => {
    render(<ChatBubble role="assistant" content="Was möchtest du gestalten?" />);
    expect(screen.getByText("Was möchtest du gestalten?")).toBeInTheDocument();
  });

  it("shows attached reference images on user messages and opens them in a lightbox", () => {
    render(
      <ChatBubble
        role="user"
        content="Das sind meine Freunde"
        attachments={[
          { url: "data:image/png;base64,one", label: "Referenzbild 1", kind: "reference" },
          { url: "data:image/png;base64,two", label: "Referenzbild 2", kind: "reference" },
        ]}
      />
    );

    expect(screen.getByText("2 Referenzbilder")).toBeInTheDocument();
    expect(screen.getAllByAltText(/Referenzbild/)).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Referenzbild 2 öffnen" }));

    const dialog = screen.getByRole("dialog", { name: "Referenzbild 2" });
    expect(within(dialog).getByAltText("Referenzbild 2")).toHaveAttribute(
      "src",
      "data:image/png;base64,two"
    );
  });

  it("hides stored reference image urls when attachment thumbnails are available", () => {
    render(
      <ChatBubble
        role="user"
        content={
          "Mach ein psychedelisches Bild.\n(Referenzbild 1: https://example.com/ref-1.jpg\nReferenzbild 2: https://example.com/ref-2.webp)"
        }
        attachments={[
          {
            url: "https://example.com/ref-1.jpg",
            label: "Referenzbild 1",
            kind: "reference",
          },
          {
            url: "https://example.com/ref-2.webp",
            label: "Referenzbild 2",
            kind: "reference",
          },
        ]}
      />
    );

    expect(screen.getByText("Mach ein psychedelisches Bild.")).toBeInTheDocument();
    expect(screen.getByText("2 Referenzbilder")).toBeInTheDocument();
    expect(screen.queryByText(/https:\/\/example\.com/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Referenzbild 1:/)).not.toBeInTheDocument();
  });
});
