import React, { useState, useEffect } from "react";

import "react-toastify/dist/ReactToastify.css";
import { QueryClient, QueryClientProvider } from "react-query";
import lightBackground from '../src/assets/wa-background-light.png';
import darkBackground from '../src/assets/wa-background-dark.jpg';
import { ptBR } from "@material-ui/core/locale";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import { useMediaQuery } from "@material-ui/core";
import ColorModeContext from "./layout/themeContext";
import { SocketContext, SocketManager } from './context/Socket/SocketContext';

import Routes from "./routes";

const queryClient = new QueryClient();

const App = () => {
    const [locale, setLocale] = useState(ptBR);

    const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
    const preferredTheme = window.localStorage.getItem("preferredTheme");
    const [mode, setMode] = useState(preferredTheme ? preferredTheme : prefersDarkMode ? "dark" : "light");

    const colorMode = React.useMemo(
        () => ({
            toggleColorMode: () => {
                setMode((prevMode) => (prevMode === "light" ? "dark" : "light"));
            },
        }),
        []
    );

    const theme = createTheme(
        {
            typography: {
                fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
                allVariants: {
                    fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
                },
            },
            scrollbarStyles: {
                "&::-webkit-scrollbar": {
                    width: '6px',
                    height: '6px',
                },
                "&::-webkit-scrollbar-thumb": {
                    backgroundColor: mode === "light" ? "rgba(0, 0, 0, 0.16)" : "rgba(16, 185, 129, 0.25)",
                    borderRadius: "9999px",
                },
                "&::-webkit-scrollbar-thumb:hover": {
                    backgroundColor: mode === "light" ? "rgba(0, 0, 0, 0.3)" : "rgba(16, 185, 129, 0.45)",
                },
                "&::-webkit-scrollbar-track": {
                    background: "transparent",
                },
            },
            scrollbarStylesSoft: {
                "&::-webkit-scrollbar": {
                    width: "5px",
                    height: "5px",
                },
                "&::-webkit-scrollbar-thumb": {
                    backgroundColor: mode === "light" ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.12)",
                    borderRadius: "9999px",
                },
                "&::-webkit-scrollbar-thumb:hover": {
                    backgroundColor: mode === "light" ? "rgba(0, 0, 0, 0.22)" : "rgba(255, 255, 255, 0.22)",
                },
                "&::-webkit-scrollbar-track": {
                    background: "transparent",
                },
            },
            palette: {
                type: mode,
                primary: {
                    main: mode === "light" ? "#10b981" : "#25D366",
                    light: mode === "light" ? "#34d399" : "#4ade80",
                    dark: mode === "light" ? "#059669" : "#0d9488",
                    contrastText: mode === "light" ? "#ffffff" : "#07130e",
                },
                background: {
                    default: mode === "light" ? "#f8fafc" : "#07130e",
                    paper: mode === "light" ? "#ffffff" : "#0b1e16",
                },
                text: {
                    primary: mode === "light" ? "#0f172a" : "#f0fdf4",
                    secondary: mode === "light" ? "#475569" : "#94a3b8",
                },
                sair: { main: mode === "light" ? "#ef4444" : "#f87171" },
                vcard: { main: mode === "light" ? "#10b981" : "#25D366" },
                textPrimary: mode === "light" ? "#064e3b" : "#25D366",
                borderPrimary: mode === "light" ? "rgba(16, 185, 129, 0.25)" : "rgba(37, 211, 102, 0.25)",
                dark: { main: mode === "light" ? "#1e293b" : "#f8fafc" },
                light: { main: mode === "light" ? "#f8fafc" : "#0b1e16" },
                tabHeaderBackground: mode === "light" ? "#f1f5f9" : "#0d2219",
                optionsBackground: mode === "light" ? "#f8fafc" : "#0d2219",
                options: mode === "light" ? "#ffffff" : "#0b1e16",
                fontecor: mode === "light" ? "#065f46" : "#25D366",
                fancyBackground: mode === "light" ? "#f8fafc" : "#07130e",
                bordabox: mode === "light" ? "rgba(226, 232, 240, 0.9)" : "rgba(16, 185, 129, 0.18)",
                newmessagebox: mode === "light" ? "#ffffff" : "#0d2219",
                inputdigita: mode === "light" ? "#ffffff" : "#0d2219",
                contactdrawer: mode === "light" ? "#ffffff" : "#0b1e16",
                announcements: mode === "light" ? "#f1f5f9" : "#0d2219",
                login: mode === "light" ? "#ffffff" : "#0b1e16",
                announcementspopover: mode === "light" ? "#ffffff" : "#0b1e16",
                chatlist: mode === "light" ? "#f8fafc" : "#07130e",
                boxlist: mode === "light" ? "#ffffff" : "#0d2219",
                boxchatlist: mode === "light" ? "#f8fafc" : "#07130e",
                total: mode === "light" ? "#ffffff" : "#0b1e16",
                messageIcons: mode === "light" ? "#64748b" : "#94a3b8",
                inputBackground: mode === "light" ? "#ffffff" : "#0d2219",
                barraSuperior: mode === "light" ? "#ffffff" : "#0b1e16",
                boxticket: mode === "light" ? "#f8fafc" : "#0d2219",
                campaigntab: mode === "light" ? "#f1f5f9" : "#0d2219",
                mediainput: mode === "light" ? "#f8fafc" : "#07130e",
            },
            overrides: {
                MuiButton: {
                    root: {
                        borderRadius: 10,
                        textTransform: "none",
                        fontWeight: 700,
                        letterSpacing: "0.01em",
                        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                    },
                    containedPrimary: {
                        background: "linear-gradient(135deg, #10b981 0%, #0d9488 100%)",
                        color: "#ffffff",
                        boxShadow: "none",
                        "&:hover": {
                            background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                            boxShadow: "none",
                        },
                    },
                    containedSecondary: {
                        backgroundColor: "#ef4444",
                        color: "#ffffff",
                        boxShadow: "none",
                        "&:hover": {
                            backgroundColor: "#dc2626",
                            boxShadow: "none",
                        },
                    },
                    outlinedPrimary: {
                        borderColor: "rgba(16, 185, 129, 0.4)",
                        color: mode === "light" ? "#065f46" : "#34d399",
                        "&:hover": {
                            borderColor: "#10b981",
                            backgroundColor: "rgba(16, 185, 129, 0.08)",
                        },
                    },
                    outlinedSecondary: {
                        borderColor: mode === "light" ? "rgba(226, 232, 240, 0.9)" : "rgba(255, 255, 255, 0.15)",
                        color: mode === "light" ? "#64748b" : "#94a3b8",
                        "&:hover": {
                            backgroundColor: mode === "light" ? "#f1f5f9" : "rgba(255, 255, 255, 0.06)",
                            borderColor: mode === "light" ? "#cbd5e1" : "rgba(255, 255, 255, 0.25)",
                        },
                    },
                },
                MuiDialog: {
                    paper: {
                        borderRadius: 16,
                        border: mode === "light" ? "1px solid rgba(226, 232, 240, 0.9)" : "1px solid rgba(16, 185, 129, 0.2)",
                        boxShadow: mode === "light" ? "0 4px 16px rgba(0, 0, 0, 0.08)" : "0 4px 20px rgba(0, 0, 0, 0.45)",
                    },
                },
                MuiDialogTitle: {
                    root: {
                        padding: "18px 24px 14px",
                        borderBottom: mode === "light" ? "1px solid #f1f5f9" : "1px solid rgba(16, 185, 129, 0.15)",
                        "& .MuiTypography-root": {
                            fontSize: "1.125rem",
                            fontWeight: 800,
                            letterSpacing: "-0.01em",
                            color: mode === "light" ? "#0f172a" : "#f0fdf4",
                            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                        },
                    },
                },
                MuiDialogActions: {
                    root: {
                        padding: "14px 24px 18px",
                        borderTop: mode === "light" ? "1px solid #f1f5f9" : "1px solid rgba(16, 185, 129, 0.15)",
                        gap: 8,
                    },
                },
                MuiPaper: {
                    rounded: {
                        borderRadius: 14,
                    },
                },
                MuiOutlinedInput: {
                    root: {
                        borderRadius: 10,
                        backgroundColor: mode === "light" ? "#ffffff" : "#07130e",
                        transition: "all 0.2s ease-in-out",
                        "&:hover $notchedOutline": {
                            borderColor: "#10b981",
                        },
                        "&$focused $notchedOutline": {
                            borderColor: "#10b981",
                            borderWidth: "1.5px",
                        },
                    },
                    notchedOutline: {
                        borderColor: mode === "light" ? "rgba(226, 232, 240, 0.9)" : "rgba(16, 185, 129, 0.2)",
                    },
                },
                MuiTableHead: {
                    root: {
                        backgroundColor: mode === "light" ? "#f8fafc" : "#0b1e16",
                    },
                },
                MuiTableCell: {
                    head: {
                        fontSize: "0.75rem",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: mode === "light" ? "#475569" : "#6ee7b7",
                        borderBottom: mode === "light" ? "1px solid #e2e8f0" : "1px solid rgba(16, 185, 129, 0.15)",
                        padding: "12px 16px",
                    },
                    body: {
                        fontSize: "0.84rem",
                        color: mode === "light" ? "#1e293b" : "#f1f5f9",
                        borderBottom: mode === "light" ? "1px solid #f1f5f9" : "1px solid rgba(255, 255, 255, 0.04)",
                        padding: "12px 16px",
                    },
                },
                MuiTableRow: {
                    root: {
                        transition: "background-color 0.15s ease",
                        "&:hover": {
                            backgroundColor: mode === "light" ? "rgba(16, 185, 129, 0.04)" : "rgba(16, 185, 129, 0.06)",
                        },
                    },
                },
                MuiSwitch: {
                    root: {
                        width: 42,
                        height: 24,
                        padding: 0,
                        margin: 8,
                    },
                    switchBase: {
                        padding: 2,
                        "&$checked": {
                            transform: "translateX(18px)",
                            color: "#ffffff",
                            "& + $track": {
                                backgroundColor: "#10b981",
                                opacity: 1,
                                border: "none",
                            },
                        },
                    },
                    thumb: {
                        width: 20,
                        height: 20,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    },
                    track: {
                        borderRadius: 12,
                        border: "1px solid #cbd5e1",
                        backgroundColor: "#cbd5e1",
                        opacity: 1,
                        transition: "all 0.2s ease-in-out",
                    },
                },
            },
            mode,
        },
        locale
    );

    useEffect(() => {
        localStorage.setItem("i18nextLng", "pt-BR");
        setLocale(ptBR);
    }, []);

    useEffect(() => {
        window.localStorage.setItem("preferredTheme", mode);
    }, [mode]);



    return (
        <ColorModeContext.Provider value={{ colorMode }}>
            <ThemeProvider theme={theme}>
                <QueryClientProvider client={queryClient}>
                  <SocketContext.Provider value={SocketManager}>
                      <Routes />
                  </SocketContext.Provider>
                </QueryClientProvider>
            </ThemeProvider>
        </ColorModeContext.Provider>
    );
};

export default App;
