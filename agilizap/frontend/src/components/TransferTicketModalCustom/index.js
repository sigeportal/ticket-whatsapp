import React, { useState, useEffect, useRef, useContext } from "react";
import { useHistory } from "react-router-dom";

import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import Select from "@material-ui/core/Select";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import { makeStyles } from "@material-ui/core/styles";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Autocomplete, {
  createFilterOptions,
} from "@material-ui/lab/Autocomplete";
import CircularProgress from "@material-ui/core/CircularProgress";
import { Close, SwapHoriz } from "@material-ui/icons";
import { toast } from "react-toastify";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import ButtonWithSpinner from "../ButtonWithSpinner";
import toastError from "../../errors/toastError";
import useQueues from "../../hooks/useQueues";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
  dialogPaper: {
    borderRadius: 16,
    maxWidth: 480,
    width: "100%",
    backgroundColor: theme.palette.type === "dark" ? "#0b1e16" : "#ffffff",
    border: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.2)"
        : "rgba(226, 232, 240, 0.9)"
    }`,
    boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.35)",
  },
  dialogTitle: {
    padding: "18px 24px 14px",
    borderBottom: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.15)"
        : "#f1f5f9"
    }`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleText: {
    fontSize: "1.1rem",
    fontWeight: 700,
    color: theme.palette.type === "dark" ? "#f0fdf4" : "#0f172a",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  titleIcon: {
    color: "#10b981",
    fontSize: "1.4rem",
  },
  closeButton: {
    padding: 6,
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    borderRadius: 8,
    "&:hover": {
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(255, 255, 255, 0.08)"
          : "#f1f5f9",
    },
  },
  dialogContent: {
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  dialogActions: {
    padding: "14px 24px 18px",
    borderTop: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.15)"
        : "#f1f5f9"
    }`,
    gap: 10,
  },
  btnCancel: {
    borderRadius: 8,
    padding: "7px 18px",
    fontWeight: 600,
    fontSize: "0.84rem",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    borderColor:
      theme.palette.type === "dark"
        ? "rgba(255, 255, 255, 0.15)"
        : "rgba(226, 232, 240, 0.9)",
    "&:hover": {
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(255, 255, 255, 0.06)"
          : "#f8fafc",
    },
  },
  btnTransfer: {
    borderRadius: 8,
    padding: "7px 22px",
    fontWeight: 700,
    fontSize: "0.84rem",
    background: "linear-gradient(135deg, #10b981 0%, #0d9488 100%)",
    color: "#ffffff",
    boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
    "&:hover": {
      background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
      boxShadow: "0 4px 12px rgba(16, 185, 129, 0.4)",
    },
  },
  queueDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    display: "inline-block",
    marginRight: 8,
    flexShrink: 0,
  },
  statusConnected: {
    color: "#10b981",
    fontWeight: 600,
    fontSize: "0.78rem",
    marginLeft: 6,
  },
  statusDisconnected: {
    color: "#ef4444",
    fontWeight: 600,
    fontSize: "0.78rem",
    marginLeft: 6,
  },
}));

const filterOptions = createFilterOptions({
  trim: true,
});

const TransferTicketModalCustom = ({ modalOpen, onClose, ticketid, ticket }) => {
  const history = useHistory();
  const classes = useStyles();
  const isMounted = useRef(true);

  const [options, setOptions] = useState([]);
  const [queues, setQueues] = useState([]);
  const [allQueues, setAllQueues] = useState([]);
  const [whatsapps, setWhatsapps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedQueue, setSelectedQueue] = useState("");
  const [selectedWhatsapp, setSelectedWhatsapp] = useState("");

  const { findAll: findAllQueues } = useQueues();
  const { user } = useContext(AuthContext);
  const companyId = user?.companyId;

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!modalOpen) return;

    // Usuário começa limpo (apenas selecionado se o atendente quiser transferir para alguém específico)
    setSelectedUser(null);
    setSearchParam("");

    // Conexão WhatsApp padrão do ticket ou do usuário
    const initialWhatsappId =
      ticket?.whatsappId || ticket?.whatsapp?.id || user?.whatsappId || "";
    setSelectedWhatsapp(initialWhatsappId);

    // Fila padrão do ticket ou do usuário
    if (ticket?.queueId) {
      setSelectedQueue(ticket.queueId);
    } else if (user?.queues?.length === 1) {
      setSelectedQueue(user.queues[0].id);
    } else {
      setSelectedQueue("");
    }

    // Carregar todas as filas da empresa
    const loadQueues = async () => {
      try {
        const list = await findAllQueues();
        if (isMounted.current) {
          setAllQueues(list || []);
          setQueues(list || []);
        }
      } catch (err) {
        toastError(err);
      }
    };
    loadQueues();

    // Carregar conexões de WhatsApp
    const fetchWhatsapps = async () => {
      try {
        const { data } = await api.get(`/whatsapp`, {
          params: { companyId, session: 0 },
        });
        if (isMounted.current) {
          setWhatsapps(data || []);
          if (!initialWhatsappId && data?.length > 0) {
            setSelectedWhatsapp(data[0].id);
          }
        }
      } catch (err) {
        toastError(err);
      }
    };
    fetchWhatsapps();

    // Carregar usuários iniciais para busca
    const fetchInitialUsers = async () => {
      try {
        setLoadingUsers(true);
        const { data } = await api.get("/users/", {
          params: { searchParam: "" },
        });
        if (isMounted.current) {
          setOptions(data.users || []);
        }
      } catch (err) {
        // Silencioso se der erro não crítico
      } finally {
        if (isMounted.current) setLoadingUsers(false);
      }
    };
    fetchInitialUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, ticket, user, companyId]);

  // Busca de usuários com debounce
  useEffect(() => {
    if (!modalOpen || searchParam.length < 2) {
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      setLoadingUsers(true);
      const fetchUsers = async () => {
        try {
          const { data } = await api.get("/users/", {
            params: { searchParam },
          });
          if (isMounted.current) {
            setOptions(data.users || []);
          }
        } catch (err) {
          toastError(err);
        } finally {
          if (isMounted.current) setLoadingUsers(false);
        }
      };

      fetchUsers();
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, modalOpen]);

  const handleClose = () => {
    onClose();
    setSearchParam("");
    setSelectedUser(null);
  };

  const handleSaveTicket = async (e) => {
    e.preventDefault();
    const targetTicketId = ticketid || ticket?.id;
    if (!targetTicketId) return;

    if (!selectedQueue || selectedQueue === "") {
      toast.error("Por favor, selecione uma fila de destino.");
      return;
    }

    setLoading(true);
    try {
      const data = {
        queueId: selectedQueue,
      };

      if (selectedUser) {
        data.userId = selectedUser.id;
        data.status = "open";
      } else {
        data.userId = null;
        data.status = "pending";
      }

      if (selectedWhatsapp) {
        data.whatsappId = selectedWhatsapp;
      }

      await api.put(`/tickets/${targetTicketId}`, data);
      toast.success("Atendimento transferido com sucesso!");
      handleClose();
      history.push(`/tickets`);
    } catch (err) {
      toastError(err);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  return (
    <Dialog
      open={modalOpen}
      onClose={handleClose}
      classes={{ paper: classes.dialogPaper }}
      aria-labelledby="transfer-ticket-dialog-title"
    >
      <form onSubmit={handleSaveTicket}>
        <DialogTitle
          className={classes.dialogTitle}
          disableTypography
          id="transfer-ticket-dialog-title"
        >
          <Typography className={classes.titleText}>
            <SwapHoriz className={classes.titleIcon} />
            {i18n.t("transferTicketModal.title") || "Transferir Ticket"}
          </Typography>
          <IconButton
            size="small"
            className={classes.closeButton}
            onClick={handleClose}
          >
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent className={classes.dialogContent}>
          {/* USUÁRIO / ATENDENTE (OPCIONAL) */}
          <Autocomplete
            value={selectedUser}
            options={options}
            getOptionLabel={(option) => (option ? option.name || "" : "")}
            getOptionSelected={(option, value) =>
              !value || option?.id === value?.id
            }
            filterOptions={filterOptions}
            onChange={(e, newValue) => {
              setSelectedUser(newValue);
              if (
                newValue != null &&
                Array.isArray(newValue.queues) &&
                newValue.queues.length > 0
              ) {
                setQueues(newValue.queues);
              } else {
                setQueues(allQueues);
              }
            }}
            onInputChange={(e, newInputValue, reason) => {
              if (reason === "input") {
                setSearchParam(newInputValue);
              }
            }}
            loading={loadingUsers}
            noOptionsText={i18n.t("transferTicketModal.noOptions")}
            renderInput={(params) => (
              <TextField
                {...params}
                label={
                  i18n.t("transferTicketModal.fieldLabel") ||
                  "Localize o usuário (opcional)"
                }
                variant="outlined"
                fullWidth
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <React.Fragment>
                      {loadingUsers ? (
                        <CircularProgress color="inherit" size={18} />
                      ) : null}
                      {params.InputProps.endAdornment}
                    </React.Fragment>
                  ),
                }}
              />
            )}
          />

          {/* FILA */}
          <FormControl variant="outlined" fullWidth required>
            <InputLabel id="transfer-queue-label">
              {i18n.t("transferTicketModal.fieldQueueLabel") || "Fila de Destino"}
            </InputLabel>
            <Select
              labelId="transfer-queue-label"
              value={selectedQueue}
              onChange={(e) => setSelectedQueue(e.target.value)}
              label={
                i18n.t("transferTicketModal.fieldQueueLabel") ||
                "Fila de Destino"
              }
            >
              {queues.map((queue) => (
                <MenuItem key={queue.id} value={queue.id}>
                  <span
                    className={classes.queueDot}
                    style={{ backgroundColor: queue.color || "#10b981" }}
                  />
                  {queue.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* CONEXÃO WHATSAPP */}
          <FormControl variant="outlined" fullWidth required>
            <InputLabel id="transfer-whatsapp-label">
              Conexão WhatsApp
            </InputLabel>
            <Select
              labelId="transfer-whatsapp-label"
              value={selectedWhatsapp}
              onChange={(e) => setSelectedWhatsapp(e.target.value)}
              label="Conexão WhatsApp"
            >
              {whatsapps.map((w) => (
                <MenuItem key={w.id} value={w.id}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                    }}
                  >
                    <span>{w.name}</span>
                    <span
                      className={
                        w.status === "CONNECTED"
                          ? classes.statusConnected
                          : classes.statusDisconnected
                      }
                    >
                      ({w.status === "CONNECTED" ? "Conectado" : w.status})
                    </span>
                  </div>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>

        <DialogActions className={classes.dialogActions}>
          <Button
            onClick={handleClose}
            disabled={loading}
            variant="outlined"
            className={classes.btnCancel}
          >
            {i18n.t("transferTicketModal.buttons.cancel") || "Cancelar"}
          </Button>
          <ButtonWithSpinner
            type="submit"
            loading={loading}
            variant="contained"
            className={classes.btnTransfer}
          >
            {i18n.t("transferTicketModal.buttons.ok") || "Transferir"}
          </ButtonWithSpinner>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default TransferTicketModalCustom;
