/**
 * Notification store — transient toast messages.
 *
 * Notifications auto-dismiss after 4 seconds.
 * The ToastContainer component subscribes to this store.
 */

import { create } from "zustand";

export type NotificationType = "success" | "error" | "info";

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
}

interface NotificationState {
  notifications: Notification[];
  addNotification: (message: string, type?: NotificationType) => void;
  removeNotification: (id: string) => void;
}

let nextId = 0;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],

  addNotification: (message, type = "info") => {
    const id = `notif-${++nextId}`;
    set((state) => ({
      notifications: [...state.notifications, { id, type, message }],
    }));
    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      get().removeNotification(id);
    }, 4000);
  },

  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
}));
