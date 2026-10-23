import React, { useState, useEffect, useReducer, useContext } from "react";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import IconButton from "@material-ui/core/IconButton";
import SearchIcon from "@material-ui/icons/Search";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import Tooltip from "@material-ui/core/Tooltip";
import Avatar from "@material-ui/core/Avatar";
import Typography from "@material-ui/core/Typography";

import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import PeopleIcon from "@material-ui/icons/People";
import GetAppIcon from "@material-ui/icons/GetApp";
import AddIcon from "@material-ui/icons/Add";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ContactListDialog from "../../components/ContactListDialog";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { Grid } from "@material-ui/core";

import planilhaExemplo from "../../assets/planilha.xlsx";
import { SocketContext } from "../../context/Socket/SocketContext";
import { getInitials } from "../../helpers/getInitials";
import { generateColor } from "../../helpers/colorGenerator";

const reducer = (state, action) => {
  if (action.type === "LOAD_CONTACTLISTS") {
    const contactLists = action.payload;
    const newContactLists = [];

    contactLists.forEach((contactList) => {
      const contactListIndex = state.findIndex((u) => u.id === contactList.id);
      if (contactListIndex !== -1) {
        state[contactListIndex] = contactList;
      } else {
        newContactLists.push(contactList);
      }
    });

    return [...state, ...newContactLists];
  }

  if (action.type === "UPDATE_CONTACTLIST") {
    const contactList = action.payload;
    const contactListIndex = state.findIndex((u) => u.id === contactList.id);

    if (contactListIndex !== -1) {
      state[contactListIndex] = contactList;
      return [...state];
    } else {
      return [contactList, ...state];
    }
  }

  if (action.type === "DELETE_CONTACTLIST") {
    const contactListId = action.payload;

    const contactListIndex = state.findIndex((u) => u.id === contactListId);
    if (contactListIndex !== -1) {
      state.splice(contactListIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1.5),
    overflowY: "scroll",
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
    ...theme.scrollbarStyles,
  },
  searchInput: {
    backgroundColor: theme.palette.type === "dark" ? "#07130e" : "#f8fafc",
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
  },
  addButton: {
    borderRadius: 10,
    fontWeight: 700,
    fontSize: "0.84rem",
    padding: "8px 18px",
    background: "linear-gradient(135deg, #10b981 0%, #0d9488 100%)",
    color: "#ffffff",
    boxShadow: "0 2px 8px rgba(16, 185, 129, 0.25)",
    transition: "all 0.2s ease",
    "&:hover": {
      background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
      boxShadow: "0 4px 12px rgba(16, 185, 129, 0.4)",
    },
  },
  secondaryButton: {
    borderRadius: 10,
    fontWeight: 600,
    fontSize: "0.82rem",
    padding: "8px 14px",
    color: theme.palette.type === "dark" ? "#cbd5e1" : "#475569",
    backgroundColor:
      theme.palette.type === "dark" ? "rgba(16, 185, 129, 0.08)" : "#f1f5f9",
    border: `1px solid ${
      theme.palette.type === "dark" ? "rgba(16, 185, 129, 0.2)" : "#e2e8f0"
    }`,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    transition: "all 0.2s ease",
    "&:hover": {
      backgroundColor:
        theme.palette.type === "dark" ? "rgba(16, 185, 129, 0.15)" : "#e2e8f0",
      color: theme.palette.type === "dark" ? "#34d399" : "#0f172a",
    },
  },
  listNameCell: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  avatarSquircle: {
    borderRadius: 10,
    fontWeight: 700,
    fontSize: "0.85rem",
    width: 38,
    height: 38,
    boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
  },
  listNameText: {
    fontWeight: 600,
    fontSize: "0.88rem",
    color: theme.palette.type === "dark" ? "#f0fdf4" : "#0f172a",
  },
  contactsBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "3px 10px",
    borderRadius: 12,
    fontSize: "0.75rem",
    fontWeight: 600,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.15)"
        : "rgba(16, 185, 129, 0.1)",
    color: theme.palette.type === "dark" ? "#34d399" : "#059669",
    border: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.3)"
        : "rgba(16, 185, 129, 0.2)"
    }`,
  },
  actionButtonSecondary: {
    color: theme.palette.type === "dark" ? "#94a3b8" : "#475569",
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255, 255, 255, 0.06)"
        : "rgba(0, 0, 0, 0.04)",
    borderRadius: 8,
    padding: 6,
    marginRight: 6,
    transition: "all 0.2s ease",
    "&:hover": {
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(16, 185, 129, 0.2)"
          : "rgba(16, 185, 129, 0.15)",
      color: "#10b981",
    },
  },
  actionButtonEdit: {
    color: theme.palette.type === "dark" ? "#34d399" : "#059669",
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.12)"
        : "rgba(16, 185, 129, 0.08)",
    borderRadius: 8,
    padding: 6,
    marginRight: 6,
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
    borderRadius: 8,
    padding: 6,
    transition: "all 0.2s ease",
    "&:hover": {
      backgroundColor: "#ef4444",
      color: "#ffffff",
    },
  },
}));

const ContactLists = () => {
  const classes = useStyles();
  const history = useHistory();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedContactList, setSelectedContactList] = useState(null);
  const [deletingContactList, setDeletingContactList] = useState(null);
  const [contactListModalOpen, setContactListModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [contactLists, dispatch] = useReducer(reducer, []);

  const socketManager = useContext(SocketContext);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContactLists = async () => {
        try {
          const { data } = await api.get("/contact-lists/", {
            params: { searchParam, pageNumber },
          });
          dispatch({ type: "LOAD_CONTACTLISTS", payload: data.records });
          setHasMore(data.hasMore);
          setLoading(false);
        } catch (err) {
          toastError(err);
        }
      };
      fetchContactLists();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    socket.on(`company-${companyId}-ContactList`, (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_CONTACTLIST", payload: data.record });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_CONTACTLIST", payload: +data.id });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [socketManager]);

  const handleOpenContactListModal = () => {
    setSelectedContactList(null);
    setContactListModalOpen(true);
  };

  const handleCloseContactListModal = () => {
    setSelectedContactList(null);
    setContactListModalOpen(false);
  };

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleEditContactList = (contactList) => {
    setSelectedContactList(contactList);
    setContactListModalOpen(true);
  };

  const handleDeleteContactList = async (contactListId) => {
    try {
      await api.delete(`/contact-lists/${contactListId}`);
      toast.success(i18n.t("contactLists.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingContactList(null);
    setSearchParam("");
    setPageNumber(1);
  };

  const loadMore = () => {
    setPageNumber((prevState) => prevState + 1);
  };

  const handleScroll = (e) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  const goToContacts = (id) => {
    history.push(`/contact-lists/${id}/contacts`);
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={
          deletingContactList &&
          `${i18n.t("contactLists.confirmationModal.deleteTitle")} ${
            deletingContactList.name
          }?`
        }
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={() => handleDeleteContactList(deletingContactList.id)}
      >
        {i18n.t("contactLists.confirmationModal.deleteMessage")}
      </ConfirmationModal>

      <ContactListDialog
        open={contactListModalOpen}
        onClose={handleCloseContactListModal}
        aria-labelledby="form-dialog-title"
        contactListId={selectedContactList && selectedContactList.id}
      />

      <MainHeader>
        <Grid style={{ width: "99.6%" }} alignItems="center" container>
          <Grid xs={12} sm={6} item>
            <Title>{i18n.t("contactLists.title")}</Title>
          </Grid>
          <Grid xs={12} sm={6} item>
            <Grid spacing={1} alignItems="center" justifyContent="flex-end" container>
              <Grid xs={12} sm={6} item>
                <TextField
                  fullWidth
                  placeholder={i18n.t("contacts.searchPlaceholder")}
                  type="search"
                  size="small"
                  variant="outlined"
                  value={searchParam}
                  onChange={handleSearch}
                  className={classes.searchInput}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon style={{ color: "#10b981", fontSize: 18 }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid xs={6} sm={3} item>
                <a
                  href={planilhaExemplo}
                  download="planilha.xlsx"
                  className={classes.secondaryButton}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  <GetAppIcon style={{ fontSize: 16 }} />
                  <span>Modelo</span>
                </a>
              </Grid>
              <Grid xs={6} sm={3} item>
                <Button
                  fullWidth
                  variant="contained"
                  className={classes.addButton}
                  startIcon={<AddIcon />}
                  onClick={handleOpenContactListModal}
                >
                  {i18n.t("contactLists.buttons.add")}
                </Button>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </MainHeader>

      <Paper
        className={classes.mainPaper}
        variant="outlined"
        onScroll={handleScroll}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell align="left" style={{ fontWeight: 700 }}>
                {i18n.t("contactLists.table.name")}
              </TableCell>
              <TableCell align="center" style={{ fontWeight: 700 }}>
                {i18n.t("contactLists.table.contacts")}
              </TableCell>
              <TableCell align="right" style={{ fontWeight: 700, paddingRight: 24 }}>
                {i18n.t("contactLists.table.actions")}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <>
              {contactLists.map((contactList) => (
                <TableRow key={contactList.id} hover>
                  <TableCell align="left">
                    <div className={classes.listNameCell}>
                      <Avatar
                        className={classes.avatarSquircle}
                        style={{
                          backgroundColor: generateColor(
                            contactList.name || "List"
                          ),
                        }}
                      >
                        {getInitials(contactList.name || "CL")}
                      </Avatar>
                      <Typography className={classes.listNameText}>
                        {contactList.name}
                      </Typography>
                    </div>
                  </TableCell>

                  <TableCell align="center">
                    <span className={classes.contactsBadge}>
                      <PeopleIcon style={{ fontSize: 14 }} />
                      {contactList.contactsCount || 0} contatos
                    </span>
                  </TableCell>

                  <TableCell align="right">
                    <Tooltip title="Baixar Planilha Exemplo" arrow>
                      <a href={planilhaExemplo} download="planilha.xlsx">
                        <IconButton
                          size="small"
                          className={classes.actionButtonSecondary}
                        >
                          <GetAppIcon style={{ fontSize: 16 }} />
                        </IconButton>
                      </a>
                    </Tooltip>

                    <Tooltip title="Ver Contatos da Lista" arrow>
                      <IconButton
                        size="small"
                        className={classes.actionButtonSecondary}
                        onClick={() => goToContacts(contactList.id)}
                      >
                        <PeopleIcon style={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Editar Lista" arrow>
                      <IconButton
                        size="small"
                        className={classes.actionButtonEdit}
                        onClick={() => handleEditContactList(contactList)}
                      >
                        <EditIcon style={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Excluir Lista" arrow>
                      <IconButton
                        size="small"
                        className={classes.actionButtonDelete}
                        onClick={(e) => {
                          setConfirmModalOpen(true);
                          setDeletingContactList(contactList);
                        }}
                      >
                        <DeleteOutlineIcon style={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {loading && <TableRowSkeleton columns={3} />}
            </>
          </TableBody>
        </Table>
      </Paper>
    </MainContainer>
  );
};

export default ContactLists;
