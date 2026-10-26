import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  InputBase,
  Paper,
  Tooltip,
  Typography,
  makeStyles,
  useMediaQuery,
  useTheme,
} from "@material-ui/core";
import { FiSend as SendIcon } from "react-icons/fi";
import { FiCheck as DoneAllIcon } from "react-icons/fi";
import { FiUsers as GroupIcon } from "react-icons/fi";

import { AuthContext } from "../../context/Auth/AuthContext";
import { useDate } from "../../hooks/useDate";
import api from "../../services/api";
import { getInitials } from "../../helpers/getInitials";
import type { InternalChat, InternalChatMessage, User } from "../../types";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  mainContainer: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    flex: 1,
    overflow: "hidden",
    borderRadius: 0,
    height: "100%",
    backgroundColor: theme.palette.type === "dark" ? "#0f172a" : "#f8fafc",
  },
  headerArea: {
    padding: "10px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.palette.type === "dark" ? "#162032" : "#ffffff",
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
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
    lineHeight: 1.2,
  },
  headerSubtitle: {
    fontSize: "0.75rem",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  participants: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, maxHeight: 64, overflowY: "auto" },
  presence: { color: theme.palette.type === "dark" ? "#6ee7b7" : "#047857", backgroundColor: "rgba(16,185,129,0.12)", padding: "2px 8px", borderRadius: 12 },
  day: { alignSelf: "center", color: theme.palette.text.secondary, fontSize: 12, margin: "8px 0" },
  messageList: {
    position: "relative",
    overflowY: "auto",
    flex: 1,
    padding: theme.spacing(2),
    display: "flex",
    flexDirection: "column",
    gap: 10,
    backgroundColor: theme.palette.type === "dark" ? "#0f172a" : "#f8fafc",
    ...theme.scrollbarStyles,
    minHeight: 0,
    minWidth: 0,
  },
  boxLeft: {
    alignSelf: "flex-start",
    maxWidth: "min(80%, 560px)",
    padding: "8px 14px 6px",
    borderRadius: "18px 18px 18px 4px",
    backgroundColor: theme.palette.type === "dark" ? "#162032" : "#ffffff",
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
    border: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.18)"
        : "rgba(226, 232, 240, 0.9)"
    }`,
    boxShadow: "none",
  },
  boxRight: {
    alignSelf: "flex-end",
    maxWidth: "min(80%, 560px)",
    padding: "8px 14px 6px",
    borderRadius: "18px 18px 4px 18px",
    background: "linear-gradient(135deg, #047857 0%, #0f766e 100%)",
    color: "#ffffff",
    boxShadow: "none",
  },
  senderName: {
    fontWeight: 700,
    fontSize: "0.75rem",
    color: theme.palette.type === "dark" ? "#34d399" : "#047857",
    marginBottom: 2,
  },
  messageText: {
    fontSize: "0.875rem",
    lineHeight: 1.45,
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
  },
  timestampRight: {
    fontSize: "0.75rem",
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  timestampLeft: {
    fontSize: "0.75rem",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    marginTop: 4,
    textAlign: "right",
  },
  inputArea: {
    padding: "10px 16px",
    backgroundColor: theme.palette.type === "dark" ? "#162032" : "#ffffff",
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
    backgroundColor: theme.palette.type === "dark" ? "#0f172a" : "#f8fafc",
    borderRadius: 20,
    padding: "6px 16px",
    border: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.2)"
        : "rgba(226, 232, 240, 0.9)"
    }`,
    fontSize: "0.85rem",
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
    "&:focus-within": {
      borderColor: "#10b981",
      boxShadow: "0 0 0 2px rgba(16, 185, 129, 0.15)",
    },
  },
  buttonSend: {
    borderRadius: 12,
    width: 44,
    height: 44,
    background: "linear-gradient(135deg, #047857 0%, #0f766e 100%)",
    color: "#ffffff",
    boxShadow: "none",
    transition: "background-color 0.2s ease, color 0.2s ease",
    "&:hover": {
      background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
      boxShadow: "none",
    },
    "&:disabled": {
      opacity: 0.6,
      color: "rgba(255, 255, 255, 0.5)",
    },
  },
}));

interface Props {
  chat: InternalChat;
  messages: InternalChatMessage[];
  handleSendMessage: (content: string) => Promise<boolean>;
  handleLoadMore: () => void;
  scrollToBottomRef: React.MutableRefObject<(() => void) | null>;
  pageInfo: { hasMore: boolean };
  loading: boolean;
  sending: boolean;
  error: boolean;
  handleRetry: () => void;
}

