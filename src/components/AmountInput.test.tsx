import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AmountInput, AmountInputSkeleton } from "./AmountInput";
import * as ReducedMotionContext from "../context/ReducedMotionContext";
import { readFileSync } from "fs";
import { resolve } from "path";

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
      expect(skeletonRegion).toHaveAttribute("role", "region");
      expect(skeletonRegion).toHaveAttribute("aria-busy", "true");
      expect(skeletonRegion).toHaveAttribute(
        "aria-label",
        "Loading amount input",
      );
    });
  });

  describe("Design Tokens & Typography Spacing (v7)", () => {
    it("pins root container spacing and header typography to design tokens", () => {
      render(<AmountInput creditLine={creditLine} onAmountChange={vi.fn()} />);

      const heading = screen.getByRole("heading", { name: /enter amount/i });
      expect(heading).toHaveClass(
        "text-2xl",
        "sm:text-3xl",
        "font-bold",
        "text-foreground",
        "leading-[var(--lh-heading)]",
        "tracking-tight",
      );
    });

    it("applies design token classes to input box, dollar prefix, and stepper controls", () => {
      render(<AmountInput creditLine={creditLine} onAmountChange={vi.fn()} />);

      const input = screen.getByLabelText(/draw amount/i);
      expect(input).toHaveClass("tabular-nums", "leading-[var(--lh-display)]");

      const maxButton = screen.getByRole("button", {
        name: /set amount to maximum/i,
      });
      expect(maxButton).toHaveClass(
        "text-accent",
        "focus-visible:ring-accent",
        "min-h-[44px]",
      );
    });

    it("maps severity validation tones to semantic status color tokens", () => {
      render(<AmountInput creditLine={creditLine} onAmountChange={vi.fn()} />);

      const input = screen.getByLabelText(/draw amount/i);

      // Exceed availability -> danger tone mapped to error token
      fireEvent.change(input, { target: { value: "40000" } });
      const wrapper = input.closest(".border-2");
      expect(wrapper).toHaveClass("border-error/70");
    });

    it("pins quick preset chips and main action buttons to semantic design tokens", () => {
      render(
        <AmountInput
          creditLine={creditLine}
          onAmountChange={vi.fn()}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />,
      );

      const presetButton = screen.getByRole("button", { name: /25 percent/i });
      expect(presetButton).toHaveClass(
        "border-border",
        "hover:border-accent",
        "focus-visible:ring-accent",
        "min-h-[44px]",
      );

      const continueButton = screen.getByRole("button", { name: /continue/i });
      expect(continueButton).toHaveClass(
        "bg-accent",
        "focus-visible:ring-accent",
        "min-h-[44px]",
      );

      const backButton = screen.getByRole("button", { name: /back/i });
      expect(backButton).toHaveClass(
        "border-border",
        "text-foreground",
        "focus-visible:ring-accent",
        "min-h-[44px]",
      );
    });

    it("renders constraint boxes with typography rhythm tokens and tabular numerals", () => {
      render(<AmountInput creditLine={creditLine} onAmountChange={vi.fn()} />);

      const minLabel = screen.getByText("Minimum draw");
      expect(minLabel).toHaveClass(
        "text-[11px]",
        "font-semibold",
        "uppercase",
        "tracking-wider",
        "text-muted",
        "leading-[var(--lh-small)]",
      );
    });
  });

  describe("Reduced Motion (v7)", () => {
    it("adds data-reduced-motion=true attribute on root when reduced motion is active", () => {
      vi.spyOn(ReducedMotionContext, "useReducedMotion").mockReturnValue({
        motionOverride: "reduced",
        toggleMotionOverride: vi.fn(),
        setMotionOverride: vi.fn(),
        isReducedMotionActive: true,
      });

      const { container } = render(
        <AmountInput
          creditLine={creditLine}
          onAmountChange={vi.fn()}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />,
      );

      const root = container.querySelector(".amount-input-root");
      expect(root).toHaveAttribute("data-reduced-motion", "true");

      vi.restoreAllMocks();
    });

    it("omits data-reduced-motion attribute when reduced motion is not active", () => {
      vi.spyOn(ReducedMotionContext, "useReducedMotion").mockReturnValue({
        motionOverride: "system",
        toggleMotionOverride: vi.fn(),
        setMotionOverride: vi.fn(),
        isReducedMotionActive: false,
      });

      const { container } = render(
        <AmountInput
          creditLine={creditLine}
          onAmountChange={vi.fn()}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />,
      );

      const root = container.querySelector(".amount-input-root");
      expect(root).not.toHaveAttribute("data-reduced-motion");

      vi.restoreAllMocks();
    });

    it("renders transition classes on stepper and action buttons when motion is active", () => {
      vi.spyOn(ReducedMotionContext, "useReducedMotion").mockReturnValue({
        motionOverride: "system",
        toggleMotionOverride: vi.fn(),
        setMotionOverride: vi.fn(),
        isReducedMotionActive: false,
      });

      render(
        <AmountInput
          creditLine={creditLine}
          onAmountChange={vi.fn()}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />,
      );

      const decreaseBtn = screen.getByRole("button", { name: /decrease amount/i });
      const increaseBtn = screen.getByRole("button", { name: /increase amount/i });
      const continueBtn = screen.getByRole("button", { name: /continue/i });

      expect(decreaseBtn.className).toContain("transition-all");
      expect(increaseBtn.className).toContain("transition-all");
      expect(continueBtn.className).toContain("transition-all");

      vi.restoreAllMocks();
    });

    it("omits transition classes on buttons when reduced motion is active", () => {
      vi.spyOn(ReducedMotionContext, "useReducedMotion").mockReturnValue({
        motionOverride: "reduced",
        toggleMotionOverride: vi.fn(),
        setMotionOverride: vi.fn(),
        isReducedMotionActive: true,
      });

      render(
        <AmountInput
          creditLine={creditLine}
          onAmountChange={vi.fn()}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />,
      );

      const decreaseBtn = screen.getByRole("button", { name: /decrease amount/i });
      const increaseBtn = screen.getByRole("button", { name: /increase amount/i });
      const continueBtn = screen.getByRole("button", { name: /continue/i });

      expect(decreaseBtn.className).not.toContain("transition-all");
      expect(increaseBtn.className).not.toContain("transition-all");
      expect(continueBtn.className).not.toContain("transition-all");

      vi.restoreAllMocks();
    });

    it("AmountInput CSS file includes prefers-reduced-motion reduce rule", () => {
      const cssPath = resolve(__dirname, "AmountInput.css");
      const css = readFileSync(cssPath, "utf-8");
      expect(css).toContain("prefers-reduced-motion: reduce");
      expect(css).toContain("transition-duration: 0s");
    });
  });

  describe("Responsive Breakpoints (v7)", () => {
    it("uses grid-cols-2 on narrow viewports and xs:grid-cols-4 for preset chips", () => {
      render(
        <AmountInput
          creditLine={creditLine}
          onAmountChange={vi.fn()}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />,
      );

      const presetButton = screen.getByRole("button", { name: /25 percent/i });
      const presetGrid = presetButton.closest(".grid");
      expect(presetGrid).toHaveClass("grid-cols-2");
      expect(presetGrid).toHaveClass("xs:grid-cols-4");
    });

    it("stacks action buttons vertically on narrow and row on wider viewports", () => {
      render(
        <AmountInput
          creditLine={creditLine}
          onAmountChange={vi.fn()}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />,
      );

      const backButton = screen.getByRole("button", { name: /back/i });
      const actionRow = backButton.closest(".flex.flex-col");
      expect(actionRow).toHaveClass("flex-col");
      expect(actionRow).toHaveClass("xs:flex-row");
    });

    it("constraint cards use single-column grid on narrow viewports with sm:grid-cols-3", () => {
      render(
        <AmountInput
          creditLine={creditLine}
          onAmountChange={vi.fn()}
        />,
      );

      const constraintsGrid = document.getElementById("draw-amount-constraints");
      expect(constraintsGrid).toHaveClass("grid");
      expect(constraintsGrid).toHaveClass("sm:grid-cols-3");
    });

    it("stepper buttons resize from w-10/h-10 on narrow to xs:w-11/xs:h-11", () => {
      render(
        <AmountInput
          creditLine={creditLine}
          onAmountChange={vi.fn()}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />,
      );

      const decreaseBtn = screen.getByRole("button", { name: /decrease amount/i });
      expect(decreaseBtn).toHaveClass("w-10", "h-10");
      expect(decreaseBtn).toHaveClass("xs:w-11", "xs:h-11");
    });

    it("action buttons are full width on narrow and auto on wider viewports", () => {
      render(
        <AmountInput
          creditLine={creditLine}
          onAmountChange={vi.fn()}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />,
      );

      const continueBtn = screen.getByRole("button", { name: /continue/i });
      expect(continueBtn).toHaveClass("w-full");
      expect(continueBtn).toHaveClass("xs:w-auto");
    });
  });
  it("renders keyboard shortcut hint for arrow key stepper controls", () => {
    render(
      <AmountInput
        creditLine={creditLine}
        onAmountChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText("↑ / ↓")).toBeInTheDocument();
    expect(screen.getByText("Adjust amount")).toBeInTheDocument();
  });

  describe("Optimistic UI (isSubmitting)", () => {
    it("shows a spinner and 'Processing…' label on the Continue button when isSubmitting is true", () => {
      render(
        <AmountInput
          creditLine={creditLine}
          onAmountChange={vi.fn()}
          onNext={vi.fn()}
          onBack={vi.fn()}
          isSubmitting={true}
        />,
      );

      // Enter a valid amount so Continue is enabled
      const input = screen.getByRole("spinbutton", { name: /draw amount/i });
      fireEvent.change(input, { target: { value: "10000" } });

      const continueBtn = screen.getByRole("button", { name: /processing/i });
      expect(continueBtn).toBeInTheDocument();
      expect(continueBtn).toBeDisabled();
      expect(continueBtn).toHaveAttribute("aria-busy", "true");
      expect(continueBtn.querySelector(".pending-btn__spinner")).toBeInTheDocument();
    });

    it("shows normal Continue label when not submitting", () => {
      render(
        <AmountInput
          creditLine={creditLine}
          onAmountChange={vi.fn()}
          onNext={vi.fn()}
          onBack={vi.fn()}
          isSubmitting={false}
        />,
      );

      const input = screen.getByRole("spinbutton", { name: /draw amount/i });
      fireEvent.change(input, { target: { value: "10000" } });

      expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
      expect(screen.queryByText(/processing/i)).not.toBeInTheDocument();
    });

    it("disables all interactive elements when isSubmitting is true", () => {
      render(
        <AmountInput
          creditLine={creditLine}
          onAmountChange={vi.fn()}
          onNext={vi.fn()}
          onBack={vi.fn()}
          isSubmitting={true}
        />,
      );

      const input = screen.getByRole("spinbutton", { name: /draw amount/i });
      expect(input).toBeDisabled();

      const decreaseBtn = screen.getByRole("button", { name: /decrease amount/i });
      expect(decreaseBtn).toBeDisabled();

      const increaseBtn = screen.getByRole("button", { name: /increase amount/i });
      expect(increaseBtn).toBeDisabled();

      const maxBtn = screen.getByRole("button", { name: /set amount to maximum/i });
      expect(maxBtn).toBeDisabled();

      const backBtn = screen.getByRole("button", { name: /back/i });
      expect(backBtn).toBeDisabled();

      const presetBtns = screen.getAllByRole("button", { name: /percent/i });
      presetBtns.forEach((btn) => expect(btn).toBeDisabled());
    });

    it("sets aria-busy on the root container when isSubmitting is true", () => {
      const { container } = render(
        <AmountInput
          creditLine={creditLine}
          onAmountChange={vi.fn()}
          onNext={vi.fn()}
          onBack={vi.fn()}
          isSubmitting={true}
        />,
      );

      const root = container.querySelector("div[aria-busy='true']");
      expect(root).toBeInTheDocument();
    });

    it("omits aria-busy on root container when isSubmitting is false", () => {
      const { container } = render(
        <AmountInput
          creditLine={creditLine}
          onAmountChange={vi.fn()}
          onNext={vi.fn()}
          onBack={vi.fn()}
          isSubmitting={false}
        />,
      );

      const root = container.querySelector("div[aria-busy='true']");
      expect(root).not.toBeInTheDocument();
    });
  });
});
