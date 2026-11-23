import React, { useState, useEffect } from "react";
import { makeStyles } from "@material-ui/core/styles";
import TextField from "@material-ui/core/TextField";
import Button from "@material-ui/core/Button";
import Paper from "@material-ui/core/Paper";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditOutlinedIcon from "@material-ui/icons/EditOutlined";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";

const useStyles = makeStyles((theme) => ({
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
  inputContainer: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    [theme.breakpoints.down("xs")]: {
      flexDirection: "column",
      alignItems: "stretch",
    },
  },
  input: {
    flexGrow: 1,
  },
  addBtn: {
    height: 44,
    padding: "0 22px",
    whiteSpace: "nowrap",
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
    padding: "10px 88px 10px 16px",
    marginBottom: 8,
    transition: "border-color var(--t-in) var(--ease-ui)",
    "&:hover": {
      borderColor: "var(--border-strong)",
    },
  },
  taskTitle: {
    fontWeight: 600,
    fontSize: "0.92rem",
    color: "var(--ink-primary)",
  },
  taskMeta: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.72rem",
    color: "var(--ink-muted)",
    marginTop: 2,
  },
  actionEdit: {
    color: "var(--action)",
    marginRight: 4,
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

  const [task, setTask] = useState("");
  const [tasks, setTasks] = useState([]);
  const [editIndex, setEditIndex] = useState(-1);

  useEffect(() => {
    const savedTasks = localStorage.getItem("tasks");
    if (savedTasks) {
      setTasks(JSON.parse(savedTasks));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("tasks", JSON.stringify(tasks));
  }, [tasks]);

  const handleTaskChange = (event) => {
    setTask(event.target.value);
  };

  const handleAddTask = () => {
    if (!task.trim()) {
      return;
    }

    const now = new Date();
    if (editIndex >= 0) {
      const newTasks = [...tasks];
      newTasks[editIndex] = {
        text: task,
        updatedAt: now,
        createdAt: newTasks[editIndex].createdAt,
      };
      setTasks(newTasks);
      setTask("");
      setEditIndex(-1);
    } else {
      setTasks([...tasks, { text: task, createdAt: now, updatedAt: now }]);
      setTask("");
    }
  };

  const handleEditTask = (index) => {
    setTask(tasks[index].text);
    setEditIndex(index);
  };

  const handleDeleteTask = (index) => {
    const newTasks = [...tasks];
    newTasks.splice(index, 1);
    setTasks(newTasks);
  };

  return (
    <MainContainer>
      <MainHeader>
        <Title>Tarefas ({tasks.length})</Title>
      </MainHeader>

      <Paper className={classes.mainPaper} elevation={0}>
        <div className={classes.inputContainer}>
          <TextField
            className={classes.input}
            label="Nova tarefa"
            placeholder="Descreva a tarefa operacional..."
            value={task}
            onChange={handleTaskChange}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddTask();
              }
            }}
            variant="outlined"
            size="small"
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleAddTask}
            className={classes.addBtn}
          >
            {editIndex >= 0 ? "Salvar alterações" : "Adicionar tarefa"}
          </Button>
        </div>

        <div className={classes.listContainer}>
          {tasks.length === 0 ? (
            <div className={classes.emptyState}>
              <Typography variant="body2">
                Nenhuma tarefa pendente. Adicione um item acima para organizar seu turno.
              </Typography>
            </div>
          ) : (
            <List disablePadding>
              {tasks.map((item, index) => (
                <ListItem key={index} className={classes.listItem}>
                  <ListItemText
                    primary={<span className={classes.taskTitle}>{item.text}</span>}
                    secondary={
                      <span className={classes.taskMeta}>
                        {new Date(item.updatedAt).toLocaleString("pt-BR")}
                      </span>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      aria-label="Editar tarefa"
                      size="small"
                      className={classes.actionEdit}
                      onClick={() => handleEditTask(index)}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      aria-label="Excluir tarefa"
                      size="small"
                      className={classes.actionDelete}
                      onClick={() => handleDeleteTask(index)}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </div>
      </Paper>
    </MainContainer>
  );
};

export default ToDoList;
