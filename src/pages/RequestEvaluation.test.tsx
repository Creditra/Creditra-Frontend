// src/pages/RequestEvaluation.test.tsx
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";
import { RequestEvaluation } from "./RequestEvaluation";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importActual) => {
  const actual = await importActual<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("RequestEvaluation (#1112)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const renderPage = (initialUrl = "/request-evaluation") =>
    render(
      <MemoryRouter initialEntries={[initialUrl]}>
        <RequestEvaluation />
      </MemoryRouter>
    );

  describe("Initial step and deep linking", () => {
    it("renders Step 1 by default when no search param is present", () => {
      renderPage("/request-evaluation");

      expect(screen.getByText("Step 1 of 5")).toBeInTheDocument();
      expect(screen.getByText("Initiate Evaluation")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^start$/i })).toBeInTheDocument();
    });

    it("opens Step 2 directly when deep-linked with ?step=2", () => {
      renderPage("/request-evaluation?step=2");

      expect(screen.getByText("Step 2 of 5")).toBeInTheDocument();
      expect(screen.getByText("Optional Information")).toBeInTheDocument();
      expect(
        screen.getByText(/revenue attestation \(pdf\/csv\)/i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /begin evaluation/i })
      ).toBeInTheDocument();
    });

    it("falls back to Step 1 when an unrecognized ?step param is provided", () => {
      renderPage("/request-evaluation?step=99");

      expect(screen.getByText("Step 1 of 5")).toBeInTheDocument();
      expect(screen.getByText("Initiate Evaluation")).toBeInTheDocument();
    });
  });

  describe("Step navigation and gating", () => {
    it("navigates from Step 1 to Step 2 when Start is clicked", () => {
      renderPage();

      fireEvent.click(screen.getByRole("button", { name: /^start$/i }));

      expect(screen.getByText("Step 2 of 5")).toBeInTheDocument();
      expect(screen.getByText("Optional Information")).toBeInTheDocument();
    });

    it("navigates back from Step 2 to Step 1 when Back is clicked", () => {
      renderPage("/request-evaluation?step=2");

      fireEvent.click(screen.getByRole("button", { name: /^back$/i }));

      expect(screen.getByText("Step 1 of 5")).toBeInTheDocument();
      expect(screen.getByText("Initiate Evaluation")).toBeInTheDocument();
    });

    it("clears optional inputs when Clear is clicked on Step 2", () => {
      renderPage("/request-evaluation?step=2");

      const identityBondCheckbox = screen.getByRole("checkbox");
      expect(identityBondCheckbox).not.toBeChecked();

      fireEvent.click(identityBondCheckbox);
      expect(identityBondCheckbox).toBeChecked();

      fireEvent.click(screen.getByRole("button", { name: /^clear$/i }));
      expect(identityBondCheckbox).not.toBeChecked();
    });
  });

  describe("Progress and ETA updates in Step 3", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("updates progress percentage and ETA countdown as fake time advances", () => {
      renderPage("/request-evaluation?step=2");

      // Begin evaluation to enter Step 3
      fireEvent.click(screen.getByRole("button", { name: /begin evaluation/i }));

      expect(screen.getByText("Step 3 of 5")).toBeInTheDocument();
      expect(screen.getByText("Evaluation in Progress")).toBeInTheDocument();

      const progressbar = screen.getByRole("progressbar");
      expect(progressbar).toHaveAttribute("aria-valuenow", "0");
      expect(screen.getByText(/estimated time remaining: 45s/i)).toBeInTheDocument();

      // Advance by 15 seconds (1/3 of 45s totalMs)
      act(() => {
        vi.advanceTimersByTime(15000);
      });

      expect(progressbar).toHaveAttribute("aria-valuenow", "33");
      expect(screen.getByText(/evaluating on-chain activity: 33%/i)).toBeInTheDocument();
      expect(screen.getByText(/estimated time remaining: 30s/i)).toBeInTheDocument();

      // Advance another 15 seconds (2/3 of 45s totalMs)
      act(() => {
        vi.advanceTimersByTime(15000);
      });

      expect(progressbar).toHaveAttribute("aria-valuenow", "67");
      expect(screen.getByText(/evaluating on-chain activity: 67%/i)).toBeInTheDocument();
      expect(screen.getByText(/estimated time remaining: 15s/i)).toBeInTheDocument();
    });

    it("cancels evaluation and resets to Step 1 when Cancel Evaluation is clicked", () => {
      renderPage("/request-evaluation?step=2");

      fireEvent.click(screen.getByRole("button", { name: /begin evaluation/i }));
      expect(screen.getByText("Step 3 of 5")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      fireEvent.click(
        screen.getByRole("button", { name: /cancel evaluation/i })
      );

      expect(screen.getByText("Step 1 of 5")).toBeInTheDocument();
      expect(screen.getByText("Initiate Evaluation")).toBeInTheDocument();
    });
  });

  describe("Evaluation outcomes (Step 4 & Step 5)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("renders approved results and walks through terms acceptance to confirmation (Step 5)", () => {
      // Stub Math.random to 0.3 for approval (0.1 <= r < 0.6)
      vi.spyOn(Math, "random").mockReturnValue(0.3);

      renderPage("/request-evaluation?step=2");
      fireEvent.click(screen.getByRole("button", { name: /begin evaluation/i }));

      // Complete 45s evaluation
      act(() => {
        vi.advanceTimersByTime(45000);
      });

      expect(screen.getByText("Step 4 of 5")).toBeInTheDocument();
      expect(screen.getByText("Results")).toBeInTheDocument();
      expect(screen.getByText("Credit Limit Offered")).toBeInTheDocument();
      expect(screen.getByText("Interest Rate (APR)")).toBeInTheDocument();
      expect(screen.getByText("Risk Score")).toBeInTheDocument();

      const acceptButton = screen.getByRole("button", {
        name: /accept credit line/i,
      });
      expect(acceptButton).toBeDisabled();

      // Expand preview terms details
      const details = screen.getByText(/preview terms and conditions/i).closest("details") as HTMLDetailsElement;
      expect(details).toBeInTheDocument();
      details.open = true;
      fireEvent(details, new Event("toggle"));

      expect(acceptButton).not.toBeDisabled();
      fireEvent.click(acceptButton);

      // Advances to Step 5
      expect(screen.getByText("Step 5 of 5")).toBeInTheDocument();
      expect(screen.getByText("Confirmation")).toBeInTheDocument();
      expect(
        screen.getByText(/credit line created successfully/i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /go to credit lines/i })
      ).toHaveAttribute("href", "/credit-lines");
    });

    it("renders declined results with rejection reasons", () => {
      // Stub Math.random to 0.8 for rejection (r >= 0.6)
      vi.spyOn(Math, "random").mockReturnValue(0.8);

      renderPage("/request-evaluation?step=2");
      fireEvent.click(screen.getByRole("button", { name: /begin evaluation/i }));

      act(() => {
        vi.advanceTimersByTime(45000);
      });

      expect(screen.getByText("Step 4 of 5")).toBeInTheDocument();
      expect(screen.getByText("Results")).toBeInTheDocument();
      expect(screen.getByText("Application Rejected")).toBeInTheDocument();
      expect(
        screen.getByText(/insufficient on-chain activity and limited repayment history detected/i)
      ).toBeInTheDocument();

      const tryAgainBtn = screen.getByRole("button", { name: /try again/i });
      expect(tryAgainBtn).toBeInTheDocument();

      fireEvent.click(tryAgainBtn);
      expect(screen.getByText("Step 1 of 5")).toBeInTheDocument();
      expect(screen.getByText("Initiate Evaluation")).toBeInTheDocument();
    });

    it("renders error state on evaluation failure and offers retry", () => {
      // Stub Math.random to 0.05 for error (r < 0.1)
      vi.spyOn(Math, "random").mockReturnValue(0.05);

      renderPage("/request-evaluation?step=2");
      fireEvent.click(screen.getByRole("button", { name: /begin evaluation/i }));

      act(() => {
        vi.advanceTimersByTime(45000);
      });

      expect(screen.getByText("Step 4 of 5")).toBeInTheDocument();
      expect(screen.getByText("Evaluation failed")).toBeInTheDocument();
      expect(
        screen.getByText(/a network error occurred while analyzing your wallet\. please try again\./i)
      ).toBeInTheDocument();

      const tryAgainBtn = screen.getByRole("button", { name: /try again/i });
      expect(tryAgainBtn).toBeInTheDocument();

      fireEvent.click(tryAgainBtn);
      expect(screen.getByText("Step 1 of 5")).toBeInTheDocument();
      expect(screen.getByText("Initiate Evaluation")).toBeInTheDocument();
    });
  });

  describe("Lifecycle and cleanup", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("clears interval timer on unmount during evaluation", () => {
      const clearIntervalSpy = vi.spyOn(window, "clearInterval");

      const { unmount } = renderPage("/request-evaluation?step=2");
      fireEvent.click(screen.getByRole("button", { name: /begin evaluation/i }));

      expect(screen.getByText("Step 3 of 5")).toBeInTheDocument();

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});
