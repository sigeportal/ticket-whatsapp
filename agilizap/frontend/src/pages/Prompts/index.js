import React, { useContext, useEffect, useReducer, useState, useCallback } from "react";
import {
  Button,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Chip,
  Box,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { DeleteOutline, Edit, Add, RecordVoiceOver, TextFields } from "@material-ui/icons";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";

const AiBrainIcon = (props) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 2a4 4 0 0 0-4 4v1H7a3 3 0 0 0-3 3v2a3 3 0 0 0 3 3h1v1a4 4 0 0 0 8 0v-1h1a3 3 0 0 0 3-3V10a3 3 0 0 0-3-3h-1V6a4 4 0 0 0-4-4z" />
    <circle cx="9" cy="12" r="1" />
    <circle cx="15" cy="12" r="1" />
    <path d="M10 16h4" />
  </svg>
);

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import Title from "../../components/Title";
import PromptModal from "../../components/PromptModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import { AuthContext } from "../../context/Auth/AuthContext";
import { SocketContext } from "../../context/Socket/SocketContext";
import usePlans from "../../hooks/usePlans";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(2),
    borderRadius: 14,
    border: "1px solid var(--border-hairline)",
    backgroundColor: "var(--bg-surface)",
    boxShadow: "none",
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },
  aiHeroBanner: {
    padding: theme.spacing(2.5),
    borderRadius: 14,
    marginBottom: theme.spacing(2),
    backgroundColor: "var(--bg-surface)",
    border: "1px solid var(--border-strong)",
    display: "flex",
    alignItems: "flex-start",
    gap: theme.spacing(2),
    boxShadow: "none",
  },
  heroIcon: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: "var(--action)",
    color: "var(--action-ink)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  btnAdd: {
    backgroundColor: "var(--action) !important",
    color: "var(--action-ink) !important",
    borderRadius: 10,
    fontWeight: 600,
    textTransform: "none",
    padding: "8px 18px",
    boxShadow: "none",
    "&:hover": {
      backgroundColor: "var(--action-hover) !important",
    },
  },
  actionBtn: {
    borderRadius: 8,
    padding: 6,
    margin: "0 2px",
    color: "var(--action)",
    backgroundColor: "var(--action-soft)",
    transition: "all var(--t-in) var(--ease-ui)",
    "&:hover": {
      backgroundColor: "var(--action)",
      color: "var(--action-ink)",
    },
  },
  deleteBtn: {
    borderRadius: 8,
    padding: 6,
    margin: "0 2px",
    color: "var(--status-danger)",
    backgroundColor: "var(--status-danger-bg)",
    transition: "all var(--t-in) var(--ease-ui)",
    "&:hover": {
      backgroundColor: "var(--status-danger)",
      color: "#FFFFFF",
    },
  },
  badgeGemini: {
    backgroundColor: "var(--action-soft)",
    color: "var(--action)",
    border: "1px solid var(--border-strong)",
    fontWeight: 600,
    fontSize: "0.75rem",
    borderRadius: 8,
    padding: "2px 4px",
  },
  badgeOpenAi: {
    backgroundColor: "var(--status-info-bg)",
    color: "var(--status-info)",
    border: "1px solid rgba(2, 132, 199, 0.28)",
    fontWeight: 600,
    fontSize: "0.75rem",
    borderRadius: 8,
    padding: "2px 4px",
  },
  modelChip: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.72rem",
    fontWeight: 500,
    borderRadius: 6,
    backgroundColor: "var(--bg-subtle)",
    color: "var(--ink-secondary)",
  },
}));

