import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";

import { i18n } from "../../translate/i18n";
import { Button, CircularProgress, Grid, TextField, Typography } from "@material-ui/core";
import { Field, Form, Formik } from "formik";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import axios from "axios";
import usePlans from "../../hooks/usePlans";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(3),
    borderRadius: 14,
    border: "1px solid var(--border-hairline)",
    backgroundColor: "var(--bg-surface)",
    overflowY: "auto",
    boxShadow: "none",
    ...theme.scrollbarStyles,
  },
  sectionCard: {
    padding: theme.spacing(2.5),
    borderRadius: 12,
    border: "1px solid var(--border-hairline)",
    backgroundColor: "var(--bg-canvas)",
    marginBottom: theme.spacing(3),
  },
  sectionHeading: {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: "1.05rem",
    color: "var(--ink-primary)",
    marginBottom: theme.spacing(1.5),
  },
  codeBlock: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.78rem",
    lineHeight: 1.6,
    padding: theme.spacing(2),
    borderRadius: 10,
    backgroundColor: "var(--bg-subtle)",
    border: "1px solid var(--border-hairline)",
    color: "var(--ink-primary)",
    overflowX: "auto",
  },
  noteList: {
    margin: "8px 0 0",
    paddingLeft: 20,
    color: "var(--ink-secondary)",
    fontSize: "0.875rem",
    lineHeight: 1.6,
  },
  formContainer: {
    maxWidth: 520,
  },
  textRight: {
    textAlign: "right",
  },
  btnWrapper: {
    position: "relative",
    minWidth: 120,
    height: 40,
  },
  buttonProgress: {
    color: "var(--action-ink)",
  },
  fileInputLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "9px 14px",
    borderRadius: 10,
    backgroundColor: "var(--field-bg)",
    border: "1px dashed var(--border-strong)",
    color: "var(--ink-primary)",
    fontSize: "0.85rem",
    fontWeight: 500,
    cursor: "pointer",
    width: "100%",
  },
}));

