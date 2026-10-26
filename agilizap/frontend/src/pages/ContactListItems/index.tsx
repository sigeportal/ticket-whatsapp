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
import { FiSearch as SearchIcon } from "react-icons/fi";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import Tooltip from "@material-ui/core/Tooltip";
import Avatar from "@material-ui/core/Avatar";
import Typography from "@material-ui/core/Typography";

import IconButton from "@material-ui/core/IconButton";
import { FiTrash2 as DeleteOutlineIcon } from "react-icons/fi";
import { FiEdit2 as EditIcon } from "react-icons/fi";
import { FiCheckCircle as CheckCircleIcon } from "react-icons/fi";
import { FiXCircle as BlockIcon } from "react-icons/fi";
import { FiUpload as CloudUploadIcon } from "react-icons/fi";
import { FiList as FormatListBulletedIcon } from "react-icons/fi";
import { FiPlus as AddIcon } from "react-icons/fi";

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
import type { ContactListItem, ContactListEvent, ContactList, User } from "../../types";
import ContactListStats from "../../components/ContactListStats";

type Action = { type: "LOAD_CONTACTS"; payload: ContactListItem[] } | { type: "UPDATE_CONTACTS"; payload: ContactListItem } | { type: "DELETE_CONTACT"; payload: number } | { type: "RESET" };
const reducer = (state: ContactListItem[], action: Action): ContactListItem[] => {
  if (action.type === "RESET") return [];
  if (action.type === "DELETE_CONTACT") return state.filter(item => item.id !== action.payload);
  if (action.type === "UPDATE_CONTACTS") return [action.payload, ...state.filter(item => item.id !== action.payload.id)];
  const records = new Map(state.map(item => [item.id, item]));
  action.payload.forEach(item => records.set(item.id, item));
  return [...records.values()];
};

const t = (key: string) => String(i18n.t(key));

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1.5),
    overflow: "auto",
    "& table": { minWidth: 720 },
    "& td:last-child": { whiteSpace: "nowrap" },
    [theme.breakpoints.down("xs")]: {
      "& table": { minWidth: 0 },
      "& thead": { display: "none" },
      "& tbody": { display: "block" },
      "& tr": { display: "grid", gridTemplateColumns: "minmax(0, 1fr)", padding: "12px 0", borderBottom: `1px solid ${theme.palette.divider}` },
      "& td": { display: "block", border: 0, padding: "4px 8px", textAlign: "left", overflowWrap: "anywhere", minWidth: 0 },
      "& td:last-child": { display: "flex", flexDirection: "row", justifyContent: "flex-start", gap: 4, paddingTop: 8 },
      "& td[data-label]::before": { content: "attr(data-label)", marginRight: 8, color: theme.palette.text.secondary, fontSize: 12 },
    },
    "& .MuiIconButton-root": { minWidth: 44, minHeight: 44 },
    borderRadius: 14,
    border: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.18)"
        : "rgba(226, 232, 240, 0.9)"
    }`,
    backgroundColor: theme.palette.type === "dark" ? "#162032" : "#ffffff",
    boxShadow: "none",
    ...theme.scrollbarStyles,
    minHeight: 0,
    minWidth: 0,
  },
  searchInput: {
    backgroundColor: theme.palette.type === "dark" ? "#0f172a" : "#f8fafc",
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
    background: "linear-gradient(135deg, #047857 0%, #0f766e 100%)",
    color: "#ffffff",
    boxShadow: "none",
    transition: "background-color 0.2s ease, color 0.2s ease",
    "&:hover": {
      background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
      boxShadow: "none",
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
    transition: "background-color 0.2s ease, color 0.2s ease",
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
    color: "#ffffff",
  },
  contactNameText: {
    fontWeight: 600,
    fontSize: "0.86rem",
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
  },
  statusPillActive: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "3px 9px",
    borderRadius: 12,
    fontSize: "0.75rem",
    whiteSpace: "nowrap",
    fontWeight: 600,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.15)"
        : "rgba(16, 185, 129, 0.1)",
    color: theme.palette.type === "dark" ? "#34d399" : "#047857",
    border: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.3)"
        : "rgba(16, 185, 129, 0.2)"
    }`,
  },
  statusPillPending: { display: "inline-flex", padding: "3px 9px", borderRadius: 12, fontSize: 12, whiteSpace: "nowrap", backgroundColor: theme.palette.action.hover, color: theme.palette.text.secondary },
  statusPillInactive: {
    display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 12,
    fontSize: 12, whiteSpace: "nowrap", fontWeight: 600,
    backgroundColor: "rgba(239,68,68,0.12)", color: theme.palette.type === "dark" ? "#fca5a5" : "#b91c1c",
  },
  actionButtonEdit: {
    color: theme.palette.type === "dark" ? "#34d399" : "#047857",
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.12)"
        : "rgba(16, 185, 129, 0.08)",
    borderRadius: 8,
    padding: 6,
    marginRight: 6,
    transition: "background-color 0.2s ease, color 0.2s ease",
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
    transition: "background-color 0.2s ease, color 0.2s ease",
    "&:hover": {
      backgroundColor: "#ef4444",
      color: "#ffffff",
    },
  },
}));

