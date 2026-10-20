import React from "react";
import { useTheme } from "@material-ui/core/styles";

/**
 * Componente oficial de identidade visual PortAI (BY PORTAL • SMART CX)
 * Suporta variantes: 'full' (logo completa com tipografia) e 'icon' (apenas o símbolo compacto)
 * Adapta-se automaticamente ao tema ativo (light / dark) ou aceita override via prop `themeMode`
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

  // Identificador único para evitar colisão de IDs de gradientes SVG no DOM
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
        style={{ display: "inline-block", verticalAlign: "middle", ...style }}
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

        {/* Base do Ícone */}
        <rect width="240" height="240" rx="56" fill="#07130E" />

        {/* Arco Externo (Portal + Balão WhatsApp) */}
        <path
          d="M 120 36 C 166.4 36, 204 73.6, 204 120 C 204 166.4, 166.4 204, 120 204 L 54 204 C 44 204, 36 196, 36 186 L 36 120 C 36 73.6, 73.6 36, 120 36 Z"
          fill="none"
          stroke={`url(#iconGreenGrad-${uid})`}
          strokeWidth="18"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Arco Interno */}
        <path
          d="M 120 70 C 147.6 70, 170 92.4, 170 120 C 170 147.6, 147.6 170, 120 170 L 80 170"
          fill="none"
          stroke={`url(#innerMintGrad-${uid})`}
          strokeWidth="12"
          strokeLinecap="round"
        />

        {/* Estrela de IA */}
        <path
          d="M 120 85 Q 120 120 155 120 Q 120 120 120 155 Q 120 120 85 120 Q 120 120 120 85 Z"
          fill="#FFFFFF"
        />

        {/* Ponto de Status Verde WhatsApp */}
        <circle cx="58" cy="170" r="7" fill="#25D366" />
      </svg>
    );
  }

  // Variante FULL (Logo com escrita PortAI - BY PORTAL • SMART CX)
  const fullWidth = width || size || 180;
  const fullHeight = height || (width || size ? (width || size) * (300 / 800) : 56);

  if (isDark) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 800 300"
        width={fullWidth}
        height={fullHeight}
        className={className}
        style={{ display: "inline-block", verticalAlign: "middle", ...style }}
      >
        <defs>
          <linearGradient id={`portalGreenGrad-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4ADE80" />
            <stop offset="45%" stopColor="#25D366" />
            <stop offset="100%" stopColor="#0D9488" />
          </linearGradient>
          <linearGradient id={`aiMintSpark-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A7F3D0" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
        </defs>

        {!transparent && <rect width="800" height="300" rx="24" fill="#07130E" />}

        {/* GRUPO DO ÍCONE */}
        <g transform="translate(50, 30)">
          <path
            d="M 120 30 C 169.7 30, 210 70.3, 210 120 C 210 169.7, 169.7 210, 120 210 L 50 210 C 38 210, 30 202, 30 190 L 30 120 C 30 70.3, 70.3 30, 120 30 Z"
            fill="none"
            stroke={`url(#portalGreenGrad-${uid})`}
            strokeWidth="18"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M 120 66 C 149.8 66, 174 90.2, 174 120 C 174 149.8, 149.8 174, 120 174 L 78 174"
            fill="none"
            stroke={`url(#aiMintSpark-${uid})`}
            strokeWidth="12"
            strokeLinecap="round"
            opacity="0.9"
          />
          <path
            d="M 120 82 Q 120 120 158 120 Q 120 120 120 158 Q 120 120 82 120 Q 120 120 120 82 Z"
            fill="#FFFFFF"
          />
          <circle cx="58" cy="174" r="7" fill="#25D366" />
        </g>

        {/* TIPOGRAFIA */}
        <g transform="translate(305, 0)">
          <text
            x="0"
            y="162"
            fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
            fontSize="96"
            fontWeight="800"
            letterSpacing="-2"
          >
            <tspan fill="#F0FDF4">Port</tspan>
            <tspan fill={`url(#portalGreenGrad-${uid})`}>AI</tspan>
          </text>
          <text
            x="6"
            y="205"
            fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
            fontSize="19"
            fontWeight="600"
            fill="#6EE7B7"
            opacity="0.75"
            letterSpacing="5"
          >
            BY PORTAL • SMART CX
          </text>
        </g>
      </svg>
    );
  }

  // Versão Modo Claro
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 800 300"
      width={fullWidth}
      height={fullHeight}
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", ...style }}
    >
      <defs>
        <linearGradient id={`portalGreenLight-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#25D366" />
          <stop offset="50%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        <linearGradient id={`aiMintLight-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>

      {!transparent && <rect width="800" height="300" rx="24" fill="#FFFFFF" />}

      {/* GRUPO DO ÍCONE */}
      <g transform="translate(50, 30)">
        <path
          d="M 120 30 C 169.7 30, 210 70.3, 210 120 C 210 169.7, 169.7 210, 120 210 L 50 210 C 38 210, 30 202, 30 190 L 30 120 C 30 70.3, 70.3 30, 120 30 Z"
          fill="none"
          stroke={`url(#portalGreenLight-${uid})`}
          strokeWidth="18"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 120 66 C 149.8 66, 174 90.2, 174 120 C 174 149.8, 149.8 174, 120 174 L 78 174"
          fill="none"
          stroke={`url(#aiMintLight-${uid})`}
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M 120 82 Q 120 120 158 120 Q 120 120 120 158 Q 120 120 82 120 Q 120 120 120 82 Z"
          fill="#065F46"
        />
        <circle cx="58" cy="174" r="7" fill="#25D366" />
      </g>

      {/* TIPOGRAFIA ESCURA */}
      <g transform="translate(305, 0)">
        <text
          x="0"
          y="162"
          fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
          fontSize="96"
          fontWeight="800"
          letterSpacing="-2"
        >
          <tspan fill="#064E3B">Port</tspan>
          <tspan fill={`url(#portalGreenLight-${uid})`}>AI</tspan>
        </text>
        <text
          x="6"
          y="205"
          fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
          fontSize="19"
          fontWeight="700"
          fill="#059669"
          opacity="0.85"
          letterSpacing="5"
        >
          BY PORTAL • SMART CX
        </text>
      </g>
    </svg>
  );
};

export default PortAiLogo;
