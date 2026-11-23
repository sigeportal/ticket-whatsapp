import React from "react";
import { useTheme } from "@material-ui/core/styles";

/**
 * Componente oficial de identidade visual PortAI (BY PORTAL • SMART CX)
 * Suporta variantes:
 *   - 'full'    : logo completa com tipografia Sora e subtitulo tecnico
 *   - 'compact' : lockup horizontal enxuto para barra superior e menu lateral
 *   - 'icon'    : apenas o simbolo quadrado arredondado (#07130E + #25D366 / #10B981 / #0D9488)
 */
const PortAiLogo = ({
  variant = "full",
  themeMode,
  size,
  width,
  height,
  transparent = true,
  className,
  style = {},
}) => {
  const muiTheme = useTheme();
  const currentMode = themeMode || muiTheme?.mode || muiTheme?.palette?.type || "dark";
  const isDark = currentMode === "dark";

  const uid = React.useId ? React.useId().replace(/:/g, "") : Math.random().toString(36).substring(2, 7);

  if (variant === "icon") {
    const iconWidth = width || size || 36;
    const iconHeight = height || size || 36;

    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 240 240"
        width={iconWidth}
        height={iconHeight}
        className={className}
        style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, ...style }}
        aria-label="PortAI"
      >
        <defs>
          <linearGradient id={`iconGreenGrad-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4ADE80" />
            <stop offset="45%" stopColor="#25D366" />
            <stop offset="100%" stopColor="#0D9488" />
          </linearGradient>
          <linearGradient id={`innerMintGrad-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A7F3D0" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
        </defs>

        <rect width="240" height="240" rx="56" fill="#07130E" />

        <path
          d="M 120 36 C 166.4 36, 204 73.6, 204 120 C 204 166.4, 166.4 204, 120 204 L 54 204 C 44 204, 36 196, 36 186 L 36 120 C 36 73.6, 73.6 36, 120 36 Z"
          fill="none"
          stroke={`url(#iconGreenGrad-${uid})`}
          strokeWidth="18"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <path
          d="M 120 70 C 147.6 70, 170 92.4, 170 120 C 170 147.6, 147.6 170, 120 170 L 80 170"
          fill="none"
          stroke={`url(#innerMintGrad-${uid})`}
          strokeWidth="12"
          strokeLinecap="round"
        />

        <path
          d="M 120 85 Q 120 120 155 120 Q 120 120 120 155 Q 120 120 85 120 Q 120 120 120 85 Z"
          fill="#FFFFFF"
        />

        <circle cx="58" cy="170" r="8" fill="#25D366" />
      </svg>
    );
  }

  if (variant === "compact") {
    const compactHeight = height || size || 32;
    return (
      <span
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          userSelect: "none",
          ...style,
        }}
      >
        <PortAiLogo variant="icon" size={compactHeight} themeMode={currentMode} />
        <span style={{ display: "inline-flex", flexDirection: "column", lineHeight: 1 }}>
          <span
            style={{
              fontFamily: "'Sora', system-ui, sans-serif",
              fontWeight: 800,
              fontSize: compactHeight * 0.56,
              letterSpacing: "-0.03em",
              color: isDark ? "#ECF5F0" : "#0A1510",
            }}
          >
            Port
            <span style={{ color: isDark ? "#25D366" : "#059669" }}>AI</span>
          </span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.62rem",
              fontWeight: 600,
              letterSpacing: "0.14em",
              color: isDark ? "#6EE7B7" : "#059669",
              marginTop: 2,
              opacity: 0.9,
            }}
          >
            SMART CX
          </span>
        </span>
      </span>
    );
  }

  const fullWidth = width || size || 190;
  const fullHeight = height || (width || size ? (width || size) * (280 / 760) : 64);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 760 260"
      width={fullWidth}
      height={fullHeight}
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", ...style }}
      aria-label="PortAI — Smart CX"
    >
      <defs>
        <linearGradient id={`portalGrad-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4ADE80" />
          <stop offset="48%" stopColor="#25D366" />
          <stop offset="100%" stopColor={isDark ? "#0D9488" : "#059669"} />
        </linearGradient>
        <linearGradient id={`aiMint-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={isDark ? "#A7F3D0" : "#34D399"} />
          <stop offset="100%" stopColor={isDark ? "#10B981" : "#047857"} />
        </linearGradient>
      </defs>

      {!transparent && (
        <rect width="760" height="260" rx="24" fill={isDark ? "#07130E" : "#FFFFFF"} />
      )}

      <g transform="translate(24, 14)">
        <rect width="232" height="232" rx="54" fill="#07130E" />
        <path
          d="M 116 38 C 159.1 38, 194 72.9, 194 116 C 194 159.1, 159.1 194, 116 194 L 54 194 C 45 194, 38 187, 38 178 L 38 116 C 38 72.9, 72.9 38, 116 38 Z"
          fill="none"
          stroke={`url(#portalGrad-${uid})`}
          strokeWidth="17"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 116 68 C 142.5 68, 164 89.5, 164 116 C 164 142.5, 142.5 164, 116 164 L 78 164"
          fill="none"
          stroke={`url(#aiMint-${uid})`}
          strokeWidth="11"
          strokeLinecap="round"
        />
        <path
          d="M 116 83 Q 116 116 149 116 Q 116 116 116 149 Q 116 116 83 116 Q 116 116 116 83 Z"
          fill="#FFFFFF"
        />
        <circle cx="58" cy="164" r="7.5" fill="#25D366" />
      </g>

      <g transform="translate(290, 0)">
        <text
          x="0"
          y="145"
          fontFamily="'Sora', 'Instrument Sans', system-ui, sans-serif"
          fontSize="104"
          fontWeight="800"
          letterSpacing="-4"
        >
          <tspan fill={isDark ? "#ECF5F0" : "#0A1510"}>Port</tspan>
          <tspan fill={isDark ? `url(#portalGrad-${uid})` : "#059669"}>AI</tspan>
        </text>
        <text
          x="4"
          y="194"
          fontFamily="'JetBrains Mono', monospace"
          fontSize="20"
          fontWeight="600"
          fill={isDark ? "#6EE7B7" : "#047857"}
          opacity={isDark ? "0.82" : "0.9"}
          letterSpacing="5.5"
        >
          BY PORTAL • SMART CX
        </text>
      </g>
    </svg>
  );
};

export default PortAiLogo;
