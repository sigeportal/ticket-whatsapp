import React from "react";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
	MainHeaderButtonsWrapper: {
		display: "flex",
		alignItems: "center",
		gap: 10,
		flexWrap: "wrap",
		marginLeft: "auto",
		"& > *": {
			margin: 0,
		},
	},
}));

const MainHeaderButtonsWrapper = ({ children }) => {
	const classes = useStyles();

	return <div className={classes.MainHeaderButtonsWrapper}>{children}</div>;
};

export default MainHeaderButtonsWrapper;
