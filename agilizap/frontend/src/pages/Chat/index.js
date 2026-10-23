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

import { has, isObject } from "lodash";
import { AuthContext } from "../../context/Auth/AuthContext";
import withWidth, { isWidthUp } from "@material-ui/core/withWidth";
import ForumIcon from "@material-ui/icons/Forum";
import AddIcon from "@material-ui/icons/Add";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  mainContainer: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    flex: 1,
    padding: theme.spacing(1.5),
    height: `calc(100% - 64px)`,
    overflowY: "hidden",
    borderRadius: 14,
    border: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.18)"
        : "rgba(226, 232, 240, 0.9)"
    }`,
    backgroundColor: theme.palette.type === "dark" ? "#0b1e16" : "#ffffff",
    boxShadow:
      theme.palette.type === "dark"
        ? "0 4px 20px -2px rgba(0, 0, 0, 0.4)"
        : "0 1px 3px rgba(0, 0, 0, 0.05)",
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
    backgroundColor: theme.palette.type === "dark" ? "#07130e" : "#f8fafc",
    borderRight: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.12)"
        : "rgba(226, 232, 240, 0.8)"
    }`,
  },
  gridContent: {
    height: "100%",
    backgroundColor: theme.palette.type === "dark" ? "#0b1e16" : "#ffffff",
  },
  sidebarHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    backgroundColor: theme.palette.type === "dark" ? "#0b1e16" : "#ffffff",
    borderBottom: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.12)"
        : "rgba(226, 232, 240, 0.9)"
    }`,
  },
  sidebarTitle: {
    fontWeight: 700,
    fontSize: "0.95rem",
    color: theme.palette.type === "dark" ? "#f0fdf4" : "#0f172a",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  addButton: {
    borderRadius: 10,
    fontWeight: 700,
    fontSize: "0.8rem",
    padding: "6px 14px",
    background: "linear-gradient(135deg, #10b981 0%, #0d9488 100%)",
    color: "#ffffff",
    boxShadow: "0 2px 8px rgba(16, 185, 129, 0.25)",
    transition: "all 0.2s ease",
    "&:hover": {
      background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
      boxShadow: "0 4px 12px rgba(16, 185, 129, 0.4)",
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
    backgroundColor: theme.palette.type === "dark" ? "#07130e" : "#f8fafc",
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
    color: theme.palette.type === "dark" ? "#f0fdf4" : "#0f172a",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: "0.85rem",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    maxWidth: 380,
    marginBottom: theme.spacing(2.5),
  },
  gridItemTab: {
    height: "92%",
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
}) {
  const [users, setUsers] = useState([]);
  const [title, setTitle] = useState("");

  useEffect(() => {
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
        alert("Por favor, preencha o título da conversa.");
        return;
      }

      if (!users || users.length === 0) {
        alert("Por favor, selecione pelo menos um usuário.");
        return;
      }

      if (type === "edit") {
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
    }
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
          onClick={handleSave}
          color="primary"
          variant="contained"
          style={{
            borderRadius: 10,
            background: "linear-gradient(135deg, #10b981 0%, #0d9488 100%)",
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

function Chat(props) {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const history = useHistory();

  const [showDialog, setShowDialog] = useState(false);
  const [dialogType, setDialogType] = useState("new");
  const [currentChat, setCurrentChat] = useState({});
  const [chats, setChats] = useState([]);
  const [chatsPageInfo, setChatsPageInfo] = useState({ hasMore: false });
  const [messages, setMessages] = useState([]);
  const [messagesPageInfo, setMessagesPageInfo] = useState({ hasMore: false });
  const [messagesPage, setMessagesPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(0);

  const isMounted = useRef(true);
  const scrollToBottomRef = useRef();
  const currentChatRef = useRef(currentChat);
  const { id } = useParams();

  const socketManager = useContext(SocketContext);

  useEffect(() => {
    currentChatRef.current = currentChat;
  }, [currentChat]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const findChats = async () => {
    try {
      const { data } = await api.get("/chats");
      return data;
    } catch (err) {
      return { records: [], hasMore: false };
    }
  };

  const findMessages = async (chatId) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/chats/${chatId}/messages?pageNumber=${messagesPage}`);
      setMessages(data.records);
      setMessagesPageInfo(data);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  const loadMoreMessages = async () => {
    if (!messagesPageInfo.hasMore || loading) return;
    setLoading(true);
    try {
      const nextPage = messagesPage + 1;
      const { data } = await api.get(`/chats/${currentChat.id}/messages?pageNumber=${nextPage}`);
      setMessages((prev) => [...data.records, ...prev]);
      setMessagesPage(nextPage);
      setMessagesPageInfo(data);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  const selectChat = useCallback((chat) => {
    if (!chat || !chat.id) return;
    setMessages([]);
    setMessagesPage(1);
    setCurrentChat(chat);
    setTab(1);
  }, []);

  // Initial load
  useEffect(() => {
    if (isMounted.current) {
      findChats().then((data) => {
        const { records } = data;
        if (records && records.length > 0) {
          setChats(records);
          setChatsPageInfo(data);

          if (id) {
            const foundChat = records.find((r) => r.uuid === id);
            if (foundChat) selectChat(foundChat);
          }
        }
      });
    }
  }, [id, selectChat]);

  // Synchronize when ID parameter changes in URL
  useEffect(() => {
    if (id && chats.length > 0) {
      const matchingChat = chats.find((c) => c.uuid === id);
      if (matchingChat && matchingChat.id !== currentChatRef.current?.id) {
        selectChat(matchingChat);
      }
    }
  }, [id, chats, selectChat]);

  // Load messages when currentChat changes
  useEffect(() => {
    if (isObject(currentChat) && has(currentChat, "id")) {
      findMessages(currentChat.id).then(() => {
        if (typeof scrollToBottomRef.current === "function") {
          setTimeout(() => {
            scrollToBottomRef.current();
          }, 200);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChat?.id]);

  // REAL-TIME WEBSOCKET LISTENER (Single stable connection without unbind cycles)
  useEffect(() => {
    const companyId = user?.companyId || localStorage.getItem("companyId");
    if (!companyId || !user?.id) return;

    const socket = socketManager.getSocket(companyId);
    if (!socket) return;

    const onUserChatEvent = (data) => {
      if (data.action === "create" && data.record) {
        setChats((prev) => {
          if (prev.some((c) => c.id === data.record.id)) return prev;
          return [data.record, ...prev];
        });
      }
      if (data.action === "update" && data.record) {
        setChats((prev) =>
          prev.map((c) => (c.id === data.record.id ? { ...c, ...data.record } : c))
        );
        if (currentChatRef.current?.id === data.record.id) {
          setCurrentChat((prev) => ({ ...prev, ...data.record }));
        }
      }
    };

    const onCompanyChatEvent = (data) => {
      // 1. New Message Event
      if (data.action === "new-message" && data.newMessage) {
        const incomingChatId = data.newMessage.chatId || (data.chat ? data.chat.id : null);

        // If the message is for the currently open chat, append to messages immediately
        if (currentChatRef.current && currentChatRef.current.id === incomingChatId) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.newMessage.id)) return prev;
            return [...prev, data.newMessage];
          });
          if (typeof scrollToBottomRef.current === "function") {
            setTimeout(() => scrollToBottomRef.current(), 100);
          }
        }

        // Update the chat in the sidebar and move to top
        setChats((prev) => {
          const index = prev.findIndex((c) => c.id === incomingChatId);
          if (index !== -1) {
            const updatedList = [...prev];
            const updatedItem = {
              ...updatedList[index],
              ...(data.chat || {}),
              lastMessage: data.newMessage.message || updatedList[index].lastMessage,
              updatedAt: data.newMessage.createdAt || new Date().toISOString(),
            };
            updatedList.splice(index, 1);
            return [updatedItem, ...updatedList];
          } else if (data.chat) {
            return [data.chat, ...prev];
          }
          return prev;
        });
      }

      // 2. Chat Update Event
      if (data.action === "update" && data.chat) {
        setChats((prev) =>
          prev.map((c) => (c.id === data.chat.id ? { ...c, ...data.chat } : c))
        );
        if (currentChatRef.current?.id === data.chat.id) {
          setCurrentChat((prev) => ({ ...prev, ...data.chat }));
        }
      }

      // 3. Chat Create Event
      if (data.action === "create" && data.record) {
        setChats((prev) => {
          if (prev.some((c) => c.id === data.record.id)) return prev;
          return [data.record, ...prev];
        });
      }

      // 4. Chat Delete Event
      if (data.action === "delete") {
        const deletedId = +data.id;
        setChats((prev) => prev.filter((c) => c.id !== deletedId));
        if (currentChatRef.current?.id === deletedId) {
          setMessages([]);
          setMessagesPage(1);
          setMessagesPageInfo({ hasMore: false });
          setCurrentChat({});
          history.push("/chats");
        }
      }
    };

    socket.on(`company-${companyId}-chat-user-${user.id}`, onUserChatEvent);
    socket.on(`company-${companyId}-chat`, onCompanyChatEvent);

    return () => {
      socket.disconnect();
    };
  }, [socketManager, user?.id, user?.companyId, history]);

  // Send message with immediate optimistic UI update
  const sendMessage = async (contentMessage) => {
    if (!currentChat || !currentChat.id || !contentMessage.trim()) return;

    setLoading(true);
    try {
      const { data: newMessage } = await api.post(`/chats/${currentChat.id}/messages`, {
        message: contentMessage.trim(),
      });

      // Immediate UI update without waiting for socket roundtrip
      if (newMessage) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });

        setChats((prev) => {
          const index = prev.findIndex((c) => c.id === currentChat.id);
          if (index !== -1) {
            const updatedList = [...prev];
            const updatedItem = {
              ...updatedList[index],
              lastMessage: `${user.name || "Você"}: ${contentMessage.trim()}`,
              updatedAt: new Date().toISOString(),
            };
            updatedList.splice(index, 1);
            return [updatedItem, ...updatedList];
          }
          return prev;
        });

        if (typeof scrollToBottomRef.current === "function") {
          setTimeout(() => scrollToBottomRef.current(), 100);
        }
      }
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
  };

  const deleteChat = async (chat) => {
    try {
      await api.delete(`/chats/${chat.id}`);
      setChats((prev) => prev.filter((c) => c.id !== chat.id));
      if (currentChat?.id === chat.id) {
        setCurrentChat({});
        setMessages([]);
        history.push("/chats");
      }
    } catch (err) {
      toastError(err);
    }
  };

  const handleCreateNewChatSuccess = (newChat) => {
    if (!newChat) return;
    setChats((prev) => [newChat, ...prev.filter((c) => c.id !== newChat.id)]);
    setMessages([]);
    setMessagesPage(1);
    setCurrentChat(newChat);
    setTab(1);
    history.push(`/chats/${newChat.uuid}`);
  };

  const handleEditChatSuccess = (updatedChat) => {
    if (!updatedChat) return;
    setChats((prev) =>
      prev.map((c) => (c.id === updatedChat.id ? { ...c, ...updatedChat } : c))
    );
    if (currentChat?.id === updatedChat.id) {
      setCurrentChat((prev) => ({ ...prev, ...updatedChat }));
    }
  };

  const renderGrid = () => {
    const hasActiveChat = isObject(currentChat) && has(currentChat, "id");

    return (
      <Grid className={classes.gridContainer} container>
        {/* Left Sidebar */}
        <Grid className={classes.gridSidebar} md={4} lg={3} item>
          <div className={classes.sidebarHeader}>
            <Typography className={classes.sidebarTitle}>
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
            loading={loading}
            handleSelectChat={(chat) => selectChat(chat)}
            handleDeleteChat={(chat) => deleteChat(chat)}
            handleEditChat={() => {
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
              <Typography className={classes.sidebarTitle}>
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
              loading={loading}
              handleSelectChat={(chat) => selectChat(chat)}
              handleDeleteChat={(chat) => deleteChat(chat)}
              handleEditChat={() => {
                setDialogType("edit");
                setShowDialog(true);
              }}
            />
          </Grid>
        )}
        {tab === 1 && (
          <Grid className={classes.gridItemTab} md={12} item>
            {isObject(currentChat) && has(currentChat, "id") ? (
              <ChatMessages
                chat={currentChat}
                scrollToBottomRef={scrollToBottomRef}
                pageInfo={messagesPageInfo}
                messages={messages}
                loading={loading}
                handleSendMessage={sendMessage}
                handleLoadMore={loadMoreMessages}
              />
            ) : (
              <div className={classes.emptyState}>
                <Typography className={classes.emptyTitle}>
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
