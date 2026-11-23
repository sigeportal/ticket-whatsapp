import React, { useState, useEffect, useMemo } from "react";

import "react-toastify/dist/ReactToastify.css";
import "./styles/toast.css";
import { QueryClient, QueryClientProvider } from "react-query";
import { ptBR } from "@material-ui/core/locale";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import { useMediaQuery } from "@material-ui/core";
import {
    createTheme as createMui5Theme,
    ThemeProvider as Mui5ThemeProvider,
} from "@mui/material/styles";
import ColorModeContext from "./layout/themeContext";
import { SocketManager, SocketContext } from "./context/Socket/SocketContext";
import { FONT_DISPLAY, FONT_SANS, getDesignTokens } from "./theme/tokens";

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

    const tokens = useMemo(() => getDesignTokens(mode), [mode]);

    const theme = useMemo(
        () =>
            createTheme(
                {
                    typography: {
                        fontFamily: FONT_SANS,
                        h1: { fontFamily: FONT_DISPLAY, fontWeight: 700, letterSpacing: "-0.025em" },
                        h2: { fontFamily: FONT_DISPLAY, fontWeight: 700, letterSpacing: "-0.025em" },
                        h3: { fontFamily: FONT_DISPLAY, fontWeight: 700, letterSpacing: "-0.02em" },
                        h4: { fontFamily: FONT_DISPLAY, fontWeight: 700, letterSpacing: "-0.02em" },
                        h5: { fontFamily: FONT_DISPLAY, fontWeight: 700, letterSpacing: "-0.015em" },
                        h6: { fontFamily: FONT_DISPLAY, fontWeight: 700, letterSpacing: "-0.015em" },
                        allVariants: {
                            fontFamily: FONT_SANS,
                        },
                    },
                    scrollbarStyles: {
                        "&::-webkit-scrollbar": {
                            width: "6px",
                            height: "6px",
                        },
                        "&::-webkit-scrollbar-thumb": {
                            backgroundColor:
                                mode === "light" ? "rgba(10, 21, 16, 0.16)" : "rgba(37, 211, 102, 0.24)",
                            borderRadius: "9999px",
                        },
                        "&::-webkit-scrollbar-thumb:hover": {
                            backgroundColor:
                                mode === "light" ? "rgba(10, 21, 16, 0.32)" : "rgba(37, 211, 102, 0.45)",
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
                            backgroundColor:
                                mode === "light" ? "rgba(10, 21, 16, 0.12)" : "rgba(237, 245, 240, 0.12)",
                            borderRadius: "9999px",
                        },
                        "&::-webkit-scrollbar-thumb:hover": {
                            backgroundColor:
                                mode === "light" ? "rgba(10, 21, 16, 0.24)" : "rgba(237, 245, 240, 0.24)",
                        },
                        "&::-webkit-scrollbar-track": {
                            background: "transparent",
                        },
                    },
                    palette: {
                        type: mode,
                        primary: {
                            main: tokens.action.main,
                            light: tokens.brand.mint,
                            dark: tokens.action.hover,
                            contrastText: tokens.action.ink,
                        },
                        secondary: {
                            main: tokens.status.danger,
                            contrastText: "#FFFFFF",
                        },
                        background: {
                            default: tokens.canvas,
                            paper: tokens.surface,
                        },
                        text: {
                            primary: tokens.ink.primary,
                            secondary: tokens.ink.secondary,
                        },
                        sair: { main: tokens.status.danger },
                        vcard: { main: tokens.action.main },
                        textPrimary: mode === "light" ? "#047857" : "#25D366",
                        borderPrimary: tokens.border.strong,
                        dark: { main: mode === "light" ? "#0A1510" : "#ECF5F0" },
                        light: { main: mode === "light" ? "#F5F7F5" : "#0C1511" },
                        tabHeaderBackground: tokens.subtle,
                        optionsBackground: tokens.subtle,
                        options: tokens.surface,
                        fontecor: mode === "light" ? "#047857" : "#34D399",
                        fancyBackground: tokens.canvas,
                        bordabox: tokens.border.hairline,
                        newmessagebox: tokens.surface,
                        inputdigita: tokens.surface,
                        contactdrawer: tokens.surface,
                        announcements: tokens.subtle,
                        login: tokens.surface,
                        announcementspopover: tokens.elevated,
                        chatlist: tokens.canvas,
                        boxlist: tokens.elevated,
                        boxchatlist: tokens.canvas,
                        total: tokens.surface,
                        messageIcons: tokens.ink.muted,
                        inputBackground: tokens.fieldBg,
                        barraSuperior: tokens.surface,
                        boxticket: tokens.canvas,
                        campaigntab: tokens.subtle,
                        mediainput: tokens.subtle,
                    },
                    overrides: {
                        MuiCssBaseline: {
                            "@global": {
                                body: {
                                    backgroundColor: tokens.canvas,
                                    color: tokens.ink.primary,
                                    fontFamily: FONT_SANS,
                                },
                            },
                        },
                        MuiButton: {
                            root: {
                                borderRadius: 10,
                                textTransform: "none",
                                fontWeight: 600,
                                letterSpacing: "-0.005em",
                                fontFamily: FONT_SANS,
                                minHeight: 38,
                                boxShadow: "none",
                            },
                            containedPrimary: {
                                backgroundColor: tokens.action.main,
                                color: tokens.action.ink,
                                boxShadow: "none",
                                "&:hover": {
                                    backgroundColor: tokens.action.hover,
                                    boxShadow: "none",
                                },
                            },
                            containedSecondary: {
                                backgroundColor: tokens.status.danger,
                                color: "#ffffff",
                                boxShadow: "none",
                                "&:hover": {
                                    backgroundColor: mode === "light" ? "#BE123C" : "#F43F5E",
                                    boxShadow: "none",
                                },
                            },
                            outlinedPrimary: {
                                borderColor: tokens.border.strong,
                                color: mode === "light" ? "#047857" : "#25D366",
                                "&:hover": {
                                    borderColor: tokens.action.main,
                                    backgroundColor: tokens.action.soft,
                                },
                            },
                            outlinedSecondary: {
                                borderColor: tokens.border.hairline,
                                color: tokens.ink.secondary,
                                "&:hover": {
                                    backgroundColor: tokens.subtle,
                                    borderColor: tokens.border.strong,
                                },
                            },
                        },
                        MuiDialog: {
                            paper: {
                                borderRadius: 18,
                                backgroundColor: tokens.surface,
                                border: `1px solid ${tokens.border.hairline}`,
                                boxShadow:
                                    mode === "light"
                                        ? "0 24px 48px -12px rgba(7, 19, 14, 0.18)"
                                        : "0 24px 56px -12px rgba(0, 0, 0, 0.75)",
                            },
                        },
                        MuiDialogTitle: {
                            root: {
                                padding: "20px 24px 16px",
                                borderBottom: `1px solid ${tokens.border.hairline}`,
                                "& .MuiTypography-root": {
                                    fontSize: "1.125rem",
                                    fontWeight: 700,
                                    letterSpacing: "-0.02em",
                                    color: tokens.ink.primary,
                                    fontFamily: FONT_DISPLAY,
                                },
                            },
                        },
                        MuiDialogContent: {
                            root: {
                                padding: "20px 24px",
                            },
                        },
                        MuiDialogActions: {
                            root: {
                                padding: "14px 24px 18px",
                                borderTop: `1px solid ${tokens.border.hairline}`,
                                gap: 10,
                            },
                        },
                        MuiPaper: {
                            root: {
                                backgroundColor: tokens.surface,
                                color: tokens.ink.primary,
                            },
                            rounded: {
                                borderRadius: 14,
                            },
                            outlined: {
                                borderColor: tokens.border.hairline,
                            },
                        },
                        MuiOutlinedInput: {
                            root: {
                                borderRadius: 10,
                                backgroundColor: tokens.fieldBg,
                                transition: "all 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)",
                                "&:hover": {
                                    backgroundColor: mode === "light" ? "#FFFFFF" : "#0E1A14",
                                },
                                "&:hover $notchedOutline": {
                                    borderColor: mode === "light" ? "rgba(5, 150, 105, 0.45)" : "rgba(37, 211, 102, 0.45)",
                                },
                                "&$focused": {
                                    backgroundColor: mode === "light" ? "#FFFFFF" : "#101E17",
                                    boxShadow:
                                        mode === "light"
                                            ? "0 0 0 3px rgba(5, 150, 105, 0.16)"
                                            : "0 0 0 3px rgba(37, 211, 102, 0.2)",
                                },
                                "&$focused $notchedOutline": {
                                    borderColor: tokens.action.main,
                                    borderWidth: "1.5px",
                                },
                            },
                            notchedOutline: {
                                borderColor: mode === "light" ? "rgba(10, 21, 16, 0.14)" : "rgba(237, 245, 240, 0.12)",
                            },
                        },
                        MuiInputLabel: {
                            outlined: {
                                fontSize: "0.875rem",
                                fontWeight: 500,
                                color: tokens.ink.secondary,
                            },
                        },
                        MuiTabs: {
                            indicator: {
                                backgroundColor: tokens.action.main,
                                height: 2.5,
                                borderRadius: "2px 2px 0 0",
                            },
                        },
                        MuiTab: {
                            root: {
                                textTransform: "none",
                                fontFamily: FONT_SANS,
                                fontWeight: 600,
                                fontSize: "0.875rem",
                                color: tokens.ink.secondary,
                                "&$selected": {
                                    color: mode === "light" ? "#047857" : "#25D366",
                                    fontWeight: 700,
                                },
                            },
                        },
                        MuiTableHead: {
                            root: {
                                backgroundColor: tokens.subtle,
                            },
                        },
                        MuiTableCell: {
                            head: {
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                fontFamily: FONT_DISPLAY,
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                                color: tokens.ink.secondary,
                                borderBottom: `1px solid ${tokens.border.hairline}`,
                                padding: "12px 16px",
                            },
                            body: {
                                fontSize: "0.86rem",
                                color: tokens.ink.primary,
                                borderBottom: `1px solid ${tokens.border.hairline}`,
                                padding: "12px 16px",
                            },
                        },
                        MuiTableRow: {
                            root: {
                                transition: "background-color 0.12s ease",
                                "&:hover": {
                                    backgroundColor: tokens.action.soft,
                                },
                            },
                        },
                        MuiChip: {
                            root: {
                                borderRadius: 8,
                                fontWeight: 600,
                                fontFamily: FONT_SANS,
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
                                    color: tokens.action.ink,
                                    "& + $track": {
                                        backgroundColor: tokens.action.main,
                                        opacity: 1,
                                        border: "none",
                                    },
                                },
                            },
                            thumb: {
                                width: 20,
                                height: 20,
                                boxShadow: "0 1px 3px rgba(0,0,0,0.22)",
                            },
                            track: {
                                borderRadius: 12,
                                border: `1px solid ${tokens.border.hairline}`,
                                backgroundColor: mode === "light" ? "#CBD5CF" : "#1F3027",
                                opacity: 1,
                                transition: "all 0.18s ease-in-out",
                            },
                        },
                    },
                    mode,
                },
                locale
            ),
        [mode, tokens, locale]
    );

    const mui5Theme = useMemo(
        () =>
            createMui5Theme({
                palette: {
                    mode,
                    primary: {
                        main: tokens.action.main,
                        dark: tokens.action.hover,
                        contrastText: tokens.action.ink,
                    },
                    background: {
                        default: tokens.canvas,
                        paper: tokens.surface,
                    },
                    text: {
                        primary: tokens.ink.primary,
                        secondary: tokens.ink.secondary,
                    },
                },
                typography: {
                    fontFamily: FONT_SANS,
                },
                shape: {
                    borderRadius: 10,
                },
            }),
        [mode, tokens]
    );

    useEffect(() => {
        localStorage.setItem("i18nextLng", "pt-BR");
        setLocale(ptBR);
    }, []);

    useEffect(() => {
        window.localStorage.setItem("preferredTheme", mode);
        document.documentElement.setAttribute("data-theme", mode);
        document.body.setAttribute("data-theme", mode);
        if (mode === "dark") {
            document.documentElement.classList.add("dark");
            document.body.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
            document.body.classList.remove("dark");
        }
    }, [mode]);

    return (
        <ColorModeContext.Provider value={{ colorMode }}>
            <Mui5ThemeProvider theme={mui5Theme}>
                <ThemeProvider theme={theme}>
                    <QueryClientProvider client={queryClient}>
                        <SocketContext.Provider value={SocketManager}>
                            <Routes />
                        </SocketContext.Provider>
                    </QueryClientProvider>
                </ThemeProvider>
            </Mui5ThemeProvider>
        </ColorModeContext.Provider>
    );
};

export default App;
