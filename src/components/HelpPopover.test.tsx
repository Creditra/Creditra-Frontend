/**
 * HelpPopover.test.tsx
 *
 * Tests for the HelpPopover component:
 *  - Renders the info trigger button
 *  - Clicking toggles the popover content
 *  - Escape key closes the popover
 *  - Clicking outside closes the popover
 *  - Renders term and definition text
 *  - Supports top and bottom placement
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HelpPopover } from "./HelpPopover";

describe("HelpPopover", () => {
  const defaultProps = {
    term: "Available",
    definition: "Your available balance is the amount you can draw.",
  };

  it("renders the info trigger button", () => {
    render(<HelpPopover {...defaultProps} />);
    const button = screen.getByRole("button", { name: /Help: Available/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("shows the popover content when clicked", async () => {
    const user = userEvent.setup();
    render(<HelpPopover {...defaultProps} />);

    const button = screen.getByRole("button", { name: /Help: Available/i });
    await user.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Available")).toBeInTheDocument();
    expect(
      screen.getByText("Your available balance is the amount you can draw."),
    ).toBeInTheDocument();
  });

  it("hides the popover on second click", async () => {
    const user = userEvent.setup();
    render(<HelpPopover {...defaultProps} />);

    const button = screen.getByRole("button", { name: /Help: Available/i });
    await user.click(button);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    await user.click(button);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("closes the popover with Escape key", async () => {
    const user = userEvent.setup();
    render(<HelpPopover {...defaultProps} />);

    const button = screen.getByRole("button", { name: /Help: Available/i });
    await user.click(button);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    // Focus returns to the trigger
    expect(button).toHaveFocus();
  });

  it("closes the popover when clicking outside", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <HelpPopover {...defaultProps} />
        <div data-testid="outside">Outside</div>
      </div>,
    );

    const button = screen.getByRole("button", { name: /Help: Available/i });
    await user.click(button);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    const outside = screen.getByTestId("outside");
    await user.click(outside);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("renders with bottom placement", () => {
    render(
      <HelpPopover
        term="Utilization"
        definition="The percentage of credit in use."
        placement="bottom"
      />,
    );

    const button = screen.getByRole("button", { name: /Help: Utilization/i });
    expect(button).toBeInTheDocument();
  });

  it("restores focus to the trigger after closing", async () => {
    const user = userEvent.setup();
    render(<HelpPopover {...defaultProps} />);

    const button = screen.getByRole("button", { name: /Help: Available/i });
    await user.click(button);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(button).toHaveFocus();
  });
});