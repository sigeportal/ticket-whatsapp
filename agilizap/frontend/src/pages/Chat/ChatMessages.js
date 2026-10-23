import React, { useContext, useEffect, useRef, useState } from "react";
import {
  Avatar,
  Box,
  Divider,
  IconButton,
  InputBase,
  Paper,
  Tooltip,
  Typography,
  makeStyles,
} from "@material-ui/core";
import SendIcon from "@material-ui/icons/Send";
import DoneAllIcon from "@material-ui/icons/DoneAll";
import GroupIcon from "@material-ui/icons/Group";

import { AuthContext } from "../../context/Auth/AuthContext";
import { useDate } from "../../hooks/useDate";
import api from "../../services/api";
import { getInitials } from "../../helpers/getInitials";
import { generateColor } from "../../helpers/colorGenerator";

const useStyles = makeStyles((theme) => ({
  mainContainer: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    flex: 1,
    overflow: "hidden",
    borderRadius: 0,
    height: "100%",
    backgroundColor: theme.palette.type === "dark" ? "#07130e" : "#f8fafc",
  },
  headerArea: {
    padding: "10px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.palette.type === "dark" ? "#0b1e16" : "#ffffff",
    borderBottom: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.12)"
        : "rgba(226, 232, 240, 0.9)"
    }`,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  avatarSquircle: {
    borderRadius: 10,
    fontWeight: 700,
    fontSize: "0.9rem",
    width: 40,
    height: 40,
    boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
  },
  headerTitle: {
    fontWeight: 700,
    fontSize: "0.95rem",
    color: theme.palette.type === "dark" ? "#f0fdf4" : "#0f172a",
    lineHeight: 1.2,
  },
  headerSubtitle: {
    fontSize: "0.75rem",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  messageList: {
    position: "relative",
    overflowY: "auto",
    height: "100%",
    padding: theme.spacing(2),
    display: "flex",
    flexDirection: "column",
    gap: 10,
    backgroundColor: theme.palette.type === "dark" ? "#07130e" : "#f8fafc",
    ...theme.scrollbarStyles,
  },
  boxLeft: {
    alignSelf: "flex-start",
    maxWidth: 420,
    padding: "8px 14px 6px",
    borderRadius: "14px 14px 14px 3px",
    backgroundColor: theme.palette.type === "dark" ? "#0b1e16" : "#ffffff",
    color: theme.palette.type === "dark" ? "#f0fdf4" : "#0f172a",
    border: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.18)"
        : "rgba(226, 232, 240, 0.9)"
    }`,
    boxShadow:
      theme.palette.type === "dark"
        ? "0 2px 8px rgba(0, 0, 0, 0.3)"
        : "0 1px 3px rgba(0, 0, 0, 0.05)",
  },
  boxRight: {
    alignSelf: "flex-end",
    maxWidth: 420,
    padding: "8px 14px 6px",
    borderRadius: "14px 14px 3px 14px",
    background: "linear-gradient(135deg, #10b981 0%, #0d9488 100%)",
    color: "#ffffff",
    boxShadow: "0 2px 8px rgba(16, 185, 129, 0.25)",
  },
  senderName: {
    fontWeight: 700,
    fontSize: "0.75rem",
    color: theme.palette.type === "dark" ? "#34d399" : "#059669",
    marginBottom: 2,
  },
  messageText: {
    fontSize: "0.84rem",
    lineHeight: 1.45,
    wordBreak: "break-word",
  },
  timestampRight: {
    fontSize: "0.68rem",
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  timestampLeft: {
    fontSize: "0.68rem",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    marginTop: 4,
    textAlign: "right",
  },
  inputArea: {
    padding: "10px 16px",
    backgroundColor: theme.palette.type === "dark" ? "#0b1e16" : "#ffffff",
    borderTop: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.12)"
        : "rgba(226, 232, 240, 0.9)"
    }`,
  },
  inputForm: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  inputPill: {
    flex: 1,
    backgroundColor: theme.palette.type === "dark" ? "#07130e" : "#f8fafc",
    borderRadius: 20,
    padding: "6px 16px",
    border: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.2)"
        : "rgba(226, 232, 240, 0.9)"
    }`,
    fontSize: "0.85rem",
    color: theme.palette.type === "dark" ? "#f0fdf4" : "#0f172a",
    "&:focus-within": {
      borderColor: "#10b981",
      boxShadow: "0 0 0 2px rgba(16, 185, 129, 0.15)",
    },
  },
  buttonSend: {
    borderRadius: 12,
    width: 42,
    height: 42,
    background: "linear-gradient(135deg, #10b981 0%, #0d9488 100%)",
    color: "#ffffff",
    boxShadow: "0 2px 8px rgba(16, 185, 129, 0.25)",
    transition: "all 0.2s ease",
    "&:hover": {
      background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
      boxShadow: "0 4px 12px rgba(16, 185, 129, 0.4)",
    },
    "&:disabled": {
      opacity: 0.6,
      color: "rgba(255, 255, 255, 0.5)",
    },
  },
}));

