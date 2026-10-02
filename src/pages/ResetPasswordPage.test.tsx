// src/pages/ResetPasswordPage.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";
import { ResetPasswordPage } from "./ResetPasswordPage";

describe("ResetPasswordPage (#1111)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const renderPage = (initialUrl = "/reset-password") =>
    render(
      <MemoryRouter initialEntries={[initialUrl]}>
        <ResetPasswordPage />
      </MemoryRouter>
    );

  describe("Token edge cases", () => {
    it("shows 'Invalid or missing reset token' when ?token is absent", () => {
      renderPage("/reset-password");

      expect(
        screen.getByText(/invalid or missing reset token/i)
      ).toBeInTheDocument();
    });

    it("disables submit button when token is absent", () => {
      renderPage("/reset-password");

      const submitButton = screen.getByRole("button", {
        name: /reset password/i,
      });
      expect(submitButton).toBeDisabled();
    });

    it("enables form submission when a valid token is present in the URL", () => {
      renderPage("/reset-password?token=valid-secret-token-123");

      expect(
        screen.queryByText(/invalid or missing reset token/i)
      ).not.toBeInTheDocument();

      const submitButton = screen.getByRole("button", {
        name: /reset password/i,
      });
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe("Client-side validation", () => {
    it("rejects empty fields without calling fetch", async () => {
      renderPage("/reset-password?token=valid-token");

      const submitButton = screen.getByRole("button", {
        name: /reset password/i,
      });
      fireEvent.click(submitButton);

      expect(
        await screen.findByText(/all fields are required/i)
      ).toBeInTheDocument();
      expect(fetch).not.toHaveBeenCalled();
    });

    it("rejects passwords shorter than 8 characters without calling fetch", async () => {
      renderPage("/reset-password?token=valid-token");

      const newPassInput = screen.getByPlaceholderText(/create a strong password/i);
      const confirmPassInput = screen.getByPlaceholderText(/re-enter your password/i);

      fireEvent.change(newPassInput, { target: { value: "short1" } });
      fireEvent.change(confirmPassInput, { target: { value: "short1" } });

      const submitButton = screen.getByRole("button", {
        name: /reset password/i,
      });
      fireEvent.click(submitButton);

      expect(
        await screen.findByText(/password must be at least 8 characters/i)
      ).toBeInTheDocument();
      expect(fetch).not.toHaveBeenCalled();
    });

    it("blocks submission when passwords do not match and shows error", async () => {
      renderPage("/reset-password?token=valid-token");

      const newPassInput = screen.getByPlaceholderText(/create a strong password/i);
      const confirmPassInput = screen.getByPlaceholderText(/re-enter your password/i);

      fireEvent.change(newPassInput, { target: { value: "ValidPass123!" } });
      fireEvent.change(confirmPassInput, { target: { value: "MismatchPass123!" } });

      const submitButton = screen.getByRole("button", {
        name: /reset password/i,
      });
      fireEvent.click(submitButton);

      expect(
        await screen.findByText(/passwords do not match/i)
      ).toBeInTheDocument();
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("API payload and network interaction", () => {
    it("submits request body containing ONLY token and newPassword", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      renderPage("/reset-password?token=my-secret-token-xyz");

      const newPassInput = screen.getByPlaceholderText(/create a strong password/i);
      const confirmPassInput = screen.getByPlaceholderText(/re-enter your password/i);

      fireEvent.change(newPassInput, { target: { value: "SuperSecurePass123!" } });
      fireEvent.change(confirmPassInput, {
        target: { value: "SuperSecurePass123!" },
      });

      const submitButton = screen.getByRole("button", {
        name: /reset password/i,
      });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledTimes(1);
      });

      expect(fetch).toHaveBeenCalledWith("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: "my-secret-token-xyz",
          newPassword: "SuperSecurePass123!",
        }),
      });

      // Verify the parsed body contains ONLY token and newPassword
      const calledBody = JSON.parse(
        vi.mocked(fetch).mock.calls[0][1]?.body as string
      );
      expect(calledBody).toEqual({
        token: "my-secret-token-xyz",
        newPassword: "SuperSecurePass123!",
      });
      expect(calledBody).not.toHaveProperty("confirmPassword");
    });

    it("displays error message when backend responds with an error", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "Reset token has expired" }),
      } as Response);

      renderPage("/reset-password?token=expired-token");

      const newPassInput = screen.getByPlaceholderText(/create a strong password/i);
      const confirmPassInput = screen.getByPlaceholderText(/re-enter your password/i);

      fireEvent.change(newPassInput, { target: { value: "SuperSecurePass123!" } });
      fireEvent.change(confirmPassInput, {
        target: { value: "SuperSecurePass123!" },
      });

      const submitButton = screen.getByRole("button", {
        name: /reset password/i,
      });
      fireEvent.click(submitButton);

      expect(
        await screen.findByText(/reset token has expired/i)
      ).toBeInTheDocument();
    });

    it("displays generic error message on network failure", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Network offline"));

      renderPage("/reset-password?token=token-abc");

      const newPassInput = screen.getByPlaceholderText(/create a strong password/i);
      const confirmPassInput = screen.getByPlaceholderText(/re-enter your password/i);

      fireEvent.change(newPassInput, { target: { value: "SuperSecurePass123!" } });
      fireEvent.change(confirmPassInput, {
        target: { value: "SuperSecurePass123!" },
      });

      const submitButton = screen.getByRole("button", {
        name: /reset password/i,
      });
      fireEvent.click(submitButton);

      expect(
        await screen.findByText(/an error occurred\. please try again/i)
      ).toBeInTheDocument();
    });

    it("renders success screen and provides navigation link to login", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      renderPage("/reset-password?token=token-success");

      const newPassInput = screen.getByPlaceholderText(/create a strong password/i);
      const confirmPassInput = screen.getByPlaceholderText(/re-enter your password/i);

      fireEvent.change(newPassInput, { target: { value: "SuperSecurePass123!" } });
      fireEvent.change(confirmPassInput, {
        target: { value: "SuperSecurePass123!" },
      });

      const submitButton = screen.getByRole("button", {
        name: /reset password/i,
      });
      fireEvent.click(submitButton);

      expect(
        await screen.findByRole("heading", { name: /password reset successful/i })
      ).toBeInTheDocument();

      const continueLink = screen.getByRole("link", {
        name: /continue to login/i,
      });
      expect(continueLink).toBeInTheDocument();
      expect(continueLink).toHaveAttribute("href", "/login");
    });
  });
});
