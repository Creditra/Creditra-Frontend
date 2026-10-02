// src/pages/RegisterPage.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";
import { RegisterPage } from "./RegisterPage";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importActual) => {
  const actual = await importActual<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("RegisterPage (#1109)", () => {
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
      <MemoryRouter initialEntries={["/register"]}>
        <RegisterPage />
      </MemoryRouter>
    );

  describe("Password strength meter", () => {
    it("does not render the strength meter when password is empty", () => {
      renderPage();

      expect(screen.queryByText(/weak password/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/medium strength/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/strong password/i)).not.toBeInTheDocument();
    });

    it("displays 'Weak password' when typing a simple password", () => {
      renderPage();

      const passwordInput = screen.getByPlaceholderText(/create a strong password/i);
      fireEvent.change(passwordInput, { target: { value: "simple" } });

      expect(screen.getByText("Weak password")).toBeInTheDocument();
    });

    it("displays 'Medium strength' when password meets moderate criteria", () => {
      renderPage();

      const passwordInput = screen.getByPlaceholderText(/create a strong password/i);
      // Length >= 8, uppercase, lowercase, numbers (score = 4 -> medium)
      fireEvent.change(passwordInput, { target: { value: "Medium12" } });

      expect(screen.getByText("Medium strength")).toBeInTheDocument();
    });

    it("displays 'Strong password' when password meets high complexity criteria", () => {
      renderPage();

      const passwordInput = screen.getByPlaceholderText(/create a strong password/i);
      // Length >= 12, uppercase, lowercase, numbers, symbols (score = 6 -> strong)
      fireEvent.change(passwordInput, { target: { value: "SuperSecure123!#" } });

      expect(screen.getByText("Strong password")).toBeInTheDocument();
    });
  });

  describe("Client-side validation", () => {
    it("rejects empty fields without calling fetch", async () => {
      renderPage();

      const submitButton = screen.getByRole("button", { name: /create account/i });
      fireEvent.click(submitButton);

      expect(await screen.findByText(/all fields are required/i)).toBeInTheDocument();
      expect(fetch).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("rejects invalid email formats without calling fetch", async () => {
      renderPage();

      const emailInput = screen.getByPlaceholderText(/you@example\.com/i);
      const passwordInput = screen.getByPlaceholderText(/create a strong password/i);
      const confirmInput = screen.getByPlaceholderText(/re-enter your password/i);
      const termsCheckbox = screen.getByRole("checkbox");

      fireEvent.change(emailInput, { target: { value: "invalid-email" } });
      fireEvent.change(passwordInput, { target: { value: "Password123!" } });
      fireEvent.change(confirmInput, { target: { value: "Password123!" } });
      fireEvent.click(termsCheckbox);

      const submitButton = screen.getByRole("button", { name: /create account/i });
      fireEvent.click(submitButton);

      expect(
        await screen.findByText(/please enter a valid email address/i)
      ).toBeInTheDocument();
      expect(fetch).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("rejects passwords shorter than 8 characters without calling fetch", async () => {
      renderPage();

      const emailInput = screen.getByPlaceholderText(/you@example\.com/i);
      const passwordInput = screen.getByPlaceholderText(/create a strong password/i);
      const confirmInput = screen.getByPlaceholderText(/re-enter your password/i);
      const termsCheckbox = screen.getByRole("checkbox");

      fireEvent.change(emailInput, { target: { value: "user@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "pass1" } });
      fireEvent.change(confirmInput, { target: { value: "pass1" } });
      fireEvent.click(termsCheckbox);

      const submitButton = screen.getByRole("button", { name: /create account/i });
      fireEvent.click(submitButton);

      expect(
        await screen.findByText(/password must be at least 8 characters/i)
      ).toBeInTheDocument();
      expect(fetch).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("blocks submission when passwords do not match and shows error", async () => {
      renderPage();

      const emailInput = screen.getByPlaceholderText(/you@example\.com/i);
      const passwordInput = screen.getByPlaceholderText(/create a strong password/i);
      const confirmInput = screen.getByPlaceholderText(/re-enter your password/i);
      const termsCheckbox = screen.getByRole("checkbox");

      fireEvent.change(emailInput, { target: { value: "user@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "Password123!" } });
      fireEvent.change(confirmInput, { target: { value: "Mismatch987!" } });
      fireEvent.click(termsCheckbox);

      const submitButton = screen.getByRole("button", { name: /create account/i });
      fireEvent.click(submitButton);

      expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
      expect(fetch).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("blocks submission when terms and conditions are not accepted", async () => {
      renderPage();

      const emailInput = screen.getByPlaceholderText(/you@example\.com/i);
      const passwordInput = screen.getByPlaceholderText(/create a strong password/i);
      const confirmInput = screen.getByPlaceholderText(/re-enter your password/i);

      fireEvent.change(emailInput, { target: { value: "user@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "Password123!" } });
      fireEvent.change(confirmInput, { target: { value: "Password123!" } });

      const submitButton = screen.getByRole("button", { name: /create account/i });
      fireEvent.click(submitButton);

      expect(
        await screen.findByText(/you must accept the terms and conditions/i)
      ).toBeInTheDocument();
      expect(fetch).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe("API interaction and server response handling", () => {
    it("submits request body containing strictly email and password", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      renderPage();

      const emailInput = screen.getByPlaceholderText(/you@example\.com/i);
      const passwordInput = screen.getByPlaceholderText(/create a strong password/i);
      const confirmInput = screen.getByPlaceholderText(/re-enter your password/i);
      const termsCheckbox = screen.getByRole("checkbox");

      fireEvent.change(emailInput, { target: { value: "newuser@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "ValidPassword123!" } });
      fireEvent.change(confirmInput, { target: { value: "ValidPassword123!" } });
      fireEvent.click(termsCheckbox);

      const submitButton = screen.getByRole("button", { name: /create account/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledTimes(1);
      });

      expect(fetch).toHaveBeenCalledWith("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "newuser@example.com",
          password: "ValidPassword123!",
        }),
      });

      const parsedBody = JSON.parse(
        vi.mocked(fetch).mock.calls[0][1]?.body as string
      );
      expect(parsedBody).toEqual({
        email: "newuser@example.com",
        password: "ValidPassword123!",
      });
      expect(parsedBody).not.toHaveProperty("confirmPassword");
      expect(parsedBody).not.toHaveProperty("acceptTerms");
    });

    it("displays server error message when registration fails (4xx/5xx)", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "An account with this email already exists" }),
      } as Response);

      renderPage();

      const emailInput = screen.getByPlaceholderText(/you@example\.com/i);
      const passwordInput = screen.getByPlaceholderText(/create a strong password/i);
      const confirmInput = screen.getByPlaceholderText(/re-enter your password/i);
      const termsCheckbox = screen.getByRole("checkbox");

      fireEvent.change(emailInput, { target: { value: "existing@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "ValidPassword123!" } });
      fireEvent.change(confirmInput, { target: { value: "ValidPassword123!" } });
      fireEvent.click(termsCheckbox);

      const submitButton = screen.getByRole("button", { name: /create account/i });
      fireEvent.click(submitButton);

      expect(
        await screen.findByText(/an account with this email already exists/i)
      ).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("displays default error message when server responds with failure without message", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      } as Response);

      renderPage();

      const emailInput = screen.getByPlaceholderText(/you@example\.com/i);
      const passwordInput = screen.getByPlaceholderText(/create a strong password/i);
      const confirmInput = screen.getByPlaceholderText(/re-enter your password/i);
      const termsCheckbox = screen.getByRole("checkbox");

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "ValidPassword123!" } });
      fireEvent.change(confirmInput, { target: { value: "ValidPassword123!" } });
      fireEvent.click(termsCheckbox);

      const submitButton = screen.getByRole("button", { name: /create account/i });
      fireEvent.click(submitButton);

      expect(await screen.findByText(/registration failed/i)).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("displays generic error message when network request fails", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Network error"));

      renderPage();

      const emailInput = screen.getByPlaceholderText(/you@example\.com/i);
      const passwordInput = screen.getByPlaceholderText(/create a strong password/i);
      const confirmInput = screen.getByPlaceholderText(/re-enter your password/i);
      const termsCheckbox = screen.getByRole("checkbox");

      fireEvent.change(emailInput, { target: { value: "network@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "ValidPassword123!" } });
      fireEvent.change(confirmInput, { target: { value: "ValidPassword123!" } });
      fireEvent.click(termsCheckbox);

      const submitButton = screen.getByRole("button", { name: /create account/i });
      fireEvent.click(submitButton);

      expect(
        await screen.findByText(/an error occurred\. please try again/i)
      ).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("successfully navigates to /login?registered=true on valid registration", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      renderPage();

      const emailInput = screen.getByPlaceholderText(/you@example\.com/i);
      const passwordInput = screen.getByPlaceholderText(/create a strong password/i);
      const confirmInput = screen.getByPlaceholderText(/re-enter your password/i);
      const termsCheckbox = screen.getByRole("checkbox");

      fireEvent.change(emailInput, { target: { value: "success@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "ValidPassword123!" } });
      fireEvent.change(confirmInput, { target: { value: "ValidPassword123!" } });
      fireEvent.click(termsCheckbox);

      const submitButton = screen.getByRole("button", { name: /create account/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/login?registered=true");
      });
    });
  });
});
