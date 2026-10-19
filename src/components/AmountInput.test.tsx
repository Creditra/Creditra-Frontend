import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi} from "vitest";
import { AmountInput, AmountInputSkeleton } from "./AmountInput";

describe("AmountInput", () => {
  const creditLine = {
    id: "cl-001",
    name: "Business Line of Credit",
    limit: 50000,
    available: 35000,
    utilization: 30,
    riskBand: "Standard" as const,
    termMonths: 24,
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

    const input = screen.getByLabelText(/draw amount/i);
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

    const input = screen.getByLabelText(/draw amount/i) as HTMLInputElement;

    fireEvent.change(input, {
      target: { value: "36000" },
    });

    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toContain("draw-amount-helper");
    expect(describedBy).toContain("draw-amount-error");
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

    fireEvent.change(screen.getByLabelText(/draw amount/i), {
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

    fireEvent.change(screen.getByLabelText(/draw amount/i), {
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

    expect(
      screen.getByRole("button", { name: /set amount to maximum/i }),
    ).toBeInTheDocument();
  });

  it("sets amount to maximum available when Max button is clicked", () => {
    render(
      <AmountInput
        creditLine={creditLine}
        onAmountChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /set amount to maximum/i }),
    );

    const input = screen.getByLabelText(/draw amount/i) as HTMLInputElement;
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

    fireEvent.change(screen.getByLabelText(/draw amount/i), {
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

    fireEvent.change(screen.getByLabelText(/draw amount/i), {
      target: { value: "15000" },
    });

    expect(continueButton).not.toBeDisabled();
  });

  it("sanitizes pasted currency strings (strips $, commas, whitespace)", () => {
    render(
      <AmountInput
        creditLine={creditLine}
        onAmountChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const input = screen.getByLabelText(/draw amount/i) as HTMLInputElement;

    fireEvent.paste(input, {
      clipboardData: {
        getData: (type: string) => {
          if (type === "text") return "$1,500.00";
          return "";
        },
      },
    });

    expect(input.value).toBe("1500.00");
    expect(
      screen.getByText("Pasted value sanitized to $1,500.00"),
    ).toBeInTheDocument();
  });

  it("rejects non-numeric pasted text and announces the error", () => {
    render(
      <AmountInput
        creditLine={creditLine}
        onAmountChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const input = screen.getByLabelText(/draw amount/i) as HTMLInputElement;

    fireEvent.paste(input, {
      clipboardData: {
        getData: (type: string) => {
          if (type === "text") return "invalid-amount";
          return "";
        },
      },
    });

    expect(input.value).not.toBe("invalid-amount");
    expect(
      screen.getByText("Invalid amount pasted. Please enter a numeric value."),
    ).toBeInTheDocument();
  });

  it("renders a suggested buffer hint to make reserve guidance clearer", () => {
    render(
      <AmountInput
        creditLine={creditLine}
        onAmountChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText("Suggested buffer")).toBeInTheDocument();
    expect(screen.getByText(/keep a small safety buffer/i)).toBeInTheDocument();
  });

  it("renders explicit +/- stepper buttons with accessible labels", () => {
    render(
      <AmountInput
        creditLine={creditLine}
        onAmountChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const decreaseButton = screen.getByRole("button", {
      name: /decrease amount/i,
    });
    const increaseButton = screen.getByRole("button", {
      name: /increase amount/i,
    });

    expect(decreaseButton).toBeInTheDocument();
    expect(decreaseButton).toBeDisabled();
    expect(increaseButton).toBeInTheDocument();
    expect(increaseButton).not.toBeDisabled();
  });

  it("increments amount by the step value when increase is clicked", () => {
    render(
      <AmountInput
        creditLine={creditLine}
        onAmountChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const increaseButton = screen.getByRole("button", {
      name: /increase amount/i,
    });
    const input = screen.getByLabelText(/draw amount/i) as HTMLInputElement;

    fireEvent.click(increaseButton);

    expect(input.value).toBe("100");
  });

  it("decrements amount by the step value when decrease is clicked", () => {
    render(
      <AmountInput
        creditLine={creditLine}
        onAmountChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const input = screen.getByLabelText(/draw amount/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "500" } });

    fireEvent.click(screen.getByRole("button", { name: /decrease amount/i }));

    expect(input.value).toBe("400");
  });

  it("does not increment past the available credit", () => {
    render(
      <AmountInput
        creditLine={creditLine}
        onAmountChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const input = screen.getByLabelText(/draw amount/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "34900" } });

    fireEvent.click(screen.getByRole("button", { name: /increase amount/i }));

    expect(input.value).toBe(creditLine.available.toString());
  });

  it("does not decrement below zero", () => {
    render(
      <AmountInput
        creditLine={creditLine}
        onAmountChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const input = screen.getByLabelText(/draw amount/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "50" } });

    fireEvent.click(screen.getByRole("button", { name: /decrease amount/i }));

    expect(input.value).toBe("0");
  });

  it("responds to ArrowUp and ArrowDown keys as stepper shortcuts", () => {
    render(
      <AmountInput
        creditLine={creditLine}
        onAmountChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const input = screen.getByLabelText(/draw amount/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "500" } });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input.value).toBe("600");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.value).toBe("500");
  });

  it("sets the input step attribute", () => {
    render(
      <AmountInput
        creditLine={creditLine}
        onAmountChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const input = screen.getByLabelText(/draw amount/i) as HTMLInputElement;
    expect(input).toHaveAttribute("step", "100");
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

    const input = screen.getByLabelText(/draw amount/i) as HTMLInputElement;

    fireEvent.change(input, {
      target: { value: "50000" },
    });

    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  describe("Skeleton Loading State (v7)", () => {
    it("renders loading skeleton on first paint when isLoading is true", () => {
      render(<AmountInput creditLine={creditLine} isLoading={true} />);

      const skeletonRegion = screen.getByTestId("amount-input-skeleton");
      expect(skeletonRegion).toBeInTheDocument();
      expect(skeletonRegion).toHaveAttribute("aria-busy", "true");
      expect(skeletonRegion).toHaveAttribute(
        "aria-label",
        "Loading amount input",
      );
      expect(screen.queryByLabelText(/draw amount/i)).not.toBeInTheDocument();
    });

    it("renders themed empty state when creditLine is not yet provided and not loading", () => {
      const onBack = vi.fn();
      render(<AmountInput isLoading={false} onBack={onBack} />);

      const emptyRegion = screen.getByTestId("amount-input-empty");
      expect(emptyRegion).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "No credit line selected" })).toBeInTheDocument();
      expect(screen.getByText(/Select a credit line from the dashboard/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Go back" })).toBeInTheDocument();
    });

    it("renders skeleton when creditLine is not yet provided but loading", () => {
      render(<AmountInput isLoading={true} />);

      const skeletonRegion = screen.getByTestId("amount-input-skeleton");
      expect(skeletonRegion).toBeInTheDocument();
      expect(skeletonRegion).toHaveAttribute("aria-busy", "true");
    });

    it("renders standalone AmountInputSkeleton correctly with accessibility attributes", () => {
      render(<AmountInputSkeleton />);

      const skeletonRegion = screen.getByTestId("amount-input-skeleton");
      expect(skeletonRegion).toBeInTheDocument();
      expect(skeletonRegion).toHaveAttribute("aria-busy", "true");
      expect(skeletonRegion).toHaveAttribute(
        "aria-label",
        "Loading amount input",
      );
    });
  });
});
