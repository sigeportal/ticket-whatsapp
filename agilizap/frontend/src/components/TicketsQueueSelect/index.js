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
		backgroundColor: "var(--field-bg)",
		color: "var(--ink-primary)",
		"& .MuiOutlinedInput-notchedOutline": {
			borderColor: "var(--border-subtle)",
			borderRadius: 10,
		},
		"&:hover .MuiOutlinedInput-notchedOutline": {
			borderColor: "var(--action)",
		},
		"&.Mui-focused .MuiOutlinedInput-notchedOutline": {
			borderColor: "var(--action)",
			borderWidth: "1.5px",
		},
		"& .MuiSelect-select": {
			padding: "7px 12px",
		},
		"& .MuiSelect-icon": {
			color: "var(--ink-muted)",
		},
	},
	menuPaper: {
		borderRadius: 12,
		marginTop: 4,
		backgroundColor: "var(--bg-surface)",
		border: "1px solid var(--border-subtle)",
		boxShadow: "var(--shadow-popover)",
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
