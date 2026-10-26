import React, { useContext, useEffect, useRef, useState, useCallback } from "react";
import { useParams, useHistory } from "react-router-dom";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  makeStyles,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@material-ui/core";
import ChatList from "./ChatList";
import ChatMessages from "./ChatMessages";
import { UsersFilter } from "../../components/UsersFilter";
import api from "../../services/api";
import { SocketContext } from "../../context/Socket/SocketContext";

import type { Breakpoint } from "@material-ui/core/styles/createBreakpoints";
import type { InternalChat, InternalChatMessage, ChatPage, ChatEvent, ChatPerson, User } from "../../types";
import { AuthContext } from "../../context/Auth/AuthContext";
import withWidth, { isWidthUp } from "@material-ui/core/withWidth";
import { FiMessageSquare as ForumIcon } from "react-icons/fi";
import { FiPlus as AddIcon } from "react-icons/fi";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  mainContainer: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    flex: 1,
    padding: theme.spacing(1.5),
    height: `calc(100% - 64px)`,
    minHeight: 0,
    minWidth: 0,
    overflowY: "hidden",
    borderRadius: 14,
    border: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.18)"
        : "rgba(226, 232, 240, 0.9)"
    }`,
    backgroundColor: theme.palette.type === "dark" ? "#162032" : "#ffffff",
    boxShadow: "none",
  },
  gridContainer: {
    flex: 1,
    height: "100%",
    borderRadius: 12,
    overflow: "hidden",
    border: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.12)"
        : "rgba(226, 232, 240, 0.8)"
    }`,
  },
  gridSidebar: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    backgroundColor: theme.palette.type === "dark" ? "#0f172a" : "#f8fafc",
    borderRight: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.12)"
        : "rgba(226, 232, 240, 0.8)"
    }`,
  },
  gridContent: {
    height: "100%",
    backgroundColor: theme.palette.type === "dark" ? "#162032" : "#ffffff",
  },
  sidebarHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    backgroundColor: theme.palette.type === "dark" ? "#162032" : "#ffffff",
    borderBottom: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.12)"
        : "rgba(226, 232, 240, 0.9)"
    }`,
  },
  sidebarTitle: {
    fontWeight: 700,
    fontSize: "0.95rem",
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  addButton: {
    borderRadius: 10,
    fontWeight: 700,
    fontSize: "0.8rem",
    padding: "6px 14px",
    background: "linear-gradient(135deg, #047857 0%, #0f766e 100%)",
    color: "#ffffff",
    boxShadow: "none",
    transition: "background-color 0.2s ease, color 0.2s ease",
    "&:hover": {
      background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
      boxShadow: "none",
    },
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    padding: theme.spacing(4),
    textAlign: "center",
    backgroundColor: theme.palette.type === "dark" ? "#0f172a" : "#f8fafc",
  },
  emptyIconBox: {
    width: 68,
    height: 68,
    borderRadius: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing(2),
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.14)"
        : "rgba(16, 185, 129, 0.1)",
    color: theme.palette.type === "dark" ? "#34d399" : "#10b981",
    boxShadow: "0 2px 10px rgba(16, 185, 129, 0.15)",
  },
  emptyTitle: {
    fontWeight: 700,
    fontSize: "1.1rem",
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: "0.85rem",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    maxWidth: 380,
    marginBottom: theme.spacing(2.5),
  },
  gridItemTab: {
    height: "calc(100% - 48px)",
    width: "100%",
  },
}));

