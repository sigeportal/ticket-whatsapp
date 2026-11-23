import React, { useState, useContext } from "react";
import { Link as RouterLink } from "react-router-dom";

import Button from "@material-ui/core/Button";
import CssBaseline from "@material-ui/core/CssBaseline";
import TextField from "@material-ui/core/TextField";
import Link from "@material-ui/core/Link";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import InputAdornment from "@material-ui/core/InputAdornment";
import { makeStyles } from "@material-ui/core/styles";
import MailOutlineIcon from "@material-ui/icons/MailOutline";
import LockOutlinedIcon from "@material-ui/icons/LockOutlined";
import VisibilityOutlinedIcon from "@material-ui/icons/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@material-ui/icons/VisibilityOffOutlined";

import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import AuthShell from "../../components/AuthShell";

const useStyles = makeStyles((theme) => ({
  header: {
    marginBottom: theme.spacing(3),
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
    fontSize: "1.6rem",
    letterSpacing: "-0.025em",
    color: "var(--ink-primary)",
    lineHeight: 1.2,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: "var(--font-sans)",
    color: "var(--ink-secondary)",
    fontSize: "0.9rem",
    lineHeight: 1.45,
  },
  form: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  fieldLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "0.82rem",
    fontWeight: 600,
    color: "var(--ink-primary)",
  },
  fieldRowHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inputIcon: {
    color: "var(--ink-muted)",
    fontSize: 19,
  },
  forgotLink: {
    color: "var(--action)",
    fontSize: "0.8125rem",
    fontWeight: 600,
    textDecoration: "none",
    "&:hover": {
      textDecoration: "underline",
    },
  },
  submitButton: {
    marginTop: 6,
    height: 46,
    borderRadius: 10,
    backgroundColor: "var(--action)",
    color: "var(--action-ink)",
    fontFamily: "var(--font-sans)",
    fontWeight: 700,
    fontSize: "0.9375rem",
    textTransform: "none",
    boxShadow: "none",
    "&:hover": {
      backgroundColor: "var(--action-hover)",
      boxShadow: "none",
    },
  },
  signupText: {
    marginTop: 8,
    textAlign: "center",
    fontSize: "0.875rem",
    color: "var(--ink-secondary)",
  },
  signupLink: {
    color: "var(--action)",
    fontWeight: 600,
    marginLeft: 6,
    textDecoration: "none",
    "&:hover": {
      textDecoration: "underline",
    },
  },
}));

const Login = () => {
  const classes = useStyles();

  const [user, setUser] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const { handleLogin } = useContext(AuthContext);
  const [viewregister] = useState("disabled");

  const handleChangeInput = (e) => {
    setUser({ ...user, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleLogin(user);
  };

  return (
    <AuthShell>
      <CssBaseline />
      <div className={classes.header}>
        <span className={classes.eyebrow}>Acesso ao painel</span>
        <Typography component="h1" className={classes.title}>
          Entrar na sua conta
        </Typography>
        <Typography variant="body2" className={classes.subtitle}>
          Informe seu e-mail corporativo e senha para abrir a central de atendimentos.
        </Typography>
      </div>

      <form className={classes.form} noValidate onSubmit={handleSubmit}>
        <div className={classes.fieldGroup}>
          <label htmlFor="email" className={classes.fieldLabel}>
            {i18n.t("login.form.email") || "E-mail"}
          </label>
          <TextField
            variant="outlined"
            required
            fullWidth
            id="email"
            placeholder="nome@empresa.com.br"
            name="email"
            value={user.email}
            onChange={handleChangeInput}
            autoComplete="email"
            autoFocus
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <MailOutlineIcon className={classes.inputIcon} />
                </InputAdornment>
              ),
            }}
          />
        </div>

        <div className={classes.fieldGroup}>
          <div className={classes.fieldRowHeader}>
            <label htmlFor="password" className={classes.fieldLabel}>
              {i18n.t("login.form.password") || "Senha"}
            </label>
            <Link
              component={RouterLink}
              to="/forgetpsw"
              className={classes.forgotLink}
            >
              Esqueceu sua senha?
            </Link>
          </div>
          <TextField
            variant="outlined"
            required
            fullWidth
            name="password"
            placeholder="Digite sua senha"
            type={showPassword ? "text" : "password"}
            id="password"
            value={user.password}
            onChange={handleChangeInput}
            autoComplete="current-password"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockOutlinedIcon className={classes.inputIcon} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    onClick={() => setShowPassword((prev) => !prev)}
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
        </div>

        <Button
          type="submit"
          fullWidth
          variant="contained"
          className={classes.submitButton}
        >
          {i18n.t("login.buttons.submit") || "Entrar na plataforma"}
        </Button>

        {viewregister === "enabled" && (
          <Typography className={classes.signupText}>
            Não tem uma conta?
            <Link
              component={RouterLink}
              to="/signup"
              className={classes.signupLink}
            >
              Cadastre-se
            </Link>
          </Typography>
        )}
      </form>
    </AuthShell>
  );
};

export default Login;
