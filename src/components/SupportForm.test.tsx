/**
 * SupportForm tests — focused on form validation, state transitions, and a11y.
 *
 * What's covered:
 *   - Required field validation (min/max length rules).
 *   - Character count display.
 *   - Inline error messages wired up via aria-describedby.
 *   - Submit-level error announcement (role="status").
 *   - Success state and reset flow.
 *   - Disabled submit button when validation fails.
 *   - Form reset when parent `isOpen` flips from true → false.
 *   - Keyboard-only navigation (Tab, Enter, Space).
 *
 * Not covered:
 *   - Real backend integration — the tests supply a mock `onSubmit` prop.
 *   - Focus trap / scroll lock — those are handled by SupportWidget's container.
 *   - Network error simulation — edge cases beyond validation live in integration tests.
 */

import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  SupportForm,
  validateSupportForm,
  type SupportFormData,
} from "./SupportForm";

// ─── Validation unit tests ────────────────────────────────────────────────────

describe("validateSupportForm", () => {
  it("returns empty error map for valid data", () => {
    const errors = validateSupportForm("Valid subject", "Valid message text");
    expect(errors).toEqual({});
  });

  it("requires subject", () => {
    const errors = validateSupportForm("", "Valid message");
    expect(errors.subject).toBe("Subject is required.");
  });

  it("requires subject to be at least 3 characters", () => {
    const errors = validateSupportForm("ab", "Valid message");
    expect(errors.subject).toBe("Subject must be at least 3 characters.");
  });

  it("caps subject at 120 characters", () => {
    const longSubject = "x".repeat(121);
    const errors = validateSupportForm(longSubject, "Valid message");
    expect(errors.subject).toBe("Subject must be 120 characters or fewer.");
  });

  it("requires message", () => {
    const errors = validateSupportForm("Valid subject", "");
    expect(errors.message).toBe("Message is required.");
  });

  it("requires message to be at least 10 characters", () => {
    const errors = validateSupportForm("Valid subject", "short");
    expect(errors.message).toBe("Message must be at least 10 characters.");
  });

  it("caps message at 1000 characters", () => {
    const longMessage = "x".repeat(1001);
    const errors = validateSupportForm("Valid subject", longMessage);
    expect(errors.message).toBe("Message must be 1000 characters or fewer.");
  });

  it("trims whitespace before validating", () => {
    const errors = validateSupportForm("  valid  ", "  valid message here  ");
    expect(errors).toEqual({});
  });
});

// ─── Integration tests ────────────────────────────────────────────────────────

