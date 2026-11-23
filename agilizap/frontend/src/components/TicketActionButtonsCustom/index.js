import React, { useContext, useState } from "react";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import { IconButton, Tooltip } from "@material-ui/core";
import {
  MoreVert,
  Replay,
  CheckCircleOutline,
  UndoRounded,
  SwapHoriz,
} from "@material-ui/icons";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import TicketOptionsMenu from "../TicketOptionsMenu";
import TransferTicketModalCustom from "../TransferTicketModalCustom";
import ButtonWithSpinner from "../ButtonWithSpinner";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { TicketsContext } from "../../context/Tickets/TicketsContext";

const useStyles = makeStyles((theme) => ({
  actionButtons: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flex: "none",
    marginLeft: "auto",
    marginRight: 8,
  },

  actionButton: {
    borderRadius: 9,
    padding: "6px 14px",
    textTransform: "none",
    fontWeight: 600,
    fontSize: "0.8125rem",
    fontFamily: "var(--font-sans)",
    lineHeight: 1.4,
    boxShadow: "none",
    transition: "all var(--t-in) var(--ease-ui)",
  },

  acceptButton: {
    backgroundColor: "var(--action)",
    color: "var(--action-ink)",
    fontWeight: 700,
    border: "none",
    "&:hover": {
      backgroundColor: "var(--action-hover)",
    },
  },

  resolveButton: {
    backgroundColor: "var(--action)",
    color: "var(--action-ink)",
    fontWeight: 700,
    border: "none",
    "&:hover": {
      backgroundColor: "var(--action-hover)",
    },
  },

  returnButton: {
    backgroundColor: "var(--status-warning-bg)",
    color: "var(--status-warning)",
    border: "1px solid rgba(245, 158, 11, 0.3)",
    "&:hover": {
      backgroundColor: "rgba(245, 158, 11, 0.2)",
    },
  },

  transferButton: {
    backgroundColor: "var(--status-info-bg)",
    color: "var(--status-info)",
    border: "1px solid rgba(2, 132, 199, 0.28)",
    "&:hover": {
      backgroundColor: "rgba(2, 132, 199, 0.18)",
    },
  },

  reopenButton: {
    backgroundColor: "var(--action)",
    color: "var(--action-ink)",
    fontWeight: 700,
    border: "none",
    "&:hover": {
      backgroundColor: "var(--action-hover)",
    },
  },

  iconButtonMore: {
    padding: 7,
    borderRadius: 9,
    border: "1px solid var(--border-hairline)",
    backgroundColor: "var(--field-bg)",
    color: "var(--ink-secondary)",
    transition: "all var(--t-in) var(--ease-ui)",
    "&:hover": {
      backgroundColor: "var(--action-soft)",
      borderColor: "var(--border-strong)",
      color: "var(--action)",
    },
  },
}));

const TicketActionButtonsCustom = ({ ticket }) => {
  const classes = useStyles();
  const history = useHistory();
  const [anchorEl, setAnchorEl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const ticketOptionsMenuOpen = Boolean(anchorEl);
  const { user } = useContext(AuthContext);
  const { setCurrentTicket } = useContext(TicketsContext);

  const handleOpenTicketOptionsMenu = (e) => {
    setAnchorEl(e.currentTarget);
  };

  const handleCloseTicketOptionsMenu = () => {
    setAnchorEl(null);
  };

  const handleUpdateTicketStatus = async (e, status, userId) => {
    setLoading(true);
    try {
      await api.put(`/tickets/${ticket.id}`, {
        status: status,
        ...(status !== "closed" && { userId: userId || null }),
        useIntegration: status === "closed" ? false : ticket.useIntegration,
        promptId: status === "closed" ? null : ticket.promptId,
        integrationId: status === "closed" ? null : ticket.integrationId,
      });

      setLoading(false);
      if (status === "open") {
        setCurrentTicket({ ...ticket, code: "#open" });
      } else {
        setCurrentTicket({ id: null, code: null });
        history.push("/tickets");
      }
    } catch (err) {
      setLoading(false);
      toastError(err);
    }
  };

  return (
    <div className={classes.actionButtons}>
      <TransferTicketModalCustom
        modalOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        ticketid={ticket.id}
        ticket={ticket}
      />

      {ticket.status === "closed" && (
        <ButtonWithSpinner
          className={`${classes.actionButton} ${classes.reopenButton}`}
          loading={loading}
          startIcon={<Replay fontSize="small" />}
          size="small"
          onClick={(e) => handleUpdateTicketStatus(e, "open", user?.id)}
        >
          {i18n.t("messagesList.header.buttons.reopen")}
        </ButtonWithSpinner>
      )}

      {ticket.status === "open" && (
        <>
          <Tooltip title={i18n.t("messagesList.header.buttons.return")}>
            <ButtonWithSpinner
              className={`${classes.actionButton} ${classes.returnButton}`}
              loading={loading}
              startIcon={<UndoRounded fontSize="small" />}
              size="small"
              onClick={(e) => handleUpdateTicketStatus(e, "pending", null)}
            >
              {i18n.t("messagesList.header.buttons.return")}
            </ButtonWithSpinner>
          </Tooltip>

          <Tooltip title={i18n.t("ticketsList.buttons.transfer") || "Transferir"}>
            <ButtonWithSpinner
              className={`${classes.actionButton} ${classes.transferButton}`}
              startIcon={<SwapHoriz fontSize="small" />}
              size="small"
              onClick={() => setTransferModalOpen(true)}
            >
              {i18n.t("ticketsList.buttons.transfer") || "Transferir"}
            </ButtonWithSpinner>
          </Tooltip>

          <Tooltip title={i18n.t("messagesList.header.buttons.resolve")}>
            <ButtonWithSpinner
              className={`${classes.actionButton} ${classes.resolveButton}`}
              loading={loading}
              startIcon={<CheckCircleOutline fontSize="small" />}
              size="small"
              onClick={(e) => handleUpdateTicketStatus(e, "closed", user?.id)}
            >
              {i18n.t("messagesList.header.buttons.resolve")}
            </ButtonWithSpinner>
          </Tooltip>

          <IconButton
            size="small"
            className={classes.iconButtonMore}
            onClick={handleOpenTicketOptionsMenu}
          >
            <MoreVert fontSize="small" />
          </IconButton>
          <TicketOptionsMenu
            ticket={ticket}
            anchorEl={anchorEl}
            menuOpen={ticketOptionsMenuOpen}
            handleClose={handleCloseTicketOptionsMenu}
          />
        </>
      )}

      {ticket.status === "pending" && (
        <ButtonWithSpinner
          className={`${classes.actionButton} ${classes.acceptButton}`}
          loading={loading}
          startIcon={<CheckCircleOutline fontSize="small" />}
          size="small"
          onClick={(e) => handleUpdateTicketStatus(e, "open", user?.id)}
        >
          {i18n.t("messagesList.header.buttons.accept")}
        </ButtonWithSpinner>
      )}
    </div>
  );
};

export default TicketActionButtonsCustom;
