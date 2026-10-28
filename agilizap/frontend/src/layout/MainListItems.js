import React, { useContext, useEffect, useReducer, useState, useMemo } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import clsx from "clsx";

import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import ListSubheader from "@material-ui/core/ListSubheader";
import Divider from "@material-ui/core/Divider";
import { Badge, Typography, Tooltip } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import { i18n } from "../translate/i18n";
import { WhatsAppsContext } from "../context/WhatsApp/WhatsAppsContext";
import { AuthContext } from "../context/Auth/AuthContext";
import { Can } from "../components/Can";
import { SocketContext } from "../context/Socket/SocketContext";
import { isArray } from "lodash";
import api from "../services/api";
import toastError from "../errors/toastError";
import usePlans from "../hooks/usePlans";
import useVersion from "../hooks/useVersion";

// Ícones Vetoriais Outline de Alta Precisão (Sem Emojis, Estilo Lucide/Linear)
const Icons = {
  Tickets: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  QuickMessages: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  Kanban: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M8 7v7M12 7v4M16 7v9" />
    </svg>
  ),
  Tasks: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 11 3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  Contacts: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Schedules: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  ),
  Tags: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
      <circle cx="7" cy="7" r="1.5" fill="currentColor" />
    </svg>
  ),
  InternalChat: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  ),
  Helps: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" x2="12.01" y1="17" y2="17" />
    </svg>
  ),
  Dashboard: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" x2="12" y1="20" y2="10" />
      <line x1="18" x2="18" y1="20" y2="4" />
      <line x1="6" x2="6" y1="20" y2="16" />
    </svg>
  ),
  Campaigns: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 11 18-5-5 18-3-7-10-6Z" />
      <path d="m15 13-4-1" />
    </svg>
  ),
  ContactLists: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" x2="23" y1="8" y2="8" />
      <line x1="19" x2="23" y1="12" y2="12" />
    </svg>
  ),
  CampaignsConfig: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" x2="20" y1="21" y2="21" />
      <line x1="4" x2="20" y1="14" y2="14" />
      <line x1="4" x2="20" y1="7" y2="7" />
      <circle cx="9" cy="14" r="2" fill="currentColor" />
      <circle cx="15" cy="7" r="2" fill="currentColor" />
    </svg>
  ),
  Announcements: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  ),
  OpenAi: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
    </svg>
  ),
  Integrations: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <path d="M13 6h3a2 2 0 0 1 2 2v7" />
      <line x1="6" x2="6" y1="9" y2="21" />
    </svg>
  ),
  Connections: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
      <path d="M12 18h.01" />
    </svg>
  ),
  Files: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  ),
  Queues: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
      <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
    </svg>
  ),
  Users: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </svg>
  ),
  MessagesApi: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  ),
  Financeiro: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" x2="12" y1="2" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  Settings: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Logout: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  ),
};

