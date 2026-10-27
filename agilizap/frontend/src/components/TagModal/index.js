import React, { useState, useEffect, useContext } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import CircularProgress from "@material-ui/core/CircularProgress";
import { Colorize } from "@material-ui/icons";
import { ColorBox } from 'material-ui-color';

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { IconButton, InputAdornment } from "@material-ui/core";
import { FormControlLabel, Switch } from '@material-ui/core';
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import InputLabel from "@material-ui/core/InputLabel";
import Checkbox from '@material-ui/core/Checkbox';

const useStyles = makeStyles(theme => ({
	root: {
		display: "flex",
		flexWrap: "wrap",
	},
	dialogPaper: {
		borderRadius: 16,
		maxWidth: 460,
		width: "100%",
		backgroundColor: theme.palette.type === "dark" ? "#0b1e16" : "#ffffff",
		border: `1px solid ${
			theme.palette.type === "dark"
				? "rgba(16, 185, 129, 0.2)"
				: "rgba(226, 232, 240, 0.9)"
		}`,
		boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
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
	btnSave: {
		borderRadius: 10,
		padding: "7px 22px",
		fontWeight: 700,
		fontSize: "0.84rem",
		background: "linear-gradient(135deg, #10b981 0%, #0d9488 100%) !important",
		color: "#ffffff !important",
		boxShadow: "0 2px 8px rgba(16, 185, 129, 0.25)",
		"&:hover": {
			background: "linear-gradient(135deg, #059669 0%, #047857 100%) !important",
			boxShadow: "0 4px 12px rgba(16, 185, 129, 0.4)",
		},
	},
	multFieldLine: {
		display: "flex",
		"& > *:not(:last-child)": {
			marginRight: theme.spacing(1),
		},
	},

	btnWrapper: {
		position: "relative",
	},

	buttonProgress: {
		color: green[500],
		position: "absolute",
		top: "50%",
		left: "50%",
		marginTop: -12,
		marginLeft: -12,
	},
	formControl: {
		margin: theme.spacing(1),
		minWidth: 120,
	},
	colorAdorment: {
		width: 20,
		height: 20,
	},
}));

const TagSchema = Yup.object().shape({
	name: Yup.string()
		.min(3, "Mensagem muito curta")
		.required("Obrigatório")
});

const TagModal = ({ open, onClose, tagId, reload }) => {
	const classes = useStyles();
	const { user } = useContext(AuthContext);
	const [colorPickerModalOpen, setColorPickerModalOpen] = useState(false);

	const initialState = {
		name: "",
		color: "",
		kanban: 0
	};

	const [tag, setTag] = useState(initialState);
	const [ kanban, setKanban] = useState(0);

	useEffect(() => {
		try {
			(async () => {
				if (!tagId) return;

				const { data } = await api.get(`/tags/${tagId}`);
				setKanban(data.kanban);
				setTag(prevState => {
					return { ...prevState, ...data };
				});
			})()
		} catch (err) {
			toastError(err);
		}
	}, [tagId, open]);

	const handleClose = () => {
		setTag(initialState);
		setColorPickerModalOpen(false);
		onClose();
	};

	const handleKanbanChange = (e) => {
		setKanban( e.target.checked ? 1 : 0);
	};

	const handleSaveTag = async values => {
		const tagData = { ...values, userId: user.id, kanban };
		try {
			if (tagId) {
				await api.put(`/tags/${tagId}`, tagData);
			} else {
				await api.post("/tags", tagData);
			}
			toast.success(i18n.t("tagModal.success"));
			if (typeof reload == 'function') {
				reload();
			}
		} catch (err) {
			toastError(err);
			return;
		}
		handleClose();
	};

	return (
		<div className={classes.root}>
			<Dialog
				open={open}
				onClose={handleClose}
				classes={{ paper: classes.dialogPaper }}
				maxWidth="xs"
				fullWidth
				scroll="paper"
			>
				<DialogTitle id="form-dialog-title">
					{(tagId ? `${i18n.t("tagModal.title.edit")}` : `${i18n.t("tagModal.title.add")}`)}
				</DialogTitle>
				<Formik
					initialValues={tag}
					enableReinitialize={true}
					validationSchema={TagSchema}
					onSubmit={handleSaveTag}
				>
					{({ touched, errors, isSubmitting, values }) => (
						<Form>
							<DialogContent dividers>
								<div className={classes.multFieldLine}>
									<Field
										as={TextField}
										label={i18n.t("tagModal.form.name")}
										name="name"
										error={touched.name && Boolean(errors.name)}
										helperText={touched.name && errors.name}
										variant="outlined"
										margin="dense"
										onChange={(e) => setTag(prev => ({ ...prev, name: e.target.value }))}
										fullWidth
									/>
								</div>
								<br />
								<div className={classes.multFieldLine}>
									<Field
										as={TextField}
										fullWidth
										label={i18n.t("tagModal.form.color")}
										name="color"
										id="color"
										error={touched.color && Boolean(errors.color)}
										helperText={touched.color && errors.color}
										InputProps={{
											startAdornment: (
												<InputAdornment position="start">
													<div
														style={{ backgroundColor: values.color }}
														className={classes.colorAdorment}
													></div>
												</InputAdornment>
											),
											endAdornment: (
												<IconButton
													size="small"
													color="default"
													onClick={() => setColorPickerModalOpen(!colorPickerModalOpen)}
												>
													<Colorize />
												</IconButton>
											),
										}}
										variant="outlined"
										margin="dense"
									/>
								</div>
								{(user.profile === "admin" || user.profile === "supervisor") && (
                                <>
								<div className={classes.multFieldLine}>
        							<FormControlLabel
          								control={
            								<Checkbox
             									checked={kanban === 1}
             									onChange={handleKanbanChange}
              									value={kanban}
              									color="primary"
            								/>
          								}
          								label="Kanban"
          								labelPlacement="start"
        							/>
      							</div>
      							<br />
                                </>
								)}
								{colorPickerModalOpen && (
									<div>
										<ColorBox
											disableAlpha={true}
											hslGradient={false}
											style={{ margin: '20px auto 0' }}
											value={tag.color}
											onChange={val => {
												setTag(prev => ({ ...prev, color: `#${val.hex}` }));
											}}
										/>
									</div>
								)}
							</DialogContent>
							<DialogActions>
								<Button
									onClick={handleClose}
									className={classes.btnCancel}
									disabled={isSubmitting}
									variant="outlined"
								>
									{i18n.t("tagModal.buttons.cancel")}
								</Button>
								<Button
									type="submit"
									disabled={isSubmitting}
									variant="contained"
									className={`${classes.btnWrapper} ${classes.btnSave}`}
								>
									{tagId
										? `${i18n.t("tagModal.buttons.okEdit")}`
										: `${i18n.t("tagModal.buttons.okAdd")}`}
									{isSubmitting && (
										<CircularProgress
											size={24}
											className={classes.buttonProgress}
										/>
									)}
								</Button>
							</DialogActions>
						</Form>
					)}
				</Formik>
			</Dialog>
		</div>
	);
};

export default TagModal;
