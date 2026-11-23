import React from "react";

import { Avatar, Card, CardHeader, Typography } from "@material-ui/core";
import Skeleton from "@material-ui/lab/Skeleton";

import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  card: {
    borderRadius: 12,
    border: "1px solid var(--border-hairline)",
    backgroundColor: "var(--bg-canvas)",
    boxShadow: "none",
  },
  cardAvatar: {
    fontSize: "24px",
    color: "var(--action)",
    backgroundColor: "var(--action-soft)",
    borderRadius: 10,
    width: theme.spacing(6),
    height: theme.spacing(6),
  },
  cardTitle: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.75rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--ink-muted)",
  },
  cardSubtitle: {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    color: "var(--ink-primary)",
    fontSize: "1.125rem",
    marginTop: 2,
  },
}));

export default function CardCounter(props) {
  const { icon, title, value, loading } = props;
  const classes = useStyles();
  return !loading ? (
    <Card className={classes.card} elevation={0}>
      <CardHeader
        avatar={<Avatar className={classes.cardAvatar}>{icon}</Avatar>}
        title={
          <Typography component="h2" className={classes.cardTitle}>
            {title}
          </Typography>
        }
        subheader={
          <Typography component="p" className={classes.cardSubtitle}>
            {value}
          </Typography>
        }
      />
    </Card>
  ) : (
    <Skeleton variant="rect" height={80} />
  );
}
