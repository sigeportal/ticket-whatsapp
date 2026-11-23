import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Avatar,
  Box,
  Button,
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
import DoneAllIcon from "@material-ui/icons/DoneAll";
import whatsBackground from "../../assets/wa-background.png";
import whatsBackgroundDark from "../../assets/wa-background-dark.png";

import { AuthContext } from "../../context/Auth/AuthContext";
import { useDate } from "../../hooks/useDate";
import api from "../../services/api";
import { getInitials } from "../../helpers/getInitials";
import type { InternalChat, InternalChatMessage, User } from "../../types";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark";
  return {
    mainContainer: {
      display: "flex",
      flexDirection: "column",
      position: "relative",
      flex: 1,
      overflow: "hidden",
      borderRadius: 0,
      height: "100%",
      backgroundColor: isDark ? "#0b141a" : "#efeae2",
    },
    headerArea: {
      padding: "10px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: isDark ? "#202c33" : "#f0f2f5",
      borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "#d1d7db"}`,
    },
    headerLeft: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      minWidth: 0,
      flex: 1,
    },
    avatarSquircle: {
      borderRadius: "50%",
      fontFamily: "var(--font-display)",
      fontWeight: 700,
      fontSize: "0.95rem",
      width: 42,
      height: 42,
      flexShrink: 0,
    },
    headerTitle: {
      fontFamily: "var(--font-display)",
      fontWeight: 700,
      fontSize: "0.95rem",
      color: isDark ? "#e9edef" : "#111b21",
      lineHeight: 1.25,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    headerSubtitle: {
      fontSize: "0.75rem",
      color: isDark ? "#8696a0" : "#667781",
      display: "flex",
      alignItems: "center",
      gap: 6,
      flexWrap: "wrap",
      marginTop: 2,
    },
    participantsText: {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      maxWidth: 360,
    },
    presence: {
      color: isDark ? "#00a884" : "#008069",
      backgroundColor: isDark ? "rgba(0, 168, 132, 0.16)" : "rgba(0, 168, 132, 0.12)",
      padding: "1px 8px",
      borderRadius: 999,
      fontWeight: 600,
      fontSize: "0.7rem",
    },
    day: {
      alignSelf: "center",
      color: isDark ? "#8696a0" : "#54656f",
      backgroundColor: isDark ? "#182229" : "#ffffff",
      boxShadow: "0 1px 1px rgba(11, 20, 26, 0.13)",
      borderRadius: 8,
      padding: "5px 12px",
      fontFamily: "var(--font-sans)",
      fontWeight: 600,
      fontSize: "0.72rem",
      margin: "6px 0",
    },
    messageList: {
      position: "relative",
      overflowY: "auto",
      flex: 1,
      padding: "18px 6% 16px",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      backgroundColor: isDark ? "#0b141a" : "#efeae2",
      backgroundImage: `url(${isDark ? whatsBackgroundDark : whatsBackground})`,
      backgroundRepeat: "repeat",
      backgroundSize: "412px auto",
      ...theme.scrollbarStyles,
      minHeight: 0,
      minWidth: 0,
      [theme.breakpoints.down("sm")]: {
        padding: "14px 12px",
      },
    },
    boxLeft: {
      position: "relative",
      alignSelf: "flex-start",
      maxWidth: "min(75%, 560px)",
      padding: "7px 12px 6px",
      borderRadius: "0 10px 10px 10px",
      backgroundColor: isDark ? "#202c33" : "#ffffff",
      color: isDark ? "#e9edef" : "#111b21",
      boxShadow: "0 1px 0.5px rgba(11, 20, 26, 0.13)",
      "&::before": {
        content: '""',
        position: "absolute",
        top: 0,
        left: -7,
        width: 0,
        height: 0,
        borderTop: `8px solid ${isDark ? "#202c33" : "#ffffff"}`,
        borderLeft: "8px solid transparent",
      },
    },
    boxRight: {
      position: "relative",
      alignSelf: "flex-end",
      maxWidth: "min(75%, 560px)",
      padding: "7px 12px 6px",
      borderRadius: "10px 0 10px 10px",
      backgroundColor: isDark ? "#005c4b" : "#d9fdd3",
      color: isDark ? "#e9edef" : "#111b21",
      boxShadow: "0 1px 0.5px rgba(11, 20, 26, 0.13)",
      "&::after": {
        content: '""',
        position: "absolute",
        top: 0,
        right: -7,
        width: 0,
        height: 0,
        borderTop: `8px solid ${isDark ? "#005c4b" : "#d9fdd3"}`,
        borderRight: "8px solid transparent",
      },
    },
    senderName: {
      fontWeight: 700,
      fontSize: "0.75rem",
      color: isDark ? "#53bdeb" : "#00a884",
      marginBottom: 2,
    },
    messageText: {
      fontSize: "0.885rem",
      lineHeight: 1.42,
      wordBreak: "break-word",
      whiteSpace: "pre-wrap",
    },
    timestampRight: {
      fontFamily: "var(--font-sans)",
      fontSize: "0.68rem",
      color: isDark ? "rgba(233, 237, 239, 0.65)" : "#667781",
      marginTop: 3,
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 4,
    },
    timestampLeft: {
      fontFamily: "var(--font-sans)",
      fontSize: "0.68rem",
      color: isDark ? "rgba(233, 237, 239, 0.65)" : "#667781",
      marginTop: 3,
      textAlign: "right",
    },
    inputArea: {
      padding: "10px 16px",
      backgroundColor: isDark ? "#202c33" : "#f0f2f5",
      borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "#d1d7db"}`,
    },
    inputForm: {
      display: "flex",
      alignItems: "flex-end",
      gap: 10,
    },
    inputPill: {
      flex: 1,
      backgroundColor: isDark ? "#2a3942" : "#ffffff",
      borderRadius: 24,
      padding: "8px 16px",
      border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "transparent"}`,
      fontSize: "0.9rem",
      color: isDark ? "#e9edef" : "#111b21",
      boxShadow: isDark ? "none" : "0 1px 1px rgba(11, 20, 26, 0.06)",
      "&:focus-within": {
        borderColor: "#00a884",
      },
    },
    buttonSend: {
      borderRadius: "50%",
      width: 42,
      height: 42,
      backgroundColor: "#00a884",
      color: "#ffffff",
      boxShadow: "0 1px 3px rgba(0,0,0,0.16)",
      transition: "background-color 0.15s ease, transform 0.1s ease",
      "&:hover": {
        backgroundColor: "#008f72",
        boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
      },
      "&:disabled": {
        backgroundColor: isDark ? "#2a3942" : "#d1d7db",
        color: isDark ? "#8696a0" : "#ffffff",
      },
    },
  };
});

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
          <Avatar className={classes.avatarSquircle} style={{ backgroundColor: "#00a884", color: "#fff" }}>
            {getInitials(chat.title || "Chat")}
          </Avatar>
          <div style={{ minWidth: 0, flex: 1 }}>
            <Typography component={mobile ? "h1" : "h2"} className={classes.headerTitle}>{chat.title}</Typography>
            <Typography component="div" className={classes.headerSubtitle}>
              <Tooltip
                title={participants.map(p => `${p.user?.name || `Participante ${p.userId}`}${p.user?.online === true ? " (online)" : p.user?.online === false ? " (offline)" : ""}`).join(", ")}
                arrow
              >
                <span className={classes.participantsText}>
                  {participants.map(p => p.user?.name || `Participante ${p.userId}`).join(", ") || `${participants.length} participante(s)`}
                </span>
              </Tooltip>
              <Tooltip title="Presença informada pelo servidor na última atualização da conversa">
                <span className={classes.presence}>{online} online</span>
              </Tooltip>
            </Typography>
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
                {isMe && <Tooltip title="Mensagem salva no chat"><DoneAllIcon aria-label="Mensagem enviada" style={{ fontSize: 16, color: "#53bdeb" }} /></Tooltip>}
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
