/**
 * PortAI Design System Tokens — "Signal & Precision"
 * Derivado diretamente das cores da logo PortAI (#25D366, #10B981, #059669, #0D9488, #07130E).
 */

export const FONT_DISPLAY = "'Sora', system-ui, -apple-system, sans-serif";
export const FONT_SANS = "'Instrument Sans', system-ui, -apple-system, sans-serif";
export const FONT_MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace";

export const getDesignTokens = (mode = "light") => {
  const isDark = mode === "dark";
  return {
    mode,
    brand: {
      signal: "#25D366",
      emerald: "#10B981",
      deep: "#059669",
      forest: "#047857",
      teal: "#0D9488",
      mint: "#4ADE80",
      obsidian: "#07130E",
    },
    canvas: isDark ? "#070D0A" : "#F5F7F5",
    surface: isDark ? "#0C1511" : "#FFFFFF",
    elevated: isDark ? "#122019" : "#FFFFFF",
    subtle: isDark ? "#09110D" : "#EDF1EE",
    fieldBg: isDark ? "#09120E" : "#F8FAF8",
    ink: {
      primary: isDark ? "#ECF5F0" : "#0A1510",
      secondary: isDark ? "#9DB2A7" : "#41524A",
      muted: isDark ? "#6F8479" : "#65786F",
    },
    border: {
      hairline: isDark ? "rgba(237, 245, 240, 0.09)" : "rgba(10, 21, 16, 0.09)",
      strong: isDark ? "rgba(37, 211, 102, 0.26)" : "rgba(5, 150, 105, 0.28)",
    },
    action: {
      main: isDark ? "#25D366" : "#059669",
      hover: isDark ? "#1FC45B" : "#047857",
      ink: isDark ? "#05130B" : "#FFFFFF",
      soft: isDark ? "rgba(37, 211, 102, 0.12)" : "rgba(16, 185, 129, 0.10)",
    },
    status: {
      success: isDark ? "#34D399" : "#059669",
      warning: isDark ? "#FBBF24" : "#D97706",
      danger: isDark ? "#FB7185" : "#E11D48",
      info: isDark ? "#38BDF8" : "#0284C7",
      teal: isDark ? "#2DD4BF" : "#0D9488",
    },
  };
};
