import React, { useState, useContext, useEffect } from "react";
import clsx from "clsx";
import moment from "moment";
import {
  makeStyles,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  MenuItem,
  IconButton,
  Menu,
  useTheme,
  useMediaQuery,
  Avatar,
  Tooltip,
} from "@material-ui/core";

import MenuIcon from "@material-ui/icons/Menu";
import ChevronLeftIcon from "@material-ui/icons/ChevronLeft";
import CachedIcon from "@material-ui/icons/Cached";
import PersonIcon from "@material-ui/icons/Person";
import ExitToAppIcon from "@material-ui/icons/ExitToApp";
import Brightness4Icon from "@material-ui/icons/Brightness4";
import Brightness7Icon from "@material-ui/icons/Brightness7";

import MainListItems from "./MainListItems";
import NotificationsPopOver from "../components/NotificationsPopOver";
import NotificationsVolume from "../components/NotificationsVolume";
import UserModal from "../components/UserModal";
import { AuthContext } from "../context/Auth/AuthContext";
import BackdropLoading from "../components/BackdropLoading";
import DarkMode from "../components/DarkMode";
import { i18n } from "../translate/i18n";
import toastError from "../errors/toastError";
import AnnouncementsPopover from "../components/AnnouncementsPopover";
import { SocketContext } from "../context/Socket/SocketContext";
import ChatPopover from "../pages/Chat/ChatPopover";
import PortAiLogo from "../components/PortAiLogo";
import { useDate } from "../hooks/useDate";
import ColorModeContext from "../layout/themeContext";

