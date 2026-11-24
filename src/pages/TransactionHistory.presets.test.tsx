import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MemoryRouter,
  __clearNavigateCalls,
  __getMockSearch,
} from "react-router-dom";
import { TransactionHistory } from "./TransactionHistory";
import { NotificationProvider } from "../context/NotificationContext";
import { renderWithCredit } from "../test/renderWithCredit";
import { TRANSACTION_PRESETS_STORAGE_KEY } from "../constants/storageKeys";
import { BUILTIN_TRANSACTION_PRESETS } from "../lib/transaction-presets";

vi.mock("../services/horizonStream", () => ({
  subscribeToAccount: vi.fn(() => () => undefined),
}));

vi.mock("../config/creditNetwork", () => ({
  getCreditNetworkConfig: vi.fn().mockReturnValue({
    network: "TESTNET",
    horizonUrl: "https://horizon-testnet.stellar.org",
    sorobanRpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test Stellar Network ; February 2015",
    creditContractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
  }),
  ConfigError: class ConfigError extends Error {},
}));

const renderPage = async () => {
  const result = renderWithCredit(
    <NotificationProvider>
      <MemoryRouter initialEntries={["/transactions"]}>
        <TransactionHistory />
      </MemoryRouter>
    </NotificationProvider>,
    { withRouter: false },
  );
  await screen.findByRole("table", { name: /transaction history/i });
  return result;
};

const search = () => __getMockSearch();

const presetSelect = () =>
  screen.getByLabelText("Saved presets") as HTMLSelectElement;

const typeButton = (name: string) =>
  within(screen.getByRole("group", { name: /type/i })).getByRole("button", {
    name,
  });

describe("TransactionHistory saved presets", () => {
  beforeEach(() => {
    window.localStorage.clear();
    __clearNavigateCalls();
  });

  it("lists the built-in overdue fees preset", async () => {
    await renderPage();

    expect(
      within(presetSelect()).getByRole("option", {
        name: /my overdue fees/i,
      }),
    ).toBeInTheDocument();
  });

  it("applies a preset, resets the page, updates the URL, and announces it", async () => {
    await renderPage();

    fireEvent.change(presetSelect(), {
      target: { value: BUILTIN_TRANSACTION_PRESETS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply preset" }));

    expect(typeButton("Fee")).toHaveAttribute("aria-pressed", "true");
    expect(search()).toContain("type=Fee");
    expect(search()).toContain("status=Pending");
    expect(search()).not.toContain("page=");

    expect(
      await screen.findByText(/Preset applied: My overdue fees/i),
    ).toBeInTheDocument();
  });

  it("saves the active filters, reloads, and re-applies them", async () => {
    const first = await renderPage();

    fireEvent.click(typeButton("Fee"));
    fireEvent.change(screen.getByLabelText("Preset name"), {
      target: { value: "Fees only" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save current" }));

    expect(
      within(presetSelect()).getByRole("option", { name: /fees only/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Preset saved: Fees only/i)).toBeInTheDocument();

    first.unmount();

    await renderPage();
    const reloaded = presetSelect();
    const savedOption = within(reloaded).getByRole("option", {
      name: /fees only/i,
    }) as HTMLOptionElement;

    fireEvent.change(reloaded, { target: { value: savedOption.value } });
    fireEvent.click(screen.getByRole("button", { name: "Apply preset" }));

    expect(typeButton("Fee")).toHaveAttribute("aria-pressed", "true");
    expect(search()).toContain("type=Fee");
  });

  it("deletes user presets but never built-ins", async () => {
    await renderPage();

    fireEvent.change(screen.getByLabelText("Preset name"), {
      target: { value: "Fees only" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save current" }));

    const savedOption = within(presetSelect()).getByRole("option", {
      name: /fees only/i,
    }) as HTMLOptionElement;
    fireEvent.change(presetSelect(), { target: { value: savedOption.value } });
    fireEvent.click(screen.getByRole("button", { name: "Delete preset" }));

    expect(
      within(presetSelect()).queryByRole("option", { name: /fees only/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Preset deleted: Fees only/i)).toBeInTheDocument();

    fireEvent.change(presetSelect(), {
      target: { value: BUILTIN_TRANSACTION_PRESETS[0].id },
    });
    expect(
      screen.getByRole("button", { name: "Delete preset" }),
    ).toBeDisabled();
  });

  it("ignores corrupt preset storage without crashing", async () => {
    window.localStorage.setItem(TRANSACTION_PRESETS_STORAGE_KEY, "{broken");

    await renderPage();

    expect(
      within(presetSelect()).getByRole("option", {
        name: /my overdue fees/i,
      }),
    ).toBeInTheDocument();
  });
});
