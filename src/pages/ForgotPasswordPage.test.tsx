import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";
import { ForgotPasswordPage } from "./ForgotPasswordPage";

describe("ForgotPasswordPage (#1110)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={["/forgot-password"]}>
        <ForgotPasswordPage />
      </MemoryRouter>
    );

  describe("Client-side validation", () => {
    it("rejects empty email without calling fetch", async () => {
      renderPage();

      const submitButton = screen.getByRole("button", { name: /send reset link/i });
      fireEvent.click(submitButton);

      expect(
        await screen.findByText(/please enter a valid email address/i)
      ).toBeInTheDocument();
      expect(fetch).not.toHaveBeenCalled();
    });

    it("rejects whitespace-only email without calling fetch", async () => {
      renderPage();

      const emailInput = screen.getByPlaceholderText(/you@example.com/i);
      fireEvent.change(emailInput, { target: { value: "    " } });

      const submitButton = screen.getByRole("button", { name: /send reset link/i });
      fireEvent.click(submitButton);

      expect(
        await screen.findByText(/please enter a valid email address/i)
      ).toBeInTheDocument();
      expect(fetch).not.toHaveBeenCalled();
    });

    it("rejects malformed email format without calling fetch", async () => {
      renderPage();

      const emailInput = screen.getByPlaceholderText(/you@example.com/i);
      fireEvent.change(emailInput, { target: { value: "invalid-email-format" } });

      const submitButton = screen.getByRole("button", { name: /send reset link/i });
      fireEvent.click(submitButton);

      expect(
        await screen.findByText(/please enter a valid email address/i)
      ).toBeInTheDocument();
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("Pending and loading states", () => {
    it("disables submit button and shows pending state while request is in flight", async () => {
      let resolvePromise!: (val: unknown) => void;
      const delayedPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(fetch).mockReturnValueOnce(delayedPromise as Promise<Response>);

      renderPage();

      const emailInput = screen.getByPlaceholderText(/you@example.com/i);
      fireEvent.change(emailInput, { target: { value: "borrower@creditra.com" } });

      const submitButton = screen.getByRole("button", { name: /send reset link/i });
      fireEvent.click(submitButton);

      // Submit button should become disabled with aria-busy="true"
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
        expect(submitButton).toHaveAttribute("aria-busy", "true");
        expect(submitButton).toHaveTextContent(/sending\.\.\./i);
      });

      // Resolve the mock network request
      resolvePromise({
        ok: true,
        json: async () => ({ success: true }),
      });

      // Success screen appears after resolution
      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /check your email/i })
        ).toBeInTheDocument();
      });
    });
  });

  describe("Anti-account enumeration protection", () => {
    it("renders identical generic success copy for known existing accounts", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, message: "Reset email sent" }),
      } as Response);

      renderPage();

      const emailInput = screen.getByPlaceholderText(/you@example.com/i);
      fireEvent.change(emailInput, { target: { value: "known-user@creditra.com" } });

      const submitButton = screen.getByRole("button", { name: /send reset link/i });
      fireEvent.click(submitButton);

      const successHeading = await screen.findByRole("heading", {
        name: /check your email/i,
      });
      expect(successHeading).toBeInTheDocument();

      expect(screen.getByText(/if an account exists for/i)).toBeInTheDocument();
      expect(screen.getByText("known-user@creditra.com")).toBeInTheDocument();
      expect(
        screen.getByText(/check your spam folder or request a new link/i)
      ).toBeInTheDocument();
    });

    it("renders identical generic success copy for unknown accounts (200 generic API response)", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: "If that email exists, we sent instructions",
        }),
      } as Response);

      renderPage();

      const emailInput = screen.getByPlaceholderText(/you@example.com/i);
      fireEvent.change(emailInput, { target: { value: "unknown-user@creditra.com" } });

      const submitButton = screen.getByRole("button", { name: /send reset link/i });
      fireEvent.click(submitButton);

      const successHeading = await screen.findByRole("heading", {
        name: /check your email/i,
      });
      expect(successHeading).toBeInTheDocument();

      expect(screen.getByText(/if an account exists for/i)).toBeInTheDocument();
      expect(screen.getByText("unknown-user@creditra.com")).toBeInTheDocument();
    });

    it("renders identical generic success copy when backend returns 404 (user not found)", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ message: "User not found" }),
      } as Response);

      renderPage();

      const emailInput = screen.getByPlaceholderText(/you@example.com/i);
      fireEvent.change(emailInput, { target: { value: "nonexistent@creditra.com" } });

      const submitButton = screen.getByRole("button", { name: /send reset link/i });
      fireEvent.click(submitButton);

      // Must NOT show "User not found" error to prevent enumeration
      expect(screen.queryByText(/user not found/i)).not.toBeInTheDocument();

      // Must show the identical generic success screen
      const successHeading = await screen.findByRole("heading", {
        name: /check your email/i,
      });
      expect(successHeading).toBeInTheDocument();
      expect(screen.getByText(/if an account exists for/i)).toBeInTheDocument();
      expect(screen.getByText("nonexistent@creditra.com")).toBeInTheDocument();
    });
  });

  describe("Error recovery", () => {
    it("displays a retryable error message on network failure", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Failed to fetch"));

      renderPage();

      const emailInput = screen.getByPlaceholderText(/you@example.com/i);
      fireEvent.change(emailInput, { target: { value: "user@creditra.com" } });

      const submitButton = screen.getByRole("button", { name: /send reset link/i });
      fireEvent.click(submitButton);

      const errorMessage = await screen.findByText(
        /network error\. please check your connection and try again/i
      );
      expect(errorMessage).toBeInTheDocument();

      // Form remains editable so the user can retry
      expect(emailInput).not.toBeDisabled();
      expect(submitButton).not.toBeDisabled();
    });

    it("displays a retryable error message on 500 server error", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: "Internal server error" }),
      } as Response);

      renderPage();

      const emailInput = screen.getByPlaceholderText(/you@example.com/i);
      fireEvent.change(emailInput, { target: { value: "user@creditra.com" } });

      const submitButton = screen.getByRole("button", { name: /send reset link/i });
      fireEvent.click(submitButton);

      const errorMessage = await screen.findByText(
        /internal server error/i
      );
      expect(errorMessage).toBeInTheDocument();
      expect(submitButton).not.toBeDisabled();
    });
  });
});
