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
import { FiSearch as SearchIcon } from "react-icons/fi";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import Tooltip from "@material-ui/core/Tooltip";
import Avatar from "@material-ui/core/Avatar";
import Typography from "@material-ui/core/Typography";

import { FiTrash2 as DeleteOutlineIcon } from "react-icons/fi";
import { FiEdit2 as EditIcon } from "react-icons/fi";
import { FiUsers as PeopleIcon } from "react-icons/fi";
import { FiDownload as GetAppIcon } from "react-icons/fi";
import { FiPlus as AddIcon } from "react-icons/fi";

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
import type { ContactList, ContactListEvent } from "../../types";
import ContactListStats from "../../components/ContactListStats";

type Action = { type: "LOAD_CONTACTLISTS"; payload: ContactList[] } | { type: "UPDATE_CONTACTLIST"; payload: ContactList } | { type: "DELETE_CONTACTLIST"; payload: number } | { type: "RESET" };
const reducer = (state: ContactList[], action: Action): ContactList[] => {
  if (action.type === "RESET") return [];
  if (action.type === "DELETE_CONTACTLIST") return state.filter(item => item.id !== action.payload);
  if (action.type === "UPDATE_CONTACTLIST") return [{ ...state.find(item => item.id === action.payload.id), ...action.payload }, ...state.filter(item => item.id !== action.payload.id)];
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
    "& table": { minWidth: 580 },
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
    border: "1px solid var(--border-subtle)",
    backgroundColor: "var(--bg-surface)",
    boxShadow: "none",
    ...theme.scrollbarStyles,
    minHeight: 0,
    minWidth: 0,
  },
  searchInput: {
    backgroundColor: "var(--field-bg)",
    borderRadius: 10,
    "& .MuiOutlinedInput-root": {
      borderRadius: 10,
    },
  },
  addButton: {
    borderRadius: 10,
    fontWeight: 700,
    fontSize: "0.875rem",
    padding: "8px 18px",
    minHeight: 44,
    backgroundColor: "var(--action)",
    color: "var(--action-ink)",
    boxShadow: "none",
    transition: "background-color 150ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 90ms ease",
    "&:hover": {
      backgroundColor: "var(--action-hover)",
      boxShadow: "none",
    },
    "&:active": {
      transform: "scale(0.985)",
    },
  },
  secondaryButton: {
    borderRadius: 10,
    fontWeight: 600,
    fontSize: "0.82rem",
    padding: "8px 14px",
    color: "var(--ink-secondary)",
    backgroundColor: "var(--bg-subtle)",
    border: "1px solid var(--border-subtle)",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    transition: "background-color 150ms ease, color 150ms ease, border-color 150ms ease",
    "&:hover": {
      backgroundColor: "var(--bg-elevated)",
      borderColor: "var(--border-strong)",
      color: "var(--ink-primary)",
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
    color: "#ffffff",
  },
  listNameText: {
    fontWeight: 600,
    fontSize: "0.88rem",
    color: "var(--ink-primary)",
  },
  contactsBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "3px 10px",
    borderRadius: 999,
    fontFamily: "var(--font-mono)",
    fontVariantNumeric: "tabular-nums",
    fontSize: "0.75rem",
    whiteSpace: "nowrap",
    fontWeight: 600,
    backgroundColor: "var(--action-soft)",
    color: "var(--action)",
    border: "1px solid var(--action-ring)",
  },
  actionButtonSecondary: {
    color: "var(--ink-secondary)",
    backgroundColor: "var(--bg-subtle)",
    border: "1px solid var(--border-subtle)",
    borderRadius: 8,
    padding: 6,
    marginRight: 6,
    transition: "background-color 150ms ease, color 150ms ease, border-color 150ms ease",
    "&:hover": {
      backgroundColor: "var(--action-soft)",
      borderColor: "var(--action-ring)",
      color: "var(--action)",
    },
  },
  actionButtonEdit: {
    color: "var(--action)",
    backgroundColor: "var(--action-soft)",
    borderRadius: 8,
    padding: 6,
    marginRight: 6,
    transition: "background-color 150ms ease, color 150ms ease",
    "&:hover": {
      backgroundColor: "var(--action)",
      color: "var(--action-ink)",
    },
  },
  actionButtonDelete: {
    color: theme.palette.type === "dark" ? "#FCA5A5" : "#DC2626",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 8,
    padding: 6,
    transition: "background-color 150ms ease, color 150ms ease",
    "&:hover": {
      backgroundColor: "#EF4444",
      color: "#FFFFFF",
    },
  },
}));

