/**
 * Tests for the notification store — add, remove, auto-dismiss.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useNotificationStore } from "@/store/notificationStore";

beforeEach(() => {
  useNotificationStore.setState({ notifications: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("NotificationStore", () => {
  it("starts with an empty list", () => {
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });

  it("adds a notification", () => {
    useNotificationStore.getState().addNotification("hello", "info");
    const notifs = useNotificationStore.getState().notifications;
    expect(notifs).toHaveLength(1);
    expect(notifs[0].message).toBe("hello");
    expect(notifs[0].type).toBe("info");
  });

  it("defaults to info type", () => {
    useNotificationStore.getState().addNotification("default");
    expect(useNotificationStore.getState().notifications[0].type).toBe("info");
  });

  it("removes a notification by id", () => {
    useNotificationStore.getState().addNotification("to-remove", "error");
    const id = useNotificationStore.getState().notifications[0].id;
    useNotificationStore.getState().removeNotification(id);
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });

  it("auto-dismisses after 4 seconds", () => {
    vi.useFakeTimers();
    useNotificationStore.getState().addNotification("auto-dismiss");

    // Before timeout: notification is present
    expect(useNotificationStore.getState().notifications).toHaveLength(1);

    vi.advanceTimersByTime(4000);

    // After timeout: notification is removed
    expect(useNotificationStore.getState().notifications).toHaveLength(0);

    vi.useRealTimers();
  });

  it("keeps manually-added notifications until removed", () => {
    vi.useFakeTimers();
    useNotificationStore.getState().addNotification("stays", "info");
    useNotificationStore.getState().addNotification("also stays", "info");

    // Manually remove one
    const firstId = useNotificationStore.getState().notifications[0].id;
    useNotificationStore.getState().removeNotification(firstId);

    expect(useNotificationStore.getState().notifications).toHaveLength(1);
    expect(useNotificationStore.getState().notifications[0].message).toBe("also stays");

    vi.useRealTimers();
  });
});