const useStyles = makeStyles((theme) => ({
  firstListSubheader: {
    position: "relative !important",
    height: 24,
    lineHeight: "24px",
    paddingLeft: 16,
    paddingRight: 16,
    marginTop: 2,
    marginBottom: 4,
    color: theme.mode === "light" ? "#64748b" : "#6ee7b7",
    fontSize: "0.6875rem",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    opacity: 0.8,
    backgroundColor: "transparent",
  },
  listSubheader: {
    position: "relative !important",
    height: 28,
    lineHeight: "28px",
    paddingLeft: 16,
    paddingRight: 16,
    marginTop: 14,
    marginBottom: 4,
    color: theme.mode === "light" ? "#64748b" : "#6ee7b7",
    fontSize: "0.6875rem",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    opacity: 0.8,
    backgroundColor: "transparent",
  },
  listItem: {
    borderRadius: 12,
    margin: "2px 10px",
    padding: "8px 12px",
    width: "auto",
    color: theme.mode === "light" ? "#334155" : "#94a3b8",
    transition: "all 0.18s ease-in-out",
    "&:hover": {
      backgroundColor:
        theme.mode === "light"
          ? "rgba(16, 185, 129, 0.08)"
          : "rgba(255, 255, 255, 0.05)",
      color: theme.mode === "light" ? "#065f46" : "#34d399",
      "& $listItemIcon": {
        color: theme.mode === "light" ? "#065f46" : "#34d399",
      },
    },
  },
  activeListItem: {
    backgroundColor:
      theme.mode === "light"
        ? "rgba(16, 185, 129, 0.12)"
        : "rgba(37, 211, 102, 0.14)",
    color: theme.mode === "light" ? "#065f46" : "#25d366",
    fontWeight: 700,
    border:
      theme.mode === "light"
        ? "1px solid rgba(16, 185, 129, 0.28)"
        : "1px solid rgba(37, 211, 102, 0.28)",
    boxShadow: "none",
    "&:hover": {
      backgroundColor:
        theme.mode === "light"
          ? "rgba(16, 185, 129, 0.18)"
          : "rgba(37, 211, 102, 0.22)",
    },
  },
  listItemIcon: {
    minWidth: 32,
    color: theme.mode === "light" ? "#64748b" : "#94a3b8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "color 0.18s ease-in-out",
  },
  activeListItemIcon: {
    color: theme.mode === "light" ? "#065f46" : "#25d366",
  },
  listItemText: {
    fontSize: "0.8125rem",
    fontWeight: 600,
    letterSpacing: "-0.01em",
  },
  activeListItemText: {
    fontWeight: 700,
    color: theme.mode === "light" ? "#065f46" : "#25d366",
  },
  ticketBadgesWrapper: {
    display: "flex",
    alignItems: "center",
    marginLeft: "auto",
    gap: 4,
  },
  badgeOpen: {
    backgroundColor: "#10b981",
    color: "#07130e",
    borderRadius: "9999px",
    padding: "2px 7px",
    fontSize: "0.6875rem",
    fontWeight: 800,
    lineHeight: 1.2,
    minWidth: 18,
    textAlign: "center",
    display: "inline-block",
  },
  badgePending: {
    backgroundColor: "#f59e0b",
    color: "#07130e",
    borderRadius: "9999px",
    padding: "2px 7px",
    fontSize: "0.6875rem",
    fontWeight: 800,
    lineHeight: 1.2,
    minWidth: 18,
    textAlign: "center",
    display: "inline-block",
  },
  badgeCollapsed: {
    "& .MuiBadge-badge": {
      fontSize: "0.625rem",
      height: 16,
      minWidth: 16,
      borderRadius: 8,
      padding: "0 4px",
    },
  },
  badgePendingColor: {
    backgroundColor: "#f59e0b",
    color: "#ffffff",
  },
  badgeOpenColor: {
    backgroundColor: "#10b981",
    color: "#ffffff",
  },
  logoutSection: {
    marginTop: "auto",
    paddingTop: 8,
    paddingBottom: 8,
  },
  logoutButton: {
    borderRadius: 12,
    margin: "6px 10px",
    padding: "8px 12px",
    width: "auto",
    color: theme.mode === "light" ? "#dc2626" : "#f87171",
    backgroundColor:
      theme.mode === "light"
        ? "rgba(239, 68, 68, 0.05)"
        : "rgba(239, 68, 68, 0.1)",
    border:
      theme.mode === "light"
        ? "1px solid rgba(239, 68, 68, 0.15)"
        : "1px solid rgba(239, 68, 68, 0.25)",
    transition: "all 0.18s ease-in-out",
    "&:hover": {
      backgroundColor:
        theme.mode === "light"
          ? "rgba(239, 68, 68, 0.12)"
          : "rgba(239, 68, 68, 0.22)",
      color: theme.mode === "light" ? "#b91c1c" : "#fca5a5",
      "& $logoutIcon": {
        color: theme.mode === "light" ? "#b91c1c" : "#fca5a5",
        transform: "translateX(2px)",
      },
    },
  },
  logoutIcon: {
    minWidth: 32,
    color: theme.mode === "light" ? "#dc2626" : "#f87171",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.18s ease-in-out",
  },
  logoutText: {
    fontSize: "0.8125rem",
    fontWeight: 700,
    color: "inherit",
  },
  versionContainer: {
    padding: "8px 16px 4px 16px",
    display: "flex",
    justifyContent: "flex-end",
  },
  versionText: {
    fontSize: "0.6875rem",
    fontWeight: 600,
    color: theme.mode === "light" ? "#94a3b8" : "#64748b",
    letterSpacing: "0.02em",
  },
  divider: {
    margin: "8px 12px",
    backgroundColor:
      theme.mode === "light"
        ? "rgba(229, 231, 235, 0.8)"
        : "rgba(255, 255, 255, 0.08)",
  },
  collapsedListItem: {
    justifyContent: "center !important",
    padding: "10px 0 !important",
    margin: "4px 8px !important",
    borderRadius: "10px !important",
    width: "auto !important",
    minWidth: "0 !important",
  },
  collapsedListItemIcon: {
    minWidth: "0 !important",
    margin: "0 auto !important",
    display: "flex !important",
    justifyContent: "center !important",
    alignItems: "center !important",
  },
  collapsedDivider: {
    margin: "8px 12px",
    backgroundColor:
      theme.mode === "light"
        ? "rgba(229, 231, 235, 0.7)"
        : "rgba(255, 255, 255, 0.08)",
  },
}));

