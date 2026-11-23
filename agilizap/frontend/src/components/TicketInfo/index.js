import React, { useState, useEffect } from "react";

import { Avatar, CardHeader, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { getInitials } from "../../helpers/getInitials";
import { generateColor } from "../../helpers/colorGenerator";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(() => ({
  cardHeader: {
    cursor: "pointer",
    padding: "10px 12px",
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 11,
    color: "#ffffff",
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: "0.9rem",
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  contactTitle: {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: "0.95rem",
    color: "var(--ink-primary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  ticketIdChip: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.72rem",
    fontWeight: 600,
    padding: "1px 6px",
    borderRadius: 6,
    backgroundColor: "var(--bg-subtle)",
    border: "1px solid var(--border-hairline)",
    color: "var(--ink-secondary)",
    flexShrink: 0,
  },
  subheader: {
    fontFamily: "var(--font-sans)",
    fontSize: "0.78rem",
    color: "var(--ink-secondary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    marginTop: 2,
  },
}));

const TicketInfo = ({ contact, ticket, onClick }) => {
  const classes = useStyles();
  const { user, queue, whatsapp } = ticket;
  const [userName, setUserName] = useState("");
  const [contactName, setContactName] = useState("");

  useEffect(() => {
    if (contact) {
      setContactName(contact.name);
      if (document.body.offsetWidth < 600) {
        if (contact.name && contact.name.length > 10) {
          const truncadName = contact.name.substring(0, 10) + "...";
          setContactName(truncadName);
        }
      }
    }

    if (contact) {
      const assigned = user
        ? `${i18n.t("messagesList.header.assignedTo")} ${user.name}`
        : "Sem atendente";
      const queueName = queue?.name ? ` • ${queue.name}` : "";
      const connectionName = whatsapp?.name ? ` • ${whatsapp.name}` : "";
      setUserName(`${assigned}${queueName}${connectionName}`);

      if (document.body.offsetWidth < 600) {
        setUserName(user?.name || "Sem atendente");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact, user, queue, whatsapp]);

  return (
    <CardHeader
      onClick={onClick}
      className={classes.cardHeader}
      titleTypographyProps={{ component: "div", noWrap: true }}
      subheaderTypographyProps={{ component: "div", noWrap: true }}
      avatar={
        <Avatar
          className={classes.avatar}
          style={{ backgroundColor: generateColor(contact?.number) }}
          src={contact.profilePicUrl}
          alt="contact_image"
        >
          {getInitials(contact?.name)}
        </Avatar>
      }
      title={
        <div className={classes.titleRow}>
          <Typography component="span" className={classes.contactTitle}>
            {contactName}
          </Typography>
          <span className={classes.ticketIdChip}>#{ticket.id}</span>
        </div>
      }
      subheader={
        ticket.user ? (
          <span className={classes.subheader}>{userName}</span>
        ) : null
      }
    />
  );
};

export default TicketInfo;
