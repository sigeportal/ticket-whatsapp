import React from "react";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
	title: {
		fontSize: "1.375rem",
		fontWeight: 800,
		letterSpacing: "-0.02em",
		color: theme.palette.type === "dark" ? "#f0fdf4" : "#0f172a",
		display: "flex",
		alignItems: "center",
		gap: 10,
	},
}));

export default function Title(props) {
	const classes = useStyles();
	return (
		<Typography component="h1" className={classes.title}>
			{props.children}
		</Typography>
	);
}
