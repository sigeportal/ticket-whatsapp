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
		borderRadius: 18,
		maxWidth: 420,
		width: "100%",
		backgroundColor: "var(--bg-surface)",
		border: "1px solid var(--border-hairline)",
		boxShadow: "var(--shadow-dialog)",
	},
	dialogTitle: {
		padding: "20px 24px 14px",
		borderBottom: "1px solid var(--border-hairline)",
	},
	titleText: {
		fontFamily: "var(--font-display)",
		fontSize: "1.08rem",
		fontWeight: 700,
		color: "var(--ink-primary)",
	},
	dialogContent: {
		padding: "20px 24px",
		color: "var(--ink-secondary)",
	},
	dialogActions: {
		padding: "14px 24px 18px",
		borderTop: "1px solid var(--border-hairline)",
		gap: 10,
	},
	btnCancel: {
		borderRadius: 10,
		padding: "7px 18px",
		fontWeight: 600,
		fontSize: "0.84rem",
		color: "var(--ink-secondary)",
		borderColor: "var(--border-hairline)",
		"&:hover": {
			backgroundColor: "var(--bg-subtle)",
		},
	},
	btnConfirm: {
		borderRadius: 10,
		padding: "7px 20px",
		fontWeight: 700,
		fontSize: "0.84rem",
		backgroundColor: "var(--status-danger) !important",
		color: "#ffffff !important",
		boxShadow: "none",
		"&:hover": {
			backgroundColor: "#BE123C !important",
			boxShadow: "none",
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
