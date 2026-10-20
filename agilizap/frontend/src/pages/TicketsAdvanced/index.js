import React, { useState, useEffect, useContext } from "react";
import { useParams } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import Button from '@material-ui/core/Button';
import Box from '@material-ui/core/Box';
import BottomNavigation from '@material-ui/core/BottomNavigation';
import BottomNavigationAction from '@material-ui/core/BottomNavigationAction';
import QuestionAnswerIcon from '@material-ui/icons/QuestionAnswer';
import ChatIcon from '@material-ui/icons/Chat';

import TicketsManagerTabs from "../../components/TicketsManagerTabs/";
import Ticket from "../../components/Ticket/";
import TicketAdvancedLayout from "../../components/TicketAdvancedLayout";
import { TicketsContext } from "../../context/Tickets/TicketsContext";
import Typography from '@material-ui/core/Typography';
import PortAiLogo from "../../components/PortAiLogo";

import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
    header: {
    },
    content: {
        overflow: "auto"
    },
    placeholderContainer: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
		backgroundColor: theme.palette.boxticket, //DARK MODE Multiconversa//
    },
    placeholderItem: {
    }
}));

const TicketAdvanced = (props) => {
	const classes = useStyles();
	const { ticketId } = useParams();
	const [option, setOption] = useState(0);
    const { currentTicket, setCurrentTicket } = useContext(TicketsContext)

    useEffect(() => {
        if(currentTicket.id !== null) {
            setCurrentTicket({ id: currentTicket.id, code: '#open' })
        }
        if (!ticketId) {
            setOption(1)
        }
        return () => {
            setCurrentTicket({ id: null, code: null })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (currentTicket.id !== null) {
            setOption(0)
        }
    }, [currentTicket])


	const renderPlaceholder = () => {
		return (
			<Box className={classes.placeholderContainer}>
				<div style={{
					maxWidth: 420,
					padding: "40px 32px",
					borderRadius: 24,
					backgroundColor: "transparent",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					textAlign: "center"
				}}>
					<div style={{ marginBottom: 20, filter: "drop-shadow(0 10px 18px rgba(16, 185, 129, 0.25))" }}>
						<PortAiLogo variant="icon" size={84} />
					</div>
					<Typography variant="h6" style={{ fontWeight: 800, fontSize: "1.35rem", marginBottom: 4 }}>
						Central <span style={{ color: "#10b981" }}>PortAI</span>
					</Typography>
					<Typography variant="caption" style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.15em", color: "#10b981", opacity: 0.85, marginBottom: 16, textTransform: "uppercase" }}>
						BY PORTAL • SMART CX
					</Typography>
					<Typography variant="body2" style={{ fontSize: "0.875rem", color: "#94a3b8", lineHeight: 1.6, maxWidth: 320, marginBottom: 24 }}>
						{i18n.t("chat.noTicketMessage") || "Selecione uma conversa ao lado para iniciar o atendimento."}
					</Typography>
					<Button onClick={() => setOption(1)} variant="contained" color="primary" style={{ borderRadius: 12, padding: "8px 24px", fontWeight: 700, textTransform: "none" }}>
						Selecionar Ticket
					</Button>
				</div>
			</Box>
		);
	};

	const renderMessageContext = () => {
		if (ticketId) {
			return <Ticket />
		}
		return renderPlaceholder()
	}

	const renderTicketsManagerTabs = () => {
		return <TicketsManagerTabs />
	}

	return (
        <TicketAdvancedLayout>
            <Box className={classes.header}>
                <BottomNavigation
                    value={option}
                    onChange={(event, newValue) => {
                        setOption(newValue);
                    }}
                    showLabels
                    className={classes.root}
                >
                    <BottomNavigationAction label="Ticket" icon={<ChatIcon />} />
                    <BottomNavigationAction label="Atendimentos" icon={<QuestionAnswerIcon />} />
                </BottomNavigation>
            </Box>
            <Box className={classes.content}>
                { option === 0 ? renderMessageContext() : renderTicketsManagerTabs() }
            </Box>
        </TicketAdvancedLayout>
	);
};

export default TicketAdvanced;
