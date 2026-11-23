import React, { useContext, useState, useEffect } from "react";
import clsx from "clsx";
import Paper from "@material-ui/core/Paper";
import Container from "@material-ui/core/Container";
import Grid from "@material-ui/core/Grid";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";
import MobileFriendlyIcon from "@material-ui/icons/MobileFriendly";
import StoreIcon from "@material-ui/icons/Store";
import CallIcon from "@material-ui/icons/Call";
import HourglassEmptyIcon from "@material-ui/icons/HourglassEmpty";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import GroupAddIcon from "@material-ui/icons/GroupAdd";
import AccessAlarmIcon from "@material-ui/icons/AccessAlarm";
import TimerIcon from "@material-ui/icons/Timer";
import FilterListIcon from "@material-ui/icons/FilterList";

import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";
import { isArray, isEmpty } from "lodash";
import moment from "moment";

import ButtonWithSpinner from "../../components/ButtonWithSpinner";
import TableAttendantsStatus from "../../components/Dashboard/TableAttendantsStatus";
import { AuthContext } from "../../context/Auth/AuthContext";
import useDashboard from "../../hooks/useDashboard";
import useContacts from "../../hooks/useContacts";
import { ChatsUser } from "./ChartsUser";
import { ChartsDate } from "./ChartsDate";

const useStyles = makeStyles((theme) => ({
  container: {
    paddingTop: theme.spacing(3),
    paddingBottom: theme.spacing(4),
    paddingLeft: theme.spacing(2.5),
    paddingRight: theme.spacing(2.5),
    overflowY: "auto",
    height: "calc(100vh - 64px)",
    ...theme.scrollbarStyles,
  },
  filterCard: {
    backgroundColor: "var(--bg-surface)",
    border: "1px solid var(--border-hairline)",
    borderRadius: 14,
    padding: theme.spacing(2.5),
    boxShadow: "none",
  },
  pageTitle: {
    fontSize: "1.45rem",
    fontWeight: 700,
    letterSpacing: "-0.025em",
    color: "var(--ink-primary)",
    fontFamily: "var(--font-display)",
    lineHeight: 1.2,
  },
  pageSubtitle: {
    fontSize: "0.85rem",
    color: "var(--ink-secondary)",
    marginTop: 4,
  },
  kpiCard: {
    backgroundColor: "var(--bg-surface)",
    border: "1px solid var(--border-hairline)",
    borderRadius: 14,
    padding: theme.spacing(2.5),
    boxShadow: "none",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    height: "100%",
    minHeight: 132,
    transition: "border-color var(--t-in) var(--ease-ui), transform var(--t-in) var(--ease-ui)",
    "&:hover": {
      borderColor: "var(--border-strong)",
      transform: "translateY(-2px)",
    },
  },
  kpiHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing(1.5),
  },
  kpiTitle: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.72rem",
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--ink-muted)",
  },
  kpiValue: {
    fontSize: "1.95rem",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    lineHeight: 1.1,
    color: "var(--ink-primary)",
    fontFamily: "var(--font-display)",
    fontVariantNumeric: "tabular-nums",
  },
  kpiSubtitle: {
    fontSize: "0.78rem",
    color: "var(--ink-secondary)",
    marginTop: 6,
  },
  kpiIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeEmerald: {
    backgroundColor: "var(--action-soft)",
    color: "var(--action)",
  },
  badgeBlue: {
    backgroundColor: "var(--status-info-bg)",
    color: "var(--status-info)",
  },
  badgeAmber: {
    backgroundColor: "var(--status-warning-bg)",
    color: "var(--status-warning)",
  },
  badgeIndigo: {
    backgroundColor: "rgba(13, 148, 136, 0.12)",
    color: theme.palette.type === "dark" ? "#2DD4BF" : "#0D9488",
  },
  badgeTeal: {
    backgroundColor: "rgba(13, 148, 136, 0.12)",
    color: theme.palette.type === "dark" ? "#2DD4BF" : "#0D9488",
  },
  badgeSlate: {
    backgroundColor: "var(--bg-subtle)",
    color: "var(--ink-secondary)",
  },
  badgeRose: {
    backgroundColor: "var(--status-danger-bg)",
    color: "var(--status-danger)",
  },
  chartPaper: {
    padding: theme.spacing(3),
    backgroundColor: "var(--bg-surface)",
    border: "1px solid var(--border-hairline)",
    borderRadius: 14,
    boxShadow: "none",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  filterButton: {
    borderRadius: 10,
    padding: "8px 18px",
    fontWeight: 600,
    boxShadow: "none !important",
    height: 40,
    textTransform: "none",
  },
  fullWidth: {
    width: "100%",
  },
}));

