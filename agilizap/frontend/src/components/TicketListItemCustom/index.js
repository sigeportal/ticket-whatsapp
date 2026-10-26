import React, { useContext, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { format, isSameDay, parseISO } from "date-fns";
import { useHistory, useParams } from "react-router-dom";
import Avatar from "@material-ui/core/Avatar";
import Box from "@material-ui/core/Box";
import ListItem from "@material-ui/core/ListItem";
import ListItemAvatar from "@material-ui/core/ListItemAvatar";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";
import Tooltip from "@material-ui/core/Tooltip";
import AndroidIcon from "@material-ui/icons/Android";
import VisibilityIcon from "@material-ui/icons/Visibility";
import { v4 as uuidv4 } from "uuid";

import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import { TicketsContext } from "../../context/Tickets/TicketsContext";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import ButtonWithSpinner from "../ButtonWithSpinner";
import MarkdownWrapper from "../MarkdownWrapper";
import ContactTag from "../ContactTag";
import TicketMessagesDialog from "../TicketMessagesDialog";
import TransferTicketModalCustom from "../TransferTicketModalCustom";
import { getInitials } from "../../helpers/getInitials";
import { generateColor } from "../../helpers/colorGenerator";

const useStyles = makeStyles((theme) => ({
  ticketCard: {
    position: "relative",
    display: "flex",
    alignItems: "flex-start",
    padding: "10px 12px",
    margin: "4px 8px",
    borderRadius: 12,
    border: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.18)"
        : "rgba(226, 232, 240, 0.85)"
    }`,
    backgroundColor: theme.palette.type === "dark" ? "#0d2219" : "#ffffff",
    transition: "all 0.2s ease-in-out",
    cursor: "pointer",
    boxShadow:
      theme.palette.type === "dark"
        ? "0 2px 6px rgba(0,0,0,0.35)"
        : "0 1px 3px rgba(0,0,0,0.04)",
    "&:hover": {
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(37, 211, 102, 0.08)"
          : "rgba(16, 185, 129, 0.05)",
      borderColor: theme.palette.type === "dark" ? "rgba(37, 211, 102, 0.4)" : "rgba(16, 185, 129, 0.35)",
      boxShadow: "0 4px 12px rgba(16, 185, 129, 0.12)",
    },
    "&$selectedTicket": {
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(37, 211, 102, 0.15)"
          : "rgba(16, 185, 129, 0.1)",
      borderColor: theme.palette.type === "dark" ? "#25d366" : "#10b981",
      boxShadow: "0 4px 14px rgba(16, 185, 129, 0.2)",
    },
  },

  selectedTicket: {},

  pendingTicket: {
    cursor: "default",
  },

  ticketQueueColor: {
    position: "absolute",
    left: 0,
    top: 8,
    bottom: 8,
    width: 3.5,
    borderRadius: "0 4px 4px 0",
  },

  avatarWrapper: {
    minWidth: 46,
    marginRight: 10,
    position: "relative",
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    fontWeight: 700,
    fontSize: "0.95rem",
    boxShadow: "0 2px 5px rgba(0,0,0,0.12)",
  },

  contentWrapper: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },

  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },

  contactName: {
    fontWeight: 600,
    fontSize: "0.88rem",
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#1e293b",
    display: "flex",
    alignItems: "center",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  lastMessageTime: {
    fontSize: "0.72rem",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#94a3b8",
    fontWeight: 500,
    whiteSpace: "nowrap",
    marginLeft: 6,
  },

  messageRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    minHeight: 20,
  },

  lastMessageText: {
    fontSize: "0.8rem",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
    paddingRight: 6,
    "& p": {
      margin: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },

  presence: {
    color: "#10b981",
    fontWeight: 600,
    fontSize: "0.8rem",
    fontStyle: "italic",
  },

  unreadBadge: {
    backgroundColor: "#10b981",
    color: "#ffffff",
    borderRadius: 10,
    padding: "1px 6px",
    fontSize: "0.7rem",
    fontWeight: 700,
    minWidth: 18,
    height: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 1px 4px rgba(16, 185, 129, 0.4)",
    flexShrink: 0,
  },

  pillsRow: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
  },

  queueChip: {
    fontSize: "0.68rem",
    fontWeight: 600,
    borderRadius: 6,
    padding: "1px 7px",
    whiteSpace: "nowrap",
    textTransform: "uppercase",
    letterSpacing: "0.02em",
  },

  whatsappChip: {
    fontSize: "0.68rem",
    fontWeight: 600,
    borderRadius: 6,
    padding: "1px 7px",
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.15)"
        : "rgba(16, 185, 129, 0.12)",
    color: "#10b981",
    whiteSpace: "nowrap",
  },

  userChip: {
    fontSize: "0.68rem",
    fontWeight: 600,
    borderRadius: 6,
    padding: "1px 7px",
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(148, 163, 184, 0.15)"
        : "#f1f5f9",
    color: theme.palette.type === "dark" ? "#cbd5e1" : "#475569",
    whiteSpace: "nowrap",
  },

  actionsRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    justifyContent: "flex-end",
  },

  actionButtonAccept: {
    backgroundColor: "#10b981",
    color: "#ffffff",
    padding: "3px 12px",
    borderRadius: 8,
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "none",
    boxShadow: "0 2px 6px rgba(16, 185, 129, 0.3)",
    "&:hover": {
      backgroundColor: "#059669",
    },
  },

  actionButtonClose: {
    backgroundColor: theme.palette.type === "dark" ? "rgba(239, 68, 68, 0.15)" : "#fef2f2",
    color: theme.palette.type === "dark" ? "#f87171" : "#dc2626",
    border: `1px solid ${theme.palette.type === "dark" ? "rgba(239, 68, 68, 0.3)" : "#fecaca"}`,
    padding: "3px 12px",
    borderRadius: 8,
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "none",
    "&:hover": {
      backgroundColor: "#ef4444",
      color: "#ffffff",
    },
  },

  actionButtonTransfer: {
    backgroundColor: theme.palette.type === "dark" ? "rgba(148, 163, 184, 0.15)" : "#f1f5f9",
    color: theme.palette.type === "dark" ? "#cbd5e1" : "#475569",
    border: `1px solid ${theme.palette.type === "dark" ? "rgba(255, 255, 255, 0.1)" : "#e2e8f0"}`,
    padding: "3px 12px",
    borderRadius: 8,
    fontSize: "0.72rem",
    fontWeight: 600,
    textTransform: "none",
    "&:hover": {
      backgroundColor: theme.palette.type === "dark" ? "rgba(255, 255, 255, 0.1)" : "#e2e8f0",
    },
  },

  actionButtonReopen: {
    background: "linear-gradient(135deg, #10b981 0%, #0d9488 100%)",
    color: "#ffffff",
    padding: "3px 14px",
    borderRadius: 8,
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "none",
    boxShadow: "0 2px 6px rgba(16, 185, 129, 0.3)",
    "&:hover": {
      background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
    },
  },

  lastInteractionBadge: {
    fontSize: "0.68rem",
    fontWeight: 600,
    marginLeft: 6,
  },
}));

const TicketListItemCustom = ({ ticket }) => {
  const classes = useStyles();
  const history = useHistory();
  const [loading, setLoading] = useState(false);
  const [ticketUser, setTicketUser] = useState(null);
  const [ticketQueueName, setTicketQueueName] = useState(null);
  const [ticketQueueColor, setTicketQueueColor] = useState(null);
  const [tag, setTag] = useState([]);
  const [whatsAppName, setWhatsAppName] = useState(null);
  const [lastInteractionLabel, setLastInteractionLabel] = useState(null);
  const [openTicketMessageDialog, setOpenTicketMessageDialog] = useState(false);
  const { ticketId } = useParams();
  const isMounted = useRef(true);
  const { setCurrentTicket } = useContext(TicketsContext);
  const { user } = useContext(AuthContext);
  const { profile } = user;
  const [transferTicketModalOpen, setTransferTicketModalOpen] = useState(false);
  const presenceMessage = {
    composing: "Digitando...",
    recording: "Gravando áudio...",
  };

  useEffect(() => {
    if (ticket.userId && ticket.user) {
      setTicketUser(ticket.user?.name?.toUpperCase());
    }
    setTicketQueueName(ticket.queue?.name?.toUpperCase());
    setTicketQueueColor(ticket.queue?.color);

    if (ticket.whatsappId && ticket.whatsapp) {
      setWhatsAppName(ticket.whatsapp.name?.toUpperCase());
    }

    setTag(ticket?.tags);

    return () => {
      isMounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCloseTicket = async (id) => {
    setTag(ticket?.tags);
    setLoading(true);
    try {
      await api.put(`/tickets/${id}`, {
        status: "closed",
        useIntegration: false,
        promptId: null,
        integrationId: null,
      });
    } catch (err) {
      setLoading(false);
      toastError(err);
      return;
    }
    if (isMounted.current) {
      setLoading(false);
    }
    history.push(`/tickets/`);
  };

  useEffect(() => {
    const renderLastInteractionLabel = () => {
      let labelColor = "";
      let labelText = "";

      if (!ticket.lastMessage) return null;

      const lastInteractionDate = parseISO(ticket.updatedAt);
      const currentDate = new Date();
      const timeDifference = currentDate - lastInteractionDate;
      const hoursDifference = Math.floor(timeDifference / (1000 * 60 * 60));
      const minutesDifference = Math.floor(timeDifference / (1000 * 60));

      if (minutesDifference >= 3 && minutesDifference <= 10) {
        labelText = `(${minutesDifference}m atrás)`;
        labelColor = "#10b981";
      } else if (minutesDifference >= 30 && minutesDifference < 60) {
        labelText = `(${minutesDifference}m atrás)`;
        labelColor = "#f59e0b";
      } else if (minutesDifference > 60 && hoursDifference < 24) {
        labelText = `(${hoursDifference}h atrás)`;
        labelColor = "#ef4444";
      } else if (hoursDifference >= 24) {
        labelText = `(${Math.floor(hoursDifference / 24)}d atrás)`;
        labelColor = "#ef4444";
      }

      if (!labelText) return null;

      return { labelText, labelColor };
    };

    const updateLastInteractionLabel = () => {
      const result = renderLastInteractionLabel();
      if (result) {
        setLastInteractionLabel(
          <span
            className={classes.lastInteractionBadge}
            style={{ color: result.labelColor }}
          >
            {result.labelText}
          </span>
        );
      } else {
        setLastInteractionLabel(null);
      }
    };

    updateLastInteractionLabel();
    const interval = setInterval(updateLastInteractionLabel, 30 * 1000);
    return () => clearInterval(interval);
  }, [ticket, classes.lastInteractionBadge]);

  const handleReopenTicket = async (id) => {
    setLoading(true);
    try {
      await api.put(`/tickets/${id}`, {
        status: "open",
        userId: user?.id,
        queueId: ticket?.queue?.id,
      });
      history.push(`/tickets/${ticket.uuid}`);
    } catch (err) {
      toastError(err);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  const handleAcepptTicket = async (id) => {
    setLoading(true);
    try {
      await api.put(`/tickets/${id}`, {
        status: "open",
        userId: user?.id,
      });

      let settingIndex;
      try {
        const { data } = await api.get("/settings/");
        settingIndex = data.filter((s) => s.key === "sendGreetingAccepted");
      } catch (err) {
        toastError(err);
      }

      if (settingIndex && settingIndex[0]?.value === "enabled" && !ticket.isGroup) {
        handleSendMessage(ticket.id);
      }
      history.push(`/tickets/${ticket.uuid}`);
    } catch (err) {
      toastError(err);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  const handleSendMessage = async (id) => {
    const msg = `{{ms}} *{{name}}*, meu nome é *${user?.name}* e agora vou prosseguir com seu atendimento!`;
    const message = {
      read: 1,
      fromMe: true,
      mediaUrl: "",
      body: `*Mensagem Automática:*\n${msg.trim()}`,
    };
    try {
      await api.post(`/messages/${id}`, message);
    } catch (err) {
      toastError(err);
    }
  };

  const handleSelectTicket = (ticket) => {
    const code = uuidv4();
    const { id, uuid } = ticket;
    setCurrentTicket({ id, uuid, code });
  };

  const handleOpenTransferModal = () => {
    setTransferTicketModalOpen(true);
  };

  const handleCloseTransferTicketModal = () => {
    if (isMounted.current) {
      setTransferTicketModalOpen(false);
    }
  };

  const queueColor = ticket.queue?.color || "#7c7c7c";

  return (
    <React.Fragment key={ticket.id}>
      <TransferTicketModalCustom
        modalOpen={transferTicketModalOpen}
        onClose={handleCloseTransferTicketModal}
        ticketid={ticket.id}
      ticket={ticket}
      />

      <TicketMessagesDialog
        open={openTicketMessageDialog}
        handleClose={() => setOpenTicketMessageDialog(false)}
        ticketId={ticket.id}
      ticket={ticket}
      />

      <ListItem
        disableGutters
        className={clsx(classes.ticketCard, {
          [classes.pendingTicket]: ticket.status === "pending",
          [classes.selectedTicket]: ticketId && +ticketId === ticket.id,
        })}
        onClick={() => {
          if (ticket.status === "pending") return;
          handleSelectTicket(ticket);
        }}
      >
        {ticket.queue?.color && (
          <Tooltip
            arrow
            placement="right"
            title={ticket.queue?.name?.toUpperCase()}
          >
            <span
              style={{ backgroundColor: ticket.queue.color }}
              className={classes.ticketQueueColor}
            />
          </Tooltip>
        )}

        <ListItemAvatar className={classes.avatarWrapper}>
          <Avatar
            className={classes.avatar}
            style={{
              backgroundColor: generateColor(ticket?.contact?.number),
            }}
            src={ticket?.contact?.profilePicUrl}
          >
            {getInitials(ticket?.contact?.name || "")}
          </Avatar>
        </ListItemAvatar>

        <div className={classes.contentWrapper}>
          <div className={classes.headerRow}>
            <Typography component="span" className={classes.contactName}>
              <span>{ticket.contact?.name}</span>
              {lastInteractionLabel}
              {ticket.chatbot && (
                <Tooltip title="Chatbot">
                  <AndroidIcon
                    fontSize="small"
                    style={{ color: "#64748b", marginLeft: 4 }}
                  />
                </Tooltip>
              )}
              {profile === "admin" && (
                <Tooltip title="Espiar Conversa">
                  <VisibilityIcon
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenTicketMessageDialog(true);
                    }}
                    fontSize="small"
                    style={{
                      color: "#3b82f6",
                      cursor: "pointer",
                      marginLeft: 6,
                    }}
                  />
                </Tooltip>
              )}
            </Typography>

            {ticket.lastMessage && (
              <span className={classes.lastMessageTime}>
                {isSameDay(parseISO(ticket.updatedAt), new Date())
                  ? format(parseISO(ticket.updatedAt), "HH:mm")
                  : format(parseISO(ticket.updatedAt), "dd/MM/yyyy")}
              </span>
            )}
          </div>

          <div className={classes.messageRow}>
            <div className={classes.lastMessageText}>
              {["composing", "recording"].includes(ticket?.presence) ? (
                <span className={classes.presence}>
                  {presenceMessage[ticket.presence]}
                </span>
              ) : ticket.lastMessage ? (
                ticket.lastMessage.includes("data:image/png;base64") ? (
                  <span>📍 Localização</span>
                ) : (
                  <MarkdownWrapper>{ticket.lastMessage}</MarkdownWrapper>
                )
              ) : (
                <span>&nbsp;</span>
              )}
            </div>

            {ticket.unreadMessages > 0 && (
              <span className={classes.unreadBadge}>
                {ticket.unreadMessages}
              </span>
            )}
          </div>

          <div className={classes.pillsRow}>
            {ticket?.whatsapp?.name && (
              <span className={classes.whatsappChip}>
                {ticket.whatsapp.name.toUpperCase()}
              </span>
            )}

            {ticketUser && (
              <span className={classes.userChip}>{ticketUser}</span>
            )}

            <span
              className={classes.queueChip}
              style={{
                backgroundColor: `${queueColor}20`,
                color: queueColor,
                border: `1px solid ${queueColor}40`,
              }}
            >
              {ticket.queue?.name?.toUpperCase() || "SEM FILA"}
            </span>

            {tag?.map((t) => (
              <ContactTag
                tag={t}
                key={`ticket-contact-tag-${ticket.id}-${t.id}`}
              />
            ))}
          </div>

          <div className={classes.actionsRow}>
            {ticket.status === "pending" && (
              <>
                <ButtonWithSpinner
                  className={classes.actionButtonAccept}
                  size="small"
                  loading={loading}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAcepptTicket(ticket.id);
                  }}
                >
                  {i18n.t("ticketsList.buttons.accept")}
                </ButtonWithSpinner>
                <ButtonWithSpinner
                  className={classes.actionButtonClose}
                  size="small"
                  loading={loading}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseTicket(ticket.id);
                  }}
                >
                  {i18n.t("ticketsList.buttons.closed")}
                </ButtonWithSpinner>
              </>
            )}

            {ticket.status === "attending" && (
              <>
                <ButtonWithSpinner
                  className={classes.actionButtonAccept}
                  size="small"
                  loading={loading}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAcepptTicket(ticket.id);
                  }}
                >
                  {i18n.t("ticketsList.buttons.accept")}
                </ButtonWithSpinner>
                <ButtonWithSpinner
                  className={classes.actionButtonClose}
                  size="small"
                  loading={loading}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseTicket(ticket.id);
                  }}
                >
                  {i18n.t("ticketsList.buttons.closed")}
                </ButtonWithSpinner>
              </>
            )}

            {ticket.status !== "closed" &&
              ticket.status !== "pending" &&
              ticket.status !== "attending" && (
                <>
                  <ButtonWithSpinner
                    className={classes.actionButtonTransfer}
                    size="small"
                    loading={loading}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenTransferModal();
                    }}
                  >
                    {i18n.t("ticketsList.buttons.transfer")}
                  </ButtonWithSpinner>
                  <ButtonWithSpinner
                    className={classes.actionButtonClose}
                    size="small"
                    loading={loading}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseTicket(ticket.id);
                    }}
                  >
                    {i18n.t("ticketsList.buttons.closed")}
                  </ButtonWithSpinner>
                </>
              )}

            {ticket.status === "closed" && (
              <ButtonWithSpinner
                className={classes.actionButtonReopen}
                size="small"
                loading={loading}
                onClick={(e) => {
                  e.stopPropagation();
                  handleReopenTicket(ticket.id);
                }}
              >
                {i18n.t("ticketsList.buttons.reopen")}
              </ButtonWithSpinner>
            )}
          </div>
        </div>
      </ListItem>
    </React.Fragment>
  );
};

export default TicketListItemCustom;