const MessagesAPI = () => {
  const classes = useStyles();
  const history = useHistory();

  const [formMessageTextData] = useState({ token: "", number: "", body: "" });
  const [formMessageMediaData] = useState({ token: "", number: "", medias: "" });
  const [file, setFile] = useState({});

  const { getPlanCompany } = usePlans();

  useEffect(() => {
    async function fetchData() {
      const companyId = localStorage.getItem("companyId");
      const planConfigs = await getPlanCompany(undefined, companyId);
      if (!planConfigs.plan.useExternalApi) {
        toast.error(
          "Esta empresa não possui permissão para acessar essa página! Estamos lhe redirecionando."
        );
        setTimeout(() => {
          history.push("/");
        }, 1000);
      }
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getEndpoint = () => {
    return process.env.REACT_APP_BACKEND_URL + "/api/messages/send";
  };

  const handleSendTextMessage = async (values) => {
    const { number, body } = values;
    const data = { number, body };
    try {
      await axios.request({
        url: getEndpoint(),
        method: "POST",
        data,
        headers: {
          "Content-type": "application/json",
          Authorization: `Bearer ${values.token}`,
        },
      });
      toast.success("Mensagem enviada com sucesso");
    } catch (err) {
      toastError(err);
    }
  };

  const handleSendMediaMessage = async (values) => {
    try {
      const firstFile = file[0];
      const data = new FormData();
      data.append("number", values.number);
      data.append("body", firstFile.name);
      data.append("medias", firstFile);
      await axios.request({
        url: getEndpoint(),
        method: "POST",
        data,
        headers: {
          "Content-type": "multipart/form-data",
          Authorization: `Bearer ${values.token}`,
        },
      });
      toast.success("Mensagem enviada com sucesso");
    } catch (err) {
      toastError(err);
    }
  };

  const renderFormMessageText = () => {
    return (
      <Formik
        initialValues={formMessageTextData}
        enableReinitialize={true}
        onSubmit={(values, actions) => {
          setTimeout(async () => {
            await handleSendTextMessage(values);
            actions.setSubmitting(false);
            actions.resetForm();
          }, 400);
        }}
      >
        {({ isSubmitting }) => (
          <Form className={classes.formContainer}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Field
                  as={TextField}
                  label={i18n.t("messagesAPI.textMessage.token")}
                  name="token"
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Field
                  as={TextField}
                  label={i18n.t("messagesAPI.textMessage.number")}
                  name="number"
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <Field
                  as={TextField}
                  label={i18n.t("messagesAPI.textMessage.body")}
                  name="body"
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  multiline
                  rows={2}
                  required
                />
              </Grid>
              <Grid item xs={12} className={classes.textRight}>
                <Button
                  type="submit"
                  color="primary"
                  variant="contained"
                  className={classes.btnWrapper}
                >
                  {isSubmitting ? (
                    <CircularProgress size={20} className={classes.buttonProgress} />
                  ) : (
                    "Enviar teste"
                  )}
                </Button>
              </Grid>
            </Grid>
          </Form>
        )}
      </Formik>
    );
  };

  const renderFormMessageMedia = () => {
    return (
      <Formik
        initialValues={formMessageMediaData}
        enableReinitialize={true}
        onSubmit={(values, actions) => {
          setTimeout(async () => {
            await handleSendMediaMessage(values);
            actions.setSubmitting(false);
            actions.resetForm();
            const mediaInput = document.getElementById("medias");
            if (mediaInput) {
              mediaInput.files = null;
              mediaInput.value = null;
            }
          }, 400);
        }}
      >
        {({ isSubmitting }) => (
          <Form className={classes.formContainer}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Field
                  as={TextField}
                  label={i18n.t("messagesAPI.mediaMessage.token")}
                  name="token"
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Field
                  as={TextField}
                  label={i18n.t("messagesAPI.mediaMessage.number")}
                  name="number"
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <label htmlFor="medias" className={classes.fileInputLabel}>
                  <input
                    type="file"
                    name="medias"
                    id="medias"
                    required
                    onChange={(e) => setFile(e.target.files)}
                  />
                </label>
              </Grid>
              <Grid item xs={12} className={classes.textRight}>
                <Button
                  type="submit"
                  color="primary"
                  variant="contained"
                  className={classes.btnWrapper}
                >
                  {isSubmitting ? (
                    <CircularProgress size={20} className={classes.buttonProgress} />
                  ) : (
                    "Enviar mídia"
                  )}
                </Button>
              </Grid>
            </Grid>
          </Form>
        )}
      </Formik>
    );
  };

  return (
    <MainContainer>
      <MainHeader>
        <Title>API de Mensagens</Title>
      </MainHeader>

      <Paper className={classes.mainPaper} elevation={0}>
        <div className={classes.sectionCard}>
          <Typography className={classes.sectionHeading}>
            Instruções gerais de integração
          </Typography>
          <ul className={classes.noteList}>
            <li>
              Antes de enviar mensagens, vincule um token na conexão desejada em{" "}
              <strong>Conexões WhatsApp</strong>.
            </li>
            <li>
              Envie o número sem máscara ou símbolos: código do país + DDD + número
              (ex.: <code className="font-mono">5567999999999</code>).
            </li>
          </ul>
        </div>

        <div className={classes.sectionCard}>
          <Typography className={classes.sectionHeading}>
            1. Mensagens de Texto
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <div className={classes.codeBlock}>
                <div>
                  <strong>POST</strong> {getEndpoint()}
                </div>
                <div>Authorization: Bearer &lt;token&gt;</div>
                <div>Content-Type: application/json</div>
                <div style={{ marginTop: 8 }}>
                  {'{ "number": "5567999999999", "body": "Sua mensagem" }'}
                </div>
              </div>
            </Grid>
            <Grid item xs={12} md={6}>
              {renderFormMessageText()}
            </Grid>
          </Grid>
        </div>

        <div className={classes.sectionCard} style={{ marginBottom: 0 }}>
          <Typography className={classes.sectionHeading}>
            2. Mensagens de Mídia
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <div className={classes.codeBlock}>
                <div>
                  <strong>POST</strong> {getEndpoint()}
                </div>
                <div>Authorization: Bearer &lt;token&gt;</div>
                <div>Content-Type: multipart/form-data</div>
                <div style={{ marginTop: 8 }}>
                  FormData: number (ex. 5567999999999), medias (arquivo)
                </div>
              </div>
            </Grid>
            <Grid item xs={12} md={6}>
              {renderFormMessageMedia()}
            </Grid>
          </Grid>
        </div>
      </Paper>
    </MainContainer>
  );
};

export default MessagesAPI;
