import React from "react";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
	contactsHeader: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		padding: "8px 2px 14px 2px",
		flexWrap: "wrap",
		gap: 12,
	},
}));

const MainHeader = ({ children }) => {
	const classes = useStyles();

	return <div className={classes.contactsHeader}>{children}</div>;
};

export default MainHeader;
