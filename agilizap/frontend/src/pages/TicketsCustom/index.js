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
		padding: theme.spacing(0),
		height: `calc(100% - 64px)`,
		overflowY: "hidden",
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
		borderRight:
			theme.mode === "light"
				? "1px solid rgba(226, 232, 240, 0.9)"
				: "1px solid rgba(16, 185, 129, 0.15)",
	},
	messagesWrapper: {
		display: "flex",
		height: "100%",
		flexDirection: "column",
	},
	welcomeMsg: {
		backgroundColor: theme.mode === "light" ? "#f8fafc" : "#07130e",
		display: "flex",
		justifyContent: "center",
		alignItems: "center",
		height: "100%",
		textAlign: "center",
		border: "none",
	},
	welcomeCard: {
		maxWidth: 420,
		padding: "40px 32px",
		borderRadius: 24,
		backgroundColor: theme.mode === "light" ? "#ffffff" : "#0d2219",
		border:
			theme.mode === "light"
				? "1px solid rgba(226, 232, 240, 0.9)"
				: "1px solid rgba(16, 185, 129, 0.18)",
		boxShadow:
			theme.mode === "light"
				? "0 10px 25px -5px rgba(0, 0, 0, 0.05)"
				: "0 20px 25px -5px rgba(0, 0, 0, 0.4)",
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
	},
	logoWrapper: {
		marginBottom: 20,
		filter: "drop-shadow(0 10px 18px rgba(16, 185, 129, 0.25))",
	},
	welcomeTitle: {
		fontWeight: 800,
		fontSize: "1.35rem",
		color: theme.mode === "light" ? "#0f172a" : "#f0fdf4",
		"& span": {
			color: theme.mode === "light" ? "#065f46" : "#25d366",
		},
	},
	welcomeSubtitle: {
		fontSize: "0.6875rem",
		fontWeight: 700,
		letterSpacing: "0.15em",
		color: theme.mode === "light" ? "#059669" : "#34d399",
		opacity: 0.85,
		marginTop: 4,
		marginBottom: 16,
		textTransform: "uppercase",
	},
	welcomeText: {
		fontSize: "0.875rem",
		color: theme.mode === "light" ? "#475569" : "#94a3b8",
		lineHeight: 1.6,
		maxWidth: 320,
		marginBottom: 20,
	},
	actionBtn: {
		borderRadius: 12,
		padding: "8px 20px",
		fontWeight: 700,
		textTransform: "none",
		fontSize: "0.8125rem",
		boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)",
		backgroundColor: theme.mode === "light" ? "#10b981" : "#10b981",
		color: "#ffffff",
		"&:hover": {
			backgroundColor: theme.mode === "light" ? "#059669" : "#059669",
			boxShadow: "0 6px 16px rgba(16, 185, 129, 0.35)",
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
							<>
								<Ticket />
							</>
						) : (
							<Paper square variant="outlined" className={classes.welcomeMsg}>
								<div className={classes.welcomeCard}>
									<div className={classes.logoWrapper}>
										<PortAiLogo variant="icon" size={84} />
									</div>
									<Typography variant="h6" className={classes.welcomeTitle}>
										Central <span>PortAI</span>
									</Typography>
									<Typography variant="caption" className={classes.welcomeSubtitle}>
										BY PORTAL • SMART CX
									</Typography>
									<Typography variant="body2" className={classes.welcomeText}>
										{i18n.t("chat.noTicketMessage") ||
											"Selecione uma conversa ao lado para iniciar o atendimento."}
									</Typography>
									<button
										type="button"
										className={classes.actionBtn}
										onClick={() => setNewTicketModalOpen(true)}
										style={{
											display: "inline-flex",
											alignItems: "center",
											gap: 8,
											cursor: "pointer",
											border: "none",
										}}
									>
										<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
