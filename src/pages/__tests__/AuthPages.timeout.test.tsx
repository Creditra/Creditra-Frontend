import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RegisterPage } from "../RegisterPage";
import { ForgotPasswordPage } from "../ForgotPasswordPage";
import { ResetPasswordPage } from "../ResetPasswordPage";
import { FetchTimeoutError } from "../../utils/fetchWithTimeout";
import * as fetchWithTimeoutModule from "../../utils/fetchWithTimeout";

describe("Auth pages — timeout and unmount cancellation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("RegisterPage shows timeout error and re-enables submit button", async () => {
    vi.spyOn(fetchWithTimeoutModule, "fetchWithTimeout").mockRejectedValueOnce(
      new FetchTimeoutError(15000),
    );

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    fireEvent.change(document.getElementById("email")!, {
      target: { value: "new@example.com" },
    });
    fireEvent.change(document.getElementById("password")!, {
      target: { value: "Password123" },
    });
    fireEvent.change(document.getElementById("confirmPassword")!, {
      target: { value: "Password123" },
    });
    fireEvent.click(screen.getByRole("checkbox"));

    const form = document.querySelector("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.getByText(/request timed out\. please try again\./i),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: /create account/i }),
    ).not.toBeDisabled();
  });

  it("ForgotPasswordPage shows timeout error and re-enables submit button", async () => {
    vi.spyOn(fetchWithTimeoutModule, "fetchWithTimeout").mockRejectedValueOnce(
      new FetchTimeoutError(15000),
    );

    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );

    fireEvent.change(document.getElementById("email")!, {
      target: { value: "user@example.com" },
    });

    const form = document.querySelector("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.getByText(/request timed out\. please try again\./i),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: /send reset link/i }),
    ).not.toBeDisabled();
  });

  it("ResetPasswordPage shows timeout error and re-enables submit button", async () => {
    vi.spyOn(fetchWithTimeoutModule, "fetchWithTimeout").mockRejectedValueOnce(
      new FetchTimeoutError(15000),
    );

    render(
      <MemoryRouter initialEntries={["/reset-password?token=valid-token"]}>
        <ResetPasswordPage />
      </MemoryRouter>,
    );

    fireEvent.change(document.getElementById("newPassword")!, {
      target: { value: "Password123" },
    });
    fireEvent.change(document.getElementById("confirmPassword")!, {
      target: { value: "Password123" },
    });

    const form = document.querySelector("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.getByText(/request timed out\. please try again\./i),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: /reset password/i }),
    ).not.toBeDisabled();
  });
});
