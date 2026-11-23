import React, { useState } from "react";
import IconButton from "@material-ui/core/IconButton";
import VisibilityOutlinedIcon from "@material-ui/icons/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@material-ui/icons/VisibilityOffOutlined";
import InputAdornment from "@material-ui/core/InputAdornment";
import * as Yup from "yup";
import { useHistory, Link as RouterLink } from "react-router-dom";
import { Formik, Form, Field } from "formik";
import Button from "@material-ui/core/Button";
import CssBaseline from "@material-ui/core/CssBaseline";
import TextField from "@material-ui/core/TextField";
import Link from "@material-ui/core/Link";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import { toast } from "react-toastify";
import toastError from "../../errors/toastError";
import "react-toastify/dist/ReactToastify.css";
import AuthShell from "../../components/AuthShell";

const useStyles = makeStyles((theme) => ({
  header: {
    marginBottom: theme.spacing(2.5),
  },
  eyebrow: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.72rem",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--action)",
    marginBottom: 6,
    display: "block",
  },
  title: {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: "1.5rem",
    letterSpacing: "-0.025em",
    color: "var(--ink-primary)",
    lineHeight: 1.2,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: "var(--font-sans)",
    color: "var(--ink-secondary)",
    fontSize: "0.875rem",
    lineHeight: 1.45,
  },
  stepBar: {
    display: "flex",
    gap: 8,
    marginBottom: theme.spacing(2.5),
  },
  stepItem: {
    flex: 1,
    padding: "6px 10px",
    borderRadius: 8,
    fontFamily: "var(--font-mono)",
    fontSize: "0.72rem",
    fontWeight: 600,
    border: "1px solid var(--border-hairline)",
    backgroundColor: "var(--bg-subtle)",
    color: "var(--ink-muted)",
    textAlign: "center",
  },
  stepItemActive: {
    backgroundColor: "var(--action-soft)",
    borderColor: "var(--border-strong)",
    color: "var(--action)",
  },
  form: {
    width: "100%",
  },
  fieldLabel: {
    display: "block",
    fontFamily: "var(--font-sans)",
    fontSize: "0.8125rem",
    fontWeight: 600,
    color: "var(--ink-primary)",
    marginBottom: 6,
  },
  submit: {
    marginTop: theme.spacing(2.5),
    marginBottom: theme.spacing(2),
    height: 46,
    borderRadius: 10,
    backgroundColor: "var(--action)",
    color: "var(--action-ink)",
    fontWeight: 700,
    fontSize: "0.9375rem",
    textTransform: "none",
    boxShadow: "none",
    "&:hover": {
      backgroundColor: "var(--action-hover)",
    },
  },
  backRow: {
    textAlign: "center",
    fontSize: "0.875rem",
  },
  backLink: {
    color: "var(--action)",
    fontWeight: 600,
    textDecoration: "none",
    "&:hover": {
      textDecoration: "underline",
    },
  },
}));

const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/;