const drawerWidth = 240;

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    height: "100vh",
    [theme.breakpoints.down("sm")]: {
      height: "calc(100vh - 56px)",
    },
    backgroundColor: theme.mode === "light" ? "#f8fafc" : "#07130e",
    "& .MuiButton-outlinedPrimary": {
      color: theme.mode === "light" ? "#064e3b" : "#f0fdf4",
      backgroundColor: theme.mode === "light" ? "rgba(16, 185, 129, 0.1)" : "rgba(37, 211, 102, 0.15)",
      borderColor: theme.mode === "light" ? "#10b981" : "#25D366",
    },
    "& .MuiTab-textColorPrimary.Mui-selected": {
      color: theme.mode === "light" ? "#064e3b" : "#25D366",
    },
  },
  toolbar: {
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
    minHeight: 60,
    [theme.breakpoints.down("xs")]: {
      minHeight: 56,
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
    },
    display: "flex",
    alignItems: "center",
  },
  toolbarIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 12px 0 16px",
    minHeight: 60,
    height: 60,
    borderBottom:
      theme.mode === "light"
        ? "1px solid rgba(226, 232, 240, 0.9)"
        : "1px solid rgba(16, 185, 129, 0.18)",
    [theme.breakpoints.down("sm")]: {
      height: 56,
      minHeight: 56,
    },
  },
  appBar: {
    zIndex: theme.zIndex.drawer + 1,
    backgroundColor:
      theme.mode === "light"
        ? "#ffffff"
        : "#0b1e16",
    color: theme.mode === "light" ? "#0f172a" : "#f0fdf4",
    borderBottom:
      theme.mode === "light"
        ? "1px solid rgba(226, 232, 240, 0.9)"
        : "1px solid rgba(16, 185, 129, 0.18)",
    boxShadow: "none",
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },
  appBarShift: {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
    [theme.breakpoints.down("sm")]: {
      display: "none",
    },
  },
  menuButton: {
    marginRight: theme.spacing(1.5),
    borderRadius: 10,
    padding: 8,
    color: theme.mode === "light" ? "#475569" : "#cbd5e1",
    transition: "all 0.2s ease-in-out",
    "&:hover": {
      backgroundColor:
        theme.mode === "light"
          ? "rgba(16, 185, 129, 0.08)"
          : "rgba(255, 255, 255, 0.08)",
      color: "#10b981",
    },
  },
  menuButtonHidden: {
    display: "none",
  },
  titleWrapper: {
    display: "flex",
    alignItems: "center",
    flexGrow: 1,
    overflow: "hidden",
  },
  onlinePill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 9px",
    borderRadius: 14,
    fontSize: "0.75rem",
    fontWeight: 600,
    backgroundColor:
      theme.mode === "light"
        ? "rgba(16, 185, 129, 0.1)"
        : "rgba(16, 185, 129, 0.18)",
    color: theme.mode === "light" ? "#059669" : "#34d399",
    marginRight: theme.spacing(1.5),
    whiteSpace: "nowrap",
    letterSpacing: "0.01em",
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    backgroundColor: "#10b981",
    marginRight: 6,
    display: "inline-block",
  },
  title: {
    fontSize: "0.9375rem",
    color: theme.mode === "light" ? "#1e293b" : "#f1f5f9",
    fontWeight: 500,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  userName: {
    fontWeight: 700,
    color: theme.mode === "light" ? "#0f172a" : "#ffffff",
  },
  companyBadge: {
    fontSize: "0.75rem",
    padding: "2px 8px",
    borderRadius: 6,
    fontWeight: 600,
    backgroundColor:
      theme.mode === "light"
        ? "rgba(16, 185, 129, 0.08)"
        : "rgba(255, 255, 255, 0.08)",
    color: theme.mode === "light" ? "#059669" : "#34d399",
    marginLeft: 4,
  },
  dueDateBadge: {
    fontSize: "0.75rem",
    padding: "2px 8px",
    borderRadius: 6,
    backgroundColor:
      theme.mode === "light"
        ? "rgba(100, 116, 139, 0.08)"
        : "rgba(255, 255, 255, 0.06)",
    color: theme.mode === "light" ? "#64748b" : "#94a3b8",
    marginLeft: 4,
  },
  topbarActions: {
    display: "flex",
    alignItems: "center",
  },
  actionIconButton: {
    padding: 8,
    borderRadius: 10,
    marginLeft: 3,
    marginRight: 3,
    color: theme.mode === "light" ? "#1e293b" : "#f0fdf4",
    backgroundColor:
      theme.mode === "light"
        ? "rgba(0, 0, 0, 0.04)"
        : "rgba(255, 255, 255, 0.06)",
    border:
      theme.mode === "light"
        ? "1px solid rgba(226, 232, 240, 0.9)"
        : "1px solid rgba(16, 185, 129, 0.18)",
    transition: "all 0.2s ease-in-out",
    "&:hover": {
      backgroundColor:
        theme.mode === "light"
          ? "rgba(16, 185, 129, 0.12)"
          : "rgba(37, 211, 102, 0.18)",
      color: theme.mode === "light" ? "#065f46" : "#25D366",
      transform: "translateY(-1px)",
    },
  },
  themeToggleBtn: {
    padding: 8,
    borderRadius: 10,
    marginLeft: 3,
    marginRight: 3,
    color: theme.mode === "dark" ? "#fbbf24" : "#1e293b",
    backgroundColor:
      theme.mode === "light"
        ? "rgba(0, 0, 0, 0.04)"
        : "rgba(255, 255, 255, 0.06)",
    border:
      theme.mode === "light"
        ? "1px solid rgba(226, 232, 240, 0.9)"
        : "1px solid rgba(16, 185, 129, 0.18)",
    transition: "all 0.2s ease-in-out",
    "&:hover": {
      backgroundColor:
        theme.mode === "light"
          ? "rgba(16, 185, 129, 0.12)"
          : "rgba(251, 191, 36, 0.16)",
      transform: "scale(1.05)",
    },
  },
  profileBadge: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "3px 8px 3px 4px",
    borderRadius: 12,
    marginLeft: 6,
    cursor: "pointer",
    userSelect: "none",
    border:
      theme.mode === "light"
        ? "1px solid rgba(226, 232, 240, 0.9)"
        : "1px solid rgba(16, 185, 129, 0.22)",
    backgroundColor:
      theme.mode === "light"
        ? "rgba(255, 255, 255, 0.85)"
        : "rgba(11, 30, 22, 0.75)",
    transition: "all 0.2s ease-in-out",
    "&:hover": {
      backgroundColor:
        theme.mode === "light"
          ? "rgba(16, 185, 129, 0.08)"
          : "rgba(16, 185, 129, 0.16)",
      borderColor: "#10b981",
    },
  },
  profileAvatarSquircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    background: "linear-gradient(135deg, #10b981 0%, #0d9488 100%)",
    color: "#ffffff",
    fontSize: "0.75rem",
    fontWeight: 800,
    letterSpacing: "-0.02em",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "none",
    flexShrink: 0,
  },
  profileMeta: {
    display: "flex",
    flexDirection: "column",
    textAlign: "left",
    lineHeight: 1.15,
  },
  profileNameText: {
    fontSize: "0.8125rem",
    fontWeight: 700,
    color: theme.mode === "light" ? "#0f172a" : "#f0fdf4",
    maxWidth: 130,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  profileRoleText: {
    fontSize: "0.625rem",
    fontWeight: 600,
    color: theme.mode === "light" ? "#059669" : "#34d399",
    letterSpacing: "0.02em",
  },
  profileMenuPaper: {
    minWidth: 200,
    borderRadius: 12,
    marginTop: 8,
    boxShadow:
      theme.mode === "light"
        ? "0 4px 12px rgba(0, 0, 0, 0.08)"
        : "0 4px 16px rgba(0, 0, 0, 0.45)",
    border:
      theme.mode === "light"
        ? "1px solid rgba(226, 232, 240, 0.9)"
        : "1px solid rgba(16, 185, 129, 0.18)",
  },
  menuHeader: {
    padding: "10px 16px",
    display: "flex",
    flexDirection: "column",
  },
  menuUserName: {
    fontWeight: 600,
    fontSize: "0.875rem",
    color: theme.mode === "light" ? "#1e293b" : "#f8fafc",
  },
  menuUserEmail: {
    fontSize: "0.75rem",
    color: theme.mode === "light" ? "#64748b" : "#94a3b8",
  },
  menuItem: {
    fontSize: "0.875rem",
    padding: "8px 16px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    "&:hover": {
      backgroundColor:
        theme.mode === "light"
          ? "rgba(16, 185, 129, 0.08)"
          : "rgba(255, 255, 255, 0.08)",
      color: "#10b981",
    },
  },
  menuItemDanger: {
    fontSize: "0.875rem",
    padding: "8px 16px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: theme.mode === "light" ? "#dc2626" : "#f87171",
    "&:hover": {
      backgroundColor:
        theme.mode === "light"
          ? "rgba(239, 68, 68, 0.08)"
          : "rgba(239, 68, 68, 0.15)",
    },
  },
  drawerPaper: {
    position: "relative",
    whiteSpace: "nowrap",
    width: drawerWidth,
    backgroundColor: theme.mode === "light" ? "#ffffff" : "#0b1e16",
    borderRight:
      theme.mode === "light"
        ? "1px solid rgba(226, 232, 240, 0.9)"
        : "1px solid rgba(16, 185, 129, 0.18)",
    boxShadow: "none",
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
    [theme.breakpoints.down("sm")]: {
      width: "100%",
    },
    scrollbarWidth: "none",
    "&::-webkit-scrollbar": {
      display: "none",
    },
    "-ms-overflow-style": "none",
  },
  drawerPaperClose: {
    overflowX: "hidden",
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    width: 68,
    [theme.breakpoints.up("sm")]: {
      width: 68,
    },
    [theme.breakpoints.down("sm")]: {
      width: "100%",
    },
    "& .MuiListItemText-root": {
      display: "none !important",
    },
    "& .MuiListSubheader-root": {
      display: "none !important",
    },
    "& .MuiListItem-root": {
      justifyContent: "center",
    },
  },
  portalBrand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    paddingLeft: 4,
    textDecoration: "none",
  },
  portalLogoBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "none",
    flexShrink: 0,
  },
  portalLogoBadgeCollapsed: {
    width: 36,
    height: 36,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "none",
    transition: "all 0.2s ease-in-out",
    "&:hover": {
      transform: "scale(1.05)",
    },
  },
  portalTextWrapper: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  portalTitle: {
    fontFamily: "'Montserrat', sans-serif",
    fontSize: "1.15rem",
    fontWeight: 800,
    letterSpacing: "0.06em",
    color: theme.mode === "light" ? "#0f172a" : "#ffffff",
    lineHeight: 1.1,
  },
  portalSubtitle: {
    fontSize: "0.625rem",
    fontWeight: 700,
    letterSpacing: "0.14em",
    color: "#10b981",
    lineHeight: 1.3,
    marginTop: 2,
  },
  toolbarIconCollapsed: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    minHeight: "60px",
    height: "60px",
    cursor: "pointer",
  },
  drawerCloseButton: {
    borderRadius: 8,
    padding: 6,
    color: theme.mode === "light" ? "#64748b" : "#94a3b8",
    transition: "all 0.2s ease-in-out",
    "&:hover": {
      backgroundColor:
        theme.mode === "light"
          ? "rgba(16, 185, 129, 0.08)"
          : "rgba(255, 255, 255, 0.08)",
      color: "#10b981",
    },
  },
  appBarSpacer: {
    minHeight: 60,
    [theme.breakpoints.down("xs")]: {
      minHeight: 56,
    },
  },
  content: {
    flex: 1,
    overflow: "auto",
    backgroundColor: theme.mode === "light" ? "#f8fafc" : "#0f172a",
  },
  containerWithScroll: {
    flex: 1,
    padding: "6px 0",
    overflowY: "auto",
    overflowX: "hidden",
    scrollbarWidth: "none",
    "&::-webkit-scrollbar": {
      display: "none",
    },
    "-ms-overflow-style": "none",
  },
}));

