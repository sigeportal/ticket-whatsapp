import React from "react";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";

import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
	dialogPaper: {
		borderRadius: 16,
		maxWidth: 420,
		width: "100%",
		backgroundColor: theme.palette.type === "dark" ? "#0b1e16" : "#ffffff",
		border: `1px solid ${
			theme.palette.type === "dark"
				? "rgba(16, 185, 129, 0.2)"
				: "rgba(226, 232, 240, 0.9)"
		}`,
		boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
	},
	dialogTitle: {
		padding: "18px 24px 12px",
		borderBottom: `1px solid ${
			theme.palette.type === "dark"
				? "rgba(16, 185, 129, 0.15)"
				: "#f1f5f9"
		}`,
	},
	titleText: {
		fontSize: "1.1rem",
		fontWeight: 700,
		color: theme.palette.type === "dark" ? "#f0fdf4" : "#0f172a",
	},
	dialogContent: {
		padding: "20px 24px",
		color: theme.palette.type === "dark" ? "#cbd5e1" : "#475569",
	},
	dialogActions: {
		padding: "14px 24px 18px",
		borderTop: `1px solid ${
			theme.palette.type === "dark"
				? "rgba(16, 185, 129, 0.15)"
				: "#f1f5f9"
		}`,
		gap: 10,
	},
	btnCancel: {
		borderRadius: 10,
		padding: "7px 18px",
		fontWeight: 600,
		fontSize: "0.84rem",
		color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
		borderColor: theme.palette.type === "dark" ? "rgba(255, 255, 255, 0.15)" : "rgba(226, 232, 240, 0.9)",
		"&:hover": {
			backgroundColor: theme.palette.type === "dark" ? "rgba(255, 255, 255, 0.06)" : "#f8fafc",
		},
	},
	btnConfirm: {
		borderRadius: 10,
		padding: "7px 20px",
		fontWeight: 700,
		fontSize: "0.84rem",
		background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important",
		color: "#ffffff !important",
		boxShadow: "0 2px 8px rgba(239, 68, 68, 0.3)",
		"&:hover": {
			background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%) !important",
			boxShadow: "0 4px 12px rgba(239, 68, 68, 0.4)",
		},
	},
}));

const ConfirmationModal = ({ title, children, open, onClose, onConfirm }) => {
	const classes = useStyles();

	return (
		<Dialog
			open={open}
			onClose={() => onClose(false)}
			classes={{ paper: classes.dialogPaper }}
			aria-labelledby="confirm-dialog"
		>
			<DialogTitle className={classes.dialogTitle} disableTypography id="confirm-dialog">
				<Typography className={classes.titleText}>{title}</Typography>
			</DialogTitle>
			<DialogContent className={classes.dialogContent}>
				<Typography>{children}</Typography>
			</DialogContent>
			<DialogActions className={classes.dialogActions}>
				<Button
					variant="outlined"
					onClick={() => onClose(false)}
					className={classes.btnCancel}
				>
					{i18n.t("confirmationModal.buttons.cancel")}
				</Button>
				<Button
					variant="contained"
					onClick={() => {
						onClose(false);
						onConfirm();
					}}
					className={classes.btnConfirm}
				>
					{i18n.t("confirmationModal.buttons.confirm")}
				</Button>
			</DialogActions>
		</Dialog>
	);
};

export default ConfirmationModal;
