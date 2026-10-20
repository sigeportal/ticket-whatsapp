import React, { useContext, useEffect, useRef, useState } from "react";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import SearchIcon from "@material-ui/icons/Search";
import InputBase from "@material-ui/core/InputBase";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import MoveToInboxIcon from "@material-ui/icons/MoveToInbox";
import CheckBoxIcon from "@material-ui/icons/CheckBox";
import api from "../../services/api";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";
import PlaylistAddCheckOutlinedIcon from "@material-ui/icons/PlaylistAddCheckOutlined";
import AddIcon from "@material-ui/icons/Add";
import Tooltip from "@material-ui/core/Tooltip";
import { Button, Snackbar, IconButton } from "@material-ui/core";

import NewTicketModal from "../NewTicketModal";
import TicketsList from "../TicketsListCustom";
import TabPanel from "../TabPanel";

import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../Can";
import TicketsQueueSelect from "../TicketsQueueSelect";
import { TagsFilter } from "../TagsFilter";
import { UsersFilter } from "../UsersFilter";

const useStyles = makeStyles((theme) => ({
  ticketsWrapper: {
    position: "relative",
    display: "flex",
    height: "100%",
    flexDirection: "column",
    overflow: "hidden",
    borderRadius: 0,
    backgroundColor: theme.palette.type === "dark" ? "#0b1e16" : "#ffffff",
    borderRight: `1px solid ${
      theme.palette.type === "dark" ? "rgba(16, 185, 129, 0.18)" : "rgba(226, 232, 240, 0.9)"
    }`,
  },

  tabsHeader: {
    flex: "none",
    backgroundColor: theme.palette.type === "dark" ? "#07130e" : "#f8fafc",
    borderBottom: `1px solid ${
      theme.palette.type === "dark" ? "rgba(16, 185, 129, 0.15)" : "#e2e8f0"
    }`,
  },

  tabsIndicator: {
    backgroundColor: theme.palette.type === "dark" ? "#25d366" : "#10b981",
    height: 3,
    borderRadius: "3px 3px 0 0",
  },

  tab: {
    minWidth: 0,
    minHeight: 46,
    flex: 1,
    padding: "8px 10px",
    textTransform: "none",
    fontWeight: 600,
    fontSize: "0.82rem",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    transition: "all 0.2s ease",
    "&$tabSelected": {
      color: theme.palette.type === "dark" ? "#34d399 !important" : "#059669 !important",
      fontWeight: 700,
    },
    "&:hover": {
      color: theme.palette.type === "dark" ? "#34d399" : "#10b981",
      opacity: 1,
    },
  },

  tabSelected: {
    color: theme.palette.type === "dark" ? "#34d399 !important" : "#059669 !important",
  },

  subTabsContainer: {
    flex: "none",
    backgroundColor: theme.palette.type === "dark" ? "#07130e" : "#f1f5f9",
    padding: "4px 8px",
    borderBottom: `1px solid ${
      theme.palette.type === "dark" ? "rgba(16, 185, 129, 0.15)" : "#e2e8f0"
    }`,
  },

  subTabs: {
    minHeight: 38,
  },

  subTab: {
    minHeight: 36,
    padding: "6px 12px",
    textTransform: "none",
    fontWeight: 600,
    fontSize: "0.82rem",
    borderRadius: 8,
    minWidth: "auto",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    transition: "all 0.2s ease",
    "&$tabSelected": {
      color: "#10b981",
      backgroundColor:
        theme.palette.type === "dark" ? "rgba(16, 185, 129, 0.12)" : "#ffffff",
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    },
  },

  badgeOpen: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    color: "#059669",
    borderRadius: 12,
    padding: "2px 8px",
    fontSize: "0.72rem",
    fontWeight: 700,
    marginLeft: 6,
  },

  badgePending: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    color: "#d97706",
    borderRadius: 12,
    padding: "2px 8px",
    fontSize: "0.72rem",
    fontWeight: 700,
    marginLeft: 6,
  },

  ticketOptionsBox: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.palette.type === "dark" ? "#07130e" : "#f8fafc",
    padding: "8px 12px",
    gap: "8px",
    borderBottom: `1px solid ${
      theme.palette.type === "dark" ? "rgba(16, 185, 129, 0.15)" : "#e2e8f0"
    }`,
  },

  serachInputWrapper: {
    flex: 1,
    backgroundColor: theme.palette.type === "dark" ? "#0b1e16" : "#ffffff",
    display: "flex",
    alignItems: "center",
    borderRadius: 10,
    padding: "5px 12px",
    transition: "all 0.2s ease",
    border: `1px solid ${
      theme.palette.type === "dark" ? "rgba(16, 185, 129, 0.2)" : "rgba(226, 232, 240, 0.9)"
    }`,
    "&:focus-within": {
      borderColor: "#10b981",
      boxShadow: "0 0 0 3px rgba(16, 185, 129, 0.15)",
    },
  },

  searchIcon: {
    color: "#10b981",
    marginRight: 8,
    fontSize: 20,
  },

  searchInput: {
    flex: 1,
    fontSize: "0.86rem",
    color: theme.palette.type === "dark" ? "#e2e8f0" : "#1e293b",
  },

  newTicketButton: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: theme.palette.type === "dark" ? "rgba(16, 185, 129, 0.15)" : "#ecfdf5",
    color: theme.palette.type === "dark" ? "#34d399" : "#059669",
    border: `1px solid ${
      theme.palette.type === "dark" ? "rgba(16, 185, 129, 0.3)" : "rgba(16, 185, 129, 0.25)"
    }`,
    transition: "all 0.2s ease",
    "&:hover": {
      backgroundColor: "#10b981",
      color: "#ffffff",
      boxShadow: "0 2px 8px rgba(16, 185, 129, 0.35)",
    },
  },

  closeAllButton: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: theme.palette.type === "dark" ? "rgba(239, 68, 68, 0.12)" : "#fef2f2",
    color: theme.palette.type === "dark" ? "#f87171" : "#dc2626",
    border: `1px solid ${
      theme.palette.type === "dark" ? "rgba(239, 68, 68, 0.25)" : "rgba(239, 68, 68, 0.2)"
    }`,
    transition: "all 0.2s ease",
    "&:hover": {
      backgroundColor: "#ef4444",
      color: "#ffffff",
      boxShadow: "0 2px 8px rgba(239, 68, 68, 0.35)",
    },
  },

  switchLabel: {
    fontSize: "0.78rem",
    fontWeight: 600,
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
  },

  customSwitch: {
    "& .MuiSwitch-switchBase.Mui-checked": {
      color: "#10b981",
      "&:hover": {
        backgroundColor: "rgba(16, 185, 129, 0.08)",
      },
    },
    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
      backgroundColor: "#10b981",
    },
  },

  snackbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.palette.type === "dark" ? "#0b1e16" : "#1e293b",
    color: "#ffffff",
    borderRadius: 12,
    border: `1px solid ${
      theme.palette.type === "dark" ? "rgba(16, 185, 129, 0.25)" : "transparent"
    }`,
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
    padding: "8px 16px",
  },

  yesButton: {
    backgroundColor: "#10b981",
    color: "#ffffff",
    padding: "4px 12px",
    fontSize: "0.8rem",
    fontWeight: "bold",
    borderRadius: 8,
    marginRight: theme.spacing(1),
    "&:hover": {
      backgroundColor: "#059669",
    },
  },

  noButton: {
    backgroundColor: "#ef4444",
    color: "#ffffff",
    padding: "4px 12px",
    fontSize: "0.8rem",
    fontWeight: "bold",
    borderRadius: 8,
    "&:hover": {
      backgroundColor: "#dc2626",
    },
  },
}));

