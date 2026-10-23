import React, { useState, useEffect } from "react";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import CircularProgress from "@material-ui/core/CircularProgress";
import { MenuItem, FormControl, InputLabel, Select, Typography, Box } from "@material-ui/core";
import { Visibility, VisibilityOff } from "@material-ui/icons";
import { InputAdornment, IconButton } from "@material-ui/core";
import QueueSelectSingle from "../../components/QueueSelectSingle";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => ({
  dialogPaper: {
    borderRadius: 16,
    maxHeight: "calc(100vh - 64px)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "0 20px 40px -15px rgba(0,0,0,0.3)",
    border: theme.palette.type === "dark" 
      ? "1px solid rgba(16, 185, 129, 0.2)" 
      : "1px solid rgba(16, 185, 129, 0.15)",
  },
  dialogTitle: {
    flexShrink: 0,
    background: theme.palette.type === "dark" 
      ? "linear-gradient(135deg, #07130E 0%, #0D2219 100%)" 
      : "linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 100%)",
    borderBottom: "1px solid rgba(16, 185, 129, 0.15)",
    padding: "18px 24px",
    "& h2": {
      display: "flex",
      alignItems: "center",
      gap: 10,
      fontSize: "1.15rem",
      fontWeight: 700,
      color: theme.palette.type === "dark" ? "#F0FDF4" : "#064E3B",
    }
  },
  formWrapper: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
    width: "100%",
  },
  dialogContent: {
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },
  dialogActions: {
    padding: "16px 24px",
    borderTop: theme.palette.type === "dark" 
      ? "1px solid rgba(255, 255, 255, 0.08)" 
      : "1px solid rgba(0, 0, 0, 0.08)",
    background: theme.palette.type === "dark" ? "#07130E" : "#FAFDFB",
    flexShrink: 0,
  },
  multFieldLine: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    "& > *": {
      flex: 1,
      minWidth: 160,
    },
  },
  providerCard: {
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid rgba(16, 185, 129, 0.25)",
    background: theme.palette.type === "dark" ? "rgba(16, 185, 129, 0.05)" : "#F0FDF4",
    marginBottom: 8,
  },
  btnSave: {
    background: "linear-gradient(135deg, #10B981 0%, #0D9488 100%) !important",
    color: "#FFFFFF !important",
    borderRadius: 9,
    fontWeight: 600,
    textTransform: "none",
    padding: "8px 20px",
    boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)",
    "&:hover": {
      background: "linear-gradient(135deg, #059669 0%, #0F766E 100%) !important",
    }
  },
  btnCancel: {
    borderRadius: 9,
    textTransform: "none",
    fontWeight: 600,
    color: theme.palette.type === "dark" ? "#94A3B8" : "#64748B",
  },
  buttonProgress: {
    color: "#FFFFFF",
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
}));

const PromptSchema = Yup.object().shape({
  name: Yup.string().min(3, "Muito curto!").max(100, "Muito longo!").required("Obrigatório"),
  prompt: Yup.string().min(20, "Muito curto!").required("Descreva as instruções para a Inteligência Artificial"),
  provider: Yup.string().required("Informe o provedor"),
  model: Yup.string().required("Informe o modelo"),
  voice: Yup.string().required("Informe o modo de resposta"),
  maxTokens: Yup.number().required("Informe o número máximo de tokens"),
  temperature: Yup.number().required("Informe a temperatura"),
  apiKey: Yup.string().nullable(),
  queueId: Yup.number().required("Informe o setor responsável"),
  maxMessages: Yup.number().required("Informe o número máximo de mensagens")
});