export default function ChatMessages({
  chat,
  messages,
  handleSendMessage,
  handleLoadMore,
  scrollToBottomRef,
  pageInfo,
  loading,
}) {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const { datetimeToClient } = useDate();
  const baseRef = useRef();

  const [contentMessage, setContentMessage] = useState("");

  const scrollToBottom = () => {
    if (baseRef.current) {
      baseRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const unreadMessages = (c) => {
    if (c !== undefined && Array.isArray(c.users)) {
      const currentUser = c.users.find((u) => u.userId === user.id);
      return currentUser ? currentUser.unreads > 0 : false;
    }
    return false;
  };

  useEffect(() => {
    if (unreadMessages(chat)) {
      try {
        api.post(`/chats/${chat.id}/read`, { userId: user.id });
      } catch (err) {}
    }
    scrollToBottomRef.current = scrollToBottom;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat]);

  const handleScroll = (e) => {
    const { scrollTop } = e.currentTarget;
    if (!pageInfo.hasMore || loading) return;
    if (scrollTop < 600) {
      handleLoadMore();
    }
  };

  const onSubmit = (e) => {
    if (e) e.preventDefault();
    if (contentMessage.trim() !== "") {
      handleSendMessage(contentMessage.trim());
      setContentMessage("");
    }
  };

  const participantsCount = chat?.users?.length || 0;
  const participantsSummary =
    Array.isArray(chat?.users) && chat.users.length > 0
      ? chat.users.map((u) => u.user?.name || "").filter(Boolean).slice(0, 3).join(", ") +
        (chat.users.length > 3 ? ` +${chat.users.length - 3}` : "")
      : "";

  return (
    <Paper className={classes.mainContainer}>
      {/* Active Conversation Header */}
      {chat && chat.id && (
        <div className={classes.headerArea}>
          <div className={classes.headerLeft}>
            <Avatar
              className={classes.avatarSquircle}
              style={{
                backgroundColor: generateColor(chat.title || "Chat"),
              }}
            >
              {getInitials(chat.title || "CH")}
            </Avatar>
            <div>
              <Typography className={classes.headerTitle}>
                {chat.title}
              </Typography>
              <Typography className={classes.headerSubtitle}>
                <GroupIcon style={{ fontSize: 13 }} />
                <span>
                  {participantsCount} {participantsCount === 1 ? "membro" : "membros"}
                  {participantsSummary ? ` • ${participantsSummary}` : ""}
                </span>
              </Typography>
            </div>
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div onScroll={handleScroll} className={classes.messageList}>
        {Array.isArray(messages) &&
          messages.map((item, key) => {
            const isMe = item.senderId === user.id;

            if (isMe) {
              return (
                <Box key={key} className={classes.boxRight}>
                  <Typography className={classes.messageText}>
                    {item.message}
                  </Typography>
                  <div className={classes.timestampRight}>
                    <span>{datetimeToClient(item.createdAt)}</span>
                    <DoneAllIcon style={{ fontSize: 14 }} />
                  </div>
                </Box>
              );
            } else {
              return (
                <Box key={key} className={classes.boxLeft}>
                  <Typography className={classes.senderName}>
                    {item.sender?.name || "Colega"}
                  </Typography>
                  <Typography className={classes.messageText}>
                    {item.message}
                  </Typography>
                  <div className={classes.timestampLeft}>
                    <span>{datetimeToClient(item.createdAt)}</span>
                  </div>
                </Box>
              );
            }
          })}
        <div ref={baseRef}></div>
      </div>

      {/* Modern Capsule Input Area */}
      <div className={classes.inputArea}>
        <form onSubmit={onSubmit} className={classes.inputForm}>
          <InputBase
            multiline
            maxRows={4}
            value={contentMessage}
            placeholder="Digite uma mensagem interna... (Pressione Enter para enviar)"
            onChange={(e) => setContentMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
            }}
            className={classes.inputPill}
          />
          <Tooltip title="Enviar mensagem" arrow>
            <span>
              <IconButton
                type="submit"
                disabled={loading || !contentMessage.trim()}
                className={classes.buttonSend}
                size="small"
              >
                <SendIcon style={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
        </form>
      </div>
    </Paper>
  );
}
