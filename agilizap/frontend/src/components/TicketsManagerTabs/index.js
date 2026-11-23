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
    backgroundColor: "var(--bg-surface)",
    borderRight: "1px solid var(--border-hairline)",
  },

  tabsHeader: {
    flex: "none",
    backgroundColor: "var(--bg-subtle)",
    borderBottom: "1px solid var(--border-hairline)",
  },

  tabsIndicator: {
    backgroundColor: "var(--action)",
    height: 2.5,
    borderRadius: "2px 2px 0 0",
  },

  tab: {
    minWidth: 0,
    minHeight: 46,
    flex: 1,
    padding: "8px 10px",
    textTransform: "none",
    fontFamily: "var(--font-sans)",
    fontWeight: 600,
    fontSize: "0.82rem",
    color: "var(--ink-secondary)",
    transition: "color var(--t-in) var(--ease-ui)",
    "&$tabSelected": {
      color: "var(--action) !important",
      fontWeight: 700,
    },
    "&:hover": {
      color: "var(--ink-primary)",
      opacity: 1,
    },
  },

  tabSelected: {
    color: "var(--action) !important",
  },

  subTabsContainer: {
    flex: "none",
    backgroundColor: "var(--bg-subtle)",
    padding: "4px 8px",
    borderBottom: "1px solid var(--border-hairline)",
  },

  subTabs: {
    minHeight: 38,
  },

  subTab: {
    minHeight: 34,
    padding: "5px 12px",
    textTransform: "none",
    fontFamily: "var(--font-sans)",
    fontWeight: 600,
    fontSize: "0.8125rem",
    borderRadius: 8,
    minWidth: "auto",
    color: "var(--ink-secondary)",
    transition: "all var(--t-in) var(--ease-ui)",
    "&$tabSelected": {
      color: "var(--action)",
      backgroundColor: "var(--bg-surface)",
      boxShadow: "var(--shadow-subtle)",
    },
  },

  badgeOpen: {
    backgroundColor: "var(--action-soft)",
    color: "var(--action)",
    fontFamily: "var(--font-mono)",
    borderRadius: 6,
    padding: "2px 7px",
    fontSize: "0.7rem",
    fontWeight: 700,
    marginLeft: 6,
  },

  badgePending: {
    backgroundColor: "var(--status-warning-bg)",
    color: "var(--status-warning)",
    fontFamily: "var(--font-mono)",
    borderRadius: 6,
    padding: "2px 7px",
    fontSize: "0.7rem",
    fontWeight: 700,
    marginLeft: 6,
  },

  ticketOptionsBox: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "var(--bg-surface)",
    padding: "8px 12px",
    gap: "8px",
    borderBottom: "1px solid var(--border-hairline)",
  },

  serachInputWrapper: {
    flex: 1,
    backgroundColor: "var(--field-bg)",
    display: "flex",
    alignItems: "center",
    borderRadius: 10,
    padding: "5px 12px",
    transition: "all var(--t-in) var(--ease-ui)",
    border: "1px solid var(--field-border)",
    "&:focus-within": {
      backgroundColor: "var(--field-focus)",
      borderColor: "var(--action)",
      boxShadow: "0 0 0 3px var(--focus-ring)",
    },
  },

  searchIcon: {
    color: "var(--action)",
    marginRight: 8,
    fontSize: 19,
  },

  searchInput: {
    flex: 1,
    fontFamily: "var(--font-sans)",
    fontSize: "0.86rem",
    color: "var(--ink-primary)",
  },

  newTicketButton: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: "var(--action-soft)",
    color: "var(--action)",
    border: "1px solid var(--border-strong)",
    transition: "all var(--t-in) var(--ease-ui)",
    "&:hover": {
      backgroundColor: "var(--action)",
      color: "var(--action-ink)",
    },
  },

  closeAllButton: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: "var(--status-danger-bg)",
    color: "var(--status-danger)",
    border: "1px solid rgba(225, 29, 72, 0.25)",
    transition: "all var(--t-in) var(--ease-ui)",
    "&:hover": {
      backgroundColor: "var(--status-danger)",
      color: "#ffffff",
    },
  },

  switchLabel: {
    fontSize: "0.78rem",
    fontWeight: 600,
    color: "var(--ink-secondary)",
  },

  customSwitch: {
    "& .MuiSwitch-switchBase.Mui-checked": {
      color: "var(--action)",
      "&:hover": {
        backgroundColor: "var(--action-soft)",
      },
    },
    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
      backgroundColor: "var(--action)",
    },
  },

  snackbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#07130E",
    color: "#ECF5F0",
    borderRadius: 12,
    border: "1px solid var(--border-strong)",
    boxShadow: "var(--shadow-popover)",
    padding: "8px 16px",
  },

  yesButton: {
    backgroundColor: "#25D366",
    color: "#05130B",
    padding: "4px 12px",
    fontSize: "0.8rem",
    fontWeight: 700,
    borderRadius: 8,
    marginRight: theme.spacing(1),
    "&:hover": {
      backgroundColor: "#1FC45B",
    },
  },

  noButton: {
    backgroundColor: "var(--status-danger)",
    color: "#ffffff",
    padding: "4px 12px",
    fontSize: "0.8rem",
    fontWeight: 700,
    borderRadius: 8,
    "&:hover": {
      backgroundColor: "#BE123C",
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
            showAll={showAllTickets}
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
