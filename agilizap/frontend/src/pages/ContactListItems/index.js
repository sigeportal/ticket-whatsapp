import React, {
  useState,
  useEffect,
  useReducer,
  useContext,
  useRef,
} from "react";

import { toast } from "react-toastify";
import { useParams, useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import SearchIcon from "@material-ui/icons/Search";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import Tooltip from "@material-ui/core/Tooltip";
import Avatar from "@material-ui/core/Avatar";
import Typography from "@material-ui/core/Typography";

import IconButton from "@material-ui/core/IconButton";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import BlockIcon from "@material-ui/icons/Block";
import CloudUploadIcon from "@material-ui/icons/CloudUpload";
import FormatListBulletedIcon from "@material-ui/icons/FormatListBulleted";
import AddIcon from "@material-ui/icons/Add";

import api from "../../services/api";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ContactListItemModal from "../../components/ContactListItemModal";
import ConfirmationModal from "../../components/ConfirmationModal/";

import { i18n } from "../../translate/i18n";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import MainContainer from "../../components/MainContainer";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../../components/Can";
import useContactLists from "../../hooks/useContactLists";
import { Grid } from "@material-ui/core";

import planilhaExemplo from "../../assets/planilha.xlsx";
import { SocketContext } from "../../context/Socket/SocketContext";
import { getInitials } from "../../helpers/getInitials";
import { generateColor } from "../../helpers/colorGenerator";

const reducer = (state, action) => {
  if (action.type === "LOAD_CONTACTS") {
    const contacts = action.payload;
    const newContacts = [];

    contacts.forEach((contact) => {
      const contactIndex = state.findIndex((c) => c.id === contact.id);
      if (contactIndex !== -1) {
        state[contactIndex] = contact;
      } else {
        newContacts.push(contact);
      }
    });

    return [...state, ...newContacts];
  }

  if (action.type === "UPDATE_CONTACTS") {
    const contact = action.payload;
    const contactIndex = state.findIndex((c) => c.id === contact.id);

    if (contactIndex !== -1) {
      state[contactIndex] = contact;
      return [...state];
    } else {
      return [contact, ...state];
    }
  }

  if (action.type === "DELETE_CONTACT") {
    const contactId = action.payload;

    const contactIndex = state.findIndex((c) => c.id === contactId);
    if (contactIndex !== -1) {
      state.splice(contactIndex, 1);
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
    fontSize: "0.82rem",
    padding: "8px 14px",
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
    transition: "all 0.2s ease",
    "&:hover": {
      backgroundColor:
        theme.palette.type === "dark" ? "rgba(16, 185, 129, 0.15)" : "#e2e8f0",
      color: theme.palette.type === "dark" ? "#34d399" : "#0f172a",
    },
  },
  contactNameCell: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  avatarSquircle: {
    borderRadius: 10,
    fontWeight: 700,
    fontSize: "0.85rem",
    width: 36,
    height: 36,
    boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
  },
  contactNameText: {
    fontWeight: 600,
    fontSize: "0.86rem",
    color: theme.palette.type === "dark" ? "#f0fdf4" : "#0f172a",
  },
  statusPillActive: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "3px 9px",
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
  statusPillInactive: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "3px 9px",
    borderRadius: 12,
    fontSize: "0.75rem",
    fontWeight: 600,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(148, 163, 184, 0.1)"
        : "#f1f5f9",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    border: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(148, 163, 184, 0.2)"
        : "#e2e8f0"
    }`,
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

const ContactListItems = () => {
  const classes = useStyles();

  const { user } = useContext(AuthContext);
  const { contactListId } = useParams();
  const history = useHistory();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchParam, setSearchParam] = useState("");
  const [contacts, dispatch] = useReducer(reducer, []);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [contactListItemModalOpen, setContactListItemModalOpen] =
    useState(false);
  const [deletingContact, setDeletingContact] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [contactList, setContactList] = useState({});
  const fileUploadRef = useRef(null);

  const { findById: findContactList } = useContactLists();

  const socketManager = useContext(SocketContext);

  useEffect(() => {
    findContactList(contactListId).then((data) => {
      setContactList(data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactListId]);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        try {
          const { data } = await api.get(`contact-list-items`, {
            params: { searchParam, pageNumber, contactListId },
          });
          dispatch({ type: "LOAD_CONTACTS", payload: data.contacts });
          setHasMore(data.hasMore);
          setLoading(false);
        } catch (err) {
          toastError(err);
        }
      };
      fetchContacts();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber, contactListId]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    socket.on(
      `company-${companyId}-ContactListItem-${contactListId}`,
      (data) => {
        if (data.action === "reload") {
          dispatch({ type: "LOAD_CONTACTS", payload: data.records });
        }
      }
    );

    return () => {
      socket.disconnect();
    };
  }, [contactListId, socketManager]);

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleOpenContactListItemModal = () => {
    setSelectedContactId(null);
    setContactListItemModalOpen(true);
  };

  const handleCloseContactListItemModal = () => {
    setSelectedContactId(null);
    setContactListItemModalOpen(false);
  };

  const hadleEditContact = (contactId) => {
    setSelectedContactId(contactId);
    setContactListItemModalOpen(true);
  };

  const handleDeleteContact = async (contactId) => {
    try {
      await api.delete(`/contact-list-items/${contactId}`);
      toast.success(i18n.t("contacts.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingContact(null);
    setSearchParam("");
    setPageNumber(1);
  };

  const handleImportContacts = async () => {
    try {
      const formData = new FormData();
      formData.append("file", fileUploadRef.current.files[0]);
      await api.request({
        url: `contact-lists/${contactListId}/upload`,
        method: "POST",
        data: formData,
      });
    } catch (err) {
      toastError(err);
    }
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

  const goToContactLists = () => {
    history.push("/contact-lists");
  };

  return (
    <MainContainer>
      <ContactListItemModal
        open={contactListItemModalOpen}
        onClose={handleCloseContactListItemModal}
        aria-labelledby="form-dialog-title"
        contactId={selectedContactId}
      />
      <ConfirmationModal
        title={
          deletingContact
            ? `${i18n.t("contactListItems.confirmationModal.deleteTitle")} ${
                deletingContact.name
              }?`
            : `${i18n.t("contactListItems.confirmationModal.importTitlte")}`
        }
        open={confirmOpen}
        onClose={setConfirmOpen}
        onConfirm={() =>
          deletingContact
            ? handleDeleteContact(deletingContact.id)
            : handleImportContacts()
        }
      >
        {deletingContact ? (
          `${i18n.t("contactListItems.confirmationModal.deleteMessage")}`
        ) : (
          <>
            {i18n.t("contactListItems.confirmationModal.importMessage")}
            <a href={planilhaExemplo} download="planilha.xlsx">
              Clique aqui para baixar planilha exemplo.
            </a>
          </>
        )}
      </ConfirmationModal>

      <MainHeader>
        <Grid style={{ width: "99.6%" }} alignItems="center" container>
          <Grid xs={12} sm={4} item>
            <Title>{contactList.name || "Contatos da Lista"}</Title>
          </Grid>
          <Grid xs={12} sm={8} item>
            <Grid spacing={1} alignItems="center" justifyContent="flex-end" container>
              <Grid xs={12} sm={5} item>
                <TextField
                  fullWidth
                  placeholder={i18n.t("contactListItems.searchPlaceholder")}
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
              <Grid xs={4} sm={2} item>
                <Button
                  fullWidth
                  variant="outlined"
                  className={classes.secondaryButton}
                  startIcon={<FormatListBulletedIcon />}
                  onClick={goToContactLists}
                >
                  Listas
                </Button>
              </Grid>
              <Grid xs={4} sm={2} item>
                <Button
                  fullWidth
                  variant="outlined"
                  className={classes.secondaryButton}
                  startIcon={<CloudUploadIcon />}
                  onClick={() => {
                    if (fileUploadRef.current) {
                      fileUploadRef.current.value = null;
                      fileUploadRef.current.click();
                    }
                  }}
                >
                  Importar
                </Button>
              </Grid>
              <Grid xs={4} sm={3} item>
                <Button
                  fullWidth
                  variant="contained"
                  className={classes.addButton}
                  startIcon={<AddIcon />}
                  onClick={handleOpenContactListItemModal}
                >
                  Adicionar
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
        <input
          style={{ display: "none" }}
          id="upload"
          name="file"
          type="file"
          accept=".xls,.xlsx"
          onChange={() => {
            setConfirmOpen(true);
          }}
          ref={fileUploadRef}
        />

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell align="left" style={{ fontWeight: 700 }}>
                {i18n.t("contactListItems.table.name")}
              </TableCell>
              <TableCell align="center" style={{ fontWeight: 700 }}>
                Status
              </TableCell>
              <TableCell align="center" style={{ fontWeight: 700 }}>
                {i18n.t("contactListItems.table.number")}
              </TableCell>
              <TableCell align="center" style={{ fontWeight: 700 }}>
                {i18n.t("contactListItems.table.email")}
              </TableCell>
              <TableCell align="right" style={{ fontWeight: 700, paddingRight: 24 }}>
                {i18n.t("contactListItems.table.actions")}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <>
              {contacts.map((contact) => (
                <TableRow key={contact.id} hover>
                  <TableCell align="left">
                    <div className={classes.contactNameCell}>
                      <Avatar
                        className={classes.avatarSquircle}
                        style={{
                          backgroundColor: generateColor(
                            contact.name || contact.number || "Contact"
                          ),
                        }}
                      >
                        {getInitials(contact.name || "CT")}
                      </Avatar>
                      <Typography className={classes.contactNameText}>
                        {contact.name}
                      </Typography>
                    </div>
                  </TableCell>

                  <TableCell align="center">
                    {contact.isWhatsappValid ? (
                      <span className={classes.statusPillActive}>
                        <CheckCircleIcon style={{ fontSize: 13 }} />
                        WhatsApp Válido
                      </span>
                    ) : (
                      <span className={classes.statusPillInactive}>
                        <BlockIcon style={{ fontSize: 13 }} />
                        Sem WhatsApp
                      </span>
                    )}
                  </TableCell>

                  <TableCell align="center">{contact.number}</TableCell>
                  <TableCell align="center">{contact.email}</TableCell>

                  <TableCell align="right">
                    <Tooltip title="Editar Contato" arrow>
                      <IconButton
                        size="small"
                        className={classes.actionButtonEdit}
                        onClick={() => hadleEditContact(contact.id)}
                      >
                        <EditIcon style={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>

                    <Can
                      role={user.profile}
                      perform="contacts-page:deleteContact"
                      yes={() => (
                        <Tooltip title="Excluir Contato" arrow>
                          <IconButton
                            size="small"
                            className={classes.actionButtonDelete}
                            onClick={() => {
                              setConfirmOpen(true);
                              setDeletingContact(contact);
                            }}
                          >
                            <DeleteOutlineIcon style={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {loading && <TableRowSkeleton columns={5} />}
            </>
          </TableBody>
        </Table>
      </Paper>
    </MainContainer>
  );
};

export default ContactListItems;