const ContactListItems = () => {
  const classes = useStyles();

  const { user } = useContext(AuthContext) as { user: User };
  const { contactListId } = useParams<{ contactListId: string }>();
  const history = useHistory();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchParam, setSearchParam] = useState("");
  const [contacts, dispatch] = useReducer(reducer, []);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [contactListItemModalOpen, setContactListItemModalOpen] =
    useState(false);
  const [deletingContact, setDeletingContact] = useState<ContactListItem | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [contactList, setContactList] = useState<ContactList | null>(null);
  const fileUploadRef = useRef<HTMLInputElement>(null);

  const { findById: findContactList } = useContactLists();

  const socketManager = useContext(SocketContext);

  useEffect(() => {
    let active = true;
    setContactList(null);
    findContactList(contactListId).then(data => { if (active) setContactList(data); }).catch(toastError);
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactListId]);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam, contactListId]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        try {
          const { data } = await api.get<{ contacts: ContactListItem[]; hasMore: boolean }>(`contact-list-items`, {
            params: { searchParam, pageNumber, contactListId },
            signal: controller.signal,
          });
          if (controller.signal.aborted) return;
          dispatch({ type: "LOAD_CONTACTS", payload: data.contacts });
          setHasMore(data.hasMore);
          setLoading(false);
        } catch (err) {
          if (!controller.signal.aborted) { setError(true); toastError(err); }
        } finally { if (!controller.signal.aborted) setLoading(false); }
      };
      fetchContacts();
    }, 500);
    return () => { controller.abort(); clearTimeout(delayDebounceFn); };
  }, [searchParam, pageNumber, contactListId, revision]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    const onContact = (data: ContactListEvent<ContactListItem>) => {
      if (data.action === "reload") { setPageNumber(1); dispatch({ type: "RESET" }); setRevision(v => v + 1); }
      if (data.action === "delete") dispatch({ type: "DELETE_CONTACT", payload: Number(data.id) });
      if (data.record && String(data.record.contactListId) === contactListId) {
        if (`${data.record.name} ${data.record.number} ${data.record.email || ""}`.toLocaleLowerCase().includes(searchParam)) {
          dispatch({ type: "UPDATE_CONTACTS", payload: data.record });
        } else dispatch({ type: "DELETE_CONTACT", payload: data.record.id });
      }
    };
    socket.on(`company-${companyId}-ContactListItem-${contactListId}`, onContact);
    socket.on(`company-${companyId}-ContactListItem`, onContact);

    return () => {
      socket.disconnect();
    };
  }, [contactListId, socketManager, searchParam]);

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleOpenContactListItemModal = () => {
    setSelectedContactId(null);
    setContactListItemModalOpen(true);
  };

  const handleCloseContactListItemModal = () => {
    setSelectedContactId(null);
    setContactListItemModalOpen(false);
    setRefreshKey(v => v + 1);
    setRevision(v => v + 1);
  };

  const handleEditContact = (contactId: number) => {
    setSelectedContactId(contactId);
    setContactListItemModalOpen(true);
  };

  const handleDeleteContact = async (contactId: number) => {
    try {
      await api.delete(`/contact-list-items/${contactId}`);
      dispatch({ type: "DELETE_CONTACT", payload: contactId });
      setRefreshKey(v => v + 1);
      toast.success(t("contacts.toasts.deleted"));
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
      const file = fileUploadRef.current?.files?.[0];
      if (!file) return;
      formData.append("file", file);
      await api.request({
        url: `contact-lists/${contactListId}/upload`,
        method: "POST",
        data: formData,
      });
      setRefreshKey(v => v + 1);
      setPageNumber(1);
      dispatch({ type: "RESET" });
      setRevision(v => v + 1);
    } catch (err) {
      toastError(err);
    }
  };

  const loadMore = () => {
    setPageNumber((prevState) => prevState + 1);
  };

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
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
        initialValues={null}
        onSave={() => setRevision(v => v + 1)}
        contactId={selectedContactId}
      />
      <ConfirmationModal
        title={
          deletingContact
            ? `${t("contactListItems.confirmationModal.deleteTitle")} ${
                deletingContact.name
              }?`
            : `${t("contactListItems.confirmationModal.importTitlte")}`
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
          `${t("contactListItems.confirmationModal.deleteMessage")}`
        ) : (
          <>
            {t("contactListItems.confirmationModal.importMessage")}
            <a href={planilhaExemplo} download="planilha.xlsx">
              Clique aqui para baixar planilha exemplo.
            </a>
          </>
        )}
      </ConfirmationModal>

      <MainHeader>
        <Grid style={{ width: "99.6%" }} alignItems="center" container>
          <Grid xs={12} sm={4} item>
            <Title>{contactList?.name || "Contatos da Lista"}</Title>
          </Grid>
          <Grid xs={12} sm={8} item>
            <Grid spacing={1} alignItems="center" justifyContent="flex-end" container>
              <Grid xs={12} sm={5} item>
                <TextField
                  fullWidth
                  placeholder={t("contactListItems.searchPlaceholder")}
                  type="search"
                  size="small"
                  variant="outlined"
                  inputProps={{ "aria-label": "Buscar contatos" }}
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
                      fileUploadRef.current.value = "";
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

      <ContactListStats contactListId={contactListId} refreshKey={refreshKey} />
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
            if (fileUploadRef.current?.files?.length) { setDeletingContact(null); setConfirmOpen(true); }
          }}
          ref={fileUploadRef}
        />

        <Table size="small" aria-label="Contatos da lista">
          <TableHead>
            <TableRow>
              <TableCell align="left" style={{ fontWeight: 700 }}>
                {t("contactListItems.table.name")}
              </TableCell>
              <TableCell align="center" style={{ fontWeight: 700 }}>
                Status
              </TableCell>
              <TableCell align="center" style={{ fontWeight: 700 }}>
                {t("contactListItems.table.number")}
              </TableCell>
              <TableCell align="center" style={{ fontWeight: 700 }}>
                {t("contactListItems.table.email")}
              </TableCell>
              <TableCell align="right" style={{ fontWeight: 700, paddingRight: 24 }}>
                {t("contactListItems.table.actions")}
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
                          backgroundColor: "#0d9488",
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
                    {contact.isWhatsappValid === true ? (
                      <span className={classes.statusPillActive}>
                        <CheckCircleIcon style={{ fontSize: 13 }} />
                        WhatsApp Válido
                      </span>
                    ) : contact.isWhatsappValid === false ? (
                      <span className={classes.statusPillInactive}>
                        <BlockIcon style={{ fontSize: 13 }} />
                        Sem WhatsApp
                      </span>
                    ) : <span className={classes.statusPillPending}>Não validado</span>}
                  </TableCell>

                  <TableCell data-label="Número:" align="center">{contact.number}</TableCell>
                  <TableCell data-label="E-mail:" align="center">{contact.email || "—"}</TableCell>

                  <TableCell align="right">
                    <Tooltip title="Editar Contato" arrow>
                      <IconButton
                        size="small"
                        className={classes.actionButtonEdit}
                        aria-label={`Editar contato ${contact.name}`}
                        onClick={() => handleEditContact(contact.id)}
                      >
                        <EditIcon style={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>

                    <Can
                      data={null}
                      role={user.profile}
                      perform="contacts-page:deleteContact"
                      yes={() => (
                        <Tooltip title="Excluir Contato" arrow>
                          <IconButton
                            size="small"
                            aria-label="Excluir contato"
                            className={classes.actionButtonDelete}
                            onClick={() => {
                              setConfirmOpen(true);
                              setDeletingContact(contact);
                            }}
                          >
                            <DeleteOutlineIcon style={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {!loading && contacts.length === 0 && <TableRow><TableCell colSpan={5} align="center">{error ? "Não foi possível carregar os dados." : searchParam ? "Nenhum resultado para esta busca." : "Adicione contatos ou importe uma planilha para começar."}</TableCell></TableRow>}
              {loading && <TableRowSkeleton avatar={false} columns={5} />}
            </>
          </TableBody>
        </Table>
        {error && <Button onClick={() => setRevision(v => v + 1)}>Tentar novamente</Button>}
        {hasMore && <Button disabled={loading} onClick={loadMore}>Carregar mais</Button>}
      </Paper>
    </MainContainer>
  );
};

export default ContactListItems;
