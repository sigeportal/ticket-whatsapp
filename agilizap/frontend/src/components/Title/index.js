import React from "react";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(() => ({
  title: {
    fontFamily: "var(--font-display)",
    fontSize: "1.45rem",
    fontWeight: 700,
    letterSpacing: "-0.025em",
    lineHeight: 1.2,
    color: "var(--ink-primary)",
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
