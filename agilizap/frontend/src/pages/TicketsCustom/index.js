import React from "react";
import { useParams } from "react-router-dom";
import Grid from "@material-ui/core/Grid";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";

import TicketsManager from "../../components/TicketsManagerTabs/";
import Ticket from "../../components/Ticket/";
import PortAiLogo from "../../components/PortAiLogo";
import NewTicketModal from "../../components/NewTicketModal";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  chatContainer: {
    flex: 1,
    padding: 0,
    height: "calc(100% - 64px)",
    overflowY: "hidden",
    backgroundColor: "var(--bg-canvas)",
  },
  chatPapper: {
    display: "flex",
    height: "100%",
  },
  contactsWrapper: {
    display: "flex",
    height: "100%",
    flexDirection: "column",
    overflowY: "hidden",
    borderRight: "1px solid var(--border-hairline)",
  },
  messagesWrapper: {
    display: "flex",
    height: "100%",
    flexDirection: "column",
  },
  welcomeMsg: {
    backgroundColor: "var(--bg-canvas)",
    backgroundImage: "radial-gradient(rgba(16, 185, 129, 0.14) 1px, transparent 1px)",
    backgroundSize: "24px 24px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
    textAlign: "center",
    border: "none",
    padding: theme.spacing(3),
  },
  welcomeCard: {
    maxWidth: 440,
    width: "100%",
    padding: "40px 34px",
    borderRadius: 18,
    backgroundColor: "var(--bg-surface)",
    border: "1px solid var(--border-hairline)",
    boxShadow: "var(--shadow-card)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  logoWrapper: {
    marginBottom: 20,
  },
  eyebrow: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.68rem",
    fontWeight: 600,
    letterSpacing: "0.14em",
    color: "var(--action)",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  welcomeTitle: {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: "1.4rem",
    letterSpacing: "-0.025em",
    color: "var(--ink-primary)",
    marginBottom: 10,
    "& span": {
      color: "var(--action)",
    },
  },
  welcomeText: {
    fontFamily: "var(--font-sans)",
    fontSize: "0.9rem",
    color: "var(--ink-secondary)",
    lineHeight: 1.55,
    maxWidth: 330,
    marginBottom: 24,
  },
  actionBtn: {
    borderRadius: 10,
    height: 44,
    padding: "0 22px",
    fontFamily: "var(--font-sans)",
    fontWeight: 600,
    textTransform: "none",
    fontSize: "0.875rem",
    backgroundColor: "var(--action)",
    color: "var(--action-ink)",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
    border: "none",
    transition: "background-color var(--t-in) var(--ease-ui), transform var(--t-in) var(--ease-ui)",
    "&:hover": {
      backgroundColor: "var(--action-hover)",
      transform: "translateY(-1px)",
    },
    "&:active": {
      transform: "scale(0.985)",
    },
  },
}));

const TicketsCustom = () => {
  const classes = useStyles();
  const { ticketId } = useParams();
  const [newTicketModalOpen, setNewTicketModalOpen] = React.useState(false);

  return (
    <div className={classes.chatContainer}>
      <NewTicketModal
        modalOpen={newTicketModalOpen}
        onClose={() => setNewTicketModalOpen(false)}
      />
      <div className={classes.chatPapper}>
        <Grid container spacing={0}>
          <Grid item xs={4} className={classes.contactsWrapper}>
            <TicketsManager />
          </Grid>
          <Grid item xs={8} className={classes.messagesWrapper}>
            {ticketId ? (
              <Ticket />
            ) : (
              <Paper square variant="outlined" className={classes.welcomeMsg}>
                <div className={classes.welcomeCard}>
                  <div className={classes.logoWrapper}>
                    <PortAiLogo variant="icon" size={76} />
                  </div>
                  <span className={classes.eyebrow}>BY PORTAL • SMART CX</span>
                  <Typography variant="h6" className={classes.welcomeTitle}>
                    Central <span>PortAI</span>
                  </Typography>
                  <Typography variant="body2" className={classes.welcomeText}>
                    {i18n.t("chat.noTicketMessage") ||
                      "Selecione uma conversa na lista ao lado ou inicie um novo atendimento."}
                  </Typography>
                  <button
                    type="button"
                    className={classes.actionBtn}
                    onClick={() => setNewTicketModalOpen(true)}
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span>Novo Atendimento</span>
                  </button>
                </div>
              </Paper>
            )}
          </Grid>
        </Grid>
      </div>
    </div>
  );
};

export default TicketsCustom;
