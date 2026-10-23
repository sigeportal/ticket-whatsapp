import React, { useState, useContext, useEffect } from "react";
import { Link as RouterLink } from "react-router-dom";

import Button from "@material-ui/core/Button";
import CssBaseline from "@material-ui/core/CssBaseline";
import TextField from "@material-ui/core/TextField";
import Link from "@material-ui/core/Link";
import Grid from "@material-ui/core/Grid";
import Container from "@material-ui/core/Container";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";
import { makeStyles } from "@material-ui/core/styles";
import LockOutlinedIcon from "@material-ui/icons/LockOutlined";
import EmailOutlinedIcon from "@material-ui/icons/EmailOutlined";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import PortAiLogo from "../../components/PortAiLogo";

const useStyles = makeStyles(theme => ({
  root: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #07130e 0%, #0b1e16 45%, #064e3b 100%)",
    padding: theme.spacing(2),
    position: "relative",
    overflow: "hidden",
    "&::before": {
      content: '""',
      position: "absolute",
      top: "-10%",
      right: "-10%",
      width: "500px",
      height: "500px",
      borderRadius: "50%",
      background: "radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, transparent 70%)",
      pointerEvents: "none",
    },
    "&::after": {
      content: '""',
      position: "absolute",
      bottom: "-10%",
      left: "-10%",
      width: "500px",
      height: "500px",
      borderRadius: "50%",
      background: "radial-gradient(circle, rgba(52, 211, 153, 0.2) 0%, transparent 70%)",
      pointerEvents: "none",
    }
  },
  card: {
    background: "#ffffff",
    borderRadius: "20px",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
    padding: theme.spacing(5, 4),
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    maxWidth: "420px",
    width: "100%",
    position: "relative",
    zIndex: 1,
    border: "1px solid rgba(255, 255, 255, 0.2)",
  },
  logoContainer: {
    marginBottom: theme.spacing(3),
    textAlign: "center",
  },
  portalBrandLogin: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    justifyContent: "center",
  },
  portalLogoBadgeLogin: {
    width: 48,
    height: 48,
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 8px 20px rgba(16, 185, 129, 0.35)",
  },
  portalTextWrapperLogin: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
  },
  portalTitleLogin: {
    fontFamily: "'Montserrat', sans-serif",
    fontSize: "1.5rem",
    fontWeight: 800,
    letterSpacing: "0.08em",
    color: "#0f172a",
    lineHeight: 1.1,
  },
  portalSubtitleLogin: {
    fontSize: "0.7rem",
    fontWeight: 700,
    letterSpacing: "0.18em",
    color: "#10b981",
    lineHeight: 1.3,
    marginTop: 2,
  },
  title: {
    fontWeight: 700,
    fontFamily: "Inter, Montserrat, sans-serif",
    color: "#111827",
    fontSize: "1.5rem",
    marginBottom: theme.spacing(0.5),
  },
  subtitle: {
    color: "#6b7280",
    fontSize: "0.875rem",
    marginBottom: theme.spacing(3),
  },
  form: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2.5),
  },
  input: {
    "& .MuiOutlinedInput-root": {
      borderRadius: "10px",
      backgroundColor: "#f9fafb",
      transition: "all 0.2s ease-in-out",
      "&:hover": {
        backgroundColor: "#ffffff",
      },
      "&.Mui-focused": {
        backgroundColor: "#ffffff",
        boxShadow: "0 0 0 3px rgba(16, 185, 129, 0.15)",
      },
    },
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: "#e5e7eb",
    },
  },
  submitButton: {
    marginTop: theme.spacing(1),
    padding: theme.spacing(1.4),
    borderRadius: "10px",
    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    color: "#ffffff",
    fontWeight: 600,
    fontSize: "0.95rem",
    textTransform: "none",
    boxShadow: "0 4px 12px rgba(16, 185, 129, 0.35)",
    transition: "all 0.2s ease",
    "&:hover": {
      background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
      boxShadow: "0 6px 16px rgba(16, 185, 129, 0.45)",
    },
  },
  forgotLink: {
    color: "#10b981",
    fontSize: "0.85rem",
    fontWeight: 500,
    textDecoration: "none",
    "&:hover": {
      textDecoration: "underline",
    },
  },
  signupText: {
    marginTop: theme.spacing(2),
    textAlign: "center",
    fontSize: "0.875rem",
    color: "#6b7280",
  },
  signupLink: {
    color: "#10b981",
    fontWeight: 600,
    marginLeft: theme.spacing(0.5),
    textDecoration: "none",
    "&:hover": {
      textDecoration: "underline",
    },
  },
}));

const Login = () => {
  const classes = useStyles();

  const [user, setUser] = useState({ email: "", password: "" });
  const { handleLogin } = useContext(AuthContext);
  const [viewregister, setviewregister] = useState("disabled");

  const handleChangeInput = e => {
    setUser({ ...user, [e.target.name]: e.target.value });
  };

  const handleSubmit = e => {
    e.preventDefault();
    handleLogin(user);
  };

  return (
    <div className={classes.root}>
      <CssBaseline />
      <div className={classes.card}>
        <div className={classes.logoContainer}>
          <PortAiLogo variant="full" width={220} height={75} themeMode="light" />
        </div>

        <Typography component="h1" className={classes.title}>
          Bem-vindo de volta
        </Typography>
        <Typography variant="body2" className={classes.subtitle}>
          Entre com suas credenciais para continuar
        </Typography>

        <form className={classes.form} noValidate onSubmit={handleSubmit}>
          <TextField
            variant="outlined"
            required
            fullWidth
            id="email"
            label={i18n.t("login.form.email") || "E-mail"}
            name="email"
            value={user.email}
            onChange={handleChangeInput}
            autoComplete="email"
            autoFocus
            className={classes.input}
            size="small"
          />

          <TextField
            variant="outlined"
            required
            fullWidth
            name="password"
            label={i18n.t("login.form.password") || "Senha"}
            type="password"
            id="password"
            value={user.password}
            onChange={handleChangeInput}
            autoComplete="current-password"
            className={classes.input}
            size="small"
          />


          <Box display="flex" justifyContent="flex-end">
            <Link
              component={RouterLink}
              to="/forgetpsw"
              className={classes.forgotLink}
            >
              Esqueceu sua senha?
            </Link>
          </Box>

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
      </div>
    </div>
  );
};

export default Login;
