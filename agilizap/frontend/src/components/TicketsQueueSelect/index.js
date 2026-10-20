import React from "react";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import Select from "@material-ui/core/Select";
import { Checkbox, ListItemText, makeStyles } from "@material-ui/core";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
	formControl: {
		width: 120,
		margin: 0,
	},
	select: {
		borderRadius: 10,
		fontSize: "0.8125rem",
		fontWeight: 600,
		backgroundColor:
			theme.palette.type === "dark"
				? "rgba(255, 255, 255, 0.05)"
				: "rgba(0, 0, 0, 0.03)",
		color: theme.palette.type === "dark" ? "#f0fdf4" : "#1e293b",
		"& .MuiOutlinedInput-notchedOutline": {
			borderColor:
				theme.palette.type === "dark"
					? "rgba(16, 185, 129, 0.2)"
					: "rgba(226, 232, 240, 0.9)",
			borderRadius: 10,
		},
		"&:hover .MuiOutlinedInput-notchedOutline": {
			borderColor: "#10b981",
		},
		"&.Mui-focused .MuiOutlinedInput-notchedOutline": {
			borderColor: "#10b981",
			borderWidth: "1.5px",
		},
		"& .MuiSelect-select": {
			padding: "7px 12px",
		},
		"& .MuiSelect-icon": {
			color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
		},
	},
	menuPaper: {
		borderRadius: 12,
		marginTop: 4,
		backgroundColor: theme.palette.type === "dark" ? "#0b1e16" : "#ffffff",
		border:
			theme.palette.type === "dark"
				? "1px solid rgba(16, 185, 129, 0.2)"
				: "1px solid rgba(226, 232, 240, 0.9)",
		boxShadow:
			theme.palette.type === "dark"
				? "0 10px 25px -5px rgba(0, 0, 0, 0.5)"
				: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
	},
}));

const TicketsQueueSelect = ({
	userQueues,
	selectedQueueIds = [],
	onChange,
}) => {
	const classes = useStyles();

	const handleChange = (e) => {
		onChange(e.target.value);
	};

	return (
		<div style={{ width: 120 }}>
			<FormControl fullWidth margin="none" className={classes.formControl}>
				<Select
					multiple
					displayEmpty
					variant="outlined"
					className={classes.select}
					value={selectedQueueIds}
					onChange={handleChange}
					MenuProps={{
						anchorOrigin: {
							vertical: "bottom",
							horizontal: "left",
						},
						transformOrigin: {
							vertical: "top",
							horizontal: "left",
						},
						getContentAnchorEl: null,
						classes: { paper: classes.menuPaper },
					}}
					renderValue={() => i18n.t("ticketsQueueSelect.placeholder")}
				>
					{userQueues?.length > 0 &&
						userQueues.map((queue) => (
							<MenuItem dense key={queue.id} value={queue.id}>
								<Checkbox
									style={{
										color: queue.color,
									}}
									size="small"
									color="primary"
									checked={selectedQueueIds.indexOf(queue.id) > -1}
								/>
								<ListItemText primary={queue.name} />
							</MenuItem>
						))}
				</Select>
			</FormControl>
		</div>
	);
};

export default TicketsQueueSelect;
