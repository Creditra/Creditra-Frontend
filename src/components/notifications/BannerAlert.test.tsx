// src/components/notifications/BannerAlert.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import { BannerAlerts } from "./BannerAlert";
import { useNotifications } from "../../context/NotificationContext";
import { TYPE_COLOR, TYPE_ICON, CATEGORY_ICON } from "./notificationIcons";
import type { BannerAlert, NotificationType } from "../../types/notification";

vi.mock("../../context/NotificationContext", () => ({
  useNotifications: vi.fn(),
}));

describe("BannerAlert and notificationIcons (#1102)", () => {
  const mockDismissBanner = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupBanners = (banners: BannerAlert[]) => {
    vi.mocked(useNotifications).mockReturnValue({
      banners,
      dismissBanner: mockDismissBanner,
      toasts: [],
      addToast: vi.fn(),
      dismissToast: vi.fn(),
      addBanner: vi.fn(),
      notifications: [],
      unreadCount: 0,
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      undoRead: vi.fn(),
      clearAll: vi.fn(),
      restoreNotifications: vi.fn(),
      filterByCategory: vi.fn(),
      preferences: {} as any,
      updatePreferences: vi.fn(),
      isPanelOpen: false,
      openPanel: vi.fn(),
      closePanel: vi.fn(),
    });
  };

  it("renders nothing when banners array is empty", () => {
    setupBanners([]);
    const { container } = render(<BannerAlerts />);
    expect(container).toBeEmptyDOMElement();
  });

  describe("Role mapping by severity", () => {
    it("maps 'error' severity to role='alert'", () => {
      setupBanners([
        {
          id: "b-error",
          type: "error",
          message: "Critical payment failure",
        },
      ]);
      render(<BannerAlerts />);

      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent("Critical payment failure");
    });

    it("maps 'warning' severity to role='alert'", () => {
      setupBanners([
        {
          id: "b-warn",
          type: "warning",
          message: "Approaching credit limit",
        },
      ]);
      render(<BannerAlerts />);

      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent("Approaching credit limit");
    });

    it("maps 'danger' severity to role='alert'", () => {
      setupBanners([
        {
          id: "b-danger",
          type: "danger",
          message: "Immediate action required",
        },
      ]);
      render(<BannerAlerts />);

      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent("Immediate action required");
    });

    it("maps 'info' severity to role='status'", () => {
      setupBanners([
        {
          id: "b-info",
          type: "info",
          message: "Scheduled maintenance tonight",
        },
      ]);
      render(<BannerAlerts />);

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      const status = screen.getByRole("status");
      expect(status).toBeInTheDocument();
      expect(status).toHaveTextContent("Scheduled maintenance tonight");
    });

    it("maps 'success' severity to role='status'", () => {
      setupBanners([
        {
          id: "b-success",
          type: "success",
          message: "Repayment completed successfully",
        },
      ]);
      render(<BannerAlerts />);

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      const status = screen.getByRole("status");
      expect(status).toBeInTheDocument();
      expect(status).toHaveTextContent("Repayment completed successfully");
    });
  });

  describe("Icon rendering and accessibility", () => {
    const severities: NotificationType[] = ["success", "info", "warning", "error", "danger"];

    severities.forEach((type) => {
      it(`renders the correct icon and aria-hidden for ${type}`, () => {
        setupBanners([
          {
            id: `b-${type}`,
            type,
            message: `Message for ${type}`,
          },
        ]);
        const { container } = render(<BannerAlerts />);

        const iconWrapper = container.querySelector(".banner-icon");
        expect(iconWrapper).toBeInTheDocument();
        expect(iconWrapper).toHaveAttribute("aria-hidden", "true");

        const svg = iconWrapper?.querySelector("svg");
        expect(svg).toBeInTheDocument();
        expect(svg).toHaveAttribute("aria-hidden", "true");
      });
    });
  });

  describe("Dismiss handler and actions", () => {
    it("calls dismissBanner with banner id when dismiss button is clicked", () => {
      setupBanners([
        {
          id: "banner-123",
          type: "warning",
          message: "Dismiss me",
          dismissible: true,
        },
      ]);
      render(<BannerAlerts />);

      const closeButton = screen.getByRole("button", { name: /dismiss alert/i });
      fireEvent.click(closeButton);

      expect(mockDismissBanner).toHaveBeenCalledTimes(1);
      expect(mockDismissBanner).toHaveBeenCalledWith("banner-123");
    });

    it("does not render dismiss button when dismissible is false", () => {
      setupBanners([
        {
          id: "banner-fixed",
          type: "error",
          message: "Non-dismissible notice",
          dismissible: false,
        },
      ]);
      render(<BannerAlerts />);

      expect(
        screen.queryByRole("button", { name: /dismiss alert/i })
      ).not.toBeInTheDocument();
    });

    it("renders custom action and invokes action.onClick when clicked", () => {
      const mockActionClick = vi.fn();
      setupBanners([
        {
          id: "banner-action",
          type: "info",
          message: "Actionable alert",
          action: {
            label: "Review Now",
            onClick: mockActionClick,
          },
        },
      ]);
      render(<BannerAlerts />);

      const actionButton = screen.getByRole("button", { name: /review now/i });
      expect(actionButton).toBeInTheDocument();

      fireEvent.click(actionButton);
      expect(mockActionClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("notificationIcons unit checks", () => {
    it("provides TYPE_COLOR definitions for every notification severity", () => {
      const severities: NotificationType[] = ["success", "info", "warning", "error", "danger"];
      severities.forEach((type) => {
        const color = TYPE_COLOR[type];
        expect(color).toBeDefined();
        expect(color.bg).toBeTypeOf("string");
        expect(color.border).toBeTypeOf("string");
        expect(color.icon).toBeTypeOf("string");
        expect(color.text).toBeTypeOf("string");
      });
    });

    it("provides TYPE_ICON elements for every notification severity", () => {
      const severities: NotificationType[] = ["success", "info", "warning", "error", "danger"];
      severities.forEach((type) => {
        expect(TYPE_ICON[type]).toBeDefined();
      });
    });

    it("provides CATEGORY_ICON symbols for notification categories", () => {
      expect(CATEGORY_ICON.transaction).toBe("↗");
      expect(CATEGORY_ICON.credit_line).toBe("💳");
      expect(CATEGORY_ICON.risk_score).toBe("🛡");
      expect(CATEGORY_ICON.rate_change).toBe("📈");
      expect(CATEGORY_ICON.system).toBe("⚙");
    });
  });
});
