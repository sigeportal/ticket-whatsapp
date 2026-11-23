import React, { useState, useContext, useEffect } from "react";
import clsx from "clsx";
import { Link as RouterLink } from "react-router-dom";
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
  Tooltip,
} from "@material-ui/core";

import PersonOutlineIcon from "@material-ui/icons/PersonOutline";
import ExitToAppIcon from "@material-ui/icons/ExitToApp";

import MainListItems from "./MainListItems";
import NotificationsPopOver from "../components/NotificationsPopOver";
import NotificationsVolume from "../components/NotificationsVolume";
import UserModal from "../components/UserModal";
import PortAiLogo from "../components/PortAiLogo";
import { AuthContext } from "../context/Auth/AuthContext";
import BackdropLoading from "../components/BackdropLoading";
import { i18n } from "../translate/i18n";
import toastError from "../errors/toastError";
import AnnouncementsPopover from "../components/AnnouncementsPopover";
import { SocketContext } from "../context/Socket/SocketContext";
import ChatPopover from "../pages/Chat/ChatPopover";
import { IconSun, IconMoon, IconRefresh, IconMenu } from "../components/Icons/NavbarIcons";
import { useDate } from "../hooks/useDate";
import ColorModeContext from "../layout/themeContext";

const drawerWidth = 248;

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    height: "100vh",
    overflow: "hidden",
    backgroundColor: "var(--bg-canvas)",
    color: "var(--ink-primary)",
  },
  toolbar: {
    paddingLeft: 16,
    paddingRight: 20,
    minHeight: 64,
    height: 64,
    display: "flex",
    alignItems: "center",
    gap: 12,
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
    backgroundColor: "var(--bg-surface)",
    color: "var(--ink-primary)",
    borderBottom: "1px solid var(--border-hairline)",
    boxShadow: "none",
  },
  brandZone: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    paddingRight: 16,
    marginRight: 4,
    borderRight: "1px solid var(--border-hairline)",
    height: 36,
    [theme.breakpoints.down("xs")]: {
      paddingRight: 8,
      borderRight: "none",
    },
  },
  brandLink: {
    display: "inline-flex",
    alignItems: "center",
    textDecoration: "none",
    borderRadius: 8,
    padding: "2px 4px",
  },
  menuButton: {
    width: 38,
    height: 38,
    minWidth: 38,
    borderRadius: 10,
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--ink-secondary)",
    backgroundColor: "var(--field-bg)",
    border: "1px solid var(--border-hairline)",
    transition: "all var(--t-in) var(--ease-ui)",
    "&:hover": {
      backgroundColor: "var(--action-soft)",
      borderColor: "var(--border-strong)",
      color: "var(--action)",
    },
  },
  titleWrapper: {
    display: "flex",
    alignItems: "center",
    flexGrow: 1,
    overflow: "hidden",
    gap: 10,
  },
  onlinePill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px 4px 8px",
    borderRadius: 9999,
    fontFamily: "var(--font-mono)",
    fontSize: "0.72rem",
    fontWeight: 600,
    letterSpacing: "0.03em",
    textTransform: "uppercase",
    backgroundColor: "var(--action-soft)",
    border: "1px solid var(--border-strong)",
    color: "var(--action)",
    whiteSpace: "nowrap",
    userSelect: "none",
    [theme.breakpoints.down("xs")]: {
      display: "none",
    },
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    backgroundColor: "#25D366",
    marginRight: 7,
    display: "inline-block",
    boxShadow: "0 0 0 2px rgba(37, 211, 102, 0.24)",
  },
  title: {
    fontSize: "0.875rem",
    color: "var(--ink-secondary)",
    fontWeight: 500,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "flex",
    alignItems: "center",
  },
  userName: {
    fontFamily: "var(--font-display)",
    fontWeight: 600,
    color: "var(--ink-primary)",
    marginLeft: 4,
  },
  bulletSeparator: {
    color: "var(--ink-muted)",
    margin: "0 8px",
    fontSize: "0.875rem",
    userSelect: "none",
    opacity: 0.5,
  },
  companyBadge: {
    fontSize: "0.78rem",
    padding: "3px 9px",
    borderRadius: 6,
    fontWeight: 600,
    backgroundColor: "var(--bg-subtle)",
    border: "1px solid var(--border-hairline)",
    color: "var(--ink-primary)",
    whiteSpace: "nowrap",
  },
  dueDateBadge: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.72rem",
    padding: "3px 8px",
    borderRadius: 6,
    backgroundColor: "var(--bg-subtle)",
    border: "1px solid var(--border-hairline)",
    color: "var(--ink-muted)",
    marginLeft: 8,
    whiteSpace: "nowrap",
  },
  topbarActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  actionIconButton: {
    width: 38,
    height: 38,
    minWidth: 38,
    borderRadius: 10,
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--ink-secondary)",
    backgroundColor: "var(--field-bg)",
    border: "1px solid var(--border-hairline)",
    transition: "all var(--t-in) var(--ease-ui)",
    "&:hover": {
      backgroundColor: "var(--action-soft)",
      borderColor: "var(--border-strong)",
      color: "var(--action)",
    },
  },
  userAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "var(--action)",
    color: "var(--action-ink)",
    fontFamily: "var(--font-display)",
    fontSize: "0.8125rem",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    marginLeft: 4,
    border: "1px solid transparent",
    transition: "all var(--t-in) var(--ease-ui)",
    userSelect: "none",
    "&:hover": {
      backgroundColor: "var(--action-hover)",
      transform: "translateY(-1px)",
    },
  },
  profileMenuPaper: {
    minWidth: 215,
    borderRadius: 12,
    marginTop: 8,
    backgroundColor: "var(--bg-elevated)",
    boxShadow: "var(--shadow-popover)",
    border: "1px solid var(--border-hairline)",
  },
  menuHeader: {
    padding: "12px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  menuUserName: {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: "0.875rem",
    color: "var(--ink-primary)",
  },
  menuUserEmail: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.72rem",
    color: "var(--ink-muted)",
  },
  menuItem: {
    fontSize: "0.875rem",
    padding: "8px 14px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: "var(--ink-primary)",
    "&:hover": {
      backgroundColor: "var(--action-soft)",
      color: "var(--action)",
    },
  },
  menuItemDanger: {
    fontSize: "0.875rem",
    padding: "8px 14px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: "var(--status-danger)",
    "&:hover": {
      backgroundColor: "var(--status-danger-bg)",
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
    backgroundColor: "var(--bg-surface)",
    borderRight: "1px solid var(--border-hairline)",
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
    backgroundColor: "var(--bg-surface)",
    borderRight: "1px solid var(--border-hairline)",
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
    backgroundColor: "var(--bg-canvas)",
  },
  containerWithScroll: {
    flex: 1,
    padding: "10px 0 8px",
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
    overflowX: "hidden",
    scrollbarWidth: "none",
    "&::-webkit-scrollbar": {
      display: "none",
    },
    "-ms-overflow-style": "none",
  },
}));

const LoggedInLayout = ({ children }) => {
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

      <AppBar position="fixed" className={classes.appBar} elevation={0}>
        <Toolbar className={classes.toolbar}>
          <div className={classes.brandZone}>
            <IconButton
              edge="start"
              aria-label="alternar menu"
              onClick={() => setDrawerOpen(!drawerOpen)}
              className={classes.menuButton}
            >
              <IconMenu size={19} />
            </IconButton>

            <RouterLink to="/" className={classes.brandLink} aria-label="PortAI Início">
              {greaterThenSm ? (
                <PortAiLogo variant="compact" size={30} />
              ) : (
                <PortAiLogo variant="icon" size={30} />
              )}
            </RouterLink>
          </div>

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
                  Vence {dateToClient(user?.company?.dueDate)}
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
                  <IconSun size={18} />
                ) : (
                  <IconMoon size={18} />
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
                <IconRefresh size={18} />
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
                <Divider style={{ backgroundColor: "var(--border-hairline)" }} />
                <MenuItem
                  onClick={handleOpenUserModal}
                  className={classes.menuItem}
                >
                  <PersonOutlineIcon style={{ fontSize: 18 }} />
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
