/**
 * ToastContainer — renders active notifications in the top-right corner.
 *
 * Subscribes to the notification store. Each toast auto-dismisses
 * (managed by the store). Manual close via the × button.
 */

import { useNotificationStore } from "@/store/notificationStore";
import type { NotificationType } from "@/store/notificationStore";

const containerStyle: React.CSSProperties = {
  position: "fixed",
  top: 12,
  right: 12,
  zIndex: 9999,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  pointerEvents: "none",
};

const colors: Record<NotificationType, { bg: string; border: string; text: string }> = {
  success: { bg: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)", border: "#86efac", text: "#166534" },
  error: { bg: "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)", border: "#fca5a5", text: "#991b1b" },
  info: { bg: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)", border: "#93c5fd", text: "#1e40af" },
};

export function ToastContainer() {
  const notifications = useNotificationStore((s) => s.notifications);
  const removeNotification = useNotificationStore((s) => s.removeNotification);

  if (notifications.length === 0) return null;

  return (
    <div style={containerStyle}>
      {notifications.map((n) => {
        const c = colors[n.type];
        return (
          <div
            key={n.id}
            style={{
              background: c.bg,
              border: `1px solid ${c.border}`,
              borderRadius: 12,
              padding: "10px 14px",
              color: c.text,
              fontSize: 13,
              fontFamily: "system-ui, sans-serif",
              display: "flex",
              alignItems: "center",
              gap: 10,
              pointerEvents: "auto",
              boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
              maxWidth: 320,
            }}
          >
            <span style={{ flex: 1 }}>{n.message}</span>
            <button
              onClick={() => removeNotification(n.id)}
              style={{
                border: "none",
                background: "none",
                cursor: "pointer",
                color: c.text,
                fontSize: 14,
                padding: 0,
                lineHeight: 1,
                opacity: 0.6,
              }}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