export default function ChatMessages({ chat, messages, handleSendMessage, handleLoadMore, scrollToBottomRef, pageInfo, loading, sending, error, handleRetry }: Props) {
  const classes = useStyles();
  const mobile = useMediaQuery(useTheme().breakpoints.down("sm"));
  const { user } = useContext(AuthContext) as { user: User };
  const { datetimeToClient } = useDate();
  const baseRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [contentMessage, setContentMessage] = useState("");
  const submitting = useRef(false);
  const draftChat = useRef(chat.id);
  draftChat.current = chat.id;
  const previousHeight = useRef<number | null>(null);

  useEffect(() => {
    setContentMessage("");
    previousHeight.current = null;
    scrollToBottomRef.current = () => baseRef.current?.scrollIntoView({ behavior: "auto" });
    return () => { scrollToBottomRef.current = null; };
  }, [chat.id, scrollToBottomRef]);

  // Keep the visible message in place when older pages are prepended.
  useLayoutEffect(() => {
    if (!loading && previousHeight.current !== null && listRef.current) {
      listRef.current.scrollTop += listRef.current.scrollHeight - previousHeight.current;
      previousHeight.current = null;
    }
  }, [messages, loading]);

  useEffect(() => {
    const ownMembership = chat.users?.find(u => u.userId === user.id);
    if (ownMembership?.unreads > 0) {
      void api.post(`/chats/${chat.id}/read`).catch(toastError);
    }
  }, [chat.id, chat.users, messages.length, user.id]);

  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (submitting.current || sending || !contentMessage.trim()) return;
    submitting.current = true;
    const content = contentMessage;
    const chatId = chat.id;
    try {
      if (await handleSendMessage(content)) {
        if (draftChat.current === chatId) setContentMessage(prev => prev === content ? "" : prev);
      }
    } finally { submitting.current = false; }
  };

  const participants = [...new Map((chat.users || []).map(u => [u.userId, u])).values()];
  const online = participants.filter(u => u.user?.online === true).length;

  return (
    <Paper elevation={0} className={classes.mainContainer}>
      <header className={classes.headerArea}>
        <div className={classes.headerLeft}>
          <Avatar className={classes.avatarSquircle} style={{ backgroundColor: "#0d9488", color: "#fff" }}>
            {getInitials(chat.title || "Chat")}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <Typography component={mobile ? "h1" : "h2"} className={classes.headerTitle}>{chat.title}</Typography>
            <Typography component="div" className={classes.headerSubtitle}>
              <GroupIcon style={{ fontSize: 16 }} />
              <span>{participants.length} {participants.length === 1 ? "participante" : "participantes"}</span>
              <Tooltip title="Presença informada pelo servidor na última atualização da conversa">
                <span className={classes.presence}>{online} online</span>
              </Tooltip>
            </Typography>
            <div className={classes.participants} aria-label="Participantes da conversa">
              {participants.map(p => (
                <Chip key={p.userId} size="small" variant="outlined"
                  label={`${p.user?.name || `Participante ${p.userId}`}${p.user?.online === true ? " · online" : p.user?.online === false ? " · offline" : ""}`} />
              ))}
            </div>
          </div>
        </div>
      </header>

      <div ref={listRef} className={classes.messageList} aria-label="Histórico de mensagens" aria-busy={loading}>
        {pageInfo.hasMore && <Button disabled={loading} onClick={() => {
          previousHeight.current = listRef.current?.scrollHeight ?? null;
          handleLoadMore();
        }}>Carregar mensagens anteriores</Button>}
        {loading && <Typography role="status" color="textSecondary">Carregando mensagens…</Typography>}
        {error && <div role="alert">Não foi possível carregar as mensagens. <Button onClick={handleRetry}>Tentar novamente</Button></div>}
        {!loading && !error && messages.length === 0 && <Typography color="textSecondary">A conversa começa aqui. Envie a primeira mensagem à equipe.</Typography>}
        {messages.map((item, index) => {
          const isMe = item.senderId === user.id;
          const day = datetimeToClient(item.createdAt).split(" ")[0];
          const previousDay = index > 0 ? datetimeToClient(messages[index - 1].createdAt).split(" ")[0] : null;
          return <React.Fragment key={item.id}>
            {day !== previousDay && <Typography component="div" className={classes.day}>{day}</Typography>}
            <Box className={isMe ? classes.boxRight : classes.boxLeft}>
              {!isMe && <Typography className={classes.senderName}>{item.sender?.name || "Colega"}</Typography>}
              <Typography className={classes.messageText}>{item.message}</Typography>
              <div className={isMe ? classes.timestampRight : classes.timestampLeft}>
                <time dateTime={item.createdAt}>{datetimeToClient(item.createdAt)}</time>
                {isMe && <Tooltip title="Mensagem salva no chat"><DoneAllIcon aria-label="Mensagem enviada" style={{ fontSize: 16 }} /></Tooltip>}
              </div>
            </Box>
          </React.Fragment>;
        })}
        <div ref={baseRef} />
      </div>

      <div className={classes.inputArea}>
        <form onSubmit={onSubmit} className={classes.inputForm}>
          <InputBase multiline maxRows={4} value={contentMessage}
            inputProps={{ "aria-label": "Mensagem interna" }}
            placeholder="Escreva para a equipe…"
            onChange={e => setContentMessage(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void onSubmit(); }
            }} className={classes.inputPill} />
          <Tooltip title="Enviar mensagem (Enter). Shift + Enter para nova linha." arrow>
            <span><IconButton type="submit" aria-label="Enviar mensagem" disabled={sending || !contentMessage.trim()} className={classes.buttonSend}>
              <SendIcon style={{ fontSize: 20 }} />
            </IconButton></span>
          </Tooltip>
        </form>
      </div>
    </Paper>
  );
}