const ContactLists = () => {
  const classes = useStyles();
  const history = useHistory();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedContactList, setSelectedContactList] = useState<ContactList | null>(null);
  const [deletingContactList, setDeletingContactList] = useState<ContactList | null>(null);
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
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    const delayDebounceFn = setTimeout(() => {
      const fetchContactLists = async () => {
        try {
          const { data } = await api.get<{ records: ContactList[]; hasMore: boolean }>("/contact-lists/", {
            params: { searchParam, pageNumber },
            signal: controller.signal,
          });
          if (controller.signal.aborted) return;
          dispatch({ type: "LOAD_CONTACTLISTS", payload: data.records });
          setHasMore(data.hasMore);
          setLoading(false);
        } catch (err) {
          if (!controller.signal.aborted) { setError(true); toastError(err); }
        } finally { if (!controller.signal.aborted) setLoading(false); }
      };
      fetchContactLists();
    }, 500);
    return () => { controller.abort(); clearTimeout(delayDebounceFn); };
  }, [searchParam, pageNumber, revision]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    socket.on(`company-${companyId}-ContactList`, (data: ContactListEvent<ContactList>) => {
      if ((data.action === "update" || data.action === "create") && data.record) {
        if (data.record.name.toLocaleLowerCase().includes(searchParam)) {
          dispatch({ type: "UPDATE_CONTACTLIST", payload: data.record });
        } else dispatch({ type: "DELETE_CONTACTLIST", payload: data.record.id });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_CONTACTLIST", payload: +data.id });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [socketManager, searchParam]);

  const handleOpenContactListModal = () => {
    setSelectedContactList(null);
    setContactListModalOpen(true);
  };

  const handleCloseContactListModal = () => {
    setSelectedContactList(null);
    setContactListModalOpen(false);
    setRefreshKey(v => v + 1);
    setRevision(v => v + 1);
  };

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleEditContactList = (contactList: ContactList) => {
    setSelectedContactList(contactList);
    setContactListModalOpen(true);
  };

  const handleDeleteContactList = async (contactListId: number) => {
    try {
      await api.delete(`/contact-lists/${contactListId}`);
      dispatch({ type: "DELETE_CONTACTLIST", payload: contactListId });
      setRefreshKey(v => v + 1);
      toast.success(t("contactLists.toasts.deleted"));
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

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  const goToContacts = (id: number) => {
    history.push(`/contact-lists/${id}/contacts`);
  };

  const exportList = async (list: ContactList) => {
    setExporting(list.id);
    try {
      const { data } = await api.get<import("../../types").ContactListItem[]>("/contact-list-items/list", { params: { contactListId: list.id } });
      const XLSX = await import("xlsx");
      const sheet = XLSX.utils.json_to_sheet(data.map(contact => ({ nome: contact.name, numero: contact.number, email: contact.email || "" })), { header: ["nome", "numero", "email"] });
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "Contatos");
      XLSX.writeFile(workbook, `lista-${list.id}.xlsx`);
    } catch (err) { toastError(err); }
    finally { setExporting(null); }
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={
          deletingContactList &&
          `${t("contactLists.confirmationModal.deleteTitle")} ${
            deletingContactList.name
          }?`
        }
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={() => deletingContactList && handleDeleteContactList(deletingContactList.id)}
      >
        {t("contactLists.confirmationModal.deleteMessage")}
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
            <Title>{t("contactLists.title")}</Title>
          </Grid>
          <Grid xs={12} sm={6} item>
            <Grid spacing={1} alignItems="center" justifyContent="flex-end" container>
              <Grid xs={12} sm={6} item>
                <TextField
                  fullWidth
                  placeholder={t("contacts.searchPlaceholder")}
                  type="search"
                  size="small"
                  variant="outlined"
                  inputProps={{ "aria-label": "Buscar listas" }}
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
                  <GetAppIcon style={{ fontSize: 18 }} />
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
                  {t("contactLists.buttons.add")}
                </Button>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </MainHeader>

      <ContactListStats refreshKey={refreshKey} />
      <Paper
        className={classes.mainPaper}
        variant="outlined"
        onScroll={handleScroll}
      >
        <Table size="small" aria-label="Listas de contatos">
          <TableHead>
            <TableRow>
              <TableCell align="left" style={{ fontWeight: 700 }}>
                {t("contactLists.table.name")}
              </TableCell>
              <TableCell align="center" style={{ fontWeight: 700 }}>
                {t("contactLists.table.contacts")}
              </TableCell>
              <TableCell align="right" style={{ fontWeight: 700, paddingRight: 24 }}>
                {t("contactLists.table.actions")}
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
                          backgroundColor: "#0d9488",
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
                      {contactList.contactsCount || 0} {Number(contactList.contactsCount) === 1 ? "contato" : "contatos"}
                    </span>
                  </TableCell>

                  <TableCell align="right">
                    <Tooltip title="Exportar contatos desta lista" arrow>
                      <span><IconButton size="small" aria-label={`Exportar lista ${contactList.name}`} disabled={exporting !== null}
                        className={classes.actionButtonSecondary} onClick={() => exportList(contactList)}>
                        <GetAppIcon style={{ fontSize: 18 }} />
                      </IconButton></span>
                    </Tooltip>

                    <Tooltip title="Ver Contatos da Lista" arrow>
                      <IconButton
                        size="small"
                        className={classes.actionButtonSecondary}
                        aria-label={`Ver contatos de ${contactList.name}`}
                        onClick={() => goToContacts(contactList.id)}
                      >
                        <PeopleIcon style={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Editar Lista" arrow>
                      <IconButton
                        size="small"
                        className={classes.actionButtonEdit}
                        aria-label={`Editar lista ${contactList.name}`}
                        onClick={() => handleEditContactList(contactList)}
                      >
                        <EditIcon style={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Excluir Lista" arrow>
                      <IconButton
                        size="small"
                        aria-label="Excluir lista"
                            className={classes.actionButtonDelete}
                        onClick={(e) => {
                          setConfirmModalOpen(true);
                          setDeletingContactList(contactList);
                        }}
                      >
                        <DeleteOutlineIcon style={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && contactLists.length === 0 && <TableRow><TableCell colSpan={3} align="center">{error ? "Não foi possível carregar os dados." : searchParam ? "Nenhum resultado para esta busca." : "Crie uma lista para organizar seus contatos."}</TableCell></TableRow>}
              {loading && <TableRowSkeleton avatar={false} columns={3} />}
            </>
          </TableBody>
        </Table>
        {error && <Button onClick={() => setRevision(v => v + 1)}>Tentar novamente</Button>}
        {hasMore && <Button disabled={loading} onClick={loadMore}>Carregar mais</Button>}
      </Paper>
    </MainContainer>
  );
};

export default ContactLists;
