import React from "react";
import { Card } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import TicketHeaderSkeleton from "../TicketHeaderSkeleton";

const useStyles = makeStyles((theme) => ({
  ticketHeader: {
    display: "flex",
    alignItems: "center",
    backgroundColor: "var(--bg-surface)",
    color: "var(--ink-primary)",
    flex: "none",
    minHeight: 68,
    padding: "2px 8px",
    borderBottom: "1px solid var(--border-hairline)",
    boxShadow: "none",
    [theme.breakpoints.down("sm")]: {
      flexWrap: "wrap",
    },
  },
}));

const TicketHeader = ({ loading, children }) => {
  const classes = useStyles();

  return (
    <>
      {loading ? (
        <TicketHeaderSkeleton />
      ) : (
        <Card square elevation={0} className={classes.ticketHeader}>
          {children}
        </Card>
      )}
    </>
  );
};

export default TicketHeader;
