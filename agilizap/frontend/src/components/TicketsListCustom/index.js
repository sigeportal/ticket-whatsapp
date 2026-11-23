import React, { useState, useEffect, useReducer, useContext } from "react";

import { makeStyles } from "@material-ui/core/styles";
import List from "@material-ui/core/List";
import Paper from "@material-ui/core/Paper";

import TicketListItem from "../TicketListItemCustom";
import TicketsListSkeleton from "../TicketsListSkeleton";

import useTickets from "../../hooks/useTickets";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import { SocketContext } from "../../context/Socket/SocketContext";

const useStyles = makeStyles((theme) => ({
  ticketsListWrapper: {
    position: "relative",
    display: "flex",
    height: "100%",
    flexDirection: "column",
    overflow: "hidden",
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: "var(--bg-surface)",
  },

  ticketsList: {
    flex: 1,
    maxHeight: "100%",
    overflowY: "scroll",
    paddingTop: 4,
    paddingBottom: 8,
    backgroundColor: "var(--bg-surface)",
    borderTop: "1px solid var(--border-hairline)",
    ...theme.scrollbarStyles,
  },

  ticketsListHeader: {
    color: "var(--ink-primary)",
    zIndex: 2,
    backgroundColor: "var(--bg-surface)",
    borderBottom: "1px solid var(--border-hairline)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },

  ticketsCount: {
    fontWeight: 500,
    fontFamily: "var(--font-mono)",
    color: "var(--ink-muted)",
    marginLeft: "8px",
    fontSize: "13px",
  },

  noTicketsText: {
    textAlign: "center",
    color: "var(--ink-secondary)",
    fontSize: "0.84rem",
    lineHeight: 1.5,
    marginTop: 6,
  },

  noTicketsTitle: {
    textAlign: "center",
    fontFamily: "var(--font-display)",
    fontSize: "0.98rem",
    fontWeight: 700,
    color: "var(--ink-primary)",
    margin: 0,
  },

  noTicketsDiv: {
    display: "flex",
    minHeight: 140,
    margin: 28,
    padding: 20,
    borderRadius: 12,
    backgroundColor: "var(--bg-subtle)",
    border: "1px dashed var(--border-hairline)",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
}));

const reducer = (state, action) => {
  if (action.type === "LOAD_TICKETS") {
    const newTickets = action.payload;

    newTickets.forEach((ticket) => {
      const ticketIndex = state.findIndex((t) => t.id === ticket.id);
      if (ticketIndex !== -1) {
        state[ticketIndex] = ticket;
        if (ticket.unreadMessages > 0) {
          state.unshift(state.splice(ticketIndex, 1)[0]);
        }
      } else {
        state.push(ticket);
      }
    });

    return [...state];
  }

  if (action.type === "RESET_UNREAD") {
    const ticketId = action.payload;

    const ticketIndex = state.findIndex((t) => t.id === ticketId);
    if (ticketIndex !== -1) {
      state[ticketIndex].unreadMessages = 0;
    }

    return [...state];
  }

  if (action.type === "UPDATE_TICKET") {
    const ticket = action.payload;

    const ticketIndex = state.findIndex((t) => t.id === ticket.id);
    if (ticketIndex !== -1) {
      state[ticketIndex] = ticket;
    } else {
      state.unshift(ticket);
    }

    return [...state];
  }

  if (action.type === "UPDATE_TICKET_UNREAD_MESSAGES") {
    const ticket = action.payload;

    const ticketIndex = state.findIndex((t) => t.id === ticket.id);
    if (ticketIndex !== -1) {
      state[ticketIndex] = ticket;
      state.unshift(state.splice(ticketIndex, 1)[0]);
    } else {
      state.unshift(ticket);
    }

    return [...state];
  }

  if (action.type === "UPDATE_TICKET_CONTACT") {
    const contact = action.payload;
    const ticketIndex = state.findIndex((t) => t.contactId === contact.id);
    if (ticketIndex !== -1) {
      state[ticketIndex].contact = contact;
    }
    return [...state];
  }

  if (action.type === "UPDATE_TICKET_PRESENCE") {
    const data = action.payload;
    const ticketIndex = state.findIndex((t) => t.id === data.ticketId);
    if (ticketIndex !== -1) {
      state[ticketIndex].presence = data.presence;
    }
    return [...state];
  }

  if (action.type === "DELETE_TICKET") {
    const ticketId = action.payload;
    const ticketIndex = state.findIndex((t) => t.id === ticketId);
    if (ticketIndex !== -1) {
      state.splice(ticketIndex, 1);
    }

    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const TicketsListCustom = (props) => {
  const {
    status,
    searchParam,
    tags,
    users,
    showAll,
    selectedQueueIds,
    updateCount,
    style,
  } = props;
  const classes = useStyles();
  const [pageNumber, setPageNumber] = useState(1);
  const [ticketsList, dispatch] = useReducer(reducer, []);
  const { user } = useContext(AuthContext);
  const { profile, queues } = user;

  const socketManager = useContext(SocketContext);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [status, searchParam, dispatch, showAll, tags, users, selectedQueueIds]);

  const { tickets, hasMore, loading } = useTickets({
    pageNumber,
    searchParam,
    status,
    showAll,
    tags: JSON.stringify(tags),
    users: JSON.stringify(users),
    queueIds: JSON.stringify(selectedQueueIds),
  });

  useEffect(() => {
    const queueIds = queues.map((q) => q.id);
    const filteredTickets = tickets.filter(
      (t) => queueIds.indexOf(t.queueId) > -1
    );

    if (profile === "user") {
      dispatch({ type: "LOAD_TICKETS", payload: filteredTickets });
    } else {
      dispatch({ type: "LOAD_TICKETS", payload: tickets });
    }
  }, [tickets, status, searchParam, queues, profile]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    const isQueueAllowed = (ticket) => {
      if (profile === "admin") {
        return (
          !ticket.queueId ||
          !selectedQueueIds ||
          selectedQueueIds.length === 0 ||
          selectedQueueIds.indexOf(ticket.queueId) > -1
        );
      }
      const queueIds = queues.map((q) => q.id);
      if (!ticket.queueId) return false;
      if (queueIds.indexOf(ticket.queueId) === -1) return false;
      return (
        !selectedQueueIds ||
        selectedQueueIds.length === 0 ||
        selectedQueueIds.indexOf(ticket.queueId) > -1
      );
    };

    const shouldUpdateTicket = (ticket) =>
      (!ticket.userId || ticket.userId === user?.id || showAll) &&
      isQueueAllowed(ticket);

    const notBelongsToUserQueues = (ticket) =>
      ticket.queueId &&
      ((profile === "admin" &&
        selectedQueueIds &&
        selectedQueueIds.length > 0 &&
        selectedQueueIds.indexOf(ticket.queueId) === -1) ||
        (profile !== "admin" &&
          (queues.map((q) => q.id).indexOf(ticket.queueId) === -1 ||
            (selectedQueueIds &&
              selectedQueueIds.length > 0 &&
              selectedQueueIds.indexOf(ticket.queueId) === -1))));

    socket.on("ready", () => {
      if (status) {
        socket.emit("joinTickets", status);
      } else {
        socket.emit("joinNotification");
      }
    });

    socket.on(`company-${companyId}-ticket`, (data) => {
      if (data.action === "updateUnread") {
        dispatch({
          type: "RESET_UNREAD",
          payload: data.ticketId,
        });
      }

      if (
        (data.action === "update" || data.action === "create") &&
        shouldUpdateTicket(data.ticket) &&
        data.ticket.status === status
      ) {
        dispatch({
          type: "UPDATE_TICKET",
          payload: data.ticket,
        });
      }

      if (data.action === "update" && notBelongsToUserQueues(data.ticket)) {
        dispatch({ type: "DELETE_TICKET", payload: data.ticket.id });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_TICKET", payload: data.ticketId });
      }
    });

    socket.on(`company-${companyId}-appMessage`, (data) => {
      const ticket = data.ticket;
      if (!ticket) return;

      if (!isQueueAllowed(ticket)) {
        return;
      }

      if (
        data.action === "create" &&
        shouldUpdateTicket(ticket) &&
        (status === undefined || ticket.status === status)
      ) {
        dispatch({
          type: "UPDATE_TICKET_UNREAD_MESSAGES",
          payload: ticket,
        });
      }
    });

    socket.on(`company-${companyId}-presence`, (data) => {
      dispatch({
        type: "UPDATE_TICKET_PRESENCE",
        payload: data,
      });
    });

    socket.on(`company-${companyId}-contact`, (data) => {
      if (data.action === "update") {
        dispatch({
          type: "UPDATE_TICKET_CONTACT",
          payload: data.contact,
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [status, showAll, user, selectedQueueIds, tags, users, profile, queues, socketManager]);

  useEffect(() => {
    if (typeof updateCount === "function") {
      updateCount(ticketsList.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketsList]);

  const loadMore = () => {
    setPageNumber((prevState) => prevState + 1);
  };

  const handleScroll = (e) => {
    if (!hasMore || loading) return;

    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  return (
    <Paper className={classes.ticketsListWrapper} style={style}>
      <Paper
        square
        name="closed"
        elevation={0}
        className={classes.ticketsList}
        onScroll={handleScroll}
      >
        <List style={{ paddingTop: 0 }}>
          {ticketsList.length === 0 && !loading ? (
            <div className={classes.noTicketsDiv}>
              <span className={classes.noTicketsTitle}>
                {i18n.t("ticketsList.noTicketsTitle")}
              </span>
              <p className={classes.noTicketsText}>
                {i18n.t("ticketsList.noTicketsMessage")}
              </p>
            </div>
          ) : (
            <>
              {ticketsList.map((ticket) => (
                <TicketListItem ticket={ticket} key={ticket.id} />
              ))}
            </>
          )}
          {loading && <TicketsListSkeleton />}
        </List>
      </Paper>
    </Paper>
  );
};

export default TicketsListCustom;
