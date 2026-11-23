import React, { useState, useContext } from "react";
import { makeStyles } from "@material-ui/core/styles";

import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Grid from "@material-ui/core/Grid";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";

import SubscriptionModal from "../../components/SubscriptionModal";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import MainContainer from "../../components/MainContainer";

import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(3),
    borderRadius: 14,
    border: "1px solid var(--border-hairline)",
    backgroundColor: "var(--bg-surface)",
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    boxShadow: "none",
  },
  eyebrow: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.7rem",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--action)",
  },
  cardHeading: {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: "1.1rem",
    color: "var(--ink-primary)",
  },
  ctaButton: {
    marginTop: theme.spacing(1),
    height: 44,
    fontWeight: 700,
  },
}));

const _formatDate = (date) => {
  const now = new Date();
  const past = new Date(date);
  const diff = Math.abs(now.getTime() - past.getTime());
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return days;
};

const Subscription = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);

  const [selectedContactId, setSelectedContactId] = useState(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);

  const handleOpenContactModal = () => {
    setSelectedContactId(null);
    setContactModalOpen(true);
  };

  const handleCloseContactModal = () => {
    setSelectedContactId(null);
    setContactModalOpen(false);
  };

  return (
    <MainContainer>
      <SubscriptionModal
        open={contactModalOpen}
        onClose={handleCloseContactModal}
        aria-labelledby="form-dialog-title"
        contactId={selectedContactId}
      />

      <MainHeader>
        <Title>Assinatura</Title>
      </MainHeader>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6} lg={5}>
          <Paper className={classes.mainPaper} elevation={0}>
            <div>
              <span className={classes.eyebrow}>Status da licença</span>
              <Typography className={classes.cardHeading}>
                Dados da assinatura da empresa
              </Typography>
            </div>

            <TextField
              id="trial-period"
              label="Período de teste"
              defaultValue={`Seu período de teste termina em ${_formatDate(
                user?.company?.trialExpiration
              )} dias!`}
              fullWidth
              InputLabelProps={{ shrink: true }}
              InputProps={{ readOnly: true }}
              variant="outlined"
            />

            <TextField
              id="billing-email"
              label="E-mail de cobrança"
              defaultValue={user?.company?.email || ""}
              fullWidth
              InputLabelProps={{ shrink: true }}
              InputProps={{ readOnly: true }}
              variant="outlined"
            />

            <Button
              variant="contained"
              color="primary"
              onClick={handleOpenContactModal}
              fullWidth
              className={classes.ctaButton}
            >
              Gerenciar assinatura
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </MainContainer>
  );
};

export default Subscription;
