import React, { useState, useEffect } from "react";
import qs from "query-string";

import * as Yup from "yup";
import { passwordSchema } from "../../utils/passwordSchema";
import { useHistory, Link as RouterLink } from "react-router-dom";
import { toast } from "react-toastify";
import { Formik, Form, Field } from "formik";
import usePlans from "../../hooks/usePlans";
import Button from "@material-ui/core/Button";
import CssBaseline from "@material-ui/core/CssBaseline";
import TextField from "@material-ui/core/TextField";
import Link from "@material-ui/core/Link";
import Grid from "@material-ui/core/Grid";
import InputMask from "react-input-mask";
import api, { openApi } from "../../services/api";
import { MenuItem, Select } from "@material-ui/core";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import moment from "moment";
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
  footerRow: {
    textAlign: "center",
    fontSize: "0.875rem",
    color: "var(--ink-secondary)",
  },
  loginLink: {
    color: "var(--action)",
    fontWeight: 600,
    textDecoration: "none",
    "&:hover": {
      textDecoration: "underline",
    },
  },
}));

const UserSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, "Muito curto")
    .max(50, "Muito longo")
    .required("Campo obrigatório"),
  password: passwordSchema.required("Campo obrigatório"),
  email: Yup.string().email("E-mail inválido").required("Campo obrigatório"),
});

const SignUp = () => {
  const classes = useStyles();
  const history = useHistory();
  const [allowregister, setallowregister] = useState("enabled");
  const [trial, settrial] = useState("3");
  let companyId = null;

  useEffect(() => {
    fetchallowregister();
    fetchtrial();
  }, []);

  const fetchtrial = async () => {
    try {
      const responsevvv = await api.get("/settings/trial");
      const allowtrialX = responsevvv.data.value;
      settrial(allowtrialX);
    } catch (error) {
      console.error("Error retrieving trial", error);
    }
  };

  const fetchallowregister = async () => {
    try {
      const responsevv = await api.get("/settings/allowregister");
      const allowregisterX = responsevv.data.value;
      setallowregister(allowregisterX);
    } catch (error) {
      console.error("Error retrieving allowregister", error);
    }
  };

  if (allowregister === "disabled") {
    history.push("/login");
  }

  const params = qs.parse(window.location.search);
  if (params.companyId !== undefined) {
    companyId = params.companyId;
  }

  const initialState = { name: "", email: "", phone: "", password: "", planId: "disabled" };

  const [user] = useState(initialState);
  const dueDate = moment().add(trial, "day").format();
  const handleSignUp = async (values) => {
    Object.assign(values, { recurrence: "MENSAL" });
    Object.assign(values, { dueDate: dueDate });
    Object.assign(values, { status: "t" });
    Object.assign(values, { campaignsEnabled: true });
    try {
      await openApi.post("/companies/cadastro", values);
      toast.success(i18n.t("signup.toasts.success"));
      history.push("/login");
    } catch (err) {
      console.log(err);
      toastError(err);
    }
  };

  const [plans, setPlans] = useState([]);
  const { register: listPlans } = usePlans();

  useEffect(() => {
    async function fetchData() {
      const list = await listPlans();
      setPlans(list);
    }
    fetchData();
  }, []);

  return (
    <AuthShell>
      <CssBaseline />
      <div className={classes.header}>
        <span className={classes.eyebrow}>Nova conta</span>
        <Typography component="h1" className={classes.title}>
          Criar ambiente da empresa
        </Typography>
        <Typography variant="body2" className={classes.subtitle}>
          Configure sua organização e escolha o plano para iniciar os atendimentos.
        </Typography>
      </div>

      <Formik
        initialValues={user}
        enableReinitialize={true}
        validationSchema={UserSchema}
        onSubmit={(values, actions) => {
          setTimeout(() => {
            handleSignUp(values);
            actions.setSubmitting(false);
          }, 400);
        }}
      >
        {({ touched, errors }) => (
          <Form className={classes.form}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <label htmlFor="name" className={classes.fieldLabel}>
                  Nome da empresa
                </label>
                <Field
                  as={TextField}
                  autoComplete="organization"
                  name="name"
                  error={touched.name && Boolean(errors.name)}
                  helperText={touched.name && errors.name}
                  variant="outlined"
                  fullWidth
                  id="name"
                  placeholder="Ex.: Portal Sistemas"
                />
              </Grid>

              <Grid item xs={12}>
                <label htmlFor="email" className={classes.fieldLabel}>
                  {i18n.t("signup.form.email") || "E-mail"}
                </label>
                <Field
                  as={TextField}
                  variant="outlined"
                  fullWidth
                  id="email"
                  placeholder="contato@empresa.com.br"
                  name="email"
                  error={touched.email && Boolean(errors.email)}
                  helperText={touched.email && errors.email}
                  autoComplete="email"
                  required
                />
              </Grid>

              <Grid item xs={12}>
                <label htmlFor="phone" className={classes.fieldLabel}>
                  WhatsApp / Telefone
                </label>
                <Field
                  as={InputMask}
                  mask="(99) 99999-9999"
                  variant="outlined"
                  fullWidth
                  id="phone"
                  name="phone"
                  error={touched.phone && Boolean(errors.phone)}
                  helperText={touched.phone && errors.phone}
                  autoComplete="tel"
                  required
                >
                  {({ field }) => (
                    <TextField
                      {...field}
                      variant="outlined"
                      fullWidth
                      id="phone"
                      placeholder="(67) 99999-9999"
                      inputProps={{ maxLength: 15 }}
                    />
                  )}
                </Field>
              </Grid>

              <Grid item xs={12}>
                <label htmlFor="password" className={classes.fieldLabel}>
                  {i18n.t("signup.form.password") || "Senha"}
                </label>
                <Field
                  as={TextField}
                  variant="outlined"
                  fullWidth
                  name="password"
                  error={touched.password && Boolean(errors.password)}
                  helperText={touched.password && errors.password}
                  placeholder="Mínimo 8 caracteres (A-Z, a-z, 0-9)"
                  type="password"
                  id="password"
                  autoComplete="new-password"
                  required
                />
              </Grid>

              <Grid item xs={12}>
                <label htmlFor="plan-selection" className={classes.fieldLabel}>
                  Plano
                </label>
                <Field
                  as={Select}
                  variant="outlined"
                  fullWidth
                  id="plan-selection"
                  name="planId"
                  required
                >
                  <MenuItem value="disabled" disabled>
                    <em>Selecione seu plano de assinatura</em>
                  </MenuItem>
                  {plans.map((plan, key) => (
                    <MenuItem key={key} value={plan.id}>
                      {plan.name} — {plan.connections} WhatsApps • {plan.users} Usuários • R${" "}
                      {plan.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </MenuItem>
                  ))}
                </Field>
              </Grid>
            </Grid>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="primary"
              className={classes.submit}
            >
              {i18n.t("signup.buttons.submit") || "Criar conta"}
            </Button>

            <div className={classes.footerRow}>
              <Link
                component={RouterLink}
                to="/login"
                className={classes.loginLink}
              >
                {i18n.t("signup.buttons.login") || "Já possui conta? Entrar"}
              </Link>
            </div>
          </Form>
        )}
      </Formik>
    </AuthShell>
  );
};

export default SignUp;