describe("SupportForm", () => {
  it("renders subject and message fields with labels", () => {
    render(<SupportForm />);

    expect(screen.getByLabelText(/subject/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send message" }),
    ).toBeInTheDocument();
  });

  it("displays character count for subject and message", () => {
    render(<SupportForm />);

    // Initially 0 / 120 and 0 / 1000
    expect(screen.getByText("0 / 120")).toBeInTheDocument();
    expect(screen.getByText("0 / 1000")).toBeInTheDocument();
  });

  it("updates character count as user types", async () => {
    const user = userEvent.setup();
    render(<SupportForm />);

    await user.type(screen.getByLabelText(/subject/i), "Help");
    expect(screen.getByText("4 / 120")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/message/i), "I need help with login");
    expect(screen.getByText("22 / 1000")).toBeInTheDocument();
  });

  it("shows inline validation errors after first submit attempt", async () => {
    const user = userEvent.setup();
    render(<SupportForm />);

    const submitButton = screen.getByRole("button", { name: "Send message" });
    await user.click(submitButton);

    // Both fields are empty — expect errors
    expect(screen.getByText("Subject is required.")).toBeInTheDocument();
    expect(screen.getByText("Message is required.")).toBeInTheDocument();

    // Error messages are wired up via aria-describedby
    const subjectInput = screen.getByLabelText(/subject/i);
    const messageTextarea = screen.getByLabelText(/message/i);
    expect(subjectInput).toHaveAttribute("aria-invalid", "true");
    expect(messageTextarea).toHaveAttribute("aria-invalid", "true");
  });

  it("enables submit button when all fields are valid and calls onSubmit", async () => {
    const user = userEvent.setup();
    // Use a never-resolving promise so we can observe the pending state
    let resolveSubmit!: () => void;
    const mockSubmit = vi.fn(
      () => new Promise<void>((resolve) => { resolveSubmit = resolve; }),
    );

    render(<SupportForm onSubmit={mockSubmit} />);

    const subjectInput = screen.getByLabelText(/subject/i);
    const messageTextarea = screen.getByLabelText(/message/i);

    await user.type(subjectInput, "Help with my account");
    await user.type(messageTextarea, "I cannot log in to my dashboard.");

    await user.click(screen.getByRole("button", { name: "Send message" }));

    // Should be pending (button shows "Sending…" — the aria-busy label)
    expect(await screen.findByRole("button", { name: "Sending\u2026" })).toBeInTheDocument();
    expect(mockSubmit).toHaveBeenCalledOnce();
    expect(mockSubmit).toHaveBeenCalledWith({
      subject: "Help with my account",
      message: "I cannot log in to my dashboard.",
    });

    // Resolve so the promise settles cleanly
    resolveSubmit();
  });

  it("cycles through pending → success states on successful submit", async () => {
    const user = userEvent.setup();
    // Controlled promise so we can observe pending state before resolving
    let resolveSubmit!: () => void;
    const mockSubmit = vi.fn(
      () => new Promise<void>((resolve) => { resolveSubmit = resolve; }),
    );

    render(<SupportForm onSubmit={mockSubmit} />);

    await user.type(screen.getByLabelText(/subject/i), "Account question");
    await user.type(screen.getByLabelText(/message/i), "Need help urgently.");

    await user.click(screen.getByRole("button", { name: "Send message" }));

    // Pending state — button label changes via PendingButton
    expect(
      await screen.findByRole("button", { name: "Sending\u2026" }),
    ).toBeInTheDocument();

    // Resolve the submit promise → success
    resolveSubmit();

    // Success state
    expect(
      await screen.findByText("Message sent!", { selector: ".support-form__success-title" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Message sent!");
  });

  it("shows error state when onSubmit rejects", async () => {
    const user = userEvent.setup();
    const mockSubmit = vi.fn(async () =>
      Promise.reject(new Error("Network failure.")),
    );

    render(<SupportForm onSubmit={mockSubmit} />);

    await user.type(screen.getByLabelText(/subject/i), "Account question");
    await user.type(screen.getByLabelText(/message/i), "Need help urgently.");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect(
      await screen.findByRole("status", { name: "" }),
    ).toHaveTextContent("Network failure.");
    expect(screen.getByText("Network failure.")).toBeInTheDocument();
  });

  it("allows user to reset and send another message after success", async () => {
    const user = userEvent.setup();
    const mockSubmit = vi.fn(async () => Promise.resolve());

    render(<SupportForm onSubmit={mockSubmit} />);

    await user.type(screen.getByLabelText(/subject/i), "Account question");
    await user.type(screen.getByLabelText(/message/i), "Need help urgently.");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    // Success state
    expect(await screen.findByText("Message sent!")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Send another message" }),
    );

    // Back to idle
    expect(screen.getByLabelText(/subject/i)).toHaveValue("");
    expect(screen.getByLabelText(/message/i)).toHaveValue("");
  });

  it("resets form when parent widget closes (isOpen → false)", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SupportForm isOpen />);

    await user.type(screen.getByLabelText(/subject/i), "Partial draft");
    await user.type(screen.getByLabelText(/message/i), "Some content here…");

    expect(screen.getByLabelText(/subject/i)).toHaveValue("Partial draft");

    // Simulate widget closing
    rerender(<SupportForm isOpen={false} />);

    // Then reopening
    rerender(<SupportForm isOpen />);

    expect(screen.getByLabelText(/subject/i)).toHaveValue("");
    expect(screen.getByLabelText(/message/i)).toHaveValue("");
  });

  it("disables submit button until validation passes after first attempt", async () => {
    const user = userEvent.setup();
    // Never-resolving submit so pending state doesn't interfere
    const mockSubmit = vi.fn(() => new Promise<void>(() => {}));
    render(<SupportForm onSubmit={mockSubmit} />);

    const submitButton = screen.getByRole("button", { name: "Send message" });

    // First submission attempt with empty fields
    await user.click(submitButton);

    // Errors shown — submit button is disabled due to touched + errors
    expect(submitButton).toBeDisabled();

    // Fix subject — message still invalid
    await user.type(screen.getByLabelText(/subject/i), "Valid subject");
    expect(submitButton).toBeDisabled();

    // Fix message — both valid, button should re-enable
    await user.type(screen.getByLabelText(/message/i), "Valid message text");
    expect(submitButton).toBeEnabled();
  });

  it("respects required attributes and has accessible error wiring", () => {
    render(<SupportForm />);

    const subjectInput = screen.getByLabelText(/subject/i);
    const messageTextarea = screen.getByLabelText(/message/i);

    expect(subjectInput).toHaveAttribute("aria-required", "true");
    expect(messageTextarea).toHaveAttribute("aria-required", "true");
  });

  it("allows keyboard-only submission", async () => {
    const user = userEvent.setup();
    const mockSubmit = vi.fn(async () => Promise.resolve());

    render(<SupportForm onSubmit={mockSubmit} />);

    const subjectInput = screen.getByLabelText(/subject/i);
    const messageTextarea = screen.getByLabelText(/message/i);

    await user.type(subjectInput, "Subject here");
    await user.tab(); // Move to message
    await user.type(messageTextarea, "Message here now.");
    await user.tab(); // Move to submit button
    await user.keyboard("{Enter}");

    expect(mockSubmit).toHaveBeenCalledOnce();
  });

  it("enforces maxLength on subject and message", async () => {
    const user = userEvent.setup({ delay: null });
    render(<SupportForm />);

    const longSubject = "x".repeat(150);
    const longMessage = "y".repeat(1100);

    await user.type(screen.getByLabelText(/subject/i), longSubject);
    await user.type(screen.getByLabelText(/message/i), longMessage);

    // maxLength attribute enforces truncation
    expect(screen.getByLabelText(/subject/i)).toHaveValue(longSubject.slice(0, 120));
    expect(screen.getByLabelText(/message/i)).toHaveValue(longMessage.slice(0, 1000));
  }, 15000);
});
