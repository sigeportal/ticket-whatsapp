import React, { useState, useEffect, useContext } from "react";
import { useParams } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import Box from "@material-ui/core/Box";
import BottomNavigation from "@material-ui/core/BottomNavigation";
import BottomNavigationAction from "@material-ui/core/BottomNavigationAction";
import QuestionAnswerIcon from "@material-ui/icons/QuestionAnswer";
import ChatIcon from "@material-ui/icons/Chat";
import Typography from "@material-ui/core/Typography";

import TicketsManagerTabs from "../../components/TicketsManagerTabs/";
import Ticket from "../../components/Ticket/";
import TicketAdvancedLayout from "../../components/TicketAdvancedLayout";
import { TicketsContext } from "../../context/Tickets/TicketsContext";
import PortAiLogo from "../../components/PortAiLogo";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  header: {
    borderBottom: "1px solid var(--border-hairline)",
    backgroundColor: "var(--bg-surface)",
  },
  bottomNav: {
    backgroundColor: "var(--bg-surface)",
    "& .MuiBottomNavigationAction-root": {
      color: "var(--ink-muted)",
    },
    "& .Mui-selected": {
      color: "var(--action)",
    },
  },
  content: {
    overflow: "auto",
  },
  placeholderContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    padding: theme.spacing(3),
    backgroundColor: "var(--bg-canvas)",
    backgroundImage: "radial-gradient(rgba(16, 185, 129, 0.14) 1px, transparent 1px)",
    backgroundSize: "24px 24px",
  },
  placeholderCard: {
    maxWidth: 400,
    width: "100%",
    padding: "36px 28px",
    borderRadius: 18,
    backgroundColor: "var(--bg-surface)",
    border: "1px solid var(--border-hairline)",
    boxShadow: "var(--shadow-card)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  },
  eyebrow: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.68rem",
    fontWeight: 600,
    letterSpacing: "0.14em",
    color: "var(--action)",
    textTransform: "uppercase",
    marginTop: 18,
    marginBottom: 6,
  },
  title: {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: "1.35rem",
    color: "var(--ink-primary)",
    marginBottom: 8,
    "& span": {
      color: "var(--action)",
    },
  },
  bodyText: {
    fontSize: "0.875rem",
    color: "var(--ink-secondary)",
    lineHeight: 1.55,
    marginBottom: 22,
  },
}));

const TicketAdvanced = () => {
  const classes = useStyles();
  const { ticketId } = useParams();
  const [option, setOption] = useState(0);
  const { currentTicket, setCurrentTicket } = useContext(TicketsContext);

  useEffect(() => {
    if (currentTicket.id !== null) {
      setCurrentTicket({ id: currentTicket.id, code: "#open" });
    }
    if (!ticketId) {
      setOption(1);
    }
    return () => {
      setCurrentTicket({ id: null, code: null });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (currentTicket.id !== null) {
      setOption(0);
    }
  }, [currentTicket]);

  const renderPlaceholder = () => {
    return (
      <Box className={classes.placeholderContainer}>
        <div className={classes.placeholderCard}>
          <PortAiLogo variant="icon" size={76} />
          <span className={classes.eyebrow}>BY PORTAL • SMART CX</span>
          <Typography variant="h6" className={classes.title}>
            Central <span>PortAI</span>
          </Typography>
          <Typography variant="body2" className={classes.bodyText}>
            {i18n.t("chat.noTicketMessage") ||
              "Selecione uma conversa ao lado para iniciar o atendimento."}
          </Typography>
          <Button
            onClick={() => setOption(1)}
            variant="contained"
            color="primary"
          >
            Selecionar Ticket
          </Button>
        </div>
      </Box>
    );
  };

  const renderMessageContext = () => {
    if (ticketId) {
      return <Ticket />;
    }
    return renderPlaceholder();
  };

  const renderTicketsManagerTabs = () => {
    return <TicketsManagerTabs />;
  };

  return (
    <TicketAdvancedLayout>
      <Box className={classes.header}>
        <BottomNavigation
          value={option}
          onChange={(event, newValue) => {
            setOption(newValue);
          }}
          showLabels
          className={classes.bottomNav}
        >
          <BottomNavigationAction label="Ticket" icon={<ChatIcon />} />
          <BottomNavigationAction label="Atendimentos" icon={<QuestionAnswerIcon />} />
        </BottomNavigation>
      </Box>
      <Box className={classes.content}>
        {option === 0 ? renderMessageContext() : renderTicketsManagerTabs()}
      </Box>
    </TicketAdvancedLayout>
  );
};

export default TicketAdvanced;
