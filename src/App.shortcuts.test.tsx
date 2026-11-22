/**
 * App-level integration tests — cooperative `?` shortcut (#1173).
 *
 * Contract: on /draw-credit the draw wizard owns `?`. Its capture-phase
 * document handler consumes the key (preventDefault + stopPropagation) so
 * App's global ShortcutHelpOverlay can never open alongside a wizard dialog.
 * Everywhere else, `?` still opens the global shortcut help.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App";

beforeEach(() => {
  localStorage.clear();
  // Skip the first-draw primer banner so the wizard starts on a clean page.
  localStorage.setItem("creditra.default_risk_ack", "true");
  window.history.pushState({}, "", "/draw-credit");
});

async function renderDrawWizard() {
  render(<App />);
  // /draw-credit is code-split; wait for the wizard before interacting.
  await screen.findByRole("button", {
    name: /select business line of credit/i,
  });
}

describe("cooperative ? shortcut (#1173)", () => {
  it("opens only the wizard help on /draw-credit — never both overlays", async () => {
    await renderDrawWizard();

    fireEvent.keyDown(document.body, { key: "?", code: "Slash" });

    const dialogs = screen.getAllByRole("dialog");
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0]).toHaveAccessibleName(/help center/i);
    expect(
      screen.queryByRole("dialog", { name: /move around faster/i }),
    ).not.toBeInTheDocument();
  });

  it("pressing ? again while the wizard help is open keeps a single dialog", async () => {
    await renderDrawWizard();

    fireEvent.keyDown(document.body, { key: "?", code: "Slash" });
    fireEvent.keyDown(document.body, { key: "?", code: "Slash" });

    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("still opens the global shortcut help on other routes", () => {
    window.history.pushState({}, "", "/");
    render(<App />);

    fireEvent.keyDown(document.body, { key: "?", code: "Slash" });

    expect(
      screen.getByRole("dialog", { name: /move around faster/i }),
    ).toBeInTheDocument();
  });

  it("does not stack a second dialog on top of the risk primer modal", async () => {
    localStorage.removeItem("creditra.default_risk_ack");
    await renderDrawWizard();

    // WhyApr has no UI trigger in the current build, so the reachable
    // DefaultRiskModal stands in as the "another dialog already open" case.
    fireEvent.click(
      screen.getByRole("button", { name: /learn about default risk/i }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: "?", code: "Slash" });

    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(
      screen.getByRole("heading", { name: /what is a default/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: /help center/i }),
    ).not.toBeInTheDocument();
  });

  it("typing ? into the amount input does not open any overlay", async () => {
    const user = userEvent.setup({ delay: null });
    await renderDrawWizard();
    await user.click(
      screen.getByRole("button", { name: /select business line of credit/i }),
    );

    const input = await screen.findByRole("spinbutton");
    await user.click(input);
    await user.keyboard("?");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /enter amount/i }),
    ).toBeInTheDocument();
    expect(input).toHaveFocus();
  });

  it("Escape closes the wizard help and returns focus to its trigger", async () => {
    await renderDrawWizard();

    fireEvent.keyDown(document.body, { key: "?", code: "Slash" });
    expect(
      screen.getByRole("dialog", { name: /help center/i }),
    ).toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /contact support/i }),
    ).toHaveFocus();
  });
});