const PromptModal = ({ open, onClose, promptId, onSave }) => {
  const classes = useStyles();
  const [showApiKey, setShowApiKey] = useState(false);

  const initialState = {
    name: "",
    prompt: "",
    provider: "gemini",
    model: "gemini-3.5-flash-lite",
    voice: "texto",
    voiceKey: "",
    voiceRegion: "",
    maxTokens: 600,
    temperature: 0.7,
    apiKey: "",
    queueId: null,
    maxMessages: 15
  };

  const [prompt, setPrompt] = useState(initialState);

  useEffect(() => {
    const fetchPrompt = async () => {
      if (!promptId) {
        setPrompt(initialState);
        return;
      }
      try {
        const { data } = await api.get(`/prompt/${promptId}`);
        setPrompt(prevState => ({
          ...prevState,
          ...data,
          provider: data.provider || "gemini",
          model: data.model || (data.provider === "openai" ? "gpt-4o-mini" : "gemini-3.5-flash-lite"),
        }));
      } catch (err) {
        toastError(err);
      }
    };

    fetchPrompt();
  }, [promptId, open]);

  const handleClose = () => {
    setPrompt(initialState);
    onClose();
  };

  const handleSavePrompt = async (values) => {
    if (!values.queueId) {
      toastError("Selecione o setor de atendimento");
      return;
    }

    try {
      if (promptId) {
        await api.put(`/prompt/${promptId}`, values);
      } else {
        await api.post("/prompt", values);
      }
      toast.success(i18n.t("promptModal.success") || "Prompt salvo com sucesso!");
      if (onSave) onSave();
      handleClose();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
      classes={{ paper: classes.dialogPaper }}
    >
      <DialogTitle className={classes.dialogTitle}>
        <span>✨ {promptId ? "Editar Prompt de Inteligência Artificial" : "Novo Agente de Inteligência Artificial"}</span>
      </DialogTitle>
      <Formik
        initialValues={prompt}
        enableReinitialize={true}
        validationSchema={PromptSchema}
        onSubmit={(values, actions) => {
          handleSavePrompt(values);
          actions.setSubmitting(false);
        }}
      >
        {({ touched, errors, isSubmitting, values, setFieldValue }) => (
          <Form className={classes.formWrapper}>
            <DialogContent dividers className={classes.dialogContent}>
              <Box className={classes.providerCard}>
                <Typography variant="body2" style={{ fontWeight: 600, color: "#059669", marginBottom: 4 }}>
                  🧠 Provedor e Modelo de IA
                </Typography>
                <Typography variant="caption" style={{ color: "#64748B", display: "block", marginBottom: 12 }}>
                  O <strong>Google Gemini 3.8 Flash</strong> oferece alta velocidade, respostas multimodais nativas e processamento direto de áudios do WhatsApp.
                </Typography>

                <div className={classes.multFieldLine}>
                  <FormControl fullWidth margin="dense" variant="outlined">
                    <InputLabel id="provider-label">Provedor de IA</InputLabel>
                    <Select
                      labelId="provider-label"
                      label="Provedor de IA"
                      name="provider"
                      value={values.provider}
                      onChange={(e) => {
                        const newProvider = e.target.value;
                        setFieldValue("provider", newProvider);
                        if (newProvider === "gemini") {
                          setFieldValue("model", "gemini-3.5-flash-lite");
                        } else {
                          setFieldValue("model", "gpt-4o-mini");
                        }
                      }}
                    >
                      <MenuItem value="gemini">Google Gemini (Recomendado)</MenuItem>
                      <MenuItem value="openai">OpenAI (ChatGPT)</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl fullWidth margin="dense" variant="outlined">
                    <InputLabel id="model-label">Modelo</InputLabel>
                    <Select
                      labelId="model-label"
                      label="Modelo"
                      name="model"
                      value={values.model}
                      onChange={(e) => setFieldValue("model", e.target.value)}
                    >
                      {values.provider === "gemini" ? [
                        <MenuItem key="gemini-3.5-flash-lite" value="gemini-3.5-flash-lite">
                          Gemini 3.5 Flash Lite (Mais Rápido & Econômico - Recomendado)
                        </MenuItem>,
                        <MenuItem key="gemini-3.8-flash" value="gemini-3.8-flash">
                          Gemini 3.8 Flash (Padrão com Raciocínio)
                        </MenuItem>,
                        <MenuItem key="gemini-2.5-flash" value="gemini-2.5-flash">
                          Gemini 2.5 Flash
                        </MenuItem>,
                        <MenuItem key="gemini-flash-latest" value="gemini-flash-latest">
                          Gemini Flash (Latest)
                        </MenuItem>,
                        <MenuItem key="gemini-1.5-flash" value="gemini-1.5-flash">
                          Gemini 1.5 Flash (Legado)
                        </MenuItem>,
                        <MenuItem key="gemini-1.5-pro" value="gemini-1.5-pro">
                          Gemini 1.5 Pro (Raciocínio Avançado)
                        </MenuItem>,
                        <MenuItem key="gemini-2.0-flash-exp" value="gemini-2.0-flash-exp">
                          Gemini 2.0 Flash (Experimental)
                        </MenuItem>,
                      ] : [
                        <MenuItem key="gpt-4o-mini" value="gpt-4o-mini">
                          GPT-4o Mini (Rápido e Inteligente)
                        </MenuItem>,
                        <MenuItem key="gpt-4o" value="gpt-4o">
                          GPT-4o (Alta Precisão)
                        </MenuItem>,
                        <MenuItem key="gpt-3.5-turbo" value="gpt-3.5-turbo">
                          GPT-3.5 Turbo (Legado)
                        </MenuItem>,
                      ]}
                    </Select>
                  </FormControl>
                </div>
              </Box>

              <Field
                as={TextField}
                label="Nome do Atendente / Prompt"
                name="name"
                placeholder="Ex: Assistente de Vendas PortAI"
                error={touched.name && Boolean(errors.name)}
                helperText={touched.name && errors.name}
                variant="outlined"
                margin="dense"
                fullWidth
              />

              <FormControl fullWidth margin="dense" variant="outlined">
                <Field
                  as={TextField}
                  label="Chave de API (Opcional - Fallback automático para o .env)"
                  name="apiKey"
                  placeholder="Deixe em branco para usar a chave configurada no servidor"
                  type={showApiKey ? "text" : "password"}
                  error={touched.apiKey && Boolean(errors.apiKey)}
                  helperText={
                    (touched.apiKey && errors.apiKey) ||
                    "Se deixar em branco, o sistema utilizará automaticamente a chave configurada no .env do servidor."
                  }
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowApiKey(!showApiKey)}>
                          {showApiKey ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </FormControl>

              <Field
                as={TextField}
                label="Instruções de Comportamento (Prompt do Sistema)"
                name="prompt"
                placeholder="Descreva a personalidade, regras de atendimento, informações da empresa, políticas e orientações da IA..."
                error={touched.prompt && Boolean(errors.prompt)}
                helperText={touched.prompt && errors.prompt}
                variant="outlined"
                margin="dense"
                fullWidth
                rows={7}
                multiline={true}
              />

              <Typography variant="caption" style={{ color: "#64748B", marginTop: -8 }}>
                💡 <strong>Dica Pro:</strong> A IA identifica automaticamente o cliente pelo nome. Para solicitar transferência humana, ela acionará o setor definido abaixo.
              </Typography>

              <QueueSelectSingle />

              <div className={classes.multFieldLine}>
                <FormControl fullWidth margin="dense" variant="outlined">
                  <InputLabel id="voice-label">Modo de Resposta</InputLabel>
                  <Select
                    labelId="voice-label"
                    label="Modo de Resposta"
                    name="voice"
                    value={values.voice}
                    onChange={(e) => setFieldValue("voice", e.target.value)}
                  >
                    <MenuItem value="texto">Texto WhatsApp (Padrão)</MenuItem>
                    <MenuItem value="pt-BR-FranciscaNeural">Voz Neural - Francisca (Áudio PTT)</MenuItem>
                    <MenuItem value="pt-BR-AntonioNeural">Voz Neural - Antônio (Áudio PTT)</MenuItem>
                    <MenuItem value="pt-BR-BrendaNeural">Voz Neural - Brenda (Áudio PTT)</MenuItem>
                    <MenuItem value="pt-BR-FabioNeural">Voz Neural - Fábio (Áudio PTT)</MenuItem>
                    <MenuItem value="pt-BR-GiovannaNeural">Voz Neural - Giovanna (Áudio PTT)</MenuItem>
                  </Select>
                </FormControl>

                {values.voice !== "texto" && (
                  <>
                    <Field
                      as={TextField}
                      label="Azure Speech Key"
                      name="voiceKey"
                      variant="outlined"
                      margin="dense"
                      fullWidth
                    />
                    <Field
                      as={TextField}
                      label="Azure Region"
                      name="voiceRegion"
                      placeholder="brazilsouth"
                      variant="outlined"
                      margin="dense"
                      fullWidth
                    />
                  </>
                )}
              </div>

              <div className={classes.multFieldLine}>
                <Field
                  as={TextField}
                  label="Temperatura (Criatividade: 0.1 a 1.0)"
                  name="temperature"
                  type="number"
                  inputProps={{ step: "0.1", min: "0", max: "2" }}
                  error={touched.temperature && Boolean(errors.temperature)}
                  helperText={touched.temperature && errors.temperature}
                  variant="outlined"
                  margin="dense"
                  fullWidth
                />
                <Field
                  as={TextField}
                  label="Tokens Máximos (Tamanho da resposta)"
                  name="maxTokens"
                  type="number"
                  error={touched.maxTokens && Boolean(errors.maxTokens)}
                  helperText={touched.maxTokens && errors.maxTokens}
                  variant="outlined"
                  margin="dense"
                  fullWidth
                />
                <Field
                  as={TextField}
                  label="Histórico de Mensagens Recentes"
                  name="maxMessages"
                  type="number"
                  error={touched.maxMessages && Boolean(errors.maxMessages)}
                  helperText={touched.maxMessages && errors.maxMessages}
                  variant="outlined"
                  margin="dense"
                  fullWidth
                />
              </div>
            </DialogContent>
            <DialogActions className={classes.dialogActions}>
              <Button
                onClick={handleClose}
                disabled={isSubmitting}
                className={classes.btnCancel}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className={classes.btnSave}
              >
                {isSubmitting ? (
                  <CircularProgress size={20} className={classes.buttonProgress} />
                ) : promptId ? (
                  "Salvar Alterações"
                ) : (
                  "Criar Agente de IA"
                )}
              </Button>
            </DialogActions>
          </Form>
        )}
      </Formik>
    </Dialog>
  );
};

export default PromptModal;