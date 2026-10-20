import React from "react";
import Paper from "@material-ui/core/Paper";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableContainer from "@material-ui/core/TableContainer";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Typography from "@material-ui/core/Typography";
import Skeleton from "@material-ui/lab/Skeleton";
import Rating from "@material-ui/lab/Rating";
import { makeStyles } from "@material-ui/core/styles";
import moment from "moment";

const useStyles = makeStyles((theme) => ({
  paperContainer: {
    backgroundColor: theme.palette.type === "dark" ? "#0b1e16" : "#ffffff",
    border: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.18)"
        : "rgba(226, 232, 240, 0.9)"
    }`,
    borderRadius: 14,
    boxShadow: "none",
    overflow: "hidden",
  },
  headerBox: {
    padding: "18px 24px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.12)"
        : "rgba(226, 232, 240, 0.8)"
    }`,
  },
  headerTitle: {
    fontSize: "1.05rem",
    fontWeight: 700,
    color: theme.palette.type === "dark" ? "#f0fdf4" : "#0f172a",
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  },
  headerCount: {
    fontSize: "0.75rem",
    fontWeight: 600,
    padding: "3px 10px",
    borderRadius: 12,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.15)"
        : "rgba(16, 185, 129, 0.1)",
    color: theme.palette.type === "dark" ? "#34d399" : "#059669",
  },
  statusOnline: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 8,
    fontSize: "0.75rem",
    fontWeight: 600,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(16, 185, 129, 0.15)"
        : "rgba(16, 185, 129, 0.1)",
    color: theme.palette.type === "dark" ? "#34d399" : "#059669",
  },
  statusOffline: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 8,
    fontSize: "0.75rem",
    fontWeight: 600,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(148, 163, 184, 0.1)"
        : "rgba(100, 116, 139, 0.08)",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
  },
  onlineDot: {
    backgroundColor: "#10b981",
  },
  offlineDot: {
    backgroundColor: "#94a3b8",
  },
  attendantName: {
    fontWeight: 600,
    color: theme.palette.type === "dark" ? "#f0fdf4" : "#0f172a",
  },
  pointer: {
    cursor: "pointer",
  },
}));

export function RatingBox({ rating }) {
  const ratingTrunc = rating === null ? 0 : Math.trunc(rating);
  return <Rating defaultValue={ratingTrunc} max={3} readOnly size="small" />;
}

export default function TableAttendantsStatus(props) {
  const { loading, attendants = [] } = props;
  const classes = useStyles();

  function formatTime(minutes) {
    return moment()
      .startOf("day")
      .add(minutes, "minutes")
      .format("HH[h] mm[m]");
  }

  const onlineCount = attendants.filter((a) => a.online).length;

  function renderList() {
    return attendants.map((a, k) => (
      <TableRow key={k}>
        <TableCell>
          <span className={classes.attendantName}>{a.name}</span>
        </TableCell>
        <TableCell
          align="center"
          title="1 - Insatisfeito, 2 - Satisfeito, 3 - Muito Satisfeito"
          className={classes.pointer}
        >
          <RatingBox rating={a.rating} />
        </TableCell>
        <TableCell align="center">{formatTime(a.avgSupportTime)}</TableCell>
        <TableCell align="center">
          {a.online ? (
            <span className={classes.statusOnline}>
              <span className={`${classes.statusDot} ${classes.onlineDot}`} />
              Online
            </span>
          ) : (
            <span className={classes.statusOffline}>
              <span className={`${classes.statusDot} ${classes.offlineDot}`} />
              Offline
            </span>
          )}
        </TableCell>
      </TableRow>
    ));
  }

  if (loading) {
    return (
      <Skeleton
        variant="rect"
        height={180}
        style={{ borderRadius: 14 }}
      />
    );
  }

  return (
    <TableContainer component={Paper} className={classes.paperContainer} elevation={0}>
      <div className={classes.headerBox}>
        <Typography className={classes.headerTitle}>
          Status dos Atendentes
        </Typography>
        <span className={classes.headerCount}>
          {onlineCount} de {attendants.length} online
        </span>
      </div>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Nome</TableCell>
            <TableCell align="center">Avaliações</TableCell>
            <TableCell align="center">T.M. de Atendimento</TableCell>
            <TableCell align="center">Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>{renderList()}</TableBody>
      </Table>
    </TableContainer>
  );
}