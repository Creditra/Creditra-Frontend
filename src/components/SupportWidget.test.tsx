import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { SupportWidget } from "./SupportWidget";

import { submitSupportRequest } from "../services/support";

vi.mock("../services/support", () => ({
  submitSupportRequest: vi.fn().mockResolvedValue({ success: true }),
}));

let capturedSupportFormProps: any = null;

// SupportForm's onSubmit defaults to a setTimeout — mock to avoid leaking timers
vi.mock("./SupportForm", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./SupportForm")>();
  return {
    ...mod,
    SupportForm: (
      props: React.ComponentProps<typeof mod.SupportForm>,
    ) => {
      capturedSupportFormProps = props;
      return (
        <mod.SupportForm
          {...props}
          onSubmit={props.onSubmit ?? (async () => {})}
        />
      );
    },
  };
});

function renderWidget() {
  return render(
    <MemoryRouter>
      <SupportWidget />
    </MemoryRouter>,
  );
}

describe("SupportWidget", () => {
  describe("trigger button", () => {
    it("renders the trigger button with aria-expanded=false", () => {
      renderWidget();
      const trigger = screen.getByRole("button", { name: "Support" });
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });

    it("opens the panel on click", async () => {
      const user = userEvent.setup();
      renderWidget();

      await user.click(screen.getByRole("button", { name: "Support" }));

      expect(
        screen.getByRole("dialog", { name: "Support" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Support" }),
      ).toHaveAttribute("aria-expanded", "true");
    });

    it("closes the panel on a second click", async () => {
      const user = userEvent.setup();
      renderWidget();

      const trigger = screen.getByRole("button", { name: "Support" });
      await user.click(trigger);
      await user.click(trigger);

      expect(
        screen.queryByRole("dialog", { name: "Support" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("FAQ tab (default)", () => {
    it("shows FAQ tab as active by default", async () => {
      const user = userEvent.setup();
      renderWidget();
      await user.click(screen.getByRole("button", { name: "Support" }));

      const faqTab = screen.getByRole("tab", { name: /faq/i });
      expect(faqTab).toHaveAttribute("aria-selected", "true");
    });

    it("focuses search input when panel opens", async () => {
      const user = userEvent.setup();
      renderWidget();
      await user.click(screen.getByRole("button", { name: "Support" }));

      expect(screen.getByRole("searchbox", { name: "Search FAQ" })).toHaveFocus();
    });

    it("filters FAQs by search query", async () => {
      const user = userEvent.setup();
      renderWidget();
      await user.click(screen.getByRole("button", { name: "Support" }));

      await user.type(screen.getByRole("searchbox", { name: "Search FAQ" }), "wallet");

      expect(
        screen.getByRole("button", { name: "How do I connect a wallet?" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", {
          name: "Where can I review my credit lines?",
        }),
      ).not.toBeInTheDocument();
    });

    it("shows email support link with GrantFox subject", async () => {
      const user = userEvent.setup();
      renderWidget();
      await user.click(screen.getByRole("button", { name: "Support" }));

      expect(screen.getByRole("link", { name: "Email support" })).toHaveAttribute(
        "href",
        "mailto:support@creditra.com?subject=GrantFox%20support%20request",
      );
    });
  });

  describe("Contact tab", () => {
    async function openContactTab() {
      const user = userEvent.setup();
      renderWidget();

      await user.click(screen.getByRole("button", { name: "Support" }));
      await user.click(screen.getByRole("tab", { name: /contact/i }));

      return user;
    }

    it("switches to Contact tab on click", async () => {
      await openContactTab();

      const contactTab = screen.getByRole("tab", { name: /contact/i });
      expect(contactTab).toHaveAttribute("aria-selected", "true");

      const faqTab = screen.getByRole("tab", { name: /faq/i });
      expect(faqTab).toHaveAttribute("aria-selected", "false");
    });

    it("shows the support form on the Contact tab", async () => {
      await openContactTab();

      // Query within the contact tab panel (visible, not hidden)
      expect(screen.getByRole("form", { name: "Contact support" })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Send message" }),
      ).toBeInTheDocument();
    });

    it("passes a real submit handler to SupportForm that calls submitSupportRequest", async () => {
      await openContactTab();
      expect(capturedSupportFormProps?.onSubmit).toBeTypeOf("function");

      await capturedSupportFormProps.onSubmit({
        subject: "Need help",
        message: "Can't connect wallet",
      });

      expect(submitSupportRequest).toHaveBeenCalledWith(
        { subject: "Need help", message: "Can't connect wallet" },
        expect.objectContaining({
          route: "/",
          appVersion: "0.1.0",
        })
      );
    });

    it("can switch back to FAQ tab", async () => {
      const user = await openContactTab();

      await user.click(screen.getByRole("tab", { name: /faq/i }));

      expect(
        screen.getByRole("tab", { name: /faq/i }),
      ).toHaveAttribute("aria-selected", "true");
      expect(
        screen.getByRole("searchbox", { name: "Search FAQ" }),
      ).toBeInTheDocument();
    });
  });

  describe("keyboard behaviour", () => {
    it("closes with Escape", async () => {
      const user = userEvent.setup();
      renderWidget();

      await user.click(screen.getByRole("button", { name: "Support" }));
      expect(
        screen.getByRole("dialog", { name: "Support" }),
      ).toBeInTheDocument();

      await user.keyboard("{Escape}");

      expect(
        screen.queryByRole("dialog", { name: "Support" }),
      ).not.toBeInTheDocument();
    });
  });
});
