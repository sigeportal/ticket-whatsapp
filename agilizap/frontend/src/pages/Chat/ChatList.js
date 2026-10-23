import React, { useContext, useState, useMemo } from "react";
import {
  Avatar,
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

import DeleteIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import SearchIcon from "@material-ui/icons/Search";

import ConfirmationModal from "../../components/ConfirmationModal";
import api from "../../services/api";
import { getInitials } from "../../helpers/getInitials";
import { generateColor } from "../../helpers/colorGenerator";

const useStyles = makeStyles((theme) => ({
  mainContainer: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    flex: 1,
    height: "100%",
    overflow: "hidden",
    backgroundColor: theme.palette.type === "dark" ? "#07130e" : "#f8fafc",
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
    backgroundColor: theme.palette.type === "dark" ? "#0b1e16" : "#ffffff",
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
  },
  listItem: {
    cursor: "pointer",
    borderRadius: 12,
    margin: "3px 0",
    padding: "8px 12px",
    transition: "all 0.2s ease",
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
  },
  chatTitle: {
    fontWeight: 600,
    fontSize: "0.85rem",
    color: theme.palette.type === "dark" ? "#f0fdf4" : "#0f172a",
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
    fontSize: "0.7rem",
    color: theme.palette.type === "dark" ? "#6ee7b7" : "#059669",
    fontWeight: 500,
  },
  unreadBadge: {
    backgroundColor: "#10b981",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: "0.7rem",
    height: 18,
    minWidth: 18,
    padding: "0 4px",
    borderRadius: 9,
    marginLeft: 6,
  },
  actionButtonEdit: {
    color: theme.palette.type === "dark" ? "#34d399" : "#059669",
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.12)"
        : "rgba(16, 185, 129, 0.08)",
    borderRadius: 6,
    padding: 5,
    marginRight: 4,
    transition: "all 0.2s ease",
    "&:hover": {
      backgroundColor: "#10b981",
      color: "#ffffff",
    },
  },
  actionButtonDelete: {
    color: theme.palette.type === "dark" ? "#f87171" : "#dc2626",
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(239, 68, 68, 0.12)"
        : "rgba(239, 68, 68, 0.08)",
    borderRadius: 6,
    padding: 5,
    transition: "all 0.2s ease",
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
}) {
  const classes = useStyles();
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const { datetimeToClient } = useDate();

  const [confirmationModal, setConfirmModalOpen] = useState(false);
  const [selectedChat, setSelectedChat] = useState({});
  const [searchParam, setSearchParam] = useState("");

  const { id } = useParams();

  const goToMessages = async (chat) => {
    if (unreadMessages(chat) > 0) {
      try {
        await api.post(`/chats/${chat.id}/read`, { userId: user.id });
      } catch (err) {}
    }

    if (id !== chat.uuid) {
      history.push(`/chats/${chat.uuid}`);
      handleSelectChat(chat);
    }
  };

  const handleDelete = () => {
    handleDeleteChat(selectedChat);
  };

  const unreadMessages = (chat) => {
    if (!chat || !Array.isArray(chat.users)) return 0;
    const currentUser = chat.users.find((u) => u.userId === user.id);
    return currentUser ? currentUser.unreads : 0;
  };

  const filteredChats = useMemo(() => {
    if (!Array.isArray(chats)) return [];
    if (!searchParam.trim()) return chats;
    const term = searchParam.toLowerCase();
    return chats.filter((c) => c.title && c.title.toLowerCase().includes(term));
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
            placeholder="Filtrar conversas..."
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
                  button
                >
                  <ListItemAvatar>
                    <Avatar
                      className={classes.avatarSquircle}
                      style={{
                        backgroundColor: generateColor(chat.title || "Chat"),
                      }}
                    >
                      {getInitials(chat.title || "CH")}
                    </Avatar>
                  </ListItemAvatar>

                  <ListItemText
                    primary={
                      <div className={classes.primaryTextWrapper}>
                        <span className={classes.chatTitle}>{chat.title}</span>
                        {unreads > 0 ? (
                          <Chip
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
                    <ListItemSecondaryAction>
                      <Tooltip title="Editar Conversa" arrow>
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            goToMessages(chat).then(() => {
                              handleEditChat(chat);
                            });
                          }}
                          className={classes.actionButtonEdit}
                          size="small"
                        >
                          <EditIcon style={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Excluir Conversa" arrow>
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedChat(chat);
                            setConfirmModalOpen(true);
                          }}
                          className={classes.actionButtonDelete}
                          size="small"
                        >
                          <DeleteIcon style={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  )}
                </ListItem>
              );
            })}
          </List>
        </div>
      </div>
    </>
  );
}
