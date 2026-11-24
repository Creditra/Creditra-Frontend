import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UpdatePrompt } from "./UpdatePrompt";

const mockSetNeedRefresh = vi.fn();
const mockUpdateServiceWorker = vi.fn();
let mockNeedRefresh = false;

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    needRefresh: [mockNeedRefresh, mockSetNeedRefresh],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: mockUpdateServiceWorker,
  }),
}));

describe("UpdatePrompt", () => {
  beforeEach(() => {
    mockNeedRefresh = false;
    mockSetNeedRefresh.mockReset();
    mockUpdateServiceWorker.mockReset();
  });

  it("renders nothing when needRefresh is false", () => {
    mockNeedRefresh = false;
    const { container } = render(<UpdatePrompt />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText(/new version available/i)).not.toBeInTheDocument();
  });

  it("renders the update banner when needRefresh is true", () => {
    mockNeedRefresh = true;
    render(<UpdatePrompt />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/new version available/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reload/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dismiss/i })).toBeInTheDocument();
  });

  it("calls updateServiceWorker(true) when Reload is clicked", () => {
    mockNeedRefresh = true;
    render(<UpdatePrompt />);
    fireEvent.click(screen.getByRole("button", { name: /reload/i }));
    expect(mockUpdateServiceWorker).toHaveBeenCalledTimes(1);
    expect(mockUpdateServiceWorker).toHaveBeenCalledWith(true);
  });

  it("calls setNeedRefresh(false) when Dismiss is clicked", () => {
    mockNeedRefresh = true;
    render(<UpdatePrompt />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(mockSetNeedRefresh).toHaveBeenCalledTimes(1);
    expect(mockSetNeedRefresh).toHaveBeenCalledWith(false);
  });
});