const reducer = (state, action) => {
  if (action.type === "LOAD_PROMPTS") {
    const prompts = action.payload;
    const newPrompts = [];

    prompts.forEach((prompt) => {
      const promptIndex = state.findIndex((p) => p.id === prompt.id);
      if (promptIndex !== -1) {
        state[promptIndex] = prompt;
      } else {
        newPrompts.push(prompt);
      }
    });

    return [...state, ...newPrompts];
  }

  if (action.type === "UPDATE_PROMPTS") {
    const prompt = action.payload;
    const promptIndex = state.findIndex((p) => p.id === prompt.id);

    if (promptIndex !== -1) {
      state[promptIndex] = prompt;
      return [...state];
    } else {
      return [prompt, ...state];
    }
  }

  if (action.type === "DELETE_PROMPT") {
    const promptId = action.payload;
    const promptIndex = state.findIndex((p) => p.id === promptId);
    if (promptIndex !== -1) {
      state.splice(promptIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const Prompts = () => {
  const classes = useStyles();

  const [prompts, dispatch] = useReducer(reducer, []);
  const [loading, setLoading] = useState(false);

  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const { user } = useContext(AuthContext);
  const { getPlanCompany } = usePlans();
  const history = useHistory();
  const companyId = user.companyId;

  const socketManager = useContext(SocketContext);

  useEffect(() => {
    async function fetchData() {
      const planConfigs = await getPlanCompany(undefined, companyId);
      if (planConfigs?.plan && !planConfigs.plan.useOpenAi) {
        toast.error("Esta empresa não possui permissão para acessar essa página! Redirecionando.");
        setTimeout(() => {
          history.push(`/`);
        }, 1000);
      }
    }
    fetchData();
  }, [companyId, getPlanCompany, history]);

  const fetchPrompts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/prompt");
      dispatch({ type: "LOAD_PROMPTS", payload: data.prompts });
      setLoading(false);
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  useEffect(() => {
    const socket = socketManager.getSocket(companyId);

    const handlePromptEvent = (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_PROMPTS", payload: data.prompt });
        fetchPrompts();
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_PROMPT", payload: data.intelligenceId || data.promptId });
        fetchPrompts();
      }
    };

    socket.on(`company-${companyId}-prompt`, handlePromptEvent);
    socket.on("prompt", handlePromptEvent);

    return () => {
      socket.off(`company-${companyId}-prompt`, handlePromptEvent);
      socket.off("prompt", handlePromptEvent);
    };
  }, [companyId, socketManager, fetchPrompts]);

  const handleOpenPromptModal = () => {
    setPromptModalOpen(true);
    setSelectedPrompt(null);
  };

  const handleClosePromptModal = () => {
    setPromptModalOpen(false);
    setSelectedPrompt(null);
  };

  const handleEditPrompt = (prompt) => {
    setSelectedPrompt(prompt);
    setPromptModalOpen(true);
  };

  const handleCloseConfirmationModal = () => {
    setConfirmModalOpen(false);
    setSelectedPrompt(null);
  };

  const handleDeletePrompt = async (promptId) => {
    try {
      const { data } = await api.delete(`/prompt/${promptId}`);
      toast.info(data.message || "Prompt excluído com sucesso");
    } catch (err) {
      toastError(err);
    }
    setSelectedPrompt(null);
  };

  return (
    <MainContainer>
      {/* Banner Moderno PortAI Intelligence Hub */}
      <Paper className={classes.aiHeroBanner} elevation={0}>
        <div className={classes.heroIcon}>
          <AiBrainIcon />
        </div>
        <div style={{ flex: 1 }}>
          <Typography
            variant="subtitle1"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              letterSpacing: "-0.015em",
              color: "var(--action)",
              marginBottom: 2,
            }}
          >
            PortAI Smart CX — Central de Inteligência Artificial
          </Typography>
          <Typography variant="body2" style={{ color: "var(--ink-secondary)", lineHeight: 1.45 }}>
            Configure assistentes virtuais para atendimento automático em suas conexões e filas. Suporte nativo para <strong>Google Gemini 1.5 Flash</strong> (respostas ultra-rápidas e compreensão nativa de áudio do WhatsApp) e <strong>OpenAI</strong> com fallback automático para variáveis de ambiente.
          </Typography>
        </div>
      </Paper>

      <ConfirmationModal
        title={
          selectedPrompt &&
          `Excluir o prompt "${selectedPrompt.name}"?`
        }
        open={confirmModalOpen}
        onClose={handleCloseConfirmationModal}
        onConfirm={() => handleDeletePrompt(selectedPrompt.id)}
      >
        Tem certeza que deseja excluir este prompt de Inteligência Artificial? Esta ação não pode ser desfeita.
      </ConfirmationModal>

      <PromptModal
        open={promptModalOpen}
        onClose={handleClosePromptModal}
        promptId={selectedPrompt?.id}
        onSave={fetchPrompts}
      />

      <MainHeader>
        <Title>Agentes de Inteligência Artificial</Title>
        <MainHeaderButtonsWrapper>
          <Button
            variant="contained"
            className={classes.btnAdd}
            onClick={handleOpenPromptModal}
            startIcon={<Add />}
          >
            Novo Agente de IA
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Paper className={classes.mainPaper} elevation={0}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell align="left" style={{ fontWeight: 600 }}>Nome do Agente</TableCell>
              <TableCell align="left" style={{ fontWeight: 600 }}>Provedor</TableCell>
              <TableCell align="left" style={{ fontWeight: 600 }}>Modelo</TableCell>
              <TableCell align="left" style={{ fontWeight: 600 }}>Setor / Fila</TableCell>
              <TableCell align="center" style={{ fontWeight: 600 }}>Tokens Máx.</TableCell>
              <TableCell align="center" style={{ fontWeight: 600 }}>Modo</TableCell>
              <TableCell align="center" style={{ fontWeight: 600 }}>Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {prompts.map((prompt) => {
              const isGemini = !prompt.provider || prompt.provider.toLowerCase() === "gemini";
              const isVoice = prompt.voice && prompt.voice !== "texto";

              return (
                <TableRow key={prompt.id} hover>
                  <TableCell align="left" style={{ fontWeight: 600 }}>
                    {prompt.name}
                  </TableCell>
                  <TableCell align="left">
                    <Chip
                      size="small"
                      label={isGemini ? "Google Gemini" : "OpenAI"}
                      className={isGemini ? classes.badgeGemini : classes.badgeOpenAi}
                    />
                  </TableCell>
                  <TableCell align="left">
                    <Chip
                      size="small"
                      label={prompt.model || (isGemini ? "gemini-3.5-flash-lite" : "gpt-4o-mini")}
                      className={classes.modelChip}
                    />
                  </TableCell>
                  <TableCell align="left">
                    {prompt.queue?.name || "Geral / Conexão"}
                  </TableCell>
                  <TableCell align="center">
                    {prompt.maxTokens || 600}
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      size="small"
                      icon={isVoice ? <RecordVoiceOver style={{ fontSize: 14 }} /> : <TextFields style={{ fontSize: 14 }} />}
                      label={isVoice ? "Voz Neural" : "Texto"}
                      variant="outlined"
                      style={{ borderRadius: 6, fontSize: "0.72rem" }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      className={classes.actionBtn}
                      onClick={() => handleEditPrompt(prompt)}
                      title="Editar Agente"
                    >
                      <Edit fontSize="small" />
                    </IconButton>

                    <IconButton
                      size="small"
                      className={classes.deleteBtn}
                      onClick={() => {
                        setSelectedPrompt(prompt);
                        setConfirmModalOpen(true);
                      }}
                      title="Excluir Agente"
                    >
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
            {loading && <TableRowSkeleton columns={7} />}
          </TableBody>
        </Table>
      </Paper>
    </MainContainer>
  );
};

export default Prompts;
