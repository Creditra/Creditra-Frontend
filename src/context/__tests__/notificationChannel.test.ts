import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NotificationProvider,
  useNotifications,
} from "../NotificationContext";
import { createSseChannel } from "../notificationChannel";
import type { Notification } from "../../types/notification";

class FakeEventSource extends EventTarget {
  static instances: FakeEventSource[] = [];

  readonly url: string;
  closed = false;

  constructor(url: string) {
    super();
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  open() {
    this.dispatchEvent(new Event("open"));
  }

  fail() {
    this.dispatchEvent(new Event("error"));
  }

  send(data: string) {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
}

function makeNotification(
  id: string,
  timestamp = "2026-11-24T09:00:00.000Z",
  category: Notification["category"] = "system",
): Notification {
  return {
    id,
    type: "info",
    category,
    title: `Title ${id}`,
    message: `Message ${id}`,
    timestamp,
    read: false,
  };
}

function ContextHarness() {
  const { notifications, notificationChannelStatus, updatePreferences } =
    useNotifications();
  return (
    <>
      <span data-testid="channel-status">{notificationChannelStatus}</span>
      <span data-testid="inbox">
        {notifications.map((notification) => notification.id).join(",")}
      </span>
      <button
        onClick={() => updatePreferences({ transaction: false })}
        type="button"
      >
        Mute transactions
      </button>
    </>
  );
}

describe("notificationChannel", () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("ignores malformed JSON and payloads and delivers valid notifications", () => {
    const onNotification = vi.fn();
    const channel = createSseChannel({
      url: "/notifications",
      onNotification,
      onStatus: vi.fn(),
      EventSource: FakeEventSource,
    });
    const source = FakeEventSource.instances[0];

    source.send("{");
    source.send(JSON.stringify({ id: "incomplete" }));
    source.send(JSON.stringify(makeNotification("valid")));

    expect(onNotification).toHaveBeenCalledTimes(1);
    expect(onNotification).toHaveBeenCalledWith(makeNotification("valid"));
    channel.close();
  });

  it("backs off after errors and resets the delay after a successful open", () => {
    vi.useFakeTimers();
    const statuses: string[] = [];
    const channel = createSseChannel({
      url: "/notifications",
      onNotification: vi.fn(),
      onStatus: (status) => statuses.push(status),
      EventSource: FakeEventSource,
      backoff: {
        initialDelayMs: 100,
        maxDelayMs: 300,
        jitterRatio: 0,
      },
    });
    const first = FakeEventSource.instances[0];
    first.fail();
    expect(first.closed).toBe(true);

    vi.advanceTimersByTime(100);
    const second = FakeEventSource.instances[1];
    second.fail();
    vi.advanceTimersByTime(199);
    expect(FakeEventSource.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    const third = FakeEventSource.instances[2];

    third.fail();
    vi.advanceTimersByTime(299);
    expect(FakeEventSource.instances).toHaveLength(3);
    vi.advanceTimersByTime(1);
    const fourth = FakeEventSource.instances[3];

    fourth.open();
    expect(statuses[statuses.length - 1]).toBe("open");
    fourth.fail();
    vi.advanceTimersByTime(99);
    expect(FakeEventSource.instances).toHaveLength(4);
    vi.advanceTimersByTime(1);
    expect(FakeEventSource.instances).toHaveLength(5);
    channel.close();
  });

  it("cancels a pending retry when the channel closes", () => {
    vi.useFakeTimers();
    const statuses: string[] = [];
    const channel = createSseChannel({
      url: "/notifications",
      onNotification: vi.fn(),
      onStatus: (status) => statuses.push(status),
      EventSource: FakeEventSource,
      backoff: { initialDelayMs: 100, jitterRatio: 0 },
    });

    FakeEventSource.instances[0].fail();
    channel.close();
    vi.advanceTimersByTime(1_000);

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(statuses[statuses.length - 1]).toBe("off");
  });

  it("cancels a pending retry when the provider unmounts", () => {
    vi.useFakeTimers();
    vi.stubEnv("VITE_NOTIFICATIONS_SSE_URL", "/notifications");
    vi.stubGlobal("EventSource", FakeEventSource);
    const { unmount } = render(
      <NotificationProvider>
        <ContextHarness />
      </NotificationProvider>,
    );

    act(() => FakeEventSource.instances[0].fail());
    unmount();
    vi.advanceTimersByTime(1_000);

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].closed).toBe(true);
  });

  it("is inert without a URL", () => {
    const onStatus = vi.fn();
    createSseChannel({
      url: "",
      onNotification: vi.fn(),
      onStatus,
      EventSource: FakeEventSource,
    });

    expect(FakeEventSource.instances).toHaveLength(0);
    expect(onStatus).toHaveBeenCalledWith("off");
  });

  it("deduplicates replayed ids, respects preferences, and caps the inbox", () => {
    vi.stubEnv("VITE_NOTIFICATIONS_SSE_URL", "/notifications");
    vi.stubGlobal("EventSource", FakeEventSource);
    render(
      <NotificationProvider>
        <ContextHarness />
      </NotificationProvider>,
    );

    const source = FakeEventSource.instances[0];
    act(() => source.open());
    expect(screen.getByTestId("channel-status").textContent).toBe("open");

    const replay = makeNotification("replayed");
    act(() => {
      source.send(JSON.stringify(replay));
      source.send(
        JSON.stringify({
          ...replay,
          title: "Replayed title",
          timestamp: "2026-11-24T09:01:00.000Z",
        }),
      );
    });
    expect(screen.getByTestId("inbox").textContent).toBe("replayed");

    act(() => screen.getByRole("button", { name: "Mute transactions" }).click());
    act(() => {
      source.send(JSON.stringify(makeNotification("muted", undefined, "transaction")));
      for (let index = 0; index < 101; index += 1) {
        source.send(
          JSON.stringify(
            makeNotification(
              `system-${index}`,
              new Date(1_800_000_000_000 + index * 1_000).toISOString(),
            ),
          ),
        );
      }
    });

    const inboxIds = screen.getByTestId("inbox").textContent?.split(",") ?? [];
    expect(inboxIds).toHaveLength(100);
    expect(inboxIds).not.toContain("muted");
    expect(inboxIds).toContain("system-100");
    expect(inboxIds).not.toContain("system-0");
  });
});
