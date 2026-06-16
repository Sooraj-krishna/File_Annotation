export const colors = {
  bg: {
    primary: "#F8FAFC",
    secondary: "#FFFFFF",
    pdfViewer: "#E2E8F0",
    header: "#008384",
    headerHover: "#007A7A",
  },
  border: {
    main: "#E5E7EB",
    light: "#F1F5F9",
  },
  text: {
    primary: "#111827",
    secondary: "#6B7280",
    light: "#9CA3AF",
  },
  annotation: {
    green: "#22C55E",
    blue: "#38BDF8",
    purple: "#4F46E5",
    orange: "#F59E0B",
    red: "#EF4444",
  },
  status: {
    success: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
  },
  card: {
    activeBg: "#F0FDF4",
    activeBorder: "#22C55E",
    warningBg: "#FFFBEB",
    warningBorder: "#F59E0B",
    errorBg: "#FEF2F2",
    errorBorder: "#EF4444",
  },
};

export const typography = {
  fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
  sizes: {
    pageHeader: 20,
    fieldLabel: 12,
    fieldValue: 18,
    tabs: 16,
    body: 13,
    small: 11,
  },
  weights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
};

export const card = {
  borderRadius: 8,
  padding: "20px",
  marginBottom: 16,
  boxShadow: "0px 4px 20px rgba(0,0,0,0.08)",
  background: "#FFFFFF",
};

export const header = {
  height: 56,
  background: colors.bg.header,
};