const ForgetPassword = () => {
  const classes = useStyles();
  const history = useHistory();
  const [showAdditionalFields, setShowAdditionalFields] = useState(false);
  const [showResetPasswordButton, setShowResetPasswordButton] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword((prev) => !prev);
  };

  const handleSendEmail = async (values) => {
    const email = values.email;
    try {
      const response = await api.post("/forgetpassword", { email });
      if (response.data.status === 404) {
        toast.error("E-mail não encontrado");
      } else {
        toast.success(i18n.t("Email enviado com sucesso!"));
        setShowAdditionalFields(true);
        setShowResetPasswordButton(true);
      }
    } catch (err) {
      toastError(err);
    }
  };

  const handleResetPassword = async (values) => {
    const email = values.email;
    const token = values.token;
    const newPassword = values.newPassword;
    const confirmPassword = values.confirmPassword;

    if (newPassword === confirmPassword) {
      try {
        await api.post("/resetpasswords", {
          email,
          token,
          password: newPassword,
        });
        setError("");
        toast.success(i18n.t("Senha redefinida com sucesso."));
        history.push("/login");
      } catch (err) {
        toastError(err);
      }
    }
  };

  const isResetPasswordButtonClicked = showResetPasswordButton;
  const UserSchema = Yup.object().shape({
    email: Yup.string().email("E-mail inválido").required("Campo obrigatório"),
    newPassword: isResetPasswordButtonClicked
      ? Yup.string()
          .required("Campo obrigatório")
          .matches(
            passwordRegex,
            "Sua senha precisa ter no mínimo 8 caracteres, sendo uma letra maiúscula, uma minúscula e um número."
          )
      : Yup.string(),
    confirmPassword: Yup.string().when("newPassword", {
      is: (newPassword) => isResetPasswordButtonClicked && newPassword,
      then: Yup.string()
        .oneOf([Yup.ref("newPassword"), null], "As senhas não correspondem")
        .required("Campo obrigatório"),
      otherwise: Yup.string(),
    }),
  });

  return (
    <AuthShell>
      <CssBaseline />
      <div className={classes.header}>
        <span className={classes.eyebrow}>Recuperação de acesso</span>
        <Typography component="h1" className={classes.title}>
          {i18n.t("Redefinir senha")}
        </Typography>
        <Typography variant="body2" className={classes.subtitle}>
          {showAdditionalFields
            ? "Insira o código recebido por e-mail e defina sua nova senha."
            : "Informe o e-mail da sua conta para receber o código de verificação."}
        </Typography>
      </div>

      <div className={classes.stepBar}>
        <div
          className={`${classes.stepItem} ${
            !showAdditionalFields ? classes.stepItemActive : ""
          }`}
        >
          1. E-mail
        </div>
        <div
          className={`${classes.stepItem} ${
            showAdditionalFields ? classes.stepItemActive : ""
          }`}
        >
          2. Código e Nova Senha
        </div>
      </div>

      <Formik
        initialValues={{
          email: "",
          token: "",
          newPassword: "",
          confirmPassword: "",
        }}
        enableReinitialize={true}
        validationSchema={UserSchema}
        onSubmit={(values, actions) => {
          setTimeout(async () => {
            if (showResetPasswordButton) {
              await handleResetPassword(values);
            } else {
              await handleSendEmail(values);
            }
            actions.setSubmitting(false);
          }, 250);
        }}
      >
        {({ touched, errors }) => (
          <Form className={classes.form}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <label htmlFor="email" className={classes.fieldLabel}>
                  {i18n.t("signup.form.email") || "E-mail"}
                </label>
                <Field
                  as={TextField}
                  variant="outlined"
                  fullWidth
                  id="email"
                  placeholder="nome@empresa.com.br"
                  name="email"
                  error={touched.email && Boolean(errors.email)}
                  helperText={touched.email && errors.email}
                  autoComplete="email"
                  required
                />
              </Grid>

              {showAdditionalFields && (
                <>
                  <Grid item xs={12}>
                    <label htmlFor="token" className={classes.fieldLabel}>
                      Código de verificação
                    </label>
                    <Field
                      as={TextField}
                      variant="outlined"
                      fullWidth
                      id="token"
                      placeholder="Cole o código enviado"
                      name="token"
                      error={touched.token && Boolean(errors.token)}
                      helperText={touched.token && errors.token}
                      autoComplete="off"
                      required
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <label htmlFor="newPassword" className={classes.fieldLabel}>
                      Nova senha
                    </label>
                    <Field
                      as={TextField}
                      variant="outlined"
                      fullWidth
                      type={showPassword ? "text" : "password"}
                      id="newPassword"
                      placeholder="Mínimo 8 caracteres (A-Z, a-z, 0-9)"
                      name="newPassword"
                      error={touched.newPassword && Boolean(errors.newPassword)}
                      helperText={touched.newPassword && errors.newPassword}
                      autoComplete="new-password"
                      required
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              aria-label="Alternar visibilidade da nova senha"
                              onClick={togglePasswordVisibility}
                              edge="end"
                              size="small"
                            >
                              {showPassword ? (
                                <VisibilityOffOutlinedIcon fontSize="small" />
                              ) : (
                                <VisibilityOutlinedIcon fontSize="small" />
                              )}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <label htmlFor="confirmPassword" className={classes.fieldLabel}>
                      Confirmar nova senha
                    </label>
                    <Field
                      as={TextField}
                      variant="outlined"
                      fullWidth
                      type={showConfirmPassword ? "text" : "password"}
                      id="confirmPassword"
                      placeholder="Repita a nova senha"
                      name="confirmPassword"
                      error={
                        touched.confirmPassword && Boolean(errors.confirmPassword)
                      }
                      helperText={
                        touched.confirmPassword && errors.confirmPassword
                      }
                      autoComplete="new-password"
                      required
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              aria-label="Alternar visibilidade da confirmação"
                              onClick={toggleConfirmPasswordVisibility}
                              edge="end"
                              size="small"
                            >
                              {showConfirmPassword ? (
                                <VisibilityOffOutlinedIcon fontSize="small" />
                              ) : (
                                <VisibilityOutlinedIcon fontSize="small" />
                              )}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                </>
              )}
            </Grid>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="primary"
              className={classes.submit}
            >
              {showResetPasswordButton ? "Redefinir senha" : "Enviar código por e-mail"}
            </Button>

            <div className={classes.backRow}>
              <Link
                component={RouterLink}
                to="/login"
                className={classes.backLink}
              >
                Voltar ao login
              </Link>
            </div>

            {error && (
              <Typography variant="body2" color="error" style={{ marginTop: 12 }}>
                {error}
              </Typography>
            )}
          </Form>
        )}
      </Formik>
    </AuthShell>
  );
};

export default ForgetPassword;