export function ChatModal({
  open,
  chat,
  type,
  handleClose,
  handleLoadNewChat,
  handleEditSuccess,
}: { open: boolean; chat: InternalChat | null; type: "new" | "edit"; handleClose: () => void; handleLoadNewChat: (chat: InternalChat) => void; handleEditSuccess: (chat: InternalChat) => void }) {
  const [users, setUsers] = useState<ChatPerson[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");

  useEffect(() => {
    setError("");
    setTitle("");
    setUsers([]);
    if (type === "edit" && chat && chat.users) {
      const userList = chat.users.map((u) => ({
        id: u.user ? u.user.id : u.userId,
        name: u.user ? u.user.name : `Usuário ${u.userId}`,
      }));
      setUsers(userList);
      setTitle(chat.title || "");
    }
  }, [chat, open, type]);

  const handleSave = async () => {
    try {
      if (!title.trim()) {
        setError("Preencha o título da conversa.");
        return;
      }

      if (!users || users.length === 0) {
        setError("Selecione pelo menos um participante.");
        return;
      }

      setSaving(true);
      if (type === "edit" && chat) {
        const { data } = await api.put(`/chats/${chat.id}`, {
          users,
          title: title.trim(),
        });
        if (typeof handleEditSuccess === "function") {
          handleEditSuccess(data);
        }
      } else {
        const { data } = await api.post("/chats", {
          users,
          title: title.trim(),
        });
        if (typeof handleLoadNewChat === "function") {
          handleLoadNewChat(data);
        }
      }
      handleClose();
    } catch (err) {
      toastError(err);
    } finally { setSaving(false); }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      aria-labelledby="chat-dialog-title"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="chat-dialog-title" style={{ fontWeight: 700 }}>
        {type === "edit" ? "Editar Conversa Interna" : "Nova Conversa Interna"}
      </DialogTitle>
      <DialogContent dividers>
        {error && <Typography color="error" role="alert">{error}</Typography>}
        <Grid spacing={2} container>
          <Grid xs={12} item>
            <TextField
              label="Título da Conversa"
              placeholder="Ex: Plantão TI, Operação..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              variant="outlined"
              size="small"
              fullWidth
            />
          </Grid>
          <Grid xs={12} item>
            <UsersFilter
              onFiltered={(filteredUsers) => setUsers(filteredUsers)}
              initialUsers={users}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions style={{ padding: "12px 20px" }}>
        <Button onClick={handleClose} color="secondary" style={{ borderRadius: 10 }}>
          Cancelar
        </Button>
        <Button
          disabled={saving}
          onClick={handleSave}
          color="primary"
          variant="contained"
          style={{
            borderRadius: 10,
            background: "linear-gradient(135deg, #047857 0%, #0f766e 100%)",
            color: "#ffffff",
            fontWeight: 700,
          }}
        >
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function Chat(props: { width: Breakpoint }) {
  const classes = useStyles();
  const { user } = useContext(AuthContext) as { user: User };
  const socketManager = useContext(SocketContext);
  const history = useHistory();
  const { id } = useParams<{ id?: string }>();
  const [showDialog, setShowDialog] = useState(false);
  const [dialogType, setDialogType] = useState<"new" | "edit">("new");
  const [currentChat, setCurrentChat] = useState<InternalChat | null>(null);
  const [chats, setChats] = useState<InternalChat[]>([]);
  const [chatsPage, setChatsPage] = useState(1);
  const [chatsPageInfo, setChatsPageInfo] = useState({ hasMore: false });
  const [chatsLoading, setChatsLoading] = useState(false);
  const [chatsError, setChatsError] = useState(false);
  const [messages, setMessages] = useState<InternalChatMessage[]>([]);
  const [messagesPageInfo, setMessagesPageInfo] = useState({ hasMore: false });
  const [messagesPage, setMessagesPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [messagesError, setMessagesError] = useState(false);
  const [tab, setTab] = useState(0);
  const currentChatRef = useRef(currentChat);
  const scrollToBottomRef = useRef<(() => void) | null>(null);
  const mounted = useRef(false);
  const messagesRequest = useRef(0);
  const messagesBusy = useRef(false);
  const chatsBusy = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; messagesRequest.current++; };
  }, []);

  const selectChat = useCallback((chat: InternalChat | null) => {
    if (chat && currentChatRef.current?.id === chat.id) { setTab(1); return; }
    messagesRequest.current++;
    currentChatRef.current = chat;
    messagesBusy.current = false;
    setLoading(false);
    setMessages([]);
    setMessagesPage(1);
    setMessagesPageInfo({ hasMore: false });
    setMessagesError(false);
    setCurrentChat(chat);
    setTab(chat ? 1 : 0);
  }, []);

  const loadChats = useCallback(async (page = 1) => {
    if (chatsBusy.current) return;
    chatsBusy.current = true;
    setChatsLoading(true);
    setChatsError(false);
    try {
      const { data } = await api.get<ChatPage<InternalChat>>("/chats", { params: { pageNumber: page } });
      if (!mounted.current) return;
      setChats(prev => page === 1 ? data.records : [...prev, ...data.records.filter(c => !prev.some(p => p.id === c.id))]);
      setChatsPage(page);
      setChatsPageInfo(data);
    } catch (err) {
      if (mounted.current) { setChatsError(true); toastError(err); }
    } finally {
      chatsBusy.current = false;
      if (mounted.current) setChatsLoading(false);
    }
  }, []);

  useEffect(() => { void loadChats(); }, [loadChats]);

  // Resolve deep links even when the conversation is beyond the first page.
  useEffect(() => {
    if (!id) { if (currentChatRef.current) selectChat(null); return; }
    if (currentChatRef.current?.uuid === id) return;
    const found = chats.find(c => c.uuid === id);
    if (found) { selectChat(found); return; }
    const controller = new AbortController();
    api.get<InternalChat>(`/chats/${id}`, { signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted) return;
      setChats(prev => [data, ...prev.filter(c => c.id !== data.id)]);
      selectChat(data);
    }).catch(err => { if (!controller.signal.aborted) toastError(err); });
    return () => controller.abort();
  }, [id, chats, selectChat]);

  const fetchMessages = useCallback(async (page = 1) => {
    const chat = currentChatRef.current;
    if (!chat || messagesBusy.current) return;
    const request = ++messagesRequest.current;
    messagesBusy.current = true;
    setLoading(true);
    setMessagesError(false);
    try {
      const { data } = await api.get<ChatPage<InternalChatMessage>>(`/chats/${chat.id}/messages`, { params: { pageNumber: page } });
      if (!mounted.current || request !== messagesRequest.current || currentChatRef.current?.id !== chat.id) return;
      setMessages(prev => {
        const combined = [...data.records, ...prev];
        return [...new Map(combined.map(m => [m.id, m])).values()].sort((a, b) => a.id - b.id);
      });
      setMessagesPage(page);
      setMessagesPageInfo(data);
      if (page === 1) requestAnimationFrame(() => scrollToBottomRef.current?.());
    } catch (err) {
      if (request === messagesRequest.current) { setMessagesError(true); toastError(err); }
    } finally {
      if (request === messagesRequest.current) { messagesBusy.current = false; setLoading(false); }
    }
  }, []);

  useEffect(() => { if (currentChat?.id) void fetchMessages(); }, [currentChat?.id, fetchMessages]);

  useEffect(() => {
    if (!user?.companyId || !user?.id) return;
    const socket = socketManager.getSocket(user.companyId);
    const onChat = (data: ChatEvent) => {
      const record = data.record || data.chat;
      if (record) {
        // Removed participants must stop seeing the conversation immediately.
        const member = record.users?.some(u => u.userId === user.id);
        if (record.users && !member) {
          setChats(prev => prev.filter(c => c.id !== record.id));
          if (currentChatRef.current?.id === record.id) { selectChat(null); history.replace("/chats"); }
          return;
        }
        setChats(prev => {
          const existing = prev.find(c => c.id === record.id);
          const updated = { ...existing, ...record };
          return [updated, ...prev.filter(c => c.id !== record.id)];
        });
        if (currentChatRef.current?.id === record.id) {
          const updated = { ...currentChatRef.current, ...record };
          currentChatRef.current = updated;
          setCurrentChat(updated);
        }
      }
      if (data.action === "new-message" && data.newMessage && currentChatRef.current?.id === data.newMessage.chatId) {
        const message = data.newMessage;
        setMessages(prev => prev.some(m => m.id === message.id) ? prev : [...prev, message]);
        requestAnimationFrame(() => scrollToBottomRef.current?.());
      }
      if (data.action === "delete") {
        setChats(prev => prev.filter(c => c.id !== Number(data.id)));
        if (currentChatRef.current?.id === Number(data.id)) { selectChat(null); history.replace("/chats"); }
      }
    };
    socket.on(`company-${user.companyId}-chat-user-${user.id}`, onChat);
    socket.on(`company-${user.companyId}-chat`, onChat);
    return () => socket.disconnect();
  }, [socketManager, user?.companyId, user?.id, selectChat, history]);

  const sendMessage = async (content: string): Promise<boolean> => {
    const chat = currentChatRef.current;
    if (!chat || !content.trim() || sending) return false;
    setSending(true);
    try {
      const { data } = await api.post<InternalChatMessage>(`/chats/${chat.id}/messages`, { message: content.trim() });
      if (currentChatRef.current?.id === chat.id) {
        setMessages(prev => prev.some(m => m.id === data.id) ? prev : [...prev, data]);
        requestAnimationFrame(() => scrollToBottomRef.current?.());
      }
      setChats(prev => {
        const existing = prev.find(c => c.id === chat.id);
        if (!existing) return prev;
        return [{ ...existing, lastMessage: `${user.name}: ${content.trim()}`, updatedAt: data.createdAt }, ...prev.filter(c => c.id !== chat.id)];
      });
      return true;
    } catch (err) { toastError(err); return false; }
    finally { if (mounted.current) setSending(false); }
  };

  const deleteChat = async (chat: InternalChat) => {
    try {
      await api.delete(`/chats/${chat.id}`);
      setChats(prev => prev.filter(c => c.id !== chat.id));
      if (currentChatRef.current?.id === chat.id) { selectChat(null); history.replace("/chats"); }
    } catch (err) { toastError(err); }
  };

  const handleCreateNewChatSuccess = (chat: InternalChat) => {
    setChats(prev => [chat, ...prev.filter(c => c.id !== chat.id)]);
    history.push(`/chats/${chat.uuid}`);
    selectChat(chat);
  };
  const handleEditChatSuccess = (chat: InternalChat) => {
    setChats(prev => prev.map(c => c.id === chat.id ? chat : c));
    currentChatRef.current = chat;
    setCurrentChat(chat);
  };
  const loadMoreMessages = () => { if (messagesPageInfo.hasMore) void fetchMessages(messagesPage + 1); };

  const renderGrid = () => {
    const hasActiveChat = Boolean(currentChat?.id);

    return (
      <Grid className={classes.gridContainer} container>
        {/* Left Sidebar */}
        <Grid className={classes.gridSidebar} md={4} lg={3} item>
          <div className={classes.sidebarHeader}>
            <Typography component="h1" className={classes.sidebarTitle}>
              <ForumIcon style={{ color: "#10b981", fontSize: 20 }} />
              Chat Interno
            </Typography>
            <Button
              onClick={() => {
                setDialogType("new");
                setShowDialog(true);
              }}
              className={classes.addButton}
              startIcon={<AddIcon />}
              size="small"
            >
              Novo
            </Button>
          </div>

          <ChatList
            chats={chats}
            pageInfo={chatsPageInfo}
            loading={chatsLoading}
            error={chatsError}
            handleRetry={() => loadChats(chatsPage)}
            handleLoadMore={() => loadChats(chatsPage + 1)}
            handleSelectChat={(chat) => selectChat(chat)}
            handleDeleteChat={(chat) => deleteChat(chat)}
            handleEditChat={(chat) => {
              currentChatRef.current = chat;
              setCurrentChat(chat);
              setDialogType("edit");
              setShowDialog(true);
            }}
          />
        </Grid>

        {/* Right Active Conversation / Empty State */}
        <Grid className={classes.gridContent} md={8} lg={9} item>
          {hasActiveChat ? (
            <ChatMessages
              chat={currentChat}
              scrollToBottomRef={scrollToBottomRef}
              pageInfo={messagesPageInfo}
              messages={messages}
              loading={loading}
              sending={sending}
              error={messagesError}
              handleRetry={() => fetchMessages(messagesPage)}
              handleSendMessage={sendMessage}
              handleLoadMore={loadMoreMessages}
            />
          ) : (
            <div className={classes.emptyState}>
              <div className={classes.emptyIconBox}>
                <ForumIcon style={{ fontSize: 34 }} />
              </div>
              <Typography className={classes.emptyTitle}>
                Comunicação Interna da Equipe
              </Typography>
              <Typography className={classes.emptyText}>
                Selecione uma conversa na barra lateral para interagir em tempo real ou crie um novo canal de comunicação.
              </Typography>
              <Button
                onClick={() => {
                  setDialogType("new");
                  setShowDialog(true);
                }}
                className={classes.addButton}
                startIcon={<AddIcon />}
              >
                Iniciar Nova Conversa
              </Button>
            </div>
          )}
        </Grid>
      </Grid>
    );
  };

  const renderTab = () => {
    return (
      <Grid className={classes.gridContainer} container>
        <Grid md={12} item>
          <Tabs
            value={tab}
            indicatorColor="primary"
            textColor="primary"
            onChange={(e, v) => setTab(v)}
            aria-label="chat tabs"
          >
            <Tab label="Conversas" />
            <Tab label="Mensagens" />
          </Tabs>
        </Grid>
        {tab === 0 && (
          <Grid className={classes.gridItemTab} md={12} item>
            <div className={classes.sidebarHeader}>
              <Typography component="h1" className={classes.sidebarTitle}>
                <ForumIcon style={{ color: "#10b981", fontSize: 20 }} />
                Conversas
              </Typography>
              <Button
                onClick={() => {
                  setDialogType("new");
                  setShowDialog(true);
                }}
                className={classes.addButton}
                startIcon={<AddIcon />}
                size="small"
              >
                Novo
              </Button>
            </div>
            <ChatList
              chats={chats}
              pageInfo={chatsPageInfo}
              loading={chatsLoading}
              error={chatsError}
              handleRetry={() => loadChats(chatsPage)}
              handleLoadMore={() => loadChats(chatsPage + 1)}
              handleSelectChat={(chat) => selectChat(chat)}
              handleDeleteChat={(chat) => deleteChat(chat)}
              handleEditChat={(chat) => {
                currentChatRef.current = chat;
                setCurrentChat(chat);
                setDialogType("edit");
                setShowDialog(true);
              }}
            />
          </Grid>
        )}
        {tab === 1 && (
          <Grid className={classes.gridItemTab} md={12} item>
            {Boolean(currentChat?.id) ? (
              <ChatMessages
                chat={currentChat}
                scrollToBottomRef={scrollToBottomRef}
                pageInfo={messagesPageInfo}
                messages={messages}
                loading={loading}
                sending={sending}
                error={messagesError}
                handleRetry={() => fetchMessages(messagesPage)}
                handleSendMessage={sendMessage}
                handleLoadMore={loadMoreMessages}
              />
            ) : (
              <div className={classes.emptyState}>
                <Typography component="h1" className={classes.emptyTitle}>
                  Nenhuma conversa selecionada
                </Typography>
                <Button
                  onClick={() => setTab(0)}
                  className={classes.addButton}
                >
                  Ver Lista de Conversas
                </Button>
              </div>
            )}
          </Grid>
        )}
      </Grid>
    );
  };

  return (
    <>
      <ChatModal
        type={dialogType}
        open={showDialog}
        chat={currentChat}
        handleLoadNewChat={handleCreateNewChatSuccess}
        handleEditSuccess={handleEditChatSuccess}
        handleClose={() => setShowDialog(false)}
      />
      <Paper className={classes.mainContainer}>
        {isWidthUp("md", props.width) ? renderGrid() : renderTab()}
      </Paper>
    </>
  );
}

export default withWidth()(Chat);
