import { render, screen } from "@testing-library/react";
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
});