const Dashboard = () => {
  const classes = useStyles();
  const [counters, setCounters] = useState({});
  const [attendants, setAttendants] = useState([]);
  const [period, setPeriod] = useState(0);
  const [filterType, setFilterType] = useState(1);
  const [dateFrom, setDateFrom] = useState(
    moment("1", "D").format("YYYY-MM-DD")
  );
  const [dateTo, setDateTo] = useState(moment().format("YYYY-MM-DD"));
  const [loading, setLoading] = useState(false);
  const { find } = useDashboard();

  const { user } = useContext(AuthContext);

  useEffect(() => {
    async function firstLoad() {
      await fetchData();
    }
    setTimeout(() => {
      firstLoad();
    }, 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleChangePeriod(value) {
    setPeriod(value);
  }

  async function handleChangeFilterType(value) {
    setFilterType(value);
    if (value === 1) {
      setPeriod(0);
    } else {
      setDateFrom("");
      setDateTo("");
    }
  }

  async function fetchData() {
    setLoading(true);

    let params = {};

    if (period > 0) {
      params = {
        days: period,
      };
    }

    if (!isEmpty(dateFrom) && moment(dateFrom).isValid()) {
      params = {
        ...params,
        date_from: moment(dateFrom).format("YYYY-MM-DD"),
      };
    }

    if (!isEmpty(dateTo) && moment(dateTo).isValid()) {
      params = {
        ...params,
        date_to: moment(dateTo).format("YYYY-MM-DD"),
      };
    }

    if (Object.keys(params).length === 0) {
      toast.error("Parametrize o filtro");
      setLoading(false);
      return;
    }

    const data = await find(params);

    setCounters(data.counters || {});
    if (isArray(data.attendants)) {
      setAttendants(data.attendants);
    } else {
      setAttendants([]);
    }

    setLoading(false);
  }

  function formatTime(minutes) {
    if (!minutes) return "00h 00m";
    return moment()
      .startOf("day")
      .add(minutes, "minutes")
      .format("HH[h] mm[m]");
  }

  const GetContacts = (all) => {
    let props = {};
    if (all) {
      props = {};
    }
    const { count } = useContacts(props);
    return count;
  };

  return (
    <Container maxWidth="xl" className={classes.container}>
      <Grid container spacing={3}>
        {/* HEADER & BARRA DE FILTROS */}
        <Grid item xs={12}>
          <Paper className={classes.filterCard} elevation={0}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <Typography className={classes.pageTitle}>
                  Painel de Controle
                </Typography>
                <Typography className={classes.pageSubtitle}>
                  Visão geral de atendimentos e métricas operacionais
                </Typography>
              </Grid>

              <Grid item xs={12} sm={4} md={3}>
                <FormControl variant="outlined" size="small" fullWidth>
                  <InputLabel id="period-selector-label">Tipo de Filtro</InputLabel>
                  <Select
                    labelId="period-selector-label"
                    value={filterType}
                    onChange={(e) => handleChangeFilterType(e.target.value)}
                    label="Tipo de Filtro"
                  >
                    <MenuItem value={1}>Filtro por Data</MenuItem>
                    <MenuItem value={2}>Filtro por Período</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {filterType === 1 ? (
                <>
                  <Grid item xs={6} sm={3} md={2}>
                    <TextField
                      size="small"
                      variant="outlined"
                      label="Data Inicial"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3} md={2}>
                    <TextField
                      size="small"
                      variant="outlined"
                      label="Data Final"
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                </>
              ) : (
                <Grid item xs={12} sm={6} md={4}>
                  <FormControl variant="outlined" size="small" fullWidth>
                    <InputLabel id="period-selector-label">Período</InputLabel>
                    <Select
                      labelId="period-selector-label"
                      id="period-selector"
                      value={period}
                      onChange={(e) => handleChangePeriod(e.target.value)}
                      label="Período"
                    >
                      <MenuItem value={0}>Nenhum selecionado</MenuItem>
                      <MenuItem value={3}>Últimos 3 dias</MenuItem>
                      <MenuItem value={7}>Últimos 7 dias</MenuItem>
                      <MenuItem value={15}>Últimos 15 dias</MenuItem>
                      <MenuItem value={30}>Últimos 30 dias</MenuItem>
                      <MenuItem value={60}>Últimos 60 dias</MenuItem>
                      <MenuItem value={90}>Últimos 90 dias</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              )}

              <Grid item xs={12} sm={2} md={1}>
                <ButtonWithSpinner
                  loading={loading}
                  onClick={() => fetchData()}
                  variant="contained"
                  color="primary"
                  startIcon={<FilterListIcon />}
                  className={classes.filterButton}
                  fullWidth
                >
                  Filtrar
                </ButtonWithSpinner>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* CARDS DE MÉTRICAS OPERACIONAIS */}
        {user.super && (
          <Grid item xs={12} sm={6} md={3}>
            <Paper className={classes.kpiCard} elevation={0}>
              <div className={classes.kpiHeader}>
                <Typography className={classes.kpiTitle}>
                  Conexões Ativas
                </Typography>
                <div className={clsx(classes.kpiIconBadge, classes.badgeEmerald)}>
                  <MobileFriendlyIcon style={{ fontSize: 20 }} />
                </div>
              </div>
              <div>
                <Typography className={classes.kpiValue}>
                  {counters.totalWhatsappSessions ?? 0}
                </Typography>
                <Typography className={classes.kpiSubtitle}>
                  Sessões WhatsApp conectadas
                </Typography>
              </div>
            </Paper>
          </Grid>
        )}

        {user.super && (
          <Grid item xs={12} sm={6} md={3}>
            <Paper className={classes.kpiCard} elevation={0}>
              <div className={classes.kpiHeader}>
                <Typography className={classes.kpiTitle}>
                  Empresas
                </Typography>
                <div className={clsx(classes.kpiIconBadge, classes.badgeIndigo)}>
                  <StoreIcon style={{ fontSize: 20 }} />
                </div>
              </div>
              <div>
                <Typography className={classes.kpiValue}>
                  {counters.totalCompanies ?? 0}
                </Typography>
                <Typography className={classes.kpiSubtitle}>
                  Contas ativas na plataforma
                </Typography>
              </div>
            </Paper>
          </Grid>
        )}

        {/* EM ATENDIMENTO */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper className={classes.kpiCard} elevation={0}>
            <div className={classes.kpiHeader}>
              <Typography className={classes.kpiTitle}>
                Em Conversa
              </Typography>
              <div className={clsx(classes.kpiIconBadge, classes.badgeEmerald)}>
                <CallIcon style={{ fontSize: 20 }} />
              </div>
            </div>
            <div>
              <Typography className={classes.kpiValue}>
                {counters.supportHappening ?? 0}
              </Typography>
              <Typography className={classes.kpiSubtitle}>
                Atendimentos em andamento
              </Typography>
            </div>
          </Paper>
        </Grid>

        {/* AGUARDANDO */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper className={classes.kpiCard} elevation={0}>
            <div className={classes.kpiHeader}>
              <Typography className={classes.kpiTitle}>
                Aguardando
              </Typography>
              <div className={clsx(classes.kpiIconBadge, classes.badgeAmber)}>
                <HourglassEmptyIcon style={{ fontSize: 20 }} />
              </div>
            </div>
            <div>
              <Typography className={classes.kpiValue}>
                {counters.supportPending ?? 0}
              </Typography>
              <Typography className={classes.kpiSubtitle}>
                Clientes na fila de espera
              </Typography>
            </div>
          </Paper>
        </Grid>

        {/* FINALIZADOS */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper className={classes.kpiCard} elevation={0}>
            <div className={classes.kpiHeader}>
              <Typography className={classes.kpiTitle}>
                Finalizados
              </Typography>
              <div className={clsx(classes.kpiIconBadge, classes.badgeTeal)}>
                <CheckCircleIcon style={{ fontSize: 20 }} />
              </div>
            </div>
            <div>
              <Typography className={classes.kpiValue}>
                {counters.supportFinished ?? 0}
              </Typography>
              <Typography className={classes.kpiSubtitle}>
                Atendimentos concluídos
              </Typography>
            </div>
          </Paper>
        </Grid>

        {/* NOVOS CONTATOS */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper className={classes.kpiCard} elevation={0}>
            <div className={classes.kpiHeader}>
              <Typography className={classes.kpiTitle}>
                Novos Contatos
              </Typography>
              <div className={clsx(classes.kpiIconBadge, classes.badgeBlue)}>
                <GroupAddIcon style={{ fontSize: 20 }} />
              </div>
            </div>
            <div>
              <Typography className={classes.kpiValue}>
                {GetContacts(true) ?? 0}
              </Typography>
              <Typography className={classes.kpiSubtitle}>
                Contatos registrados
              </Typography>
            </div>
          </Paper>
        </Grid>

        {/* T.M. DE CONVERSA */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper className={classes.kpiCard} elevation={0}>
            <div className={classes.kpiHeader}>
              <Typography className={classes.kpiTitle}>
                T.M. de Conversa
              </Typography>
              <div className={clsx(classes.kpiIconBadge, classes.badgeSlate)}>
                <AccessAlarmIcon style={{ fontSize: 20 }} />
              </div>
            </div>
            <div>
              <Typography className={classes.kpiValue}>
                {formatTime(counters.avgSupportTime)}
              </Typography>
              <Typography className={classes.kpiSubtitle}>
                Duração média de conversa
              </Typography>
            </div>
          </Paper>
        </Grid>

        {/* T.M. DE ESPERA */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper className={classes.kpiCard} elevation={0}>
            <div className={classes.kpiHeader}>
              <Typography className={classes.kpiTitle}>
                T.M. de Espera
              </Typography>
              <div className={clsx(classes.kpiIconBadge, classes.badgeRose)}>
                <TimerIcon style={{ fontSize: 20 }} />
              </div>
            </div>
            <div>
              <Typography className={classes.kpiValue}>
                {formatTime(counters.avgWaitTime)}
              </Typography>
              <Typography className={classes.kpiSubtitle}>
                Tempo médio de resposta
              </Typography>
            </div>
          </Paper>
        </Grid>

        {/* TABELA DE STATUS DOS ATENDENTES */}
        <Grid item xs={12}>
          {attendants.length ? (
            <TableAttendantsStatus
              attendants={attendants}
              loading={loading}
            />
          ) : null}
        </Grid>

        {/* GRÁFICOS */}
        <Grid item xs={12} md={6}>
          <Paper className={classes.chartPaper} elevation={0}>
            <ChatsUser />
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper className={classes.chartPaper} elevation={0}>
            <ChartsDate />
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard;
