import React, { useState, useEffect, useContext, useMemo, useCallback } from "react";
import { makeStyles } from "@material-ui/core/styles";
import {
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  List,
  ListItem,
  MenuItem,
  Paper,
  Select,
  TextField,
  Tooltip,
  Typography,
} from "@material-ui/core";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditOutlinedIcon from "@material-ui/icons/EditOutlined";
import SearchIcon from "@material-ui/icons/Search";
import EventIcon from "@material-ui/icons/Event";
import PersonOutlineIcon from "@material-ui/icons/PersonOutline";
import AddIcon from "@material-ui/icons/Add";
import { toast } from "react-toastify";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { SocketContext } from "../../context/Socket/SocketContext";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import ConfirmationModal from "../../components/ConfirmationModal";

const PRIORITY_META = {
  high: { label: "Alta", bg: "rgba(239, 68, 68, 0.14)", color: "#dc2626", border: "rgba(239, 68, 68, 0.3)" },
  medium: { label: "Média", bg: "rgba(245, 158, 11, 0.14)", color: "#d97706", border: "rgba(245, 158, 11, 0.3)" },
  low: { label: "Baixa", bg: "rgba(16, 185, 129, 0.14)", color: "#059669", border: "rgba(16, 185, 129, 0.3)" },
};

const toDateInputValue = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const useStyles = makeStyles((theme) => ({
  headerCounters: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  mainPaper: {
    flex: 1,
    padding: theme.spacing(2.5),
    borderRadius: 14,
    border: "1px solid var(--border-hairline)",
    backgroundColor: "var(--bg-surface)",
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },
  createForm: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
    padding: theme.spacing(1.5),
    borderRadius: 12,
    backgroundColor: "var(--bg-subtle)",
    border: "1px solid var(--border-hairline)",
  },
  titleField: {
    flex: "1 1 240px",
    minWidth: 200,
    backgroundColor: "var(--field-bg)",
    borderRadius: 8,
  },
  controlField: {
    minWidth: 135,
    backgroundColor: "var(--field-bg)",
    borderRadius: 8,
    [theme.breakpoints.down("xs")]: {
      flex: "1 1 100%",
    },
  },
  addBtn: {
    height: 40,
    padding: "0 18px",
    whiteSpace: "nowrap",
    borderRadius: 10,
    fontWeight: 600,
    backgroundColor: "var(--action)",
    color: "var(--action-ink)",
    boxShadow: "none",
    "&:hover": {
      backgroundColor: "var(--action-hover)",
      boxShadow: "none",
    },
    [theme.breakpoints.down("xs")]: {
      width: "100%",
    },
  },
  filterBar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  statusPills: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  pillBtn: {
    borderRadius: 999,
    textTransform: "none",
    fontWeight: 600,
    fontSize: "0.8rem",
    padding: "4px 14px",
  },
  filterControls: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  listContainer: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  listItem: {
    backgroundColor: "var(--bg-canvas)",
    border: "1px solid var(--border-hairline)",
    borderRadius: 11,
    padding: "10px 14px",
    marginBottom: 8,
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    transition: "border-color var(--t-in) var(--ease-ui)",
    "&:hover": {
      borderColor: "var(--border-strong)",
    },
  },
  listItemCompleted: {
    opacity: 0.72,
    backgroundColor: "var(--bg-subtle)",
  },
  itemBody: {
    flex: 1,
    minWidth: 0,
  },
  itemTopRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  taskTitle: {
    fontWeight: 600,
    fontSize: "0.94rem",
    color: "var(--ink-primary)",
    wordBreak: "break-word",
  },
  taskTitleCompleted: {
    textDecoration: "line-through",
    color: "var(--ink-muted)",
  },
  taskDescription: {
    fontSize: "0.83rem",
    color: "var(--ink-secondary)",
    marginTop: 4,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  taskMetaRow: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 6,
    fontFamily: "var(--font-mono)",
    fontSize: "0.73rem",
    color: "var(--ink-muted)",
  },
  metaTag: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  },
  overdueTag: {
    color: "#dc2626",
    fontWeight: 700,
  },
  priorityChip: {
    height: 20,
    fontSize: "0.7rem",
    fontWeight: 700,
    borderRadius: 999,
  },
  rowActions: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    flexShrink: 0,
  },
  actionEdit: {
    color: "var(--action)",
    borderRadius: 8,
    "&:hover": {
      backgroundColor: "var(--action-soft)",
    },
  },
  actionDelete: {
    color: "var(--status-danger)",
    borderRadius: 8,
    "&:hover": {
      backgroundColor: "var(--status-danger-bg)",
    },
  },
  emptyState: {
    padding: "40px 20px",
    textAlign: "center",
    borderRadius: 12,
    border: "1px dashed var(--border-hairline)",
    backgroundColor: "var(--bg-subtle)",
    color: "var(--ink-secondary)",
  },
}));