function ListItemLink(props) {
  const { icon, primary, to, className, collapsed, extra } = props;
  const classes = useStyles();
  const location = useLocation();

  const isActive = useMemo(() => {
    if (to === "/") {
      return location.pathname === "/";
    }
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  }, [location.pathname, to]);

  const renderLink = useMemo(
    () =>
      React.forwardRef((itemProps, ref) => (
        <RouterLink to={to} ref={ref} {...itemProps} />
      )),
    [to]
  );

  const listItem = (
    <ListItem
      button
      dense
      component={renderLink}
      className={clsx(
        classes.listItem,
        isActive && classes.activeListItem,
        collapsed && classes.collapsedListItem,
        className
      )}
    >
      {icon ? (
        <ListItemIcon
          className={clsx(
            classes.listItemIcon,
            isActive && classes.activeListItemIcon,
            collapsed && classes.collapsedListItemIcon
          )}
        >
          {icon}
        </ListItemIcon>
      ) : null}
      {!collapsed && (
        <ListItemText
          classes={{
            primary: clsx(
              classes.listItemText,
              isActive && classes.activeListItemText
            ),
          }}
          primary={primary}
        />
      )}
      {!collapsed && extra}
    </ListItem>
  );

  if (collapsed) {
    return (
      <li>
        <Tooltip title={primary} placement="right" arrow>
          {listItem}
        </Tooltip>
      </li>
    );
  }

  return <li>{listItem}</li>;
}