const TicketsManagerTabs = () => {
  const classes = useStyles();
  const history = useHistory();

  const [searchParam, setSearchParam] = useState("");
  const [tab, setTab] = useState("open");
  const [tabOpen, setTabOpen] = useState("open");
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
  const [showAllTickets, setShowAllTickets] = useState(false);
  const searchInputRef = useRef();
  const { user } = useContext(AuthContext);
  const { profile } = user;
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [openCount, setOpenCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  const userQueueIds = user.queues.map((q) => q.id);
  const [selectedQueueIds, setSelectedQueueIds] = useState(userQueueIds || []);
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);

  useEffect(() => {
    if (user.profile.toUpperCase() === "ADMIN") {
      setShowAllTickets(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === "search" && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [tab]);

  let searchTimeout;

  const handleSearch = (e) => {
    const searchedTerm = e.target.value.toLowerCase();

    clearTimeout(searchTimeout);

    if (searchedTerm === "") {
      setSearchParam(searchedTerm);
      setTab("open");
      return;
    }

    searchTimeout = setTimeout(() => {
      setSearchParam(searchedTerm);
    }, 500);
  };

  const handleChangeTab = (e, newValue) => {
    setTab(newValue);
  };

  const handleChangeTabOpen = (e, newValue) => {
    setTabOpen(newValue);
  };

  const applyPanelStyle = (status) => {
    if (tabOpen !== status) {
      return { width: 0, height: 0 };
    }
  };

  const handleCloseOrOpenTicket = (ticket) => {
    setNewTicketModalOpen(false);
    if (ticket !== undefined && ticket.uuid !== undefined) {
      history.push(`/tickets/${ticket.uuid}`);
    }
  };

  const handleSelectedTags = (selecteds) => {
    const tags = selecteds.map((t) => t.id);
    setSelectedTags(tags);
  };

  const handleSelectedUsers = (selecteds) => {
    const users = selecteds.map((t) => t.id);
    setSelectedUsers(users);
  };

  const CloseAllTicket = async () => {
    try {
      await api.post("/tickets/closeAll", {
        status: tabOpen,
        selectedQueueIds,
      });

      handleSnackbarClose();
    } catch (err) {
      console.log("Error: ", err);
    }
  };

  const handleSnackbarOpen = () => {
    setSnackbarOpen(true);
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  return (
    <Paper elevation={0} variant="outlined" className={classes.ticketsWrapper}>
      <NewTicketModal
        modalOpen={newTicketModalOpen}
        onClose={(ticket) => {
          handleCloseOrOpenTicket(ticket);
        }}
      />
      <Paper elevation={0} square className={classes.tabsHeader}>
        <Tabs
          value={tab}
          onChange={handleChangeTab}
          variant="fullWidth"
          classes={{ indicator: classes.tabsIndicator }}
          aria-label="tickets manager tabs"
        >
          <Tab
            value={"open"}
            label={
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <MoveToInboxIcon style={{ fontSize: 18 }} />
                <span>{i18n.t("tickets.tabs.open.title")}</span>
              </div>
            }
            classes={{ root: classes.tab, selected: classes.tabSelected }}
          />
          <Tab
            value={"closed"}
            label={
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <CheckBoxIcon style={{ fontSize: 18 }} />
                <span>{i18n.t("tickets.tabs.closed.title")}</span>
              </div>
            }
            classes={{ root: classes.tab, selected: classes.tabSelected }}
          />
          <Tab
            value={"search"}
            label={
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <SearchIcon style={{ fontSize: 18 }} />
                <span>{i18n.t("tickets.tabs.search.title")}</span>
              </div>
            }
            classes={{ root: classes.tab, selected: classes.tabSelected }}
          />
        </Tabs>
      </Paper>
      <Paper square elevation={0} className={classes.ticketOptionsBox}>
        {tab === "search" ? (
          <div className={classes.serachInputWrapper}>
            <SearchIcon className={classes.searchIcon} />
            <InputBase
              className={classes.searchInput}
              inputRef={searchInputRef}
              placeholder={i18n.t("tickets.search.placeholder")}
              type="search"
              onChange={handleSearch}
            />
          </div>
        ) : (
          <>
            <Snackbar
              open={snackbarOpen}
              onClose={handleSnackbarClose}
              message={i18n.t("tickets.inbox.closedAllTickets")}
              ContentProps={{
                className: classes.snackbar,
              }}
              action={
                <>
                  <Button
                    className={classes.yesButton}
                    size="small"
                    onClick={CloseAllTicket}
                  >
                    {i18n.t("tickets.inbox.yes")}
                  </Button>
                  <Button
                    className={classes.noButton}
                    size="small"
                    onClick={handleSnackbarClose}
                  >
                    {i18n.t("tickets.inbox.no")}
                  </Button>
                </>
              }
            />
            <Tooltip title={i18n.t("Novo Ticket") || "Novo Ticket"}>
              <IconButton
                size="small"
                className={classes.newTicketButton}
                onClick={() => {
                  setNewTicketModalOpen(true);
                }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {user.profile === "admin" && (
              <Tooltip
                title={
                  i18n.t("tickets.inbox.closedAll") || "Finalizar Todos"
                }
              >
                <IconButton
                  size="small"
                  className={classes.closeAllButton}
                  onClick={handleSnackbarOpen}
                >
                  <PlaylistAddCheckOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Can
              role={user.profile}
              perform="tickets-manager:showall"
              yes={() => (
                <FormControlLabel
                  label={
                    <span className={classes.switchLabel}>
                      {i18n.t("tickets.buttons.showAll")}
                    </span>
                  }
                  labelPlacement="start"
                  control={
                    <Switch
                      size="small"
                      checked={showAllTickets}
                      onChange={() =>
                        setShowAllTickets((prevState) => !prevState)
                      }
                      name="showAllTickets"
                      className={classes.customSwitch}
                    />
                  }
                />
              )}
            />
          </>
        )}
        <TicketsQueueSelect
          style={{ marginLeft: 6 }}
          selectedQueueIds={selectedQueueIds}
          userQueues={user?.queues}
          onChange={(values) => setSelectedQueueIds(values)}
        />
      </Paper>
      <TabPanel value={tab} name="open" className={classes.ticketsWrapper}>
        <div className={classes.subTabsContainer}>
          <Tabs
            value={tabOpen}
            onChange={handleChangeTabOpen}
            classes={{ indicator: classes.tabsIndicator, root: classes.subTabs }}
            variant="fullWidth"
          >
            <Tab
              label={
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span>{i18n.t("ticketsList.assignedHeader")}</span>
                  {openCount > 0 && (
                    <span className={classes.badgeOpen}>{openCount}</span>
                  )}
                </div>
              }
              value={"open"}
              classes={{ root: classes.subTab, selected: classes.tabSelected }}
            />
            <Tab
              label={
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span>{i18n.t("ticketsList.pendingHeader")}</span>
                  {pendingCount > 0 && (
                    <span className={classes.badgePending}>{pendingCount}</span>
                  )}
                </div>
              }
              value={"pending"}
              classes={{ root: classes.subTab, selected: classes.tabSelected }}
            />
          </Tabs>
        </div>
        <Paper elevation={0} className={classes.ticketsWrapper}>
          <TicketsList
            status="open"
            showAll={showAllTickets}
            selectedQueueIds={selectedQueueIds}
            updateCount={(val) => setOpenCount(val)}
            style={applyPanelStyle("open")}
          />
          <TicketsList
            status="pending"
            selectedQueueIds={selectedQueueIds}
            updateCount={(val) => setPendingCount(val)}
            style={applyPanelStyle("pending")}
          />
        </Paper>
      </TabPanel>
      <TabPanel value={tab} name="closed" className={classes.ticketsWrapper}>
        <TicketsList
          status="closed"
          showAll={true}
          selectedQueueIds={selectedQueueIds}
        />
      </TabPanel>
      <TabPanel value={tab} name="search" className={classes.ticketsWrapper}>
        <TagsFilter onFiltered={handleSelectedTags} />
        {profile === "admin" && (
          <UsersFilter onFiltered={handleSelectedUsers} />
        )}
        <TicketsList
          searchParam={searchParam}
          showAll={true}
          tags={selectedTags}
          users={selectedUsers}
          selectedQueueIds={selectedQueueIds}
        />
      </TabPanel>
    </Paper>
  );
};

export default TicketsManagerTabs;
