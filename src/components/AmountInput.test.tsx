import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AmountInput } from "./AmountInput";

describe("AmountInput", () => {
  const creditLine = {
    id: "cl-001",
    name: "Business Line of Credit",
    limit: 50000,
    available: 35000,
    utilization: 30,
  };

  it("connects inline validation messaging to the input with aria-describedby including helper text", () => {
    render(
      <AmountInput
        creditLine={creditLine}
        onAmountChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const input = screen.getByLabelText(/amount to draw/i);
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toContain("draw-amount-helper");
  });

  it("adds error message ID to aria-describedby when amount exceeds availability", () => {
    render(
      <AmountInput
        creditLine={creditLine}
        onAmountChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const input = screen.getByLabelText(/amount to draw/i) as HTMLInputElement;

    fireEvent.change(input, {
      target: { value: "36000" },
    });

    // Should have both helper and error in aria-describedby
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toContain("draw-amount-helper");
    expect(describedBy).toContain("draw-amount-error");

    // aria-invalid should be true when there's an error
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("shows an inline error and keeps continue disabled when the amount exceeds availability", () => {
    render(
      <AmountInput
        creditLine={creditLine}
        onAmountChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/amount to draw/i), {
      target: { value: "36000" },
    });

    expect(screen.getByText("Exceeds available credit")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
  });

  it("displays validation error with danger type when amount is below minimum", () => {
    render(
      <AmountInput
        creditLine={creditLine}
        onAmountChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/amount to draw/i), {
      target: { value: "0.50" },
    });

    expect(screen.getByText("Minimum amount required")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
  });

  it("renders Max button with accessible label", () => {
    render(
      <AmountInput
        creditLine={creditLine}
        onAmountChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const maxButton = screen.getByRole("button", {
      name: /set amount to maximum/i,
    });
    expect(maxButton).toBeInTheDocument();
  });

  it("sets amount to maximum available when Max button is clicked", () => {
    const onAmountChange = vi.fn();
    render(
      <AmountInput
        creditLine={creditLine}
        onAmountChange={onAmountChange}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const maxButton = screen.getByRole("button", {
      name: /set amount to maximum/i,
    });
    fireEvent.click(maxButton);

    const input = screen.getByLabelText(/amount to draw/i) as HTMLInputElement;
    expect(input.value).toBe(creditLine.available.toString());
  });

  it("shows success message when valid amount is entered", () => {
    render(
      <AmountInput
        creditLine={creditLine}
        onAmountChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/amount to draw/i), {
      target: { value: "10000" },
    });

    expect(screen.getByText("Draw amount looks good")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /continue/i }),
    ).not.toBeDisabled();
  });

  it("enables continue button only when amount is valid", () => {
    render(
      <AmountInput
        creditLine={creditLine}
        onAmountChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const continueButton = screen.getByRole("button", { name: /continue/i });
    expect(continueButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/amount to draw/i), {
      target: { value: "15000" },
    });

    expect(continueButton).not.toBeDisabled();
  });

  it("displays helper text with available limit", () => {
    render(
      <AmountInput
        creditLine={creditLine}
        onAmountChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const helpText = screen.getByText(/available limit/i);
    expect(helpText).toBeInTheDocument();
    expect(helpText.closest("p")).toHaveTextContent("$35,000");
  });

  it("sets input to invalid state with proper styling when error occurs", () => {
    render(
      <AmountInput
        creditLine={creditLine}
        onAmountChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const input = screen.getByLabelText(/amount to draw/i) as HTMLInputElement;

    fireEvent.change(input, {
      target: { value: "50000" },
    });

    expect(input).toHaveAttribute("aria-invalid", "true");
  });
});
