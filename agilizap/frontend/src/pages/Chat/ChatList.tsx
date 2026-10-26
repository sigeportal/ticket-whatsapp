import React, { useContext, useState, useMemo } from "react";
import {
  Avatar,
  Button,
  CircularProgress,
  Chip,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemSecondaryAction,
  ListItemText,
  TextField,
  Tooltip,
  Typography,
  makeStyles,
} from "@material-ui/core";

import { useHistory, useParams } from "react-router-dom";
import { AuthContext } from "../../context/Auth/AuthContext";
import { useDate } from "../../hooks/useDate";

import { FiTrash2 as DeleteIcon } from "react-icons/fi";
import { FiEdit2 as EditIcon } from "react-icons/fi";
import { FiSearch as SearchIcon } from "react-icons/fi";

import ConfirmationModal from "../../components/ConfirmationModal";
import { getInitials } from "../../helpers/getInitials";
import type { InternalChat, User } from "../../types";

const useStyles = makeStyles((theme) => ({
  mainContainer: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
    backgroundColor: theme.palette.type === "dark" ? "#0f172a" : "#f8fafc",
  },
  searchBox: {
    padding: theme.spacing(1, 1.5),
    borderBottom: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.12)"
        : "rgba(226, 232, 240, 0.9)"
    }`,
  },
  searchInput: {
    backgroundColor: theme.palette.type === "dark" ? "#162032" : "#ffffff",
    borderRadius: 10,
    "& .MuiOutlinedInput-root": {
      borderRadius: 10,
      border: `1px solid ${
        theme.palette.type === "dark"
          ? "rgba(16, 185, 129, 0.2)"
          : "rgba(226, 232, 240, 0.9)"
      }`,
      "&.Mui-focused": {
        borderColor: "#10b981",
        boxShadow: "0 0 0 3px rgba(16, 185, 129, 0.15)",
      },
    },
    "& .MuiOutlinedInput-input": {
      padding: "9px 12px",
      fontSize: "0.82rem",
    },
  },
  chatList: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    flex: 1,
    overflowY: "auto",
    padding: theme.spacing(0.5),
    ...theme.scrollbarStyles,
    minHeight: 0,
    minWidth: 0,
  },
  listItem: {
    cursor: "pointer",
    borderRadius: 12,
    margin: "3px 0",
    padding: "8px 12px",
    "&.MuiListItem-secondaryAction": { paddingRight: 12, paddingBottom: 54 },
    transition: "background-color 0.2s ease, color 0.2s ease",
    "&:hover": {
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(16, 185, 129, 0.08)"
          : "rgba(16, 185, 129, 0.05)",
    },
  },
  listItemSelected: {
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.14) !important"
        : "rgba(16, 185, 129, 0.1) !important",
    borderLeft: "4px solid #10b981",
  },
  avatarSquircle: {
    borderRadius: 10,
    fontWeight: 700,
    fontSize: "0.85rem",
    width: 38,
    height: 38,
    marginRight: 4,
    boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
  },
  primaryTextWrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    gap: 8,
  },
  chatTitle: {
    fontWeight: 600,
    fontSize: "0.875rem",
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  chatLastMessage: {
    fontSize: "0.75rem",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    marginTop: 2,
  },
  chatTime: {
    fontSize: "0.75rem",
    color: theme.palette.type === "dark" ? "#6ee7b7" : "#047857",
    fontWeight: 500,
  },
  unreadBadge: {
    backgroundColor: "#047857",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: "0.75rem",
    height: 18,
    minWidth: 18,
    padding: "0 4px",
    borderRadius: 9,
    marginLeft: 6,
  },
  actionButtonEdit: {
    minWidth: 44,
    minHeight: 44,
    color: theme.palette.type === "dark" ? "#34d399" : "#059669",
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.12)"
        : "rgba(16, 185, 129, 0.08)",
    borderRadius: 6,
    padding: 5,
    marginRight: 4,
    transition: "background-color 0.2s ease, color 0.2s ease",
    "&:hover": {
      backgroundColor: "#10b981",
      color: "#ffffff",
    },
  },
  actionButtonDelete: {
    minWidth: 44,
    minHeight: 44,
    color: theme.palette.type === "dark" ? "#f87171" : "#dc2626",
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(239, 68, 68, 0.12)"
        : "rgba(239, 68, 68, 0.08)",
    borderRadius: 6,
    padding: 5,
    transition: "background-color 0.2s ease, color 0.2s ease",
    "&:hover": {
      backgroundColor: "#ef4444",
      color: "#ffffff",
    },
  },
}));

export default function ChatList({
  chats,
  handleSelectChat,
  handleDeleteChat,
  handleEditChat,
  pageInfo,
  loading,
  handleLoadMore,
  error,
  handleRetry,
}: { chats: InternalChat[]; handleSelectChat: (chat: InternalChat) => void; handleDeleteChat: (chat: InternalChat) => void; handleEditChat: (chat: InternalChat) => void; pageInfo: { hasMore: boolean }; loading: boolean; handleLoadMore: () => void; error: boolean; handleRetry: () => void }) {
  const classes = useStyles();
  const history = useHistory();
  const { user } = useContext(AuthContext) as { user: User };
  const { datetimeToClient } = useDate();

  const [confirmationModal, setConfirmModalOpen] = useState(false);
  const [selectedChat, setSelectedChat] = useState<InternalChat | null>(null);
  const [searchParam, setSearchParam] = useState("");

  const { id } = useParams<{ id?: string }>();

  const goToMessages = (chat: InternalChat) => {
    if (id !== chat.uuid) history.push(`/chats/${chat.uuid}`);
    handleSelectChat(chat);
  };

  const handleDelete = () => {
    if (selectedChat) handleDeleteChat(selectedChat);
  };

  const unreadMessages = (chat: InternalChat) => {
    if (!chat || !Array.isArray(chat.users)) return 0;
    const currentUser = chat.users.find((u) => u.userId === user.id);
    return currentUser ? currentUser.unreads : 0;
  };

  const filteredChats = useMemo(() => {
    if (!Array.isArray(chats)) return [];
    if (!searchParam.trim()) return chats;
    const term = searchParam.trim().toLocaleLowerCase();
    return chats.filter(c => `${c.title} ${(c.users || []).map(p => p.user?.name || "").join(" ")}`.toLocaleLowerCase().includes(term));
  }, [chats, searchParam]);

  return (
    <>
      <ConfirmationModal
        title={"Excluir Conversa"}
        open={confirmationModal}
        onClose={setConfirmModalOpen}
        onConfirm={handleDelete}
      >
        Esta ação não pode ser revertida, confirmar?
      </ConfirmationModal>

      <div className={classes.mainContainer}>
        {/* Search bar */}
        <div className={classes.searchBox}>
          <TextField
            fullWidth
            size="small"
            variant="outlined"
            placeholder="Buscar conversa ou participante…"
            inputProps={{ "aria-label": "Buscar conversas" }}
            value={searchParam}
            onChange={(e) => setSearchParam(e.target.value)}
            className={classes.searchInput}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon style={{ fontSize: 18, color: "#10b981" }} />
                </InputAdornment>
              ),
            }}
          />
        </div>

        <div className={classes.chatList}>
          <List disablePadding>
            {filteredChats.map((chat) => {
              const unreads = unreadMessages(chat);
              const isSelected = chat.uuid === id;

              return (
                <ListItem
                  key={chat.id || chat.uuid}
                  onClick={() => goToMessages(chat)}
                  className={`${classes.listItem} ${
                    isSelected ? classes.listItemSelected : ""
                  }`}
                  selected={isSelected}
                  aria-current={isSelected ? "true" : undefined}
                  button
                >
                  <ListItemAvatar>
                    <Avatar
                      className={classes.avatarSquircle}
                      style={{
                        backgroundColor: "#0d9488", color: "#fff",
                      }}
                    >
                      {getInitials(chat.title || "CH")}
                    </Avatar>
                  </ListItemAvatar>

                  <ListItemText
                    disableTypography
                    primary={
                      <div className={classes.primaryTextWrapper}>
                        <span className={classes.chatTitle}>{chat.title}</span>
                        {unreads > 0 ? (
                          <Chip
                            aria-label={`${unreads} mensagens não lidas`}
                            size="small"
                            label={unreads}
                            className={classes.unreadBadge}
                          />
                        ) : chat.updatedAt ? (
                          <span className={classes.chatTime}>
                            {datetimeToClient(chat.updatedAt).split(" ")[1] || ""}
                          </span>
                        ) : null}
                      </div>
                    }
                    secondary={
                      <Typography
                        component="span"
                        className={classes.chatLastMessage}
                        display="block"
                      >
                        {chat.lastMessage || "Nenhuma mensagem recente"}
                      </Typography>
                    }
                  />

                  {chat.ownerId === user.id && (
                    <ListItemSecondaryAction style={{ top: "auto", bottom: 6, transform: "none" }}>
                      <Tooltip title="Editar Conversa" arrow>
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            goToMessages(chat);
                            handleEditChat(chat);
                          }}
                          aria-label={`Editar conversa ${chat.title}`}
                          className={classes.actionButtonEdit}
                          size="small"
                        >
                          <EditIcon style={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Excluir Conversa" arrow>
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedChat(chat);
                            setConfirmModalOpen(true);
                          }}
                          aria-label={`Excluir conversa ${chat.title}`}
                          className={classes.actionButtonDelete}
                          size="small"
                        >
                          <DeleteIcon style={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  )}
                </ListItem>
              );
            })}
          </List>
          {loading && <CircularProgress size={24} aria-label="Carregando conversas" style={{ margin: 16, alignSelf: "center" }} />}
          {error && <div role="alert">Não foi possível carregar as conversas. <Button onClick={handleRetry}>Tentar novamente</Button></div>}
          {!loading && !error && filteredChats.length === 0 && <Typography style={{ padding: 16 }} color="textSecondary">{searchParam ? "Nenhuma conversa encontrada. Tente outro nome ou carregue mais conversas." : "Sua equipe ainda não tem conversas. Clique em Novo para começar."}</Typography>}
          {pageInfo.hasMore && !error && <Button disabled={loading} onClick={handleLoadMore}>Carregar mais conversas</Button>}
        </div>
      </div>
    </>
  );
}
