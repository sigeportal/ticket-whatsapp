import React, { useContext, useEffect, useState } from "react";
import { Button, Paper, Typography, makeStyles } from "@material-ui/core";
import api from "../../services/api";
import { SocketContext } from "../../context/Socket/SocketContext";
import type { ContactListStats as Stats } from "../../types";

const useStyles = makeStyles(theme => ({
  root: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 16,
    [theme.breakpoints.down("xs")]: { gridTemplateColumns: "1fr", gap: 8 } },
  card: { padding: "12px 16px", borderRadius: 12, borderColor: theme.palette.type === "dark" ? "#334155" : "#e2e8f0", background: theme.palette.type === "dark" ? "#162032" : "#fff", boxShadow: "none",
    [theme.breakpoints.down("xs")]: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px" } },
  value: { fontSize: 24, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: theme.palette.text.primary },
  label: { fontSize: 13, color: theme.palette.text.secondary },
}));

export default function ContactListStats({ contactListId, refreshKey = 0 }: { contactListId?: string; refreshKey?: number }) {
  const classes = useStyles();
  const socketManager = useContext(SocketContext);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setStats(null);
    setError(false);
    api.get<Stats>(contactListId ? `/contact-lists/${contactListId}/stats` : "/contact-lists/stats", { signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setStats(data); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [contactListId, refreshKey, revision]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);
    const refresh = () => setRevision(v => v + 1);
    socket.on(`company-${companyId}-ContactList`, refresh);
    socket.on(`company-${companyId}-ContactListItem`, refresh);
    if (contactListId) socket.on(`company-${companyId}-ContactListItem-${contactListId}`, refresh);
    return () => socket.disconnect();
  }, [socketManager, contactListId]);

  const number = (value?: number) => value === undefined ? "—" : value.toLocaleString("pt-BR");
  const metrics = contactListId
    ? [["Contatos nesta lista", number(stats?.totalContacts)], ["WhatsApp validados", number(stats?.validContacts)],
      ["Taxa de validação", stats ? `${stats.totalContacts ? Math.round(stats.validContacts / stats.totalContacts * 100) : 0}%` : "—"]]
    : [["Total de listas", number(stats?.totalLists)], ["Total de contatos", number(stats?.totalContacts)], ["WhatsApp validados", number(stats?.validContacts)]];

  return <>
    <div className={classes.root} aria-label={contactListId ? "Resumo da lista" : "Resumo de todas as listas da empresa"} aria-busy={!stats && !error}>
      {metrics.map(([label, value]) => <Paper key={label} variant="outlined" className={classes.card}>
        <Typography className={classes.label}>{label}</Typography>
        <Typography className={classes.value}>{value}</Typography>
      </Paper>)}
    </div>
    {error && <Typography role="alert" color="textSecondary">Não foi possível carregar os indicadores. <Button onClick={() => setRevision(v => v + 1)}>Tentar novamente</Button></Typography>}
  </>;
}