const reducer = (state, action) => {
  if (action.type === "LOAD_CHATS") {
    const chats = action.payload;
    const newChats = [];

    if (isArray(chats)) {
      chats.forEach((chat) => {
        const chatIndex = state.findIndex((u) => u.id === chat.id);
        if (chatIndex !== -1) {
          state[chatIndex] = chat;
        } else {
          newChats.push(chat);
        }
      });
    }

    return [...state, ...newChats];
  }

  if (action.type === "UPDATE_CHATS") {
    const chat = action.payload;
    const chatIndex = state.findIndex((u) => u.id === chat.id);

    if (chatIndex !== -1) {
      state[chatIndex] = chat;
      return [...state];
    } else {
      return [chat, ...state];
    }
  }

  if (action.type === "DELETE_CHAT") {
    const chatId = action.payload;

    const chatIndex = state.findIndex((u) => u.id === chatId);
    if (chatIndex !== -1) {
      state.splice(chatIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }

  if (action.type === "CHANGE_CHAT") {
    const changedChats = state.map((chat) => {
      if (chat.id === action.payload.chat.id) {
        return action.payload.chat;
      }
      return chat;
    });
    return changedChats;
  }
};

const MainListItems = (props) => {
  const classes = useStyles();
  const { drawerClose, collapsed } = props;
  const { whatsApps } = useContext(WhatsAppsContext);
  const { user, handleLogout } = useContext(AuthContext);
  const [connectionWarning, setConnectionWarning] = useState(false);
  const [showCampaigns, setShowCampaigns] = useState(false);
  const [showKanban, setShowKanban] = useState(false);
  const [showOpenAi, setShowOpenAi] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [showSchedules, setShowSchedules] = useState(false);
  const [showInternalChat, setShowInternalChat] = useState(false);
  const [showExternalApi, setShowExternalApi] = useState(false);

  const [invisible, setInvisible] = useState(true);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchParam] = useState("");
  const [chats, dispatch] = useReducer(reducer, []);
  const { getPlanCompany } = usePlans();

  const [version, setVersion] = useState(false);
  const { getVersion } = useVersion();

  const [ticketCounts, setTicketCounts] = useState({ open: 0, pending: 0 });
  const socketManager = useContext(SocketContext);

  useEffect(() => {
    async function fetchVersion() {
      const _version = await getVersion();
      setVersion(_version.version);
    }
    fetchVersion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    async function fetchData() {
      const companyId = user.companyId;
      const planConfigs = await getPlanCompany(undefined, companyId);

      setShowCampaigns(planConfigs.plan.useCampaigns);
      setShowKanban(planConfigs.plan.useKanban);
      setShowOpenAi(planConfigs.plan.useOpenAi);
      setShowIntegrations(planConfigs.plan.useIntegrations);
      setShowSchedules(planConfigs.plan.useSchedules);
      setShowInternalChat(planConfigs.plan.useInternalChat);
      setShowExternalApi(planConfigs.plan.useExternalApi);
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchTicketCounts = async () => {
      try {
        const [{ data: openData }, { data: pendingData }] = await Promise.all([
          api.get("/tickets", { params: { status: "open", pageNumber: 1 } }),
          api.get("/tickets", { params: { status: "pending", pageNumber: 1 } }),
        ]);
        if (isMounted) {
          setTicketCounts({
            open: openData?.count || 0,
            pending: pendingData?.count || 0,
          });
        }
      } catch (err) {
        // Silently continue if ticket counts cannot be retrieved
      }
    };

    fetchTicketCounts();

    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    socket.on("ready", () => {
      socket.emit("joinNotification");
    });

    let debounceTimer = null;
    const handleTicketUpdate = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchTicketCounts();
      }, 800);
    };

    socket.on(`company-${companyId}-ticket`, handleTicketUpdate);
    socket.on(`company-${companyId}-appMessage`, handleTicketUpdate);

    return () => {
      isMounted = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      socket.off(`company-${companyId}-ticket`, handleTicketUpdate);
      socket.off(`company-${companyId}-appMessage`, handleTicketUpdate);
      socket.disconnect();
    };
  }, [socketManager]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchChats();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParam, pageNumber]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    socket.on(`company-${companyId}-chat`, (data) => {
      if (data.action === "new-message") {
        dispatch({ type: "CHANGE_CHAT", payload: data });
      }
      if (data.action === "update") {
        dispatch({ type: "CHANGE_CHAT", payload: data });
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [socketManager]);

  useEffect(() => {
    let unreadsCount = 0;
    if (chats.length > 0) {
      for (let chat of chats) {
        for (let chatUser of chat.users) {
          if (chatUser.userId === user.id) {
            unreadsCount += chatUser.unreads;
          }
        }
      }
    }
    if (unreadsCount > 0) {
      setInvisible(false);
    } else {
      setInvisible(true);
    }
  }, [chats, user.id]);

  useEffect(() => {
    if (localStorage.getItem("cshow")) {
      setShowCampaigns(true);
    }
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (whatsApps.length > 0) {
        const offlineWhats = whatsApps.filter((whats) => {
          return (
            whats.status === "qrcode" ||
            whats.status === "PAIRING" ||
            whats.status === "DISCONNECTED" ||
            whats.status === "TIMEOUT" ||
            whats.status === "OPENING"
          );
        });
        if (offlineWhats.length > 0) {
          setConnectionWarning(true);
        } else {
          setConnectionWarning(false);
        }
      }
    }, 2000);
    return () => clearTimeout(delayDebounceFn);
  }, [whatsApps]);

  const fetchChats = async () => {
    try {
      const { data } = await api.get("/chats/", {
        params: { searchParam, pageNumber },
      });
      dispatch({ type: "LOAD_CHATS", payload: data.records });
    } catch (err) {
      toastError(err);
    }
  };

  const handleClickLogout = () => {
    handleLogout();
  };

  return (
    <div onClick={drawerClose}>
      <Can
        role={user.profile}
        perform={"drawer-service-items:view"}
        style={{
          overflowY: "scroll",
        }}
        no={() => (
          <>
            {!collapsed ? (
              <ListSubheader
                className={classes.firstListSubheader}
                disableSticky={true}
                inset
                color="inherit"
              >
                Atendimento
              </ListSubheader>
            ) : null}

            <ListItemLink
              to="/tickets"
              primary="Atendimentos"
              collapsed={collapsed}
              icon={
                collapsed && (ticketCounts.pending > 0 || ticketCounts.open > 0) ? (
                  <Badge
                    badgeContent={
                      ticketCounts.pending > 0
                        ? ticketCounts.pending
                        : ticketCounts.open
                    }
                    classes={{
                      root: classes.badgeCollapsed,
                      badge:
                        ticketCounts.pending > 0
                          ? classes.badgePendingColor
                          : classes.badgeOpenColor,
                    }}
                  >
                    <Icons.Tickets />
                  </Badge>
                ) : (
                  <Icons.Tickets />
                )
              }
              extra={
                (ticketCounts.open > 0 || ticketCounts.pending > 0) && (
                  <div className={classes.ticketBadgesWrapper}>
                    {ticketCounts.open > 0 && (
                      <Tooltip
                        title={`Abertos: ${ticketCounts.open}`}
                        arrow
                      >
                        <span className={classes.badgeOpen}>
                          {ticketCounts.open}
                        </span>
                      </Tooltip>
                    )}
                    {ticketCounts.pending > 0 && (
                      <Tooltip
                        title={`Aguardando: ${ticketCounts.pending}`}
                        arrow
                      >
                        <span className={classes.badgePending}>
                          {ticketCounts.pending}
                        </span>
                      </Tooltip>
                    )}
                  </div>
                )
              }
            />

            <ListItemLink
              to="/quick-messages"
              primary="Respostas Rápidas"
              collapsed={collapsed}
              icon={<Icons.QuickMessages />}
            />

            {showKanban && (
              <ListItemLink
                to="/kanban"
                primary="Kanban"
                collapsed={collapsed}
                icon={<Icons.Kanban />}
              />
            )}

            <ListItemLink
              to="/todolist"
              primary="Tarefas"
              collapsed={collapsed}
              icon={<Icons.Tasks />}
            />

            <ListItemLink
              to="/contacts"
              primary="Contatos"
              collapsed={collapsed}
              icon={<Icons.Contacts />}
            />

            {showSchedules && (
              <ListItemLink
                to="/schedules"
                primary="Agendamentos"
                collapsed={collapsed}
                icon={<Icons.Schedules />}
              />
            )}

            <ListItemLink
              to="/tags"
              primary="Etiquetas (Tags)"
              collapsed={collapsed}
              icon={<Icons.Tags />}
            />

            {showInternalChat && (
              <ListItemLink
                to="/chats"
                primary="Chat Interno"
                collapsed={collapsed}
                icon={
                  <Badge
                    color="secondary"
                    variant="dot"
                    invisible={invisible}
                  >
                    <Icons.InternalChat />
                  </Badge>
                }
              />
            )}

            <ListItemLink
              to="/helps"
              primary="Ajuda & Tutoriais"
              collapsed={collapsed}
              icon={<Icons.Helps />}
            />
          </>
        )}
      />

      <Can
        role={user.profile}
        perform={"drawer-admin-items:view"}
        yes={() => (
          <>
            {!collapsed ? (
              <ListSubheader
                className={classes.listSubheader}
                disableSticky={true}
                inset
                color="inherit"
              >
                Gerência
              </ListSubheader>
            ) : (
              <Divider className={classes.collapsedDivider} />
            )}

            <ListItemLink
              to="/"
              primary="Painel de Controle"
              collapsed={collapsed}
              icon={<Icons.Dashboard />}
            />
          </>
        )}
      />

      <Can
        role={user.profile}
        perform="drawer-admin-items:view"
        yes={() => (
          <>
            {showCampaigns && (
              <>
                {!collapsed ? (
                  <ListSubheader
                    className={classes.listSubheader}
                    disableSticky={true}
                    inset
                    color="inherit"
                  >
                    Campanhas
                  </ListSubheader>
                ) : (
                  <Divider className={classes.collapsedDivider} />
                )}

                <ListItemLink
                  to="/campaigns"
                  primary="Campanhas de Disparo"
                  collapsed={collapsed}
                  icon={<Icons.Campaigns />}
                />

                <ListItemLink
                  to="/contact-lists"
                  primary="Listas de Contatos"
                  collapsed={collapsed}
                  icon={<Icons.ContactLists />}
                />

                <ListItemLink
                  to="/campaigns-config"
                  primary="Configurações de Disparo"
                  collapsed={collapsed}
                  icon={<Icons.CampaignsConfig />}
                />
              </>
            )}

            {!collapsed ? (
              <ListSubheader
                className={classes.listSubheader}
                disableSticky={true}
                inset
                color="inherit"
              >
                Administração
              </ListSubheader>
            ) : (
              <Divider className={classes.collapsedDivider} />
            )}

            {user.super && (
              <ListItemLink
                to="/announcements"
                primary="Informativos"
                collapsed={collapsed}
                icon={<Icons.Announcements />}
              />
            )}

            {showOpenAi && (
              <ListItemLink
                to="/prompts"
                primary="Inteligência Artificial"
                collapsed={collapsed}
                icon={<Icons.OpenAi />}
              />
            )}

            {showIntegrations && (
              <ListItemLink
                to="/queue-integration"
                primary="Integrações"
                collapsed={collapsed}
                icon={<Icons.Integrations />}
              />
            )}

            <ListItemLink
              to="/connections"
              primary="Conexões WhatsApp"
              collapsed={collapsed}
              icon={
                <Badge
                  badgeContent={connectionWarning ? "!" : 0}
                  color="error"
                >
                  <Icons.Connections />
                </Badge>
              }
            />

            <ListItemLink
              to="/files"
              primary="Arquivos & Mídias"
              collapsed={collapsed}
              icon={<Icons.Files />}
            />

            <ListItemLink
              to="/queues"
              primary="Filas & Chatbot"
              collapsed={collapsed}
              icon={<Icons.Queues />}
            />

            <ListItemLink
              to="/users"
              primary="Usuários"
              collapsed={collapsed}
              icon={<Icons.Users />}
            />

            {showExternalApi && (
              <ListItemLink
                to="/messages-api"
                primary="API de Mensagens"
                collapsed={collapsed}
                icon={<Icons.MessagesApi />}
              />
            )}

            <ListItemLink
              to="/financeiro"
              primary="Financeiro"
              collapsed={collapsed}
              icon={<Icons.Financeiro />}
            />

            <ListItemLink
              to="/settings"
              primary="Configurações"
              collapsed={collapsed}
              icon={<Icons.Settings />}
            />

            {!collapsed && (
              <div className={classes.versionContainer}>
                <Typography className={classes.versionText}>
                  v{version}
                </Typography>
              </div>
            )}
          </>
        )}
      />

      <Divider className={classes.divider} />

      <div className={classes.logoutSection}>
        {collapsed ? (
          <Tooltip title="Sair do Sistema" placement="right" arrow>
            <ListItem
              button
              dense
              onClick={handleClickLogout}
              className={classes.logoutButton}
            >
              <ListItemIcon className={classes.logoutIcon}>
                <Icons.Logout />
              </ListItemIcon>
            </ListItem>
          </Tooltip>
        ) : (
          <ListItem
            button
            dense
            onClick={handleClickLogout}
            className={classes.logoutButton}
          >
            <ListItemIcon className={classes.logoutIcon}>
              <Icons.Logout />
            </ListItemIcon>
            <ListItemText
              classes={{ primary: classes.logoutText }}
              primary="Sair do Sistema"
            />
          </ListItem>
        )}
      </div>
    </div>
  );
};

export default MainListItems;