const LoggedInLayout = ({ children, themeToggle }) => {
  const classes = useStyles();
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { handleLogout, loading, user } = useContext(AuthContext);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerVariant, setDrawerVariant] = useState("permanent");

  const theme = useTheme();
  const { colorMode } = useContext(ColorModeContext);
  const greaterThenSm = useMediaQuery(theme.breakpoints.up("sm"));

  const [volume, setVolume] = useState(localStorage.getItem("volume") || 1);
  const { dateToClient } = useDate();
  const socketManager = useContext(SocketContext);

  useEffect(() => {
    if (document.body.offsetWidth > 1200) {
      setDrawerOpen(true);
    }
  }, []);

  useEffect(() => {
    if (document.body.offsetWidth < 600) {
      setDrawerVariant("temporary");
    } else {
      setDrawerVariant("permanent");
    }
  }, [drawerOpen]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const userId = localStorage.getItem("userId");

    const socket = socketManager.getSocket(companyId);

    socket.on(`company-${companyId}-auth`, (data) => {
      if (data.user.id === +userId) {
        toastError("Sua conta foi acessada em outro computador.");
        setTimeout(() => {
          localStorage.clear();
          window.location.reload();
        }, 1000);
      }
    });

    socket.emit("userStatus");
    const interval = setInterval(() => {
      socket.emit("userStatus");
    }, 1000 * 60 * 5);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [socketManager]);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
    setMenuOpen(true);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setMenuOpen(false);
  };

  const handleOpenUserModal = () => {
    setUserModalOpen(true);
    handleCloseMenu();
  };

  const handleClickLogout = () => {
    handleCloseMenu();
    handleLogout();
  };

  const drawerClose = () => {
    if (document.body.offsetWidth < 600) {
      setDrawerOpen(false);
    }
  };

  const handleRefreshPage = () => {
    window.location.reload(false);
  };

  const toggleColorMode = () => {
    colorMode.toggleColorMode();
  };

  if (loading) {
    return <BackdropLoading />;
  }

  return (
    <div className={classes.root}>
      <Drawer
        variant={drawerVariant}
        className={drawerOpen ? classes.drawerPaper : classes.drawerPaperClose}
        classes={{
          paper: clsx(
            classes.drawerPaper,
            !drawerOpen && classes.drawerPaperClose
          ),
        }}
        open={drawerOpen}
      >
        <div
          className={drawerOpen ? classes.toolbarIcon : classes.toolbarIconCollapsed}
          onClick={!drawerOpen ? () => setDrawerOpen(true) : undefined}
          title={!drawerOpen ? "Expandir menu (Portal)" : undefined}
        >
          {drawerOpen ? (
            <>
              <div style={{ display: "flex", alignItems: "center" }}>
                <PortAiLogo variant="full" width={150} height={48} />
              </div>
              <IconButton
                onClick={(e) => {
                  e.stopPropagation();
                  setDrawerOpen(false);
                }}
                className={classes.drawerCloseButton}
                size="small"
              >
                <ChevronLeftIcon />
              </IconButton>
            </>
          ) : (
            <Tooltip title="PortAI (Clique para expandir)" placement="right" arrow>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}>
                <PortAiLogo variant="icon" size={36} />
              </div>
            </Tooltip>
          )}
        </div>
        <Divider />
        <List className={classes.containerWithScroll}>
          <MainListItems drawerClose={drawerClose} collapsed={!drawerOpen} />
        </List>
      </Drawer>

      <UserModal
        open={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        userId={user?.id}
      />

      <AppBar
        position="absolute"
        className={clsx(classes.appBar, drawerOpen && classes.appBarShift)}
        elevation={0}
      >
        <Toolbar variant="dense" className={classes.toolbar}>
          <IconButton
            edge="start"
            aria-label="abrir menu"
            onClick={() => setDrawerOpen(!drawerOpen)}
            className={clsx(
              classes.menuButton,
              drawerOpen && classes.menuButtonHidden
            )}
          >
            <MenuIcon />
          </IconButton>

          <div className={classes.titleWrapper}>
            <div className={classes.onlinePill}>
              <span className={classes.onlineDot} />
              Online
            </div>

            <Typography
              component="h2"
              variant="subtitle1"
              noWrap
              className={classes.title}
            >
              {greaterThenSm && user?.profile === "admin" && user?.company?.dueDate ? (
                <>
                  Olá, <span className={classes.userName}>{user.name}</span>
                  {user?.company?.name && (
                    <span className={classes.companyBadge}>
                      {user.company.name}
                    </span>
                  )}
                  <span className={classes.dueDateBadge}>
                    Ativo até {dateToClient(user?.company?.dueDate)}
                  </span>
                </>
              ) : (
                <>
                  Olá, <span className={classes.userName}>{user.name}</span>
                  {user?.company?.name && (
                    <span className={classes.companyBadge}>
                      {user.company.name}
                    </span>
                  )}
                </>
              )}
            </Typography>
          </div>

          <div className={classes.topbarActions}>
            <Tooltip
              title={theme.mode === "dark" ? "Modo Claro" : "Modo Escuro"}
              arrow
            >
              <IconButton
                onClick={toggleColorMode}
                className={classes.themeToggleBtn}
                aria-label="Alternar tema"
              >
                {theme.mode === "dark" ? (
                  <Brightness7Icon style={{ fontSize: 20 }} />
                ) : (
                  <Brightness4Icon style={{ fontSize: 20 }} />
                )}
              </IconButton>
            </Tooltip>

            <NotificationsVolume setVolume={setVolume} volume={volume} />

            <Tooltip title={i18n.t("mainDrawer.appBar.refresh")} arrow>
              <IconButton
                onClick={handleRefreshPage}
                aria-label={i18n.t("mainDrawer.appBar.refresh")}
                className={classes.actionIconButton}
              >
                <CachedIcon style={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>

            {user.id && <NotificationsPopOver volume={volume} />}

            <AnnouncementsPopover />

            <ChatPopover />

            <div>
              <Tooltip title={user?.name || "Meu Perfil"} arrow>
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="conta do usuário atual"
                  aria-controls="menu-appbar"
                  aria-haspopup="true"
                  onClick={handleMenu}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") handleMenu(e);
                  }}
                  className={classes.profileBadge}
                >
                  <div className={classes.profileAvatarSquircle}>
                    {user?.name ? user.name.slice(0, 2).toUpperCase() : "AD"}
                  </div>
                  {greaterThenSm && (
                    <div className={classes.profileMeta}>
                      <span className={classes.profileNameText}>
                        {user?.name || "Admin"}
                      </span>
                      <span className={classes.profileRoleText}>
                        Online • Smart CX
                      </span>
                    </div>
                  )}
                </div>
              </Tooltip>
              <Menu
                id="menu-appbar"
                anchorEl={anchorEl}
                getContentAnchorEl={null}
                anchorOrigin={{
                  vertical: "bottom",
                  horizontal: "right",
                }}
                transformOrigin={{
                  vertical: "top",
                  horizontal: "right",
                }}
                classes={{ paper: classes.profileMenuPaper }}
                open={menuOpen}
                onClose={handleCloseMenu}
              >
                <div className={classes.menuHeader}>
                  <Typography className={classes.menuUserName}>
                    {user?.name}
                  </Typography>
                  <Typography className={classes.menuUserEmail}>
                    {user?.email || user?.company?.name}
                  </Typography>
                </div>
                <Divider />
                <MenuItem
                  onClick={handleOpenUserModal}
                  className={classes.menuItem}
                >
                  <PersonIcon style={{ fontSize: 18 }} />
                  {i18n.t("mainDrawer.appBar.user.profile")}
                </MenuItem>
                <MenuItem
                  onClick={handleClickLogout}
                  className={classes.menuItemDanger}
                >
                  <ExitToAppIcon style={{ fontSize: 18 }} />
                  {i18n.t("Sair")}
                </MenuItem>
              </Menu>
            </div>
          </div>
        </Toolbar>
      </AppBar>

      <main className={classes.content}>
        <div className={classes.appBarSpacer} />
        {children ? children : null}
      </main>
    </div>
  );
};

export default LoggedInLayout;
