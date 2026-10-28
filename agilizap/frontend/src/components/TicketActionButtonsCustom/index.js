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
    borderRadius: 8,
    padding: "5px 14px",
    textTransform: "none",
    fontWeight: 600,
    fontSize: "0.80rem",
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    lineHeight: 1.4,
    boxShadow: "none",
    transition: "all 0.2s ease-in-out",
  },

  acceptButton: {
    background: "linear-gradient(135deg, #10b981 0%, #0d9488 100%)",
    color: "#ffffff",
    fontWeight: 700,
    border: "none",
    boxShadow: "0 2px 6px rgba(16, 185, 129, 0.25)",
    "&:hover": {
      background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
      boxShadow: "0 4px 10px rgba(16, 185, 129, 0.35)",
      transform: "translateY(-1px)",
    },
  },

  resolveButton: {
    background: "linear-gradient(135deg, #10b981 0%, #0d9488 100%)",
    color: "#ffffff",
    fontWeight: 700,
    border: "none",
    boxShadow: "0 2px 6px rgba(16, 185, 129, 0.25)",
    "&:hover": {
      background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
      boxShadow: "0 4px 10px rgba(16, 185, 129, 0.35)",
      transform: "translateY(-1px)",
    },
  },

  returnButton: {
    backgroundColor:
      theme.palette.type === "dark" ? "rgba(245, 158, 11, 0.12)" : "#fffbeb",
    color: theme.palette.type === "dark" ? "#fbbf24" : "#b45309",
    border: `1px solid ${
      theme.palette.type === "dark" ? "rgba(245, 158, 11, 0.3)" : "#fde68a"
    }`,
    "&:hover": {
      backgroundColor:
        theme.palette.type === "dark" ? "rgba(245, 158, 11, 0.22)" : "#fef3c7",
      transform: "translateY(-1px)",
    },
  },

  transferButton: {
    backgroundColor:
      theme.palette.type === "dark" ? "rgba(59, 130, 246, 0.12)" : "#eff6ff",
    color: theme.palette.type === "dark" ? "#60a5fa" : "#2563eb",
    border: `1px solid ${
      theme.palette.type === "dark" ? "rgba(59, 130, 246, 0.3)" : "#bfdbfe"
    }`,
    "&:hover": {
      backgroundColor:
        theme.palette.type === "dark" ? "rgba(59, 130, 246, 0.22)" : "#dbeafe",
      transform: "translateY(-1px)",
    },
  },

  reopenButton: {
    background: "linear-gradient(135deg, #10b981 0%, #0d9488 100%)",
    color: "#ffffff",
    fontWeight: 700,
    border: "none",
    boxShadow: "0 2px 6px rgba(16, 185, 129, 0.25)",
    "&:hover": {
      background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
      transform: "translateY(-1px)",
    },
  },

  iconButtonMore: {
    padding: 6,
    borderRadius: 8,
    border: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(255, 255, 255, 0.12)"
        : "rgba(226, 232, 240, 0.9)"
    }`,
    backgroundColor:
      theme.palette.type === "dark" ? "rgba(255, 255, 255, 0.04)" : "#ffffff",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    transition: "all 0.2s ease",
    "&:hover": {
      backgroundColor:
        theme.palette.type === "dark" ? "rgba(255, 255, 255, 0.08)" : "#f8fafc",
      color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
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
