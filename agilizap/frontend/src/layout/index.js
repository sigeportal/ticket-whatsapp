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
import { IconSun, IconMoon, IconRefresh, IconMenu } from "../components/Icons/NavbarIcons";
import { useDate } from "../hooks/useDate";
import ColorModeContext from "../layout/themeContext";

const drawerWidth = 240;

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    height: "100vh",
    overflow: "hidden",
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
    paddingLeft: 24,
    paddingRight: 24,
    minHeight: 64,
    height: 64,
    display: "flex",
    alignItems: "center",
  },
  appBar: {
    zIndex: theme.zIndex.drawer + 2,
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    width: "100%",
    height: 64,
    minHeight: 64,
    backgroundColor: theme.mode === "light" ? "#ffffff" : "#0b1e16",
    color: theme.mode === "light" ? "#0f172a" : "#f0fdf4",
    borderBottom:
      theme.mode === "light"
        ? "1px solid rgba(226, 232, 240, 0.9)"
        : "1px solid rgba(16, 185, 129, 0.15)",
    boxShadow: "none",
  },
  menuButton: {
    width: 40,
    height: 40,
    minWidth: 40,
    borderRadius: 12,
    marginRight: 16,
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: theme.mode === "light" ? "#475569" : "#cbd5e1",
    backgroundColor:
      theme.mode === "light"
        ? "rgba(248, 250, 252, 0.95)"
        : "rgba(255, 255, 255, 0.04)",
    border:
      theme.mode === "light"
        ? "1px solid rgba(226, 232, 240, 0.95)"
        : "1px solid rgba(16, 185, 129, 0.18)",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02)",
    transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
    "&:hover": {
      backgroundColor:
        theme.mode === "light"
          ? "rgba(16, 185, 129, 0.08)"
          : "rgba(37, 211, 102, 0.12)",
      borderColor:
        theme.mode === "light"
          ? "rgba(16, 185, 129, 0.35)"
          : "rgba(37, 211, 102, 0.35)",
      color: theme.mode === "light" ? "#10b981" : "#34d399",
      transform: "translateY(-1px)",
    },
  },
  titleWrapper: {
    display: "flex",
    alignItems: "center",
    flexGrow: 1,
    overflow: "hidden",
    gap: 12,
  },
  onlinePill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 12px 4px 9px",
    borderRadius: 9999,
    fontSize: "0.8125rem",
    fontWeight: 700,
    letterSpacing: "0.01em",
    backgroundColor:
      theme.mode === "light"
        ? "rgba(16, 185, 129, 0.1)"
        : "rgba(16, 185, 129, 0.18)",
    border:
      theme.mode === "light"
        ? "1px solid rgba(16, 185, 129, 0.25)"
        : "1px solid rgba(37, 211, 102, 0.3)",
    color: theme.mode === "light" ? "#065f46" : "#34d399",
    whiteSpace: "nowrap",
    userSelect: "none",
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    backgroundColor: "#10b981",
    marginRight: 8,
    display: "inline-block",
    boxShadow: "0 0 0 2px rgba(16, 185, 129, 0.25)",
  },
  title: {
    fontSize: "0.875rem",
    color: theme.mode === "light" ? "#475569" : "#94a3b8",
    fontWeight: 500,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "flex",
    alignItems: "center",
  },
  userName: {
    fontWeight: 700,
    color: theme.mode === "light" ? "#0f172a" : "#f8fafc",
    marginLeft: 4,
  },
  bulletSeparator: {
    color: theme.mode === "light" ? "#cbd5e1" : "#475569",
    margin: "0 8px",
    fontSize: "0.875rem",
    userSelect: "none",
  },
  companyBadge: {
    fontSize: "0.8125rem",
    padding: "3px 10px",
    borderRadius: 8,
    fontWeight: 600,
    letterSpacing: "0.01em",
    backgroundColor:
      theme.mode === "light"
        ? "rgba(16, 185, 129, 0.08)"
        : "rgba(255, 255, 255, 0.06)",
    border:
      theme.mode === "light"
        ? "1px solid rgba(16, 185, 129, 0.22)"
        : "1px solid rgba(37, 211, 102, 0.22)",
    color: theme.mode === "light" ? "#059669" : "#34d399",
    whiteSpace: "nowrap",
  },
  dueDateBadge: {
    fontSize: "0.75rem",
    padding: "3px 8px",
    borderRadius: 8,
    backgroundColor:
      theme.mode === "light"
        ? "rgba(100, 116, 139, 0.08)"
        : "rgba(255, 255, 255, 0.05)",
    color: theme.mode === "light" ? "#64748b" : "#94a3b8",
    marginLeft: 8,
    whiteSpace: "nowrap",
  },
  topbarActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  actionIconButton: {
    width: 40,
    height: 40,
    minWidth: 40,
    borderRadius: 12,
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: theme.mode === "light" ? "#475569" : "#cbd5e1",
    backgroundColor:
      theme.mode === "light"
        ? "rgba(248, 250, 252, 0.95)"
        : "rgba(255, 255, 255, 0.04)",
    border:
      theme.mode === "light"
        ? "1px solid rgba(226, 232, 240, 0.95)"
        : "1px solid rgba(16, 185, 129, 0.18)",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02)",
    transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
    "&:hover": {
      backgroundColor:
        theme.mode === "light"
          ? "rgba(16, 185, 129, 0.08)"
          : "rgba(37, 211, 102, 0.12)",
      borderColor:
        theme.mode === "light"
          ? "rgba(16, 185, 129, 0.35)"
          : "rgba(37, 211, 102, 0.35)",
      color: theme.mode === "light" ? "#10b981" : "#34d399",
      transform: "translateY(-1px)",
    },
  },
  userAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    color: "#ffffff",
    fontSize: "0.8125rem",
    fontWeight: 700,
    letterSpacing: "-0.01em",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    marginLeft: 4,
    border: "2px solid transparent",
    boxShadow: "0 2px 6px rgba(16, 185, 129, 0.25)",
    transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
    userSelect: "none",
    "&:hover": {
      transform: "scale(1.05)",
      boxShadow: "0 0 0 3px rgba(16, 185, 129, 0.35)",
    },
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
  drawer: {
    width: drawerWidth,
    flexShrink: 0,
    whiteSpace: "nowrap",
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  },
  drawerClose: {
    width: 68,
    flexShrink: 0,
    whiteSpace: "nowrap",
    overflowX: "hidden",
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },
  drawerPaper: {
    position: "fixed",
    top: 64,
    left: 0,
    width: drawerWidth,
    height: "calc(100vh - 64px)",
    backgroundColor: theme.mode === "light" ? "#ffffff" : "#0b1e16",
    borderRight:
      theme.mode === "light"
        ? "1px solid rgba(226, 232, 240, 0.9)"
        : "1px solid rgba(16, 185, 129, 0.18)",
    boxShadow: "none",
    overflowX: "hidden",
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
    scrollbarWidth: "none",
    "&::-webkit-scrollbar": {
      display: "none",
    },
    "-ms-overflow-style": "none",
    [theme.breakpoints.down("xs")]: {
      top: 0,
      height: "100vh",
      zIndex: theme.zIndex.drawer + 5,
    },
  },
  drawerPaperClose: {
    position: "fixed",
    top: 64,
    left: 0,
    width: 68,
    height: "calc(100vh - 64px)",
    backgroundColor: theme.mode === "light" ? "#ffffff" : "#0b1e16",
    borderRight:
      theme.mode === "light"
        ? "1px solid rgba(226, 232, 240, 0.9)"
        : "1px solid rgba(16, 185, 129, 0.18)",
    overflowX: "hidden",
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    scrollbarWidth: "none",
    "&::-webkit-scrollbar": {
      display: "none",
    },
    "-ms-overflow-style": "none",
    "& .MuiListItemText-root": {
      display: "none !important",
    },
    "& .MuiListSubheader-root": {
      display: "none !important",
    },
    "& .MuiListItem-root": {
      justifyContent: "center",
    },
    [theme.breakpoints.down("xs")]: {
      top: 0,
      height: "100vh",
      zIndex: theme.zIndex.drawer + 5,
    },
  },
  appBarSpacer: {
    minHeight: 64,
    height: 64,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    height: "100vh",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
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
        className={drawerOpen ? classes.drawer : classes.drawerClose}
        classes={{
          paper: clsx(
            classes.drawerPaper,
            !drawerOpen && classes.drawerPaperClose
          ),
        }}
        open={drawerOpen}
      >
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
        position="fixed"
        className={classes.appBar}
        elevation={0}
      >
        <Toolbar className={classes.toolbar}>
          <IconButton
            edge="start"
            aria-label="alternar menu"
            onClick={() => setDrawerOpen(!drawerOpen)}
            className={classes.menuButton}
          >
            <IconMenu size={20} />
          </IconButton>

          <div className={classes.titleWrapper}>
            <div className={classes.onlinePill}>
              <span className={classes.onlineDot} />
              Online
            </div>

            <Typography
              component="div"
              variant="subtitle1"
              noWrap
              className={classes.title}
            >
              <span>Olá,</span>
              <span className={classes.userName}>{user?.name || "Admin"}</span>
              {user?.company?.name && (
                <>
                  <span className={classes.bulletSeparator}>•</span>
                  <span className={classes.companyBadge}>
                    {user.company.name}
                  </span>
                </>
              )}
              {greaterThenSm && user?.profile === "admin" && user?.company?.dueDate && (
                <span className={classes.dueDateBadge}>
                  Ativo até {dateToClient(user?.company?.dueDate)}
                </span>
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
                className={classes.actionIconButton}
                aria-label="Alternar tema"
              >
                {theme.mode === "dark" ? (
                  <IconSun size={19} />
                ) : (
                  <IconMoon size={19} />
                )}
              </IconButton>
            </Tooltip>

            <AnnouncementsPopover />

            <Tooltip title={i18n.t("mainDrawer.appBar.refresh")} arrow>
              <IconButton
                onClick={handleRefreshPage}
                aria-label={i18n.t("mainDrawer.appBar.refresh")}
                className={classes.actionIconButton}
              >
                <IconRefresh size={19} />
              </IconButton>
            </Tooltip>

            <ChatPopover />

            {user?.id && <NotificationsPopOver volume={volume} />}

            <NotificationsVolume setVolume={setVolume} volume={volume} />

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
                  className={classes.userAvatarCircle}
                >
                  {user?.name ? user.name.slice(0, 2).toUpperCase() : "AD"}
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
