import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Container from "@material-ui/core/Container";

const useStyles = makeStyles((theme) => ({
  mainContainer: {
    flex: 1,
    padding: theme.spacing(2.5),
    height: "calc(100% - 64px)",
    maxWidth: "100%",
    backgroundColor: "var(--bg-canvas)",
    [theme.breakpoints.down("xs")]: {
      padding: theme.spacing(1.5),
    },
  },
  contentWrapper: {
    height: "100%",
    overflowY: "hidden",
    display: "flex",
    flexDirection: "column",
  },
}));

const MainContainer = ({ children }) => {
  const classes = useStyles();

  return (
    <Container maxWidth={false} className={classes.mainContainer}>
      <div className={classes.contentWrapper}>{children}</div>
    </Container>
  );
};

export default MainContainer;