const ToDoList = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const socketManager = useContext(SocketContext);

  const canManageTeam = user?.profile === "admin" || user?.profile === "supervisor";

  const [tasks, setTasks] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Quick create state
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newDueDate, setNewDueDate] = useState("");
  const [newAssigneeId, setNewAssigneeId] = useState(user?.id ? String(user.id) : "");

  useEffect(() => {
    if (user?.id && !newAssigneeId) {
      setNewAssigneeId(String(user.id));
    }
  }, [user?.id, newAssigneeId]);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [searchParam, setSearchParam] = useState("");
  const [scope, setScope] = useState("mine");

  // Edit modal
  const [editingTask, setEditingTask] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    dueDate: "",
    assignedUserId: "",
  });

  // Delete confirmation
  const [taskToDelete, setTaskToDelete] = useState(null);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/tasks", {
        params: { scope: canManageTeam ? scope : "mine" },
      });
      setTasks(Array.isArray(data?.tasks) ? data.tasks : []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [canManageTeam, scope]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (!canManageTeam) return;
    api
      .get("/users/list")
      .then(({ data }) => {
        if (Array.isArray(data)) setUsersList(data);
      })
      .catch(() => {});
  }, [canManageTeam]);

  const assigneeOptions = useMemo(() => {
    const map = new Map();
    if (user?.id) {
      map.set(Number(user.id), { id: user.id, name: user.name || "Meu perfil" });
    }
    for (const u of usersList) {
      if (u?.id) map.set(Number(u.id), u);
    }
    return Array.from(map.values());
  }, [usersList, user?.id, user?.name]);

  useEffect(() => {
    if (!user?.companyId || !socketManager?.getSocket) return;
    const socket = socketManager.getSocket(user.companyId);
    if (!socket) return;

    const belongsToCurrentScope = (t) => {
      if (!t) return false;
      if (canManageTeam && scope === "all") return true;
      return Number(t.userId) === Number(user.id) || Number(t.assignedUserId) === Number(user.id);
    };

    const handleTaskEvent = (data) => {
      if (data.action === "create" && data.task) {
        if (!belongsToCurrentScope(data.task)) return;
        setTasks((prev) =>
          prev.some((t) => t.id === data.task.id) ? prev : [data.task, ...prev]
        );
      } else if (data.action === "update" && data.task) {
        setTasks((prev) => {
          const exists = prev.some((t) => t.id === data.task.id);
          if (!belongsToCurrentScope(data.task)) {
            return prev.filter((t) => t.id !== data.task.id);
          }
          if (!exists) return [data.task, ...prev];
          return prev.map((t) => (t.id === data.task.id ? data.task : t));
        });
      } else if (data.action === "delete" && data.taskId) {
        setTasks((prev) => prev.filter((t) => t.id !== Number(data.taskId)));
      }
    };

    socket.on(`company-${user.companyId}-task`, handleTaskEvent);
    return () => {
      socket.disconnect();
    };
  }, [socketManager, user?.companyId, user?.id, canManageTeam, scope]);

  const handleCreateTask = async (e) => {
    e?.preventDefault();
    if (!newTitle.trim() || submitting) return;

    try {
      setSubmitting(true);
      const payload = {
        title: newTitle.trim(),
        priority: newPriority,
        dueDate: newDueDate ? new Date(`${newDueDate}T17:30:00`).toISOString() : null,
        assignedUserId:
          canManageTeam && newAssigneeId ? Number(newAssigneeId) : undefined,
      };
      const { data } = await api.post("/tasks", payload);
      setTasks((prev) => (prev.some((t) => t.id === data.id) ? prev : [data, ...prev]));
      setNewTitle("");
      setNewPriority("medium");
      setNewDueDate("");
      setNewAssigneeId(user?.id ? String(user.id) : "");
      toast.success("Tarefa criada com sucesso!");
    } catch (err) {
      toastError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleCompleted = async (item) => {
    const nextCompleted = !item.completed;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === item.id ? { ...t, completed: nextCompleted } : t
      )
    );
    try {
      const { data } = await api.put(`/tasks/${item.id}`, {
        completed: nextCompleted,
      });
      setTasks((prev) => prev.map((t) => (t.id === data.id ? data : t)));
    } catch (err) {
      setTasks((prev) => prev.map((t) => (t.id === item.id ? item : t)));
      toastError(err);
    }
  };

  const openEditModal = (item) => {
    setEditingTask(item);
    setEditForm({
      title: item.title || "",
      description: item.description || "",
      priority: item.priority || "medium",
      dueDate: toDateInputValue(item.dueDate),
      assignedUserId: item.assignedUserId ? String(item.assignedUserId) : "__none__",
    });
  };

  const handleSaveEdit = async () => {
    if (!editingTask || !editForm.title.trim()) return;
    try {
      setSubmitting(true);
      const payload = {
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        priority: editForm.priority,
        dueDate: editForm.dueDate
          ? new Date(`${editForm.dueDate}T17:30:00`).toISOString()
          : null,
        ...(canManageTeam && {
          assignedUserId:
            editForm.assignedUserId && editForm.assignedUserId !== "__none__"
              ? Number(editForm.assignedUserId)
              : null,
        }),
      };
      const { data } = await api.put(`/tasks/${editingTask.id}`, payload);
      setTasks((prev) => prev.map((t) => (t.id === data.id ? data : t)));
      setEditingTask(null);
      toast.success("Tarefa atualizada!");
    } catch (err) {
      toastError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!taskToDelete) return;
    try {
      await api.delete(`/tasks/${taskToDelete.id}`);
      setTasks((prev) => prev.filter((t) => t.id !== taskToDelete.id));
      toast.success("Tarefa removida!");
    } catch (err) {
      toastError(err);
    } finally {
      setTaskToDelete(null);
    }
  };

  const counts = useMemo(() => {
    const pending = tasks.filter((t) => !t.completed).length;
    const completed = tasks.filter((t) => t.completed).length;
    return { total: tasks.length, pending, completed };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const term = searchParam.trim().toLowerCase();
    return tasks.filter((item) => {
      if (statusFilter === "pending" && item.completed) return false;
      if (statusFilter === "completed" && !item.completed) return false;
      if (priorityFilter !== "all" && item.priority !== priorityFilter) return false;
      if (term) {
        const hay = `${item.title || ""} ${item.description || ""} ${
          item.assignedUser?.name || ""
        }`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [tasks, statusFilter, priorityFilter, searchParam]);

  return (
    <MainContainer>
      <ConfirmationModal
        title="Excluir Tarefa"
        open={Boolean(taskToDelete)}
        onClose={() => setTaskToDelete(null)}
        onConfirm={handleConfirmDelete}
      >
        Deseja realmente excluir a tarefa "{taskToDelete?.title}"?
      </ConfirmationModal>

      <Dialog
        open={Boolean(editingTask)}
        onClose={() => setEditingTask(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle style={{ fontWeight: 700 }}>Editar Tarefa</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                label="Título da tarefa"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                variant="outlined"
                size="small"
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Descrição / observações"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                variant="outlined"
                size="small"
                multiline
                rows={3}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl variant="outlined" size="small" fullWidth>
                <InputLabel>Prioridade</InputLabel>
                <Select
                  label="Prioridade"
                  value={editForm.priority}
                  onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                >
                  <MenuItem value="high">Alta</MenuItem>
                  <MenuItem value="medium">Média</MenuItem>
                  <MenuItem value="low">Baixa</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Prazo"
                type="date"
                value={editForm.dueDate}
                onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                variant="outlined"
                size="small"
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Grid>
            {canManageTeam && (
              <Grid item xs={12}>
                <FormControl variant="outlined" size="small" fullWidth>
                  <InputLabel>Responsável</InputLabel>
                  <Select
                    label="Responsável"
                    value={editForm.assignedUserId}
                    onChange={(e) =>
                      setEditForm({ ...editForm, assignedUserId: e.target.value })
                    }
                  >
                    <MenuItem value="__none__">Sem responsável</MenuItem>
                    {assigneeOptions.map((u) => (
                      <MenuItem key={u.id} value={String(u.id)}>
                        {Number(u.id) === Number(user?.id) ? `${u.name} (Eu)` : u.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions style={{ padding: "12px 20px" }}>
          <Button onClick={() => setEditingTask(null)} color="secondary">
            Cancelar
          </Button>
          <Button
            onClick={handleSaveEdit}
            variant="contained"
            color="primary"
            disabled={submitting || !editForm.title.trim()}
          >
            Salvar alterações
          </Button>
        </DialogActions>
      </Dialog>

      <MainHeader>
        <Title>Tarefas ({counts.pending} pendentes)</Title>
        <div className={classes.headerCounters}>
          <Chip size="small" label={`Total: ${counts.total}`} variant="outlined" />
          <Chip
            size="small"
            label={`Concluídas: ${counts.completed}`}
            style={{
              backgroundColor: "rgba(16, 185, 129, 0.14)",
              color: "#059669",
              fontWeight: 600,
            }}
          />
        </div>
      </MainHeader>

      <Paper className={classes.mainPaper} elevation={0}>
        <form onSubmit={handleCreateTask} className={classes.createForm}>
          <TextField
            className={classes.titleField}
            label="Nova tarefa"
            placeholder="Descreva a tarefa operacional..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            variant="outlined"
            size="small"
          />
          <FormControl variant="outlined" size="small" className={classes.controlField}>
            <InputLabel>Prioridade</InputLabel>
            <Select
              label="Prioridade"
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value)}
            >
              <MenuItem value="high">Alta</MenuItem>
              <MenuItem value="medium">Média</MenuItem>
              <MenuItem value="low">Baixa</MenuItem>
            </Select>
          </FormControl>
          <TextField
            className={classes.controlField}
            label="Prazo"
            type="date"
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
            variant="outlined"
            size="small"
            InputLabelProps={{ shrink: true }}
          />
          {canManageTeam && (
            <FormControl variant="outlined" size="small" className={classes.controlField}>
              <InputLabel>Responsável</InputLabel>
              <Select
                label="Responsável"
                value={newAssigneeId || (user?.id ? String(user.id) : "")}
                onChange={(e) => setNewAssigneeId(e.target.value)}
              >
                {assigneeOptions.map((u) => (
                  <MenuItem key={u.id} value={String(u.id)}>
                    {Number(u.id) === Number(user?.id) ? `${u.name} (Eu)` : u.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <Button
            type="submit"
            variant="contained"
            disabled={submitting || !newTitle.trim()}
            startIcon={<AddIcon />}
            className={classes.addBtn}
          >
            Adicionar
          </Button>
        </form>

        <div className={classes.filterBar}>
          <div className={classes.statusPills}>
            {[
              { id: "all", label: `Todas (${counts.total})` },
              { id: "pending", label: `Pendentes (${counts.pending})` },
              { id: "completed", label: `Concluídas (${counts.completed})` },
            ].map((tab) => (
              <Button
                key={tab.id}
                size="small"
                variant={statusFilter === tab.id ? "contained" : "outlined"}
                color={statusFilter === tab.id ? "primary" : "default"}
                onClick={() => setStatusFilter(tab.id)}
                className={classes.pillBtn}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          <div className={classes.filterControls}>
            <TextField
              size="small"
              variant="outlined"
              placeholder="Buscar tarefa..."
              value={searchParam}
              onChange={(e) => setSearchParam(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl variant="outlined" size="small" style={{ minWidth: 120 }}>
              <InputLabel>Prioridade</InputLabel>
              <Select
                label="Prioridade"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                <MenuItem value="all">Todas</MenuItem>
                <MenuItem value="high">Alta</MenuItem>
                <MenuItem value="medium">Média</MenuItem>
                <MenuItem value="low">Baixa</MenuItem>
              </Select>
            </FormControl>
            {canManageTeam && (
              <FormControl variant="outlined" size="small" style={{ minWidth: 140 }}>
                <InputLabel>Visualização</InputLabel>
                <Select
                  label="Visualização"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                >
                  <MenuItem value="mine">Minhas tarefas</MenuItem>
                  <MenuItem value="all">Toda a equipe</MenuItem>
                </Select>
              </FormControl>
            )}
          </div>
        </div>

        <div className={classes.listContainer}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
              <CircularProgress size={28} />
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className={classes.emptyState}>
              <Typography variant="body2">
                Nenhuma tarefa encontrada para os filtros selecionados.
              </Typography>
            </div>
          ) : (
            <List disablePadding>
              {filteredTasks.map((item) => {
                const pMeta = PRIORITY_META[item.priority] || PRIORITY_META.medium;
                const isOverdue =
                  !item.completed &&
                  item.dueDate &&
                  new Date(item.dueDate).getTime() < Date.now();

                return (
                  <ListItem
                    key={item.id}
                    className={`${classes.listItem} ${
                      item.completed ? classes.listItemCompleted : ""
                    }`}
                  >
                    <Checkbox
                      checked={Boolean(item.completed)}
                      onChange={() => handleToggleCompleted(item)}
                      color="primary"
                      style={{ padding: 4, marginTop: 2 }}
                      inputProps={{ "aria-label": `Concluir ${item.title}` }}
                    />

                    <div className={classes.itemBody}>
                      <div className={classes.itemTopRow}>
                        <span
                          className={`${classes.taskTitle} ${
                            item.completed ? classes.taskTitleCompleted : ""
                          }`}
                        >
                          {item.title}
                        </span>
                        <Chip
                          size="small"
                          label={pMeta.label}
                          className={classes.priorityChip}
                          style={{
                            backgroundColor: pMeta.bg,
                            color: pMeta.color,
                            border: `1px solid ${pMeta.border}`,
                          }}
                        />
                      </div>

                      {item.description && (
                        <Typography className={classes.taskDescription}>
                          {item.description}
                        </Typography>
                      )}

                      <div className={classes.taskMetaRow}>
                        {(item.assignedUser?.name ||
                          (Number(item.assignedUserId) === Number(user?.id) && user?.name)) && (
                          <span className={classes.metaTag}>
                            <PersonOutlineIcon style={{ fontSize: 14 }} />
                            {item.assignedUser?.name || user?.name}
                          </span>
                        )}
                        {item.dueDate && (
                          <span
                            className={`${classes.metaTag} ${
                              isOverdue ? classes.overdueTag : ""
                            }`}
                          >
                            <EventIcon style={{ fontSize: 14 }} />
                            Prazo: {new Date(item.dueDate).toLocaleDateString("pt-BR")}
                            {isOverdue ? " (atrasada)" : ""}
                          </span>
                        )}
                        <span>
                          Atualizada em{" "}
                          {new Date(item.updatedAt).toLocaleString("pt-BR")}
                        </span>
                      </div>
                    </div>

                    <div className={classes.rowActions}>
                      <Tooltip title="Editar tarefa">
                        <IconButton
                          aria-label="Editar tarefa"
                          size="small"
                          className={classes.actionEdit}
                          onClick={() => openEditModal(item)}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Excluir tarefa">
                        <IconButton
                          aria-label="Excluir tarefa"
                          size="small"
                          className={classes.actionDelete}
                          onClick={() => setTaskToDelete(item)}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </div>
                  </ListItem>
                );
              })}
            </List>
          )}
        </div>
      </Paper>
    </MainContainer>
  );
};

export default ToDoList;
