import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import PortAiLogo from "../PortAiLogo";

const useStyles = makeStyles((theme) => ({
  shell: {
    minHeight: "100vh",
    width: "100%",
    display: "grid",
    gridTemplateColumns: "1.05fr 0.95fr",
    backgroundColor: "var(--bg-canvas)",
    color: "var(--ink-primary)",
    [theme.breakpoints.down("sm")]: {
      gridTemplateColumns: "1fr",
    },
  },
  showcaseRail: {
    position: "relative",
    backgroundColor: "#07130E",
    color: "#ECF5F0",
    padding: "44px 48px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    overflow: "hidden",
    borderRight: "1px solid rgba(37, 211, 102, 0.16)",
    backgroundImage:
      "radial-gradient(rgba(37, 211, 102, 0.16) 1px, transparent 1px)",
    backgroundSize: "24px 24px",
    [theme.breakpoints.down("sm")]: {
      display: "none",
    },
  },
  railHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
    zIndex: 1,
  },
  liveBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "5px 12px",
    borderRadius: 9999,
    backgroundColor: "rgba(37, 211, 102, 0.1)",
    border: "1px solid rgba(37, 211, 102, 0.25)",
    fontFamily: "var(--font-mono)",
    fontSize: "0.72rem",
    fontWeight: 600,
    color: "#4ADE80",
    letterSpacing: "0.04em",
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    backgroundColor: "#25D366",
    boxShadow: "0 0 0 3px rgba(37, 211, 102, 0.2)",
  },
  railCenter: {
    position: "relative",
    zIndex: 1,
    maxWidth: 520,
    margin: "32px 0",
  },
  headline: {
    fontFamily: "var(--font-display)",
    fontSize: "clamp(1.85rem, 2.5vw, 2.5rem)",
    fontWeight: 700,
    lineHeight: 1.14,
    letterSpacing: "-0.03em",
    color: "#ECF5F0",
    margin: "0 0 14px 0",
  },
  headlineAccent: {
    color: "#25D366",
  },
  subheadline: {
    fontFamily: "var(--font-sans)",
    fontSize: "1rem",
    lineHeight: 1.55,
    color: "#9DB2A7",
    margin: "0 0 32px 0",
    maxWidth: 440,
  },
  /* Preview Arquitetônico do Produto Real (Sem Bloat) */
  previewFrame: {
    backgroundColor: "#0C1511",
    border: "1px solid rgba(237, 245, 240, 0.11)",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 24px 48px -12px rgba(0, 0, 0, 0.65)",
  },
  previewTopbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "11px 16px",
    backgroundColor: "#09110D",
    borderBottom: "1px solid rgba(237, 245, 240, 0.08)",
  },
  previewTicketId: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#25D366",
  },
  previewQueuePill: {
    fontFamily: "var(--font-sans)",
    fontSize: "0.72rem",
    fontWeight: 600,
    padding: "3px 9px",
    borderRadius: 6,
    backgroundColor: "rgba(16, 185, 129, 0.14)",
    color: "#6EE7B7",
    border: "1px solid rgba(16, 185, 129, 0.24)",
  },
  previewBody: {
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  previewBubbleIn: {
    alignSelf: "flex-start",
    maxWidth: "85%",
    backgroundColor: "#122019",
    border: "1px solid rgba(237, 245, 240, 0.08)",
    borderRadius: "4px 14px 14px 14px",
    padding: "10px 13px",
    fontSize: "0.84rem",
    lineHeight: 1.45,
    color: "#ECF5F0",
  },
  previewAiBox: {
    backgroundColor: "rgba(13, 148, 136, 0.1)",
    border: "1px solid rgba(45, 212, 191, 0.24)",
    borderRadius: 10,
    padding: "10px 13px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  previewAiLabel: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.68rem",
    fontWeight: 600,
    letterSpacing: "0.06em",
    color: "#2DD4BF",
    textTransform: "uppercase",
  },
  previewAiText: {
    fontSize: "0.8rem",
    lineHeight: 1.45,
    color: "#CBE4DA",
  },
  previewBubbleOut: {
    alignSelf: "flex-end",
    maxWidth: "85%",
    backgroundColor: "#0C3521",
    border: "1px solid rgba(37, 211, 102, 0.24)",
    borderRadius: "14px 4px 14px 14px",
    padding: "10px 13px",
    fontSize: "0.84rem",
    lineHeight: 1.45,
    color: "#ECFDF5",
  },
  previewFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 16px",
    backgroundColor: "#09110D",
    borderTop: "1px solid rgba(237, 245, 240, 0.08)",
    fontFamily: "var(--font-mono)",
    fontSize: "0.72rem",
    color: "#6F8479",
  },
  railFooter: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderTop: "1px solid rgba(237, 245, 240, 0.09)",
    paddingTop: 18,
    fontFamily: "var(--font-mono)",
    fontSize: "0.74rem",
    color: "#6F8479",
  },
  formStage: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px 24px",
    backgroundColor: "var(--bg-canvas)",
    minHeight: "100vh",
  },
  formCard: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "var(--bg-surface)",
    border: "1px solid var(--border-hairline)",
    borderRadius: 18,
    padding: "36px 32px",
    boxShadow: "var(--shadow-card)",
    [theme.breakpoints.down("xs")]: {
      padding: "28px 20px",
    },
  },
  mobileBrand: {
    display: "none",
    justifyContent: "center",
    marginBottom: 24,
    [theme.breakpoints.down("sm")]: {
      display: "flex",
    },
  },
}));

const AuthShell = ({ children }) => {
  const classes = useStyles();

  return (
    <div className={classes.shell}>
      <aside className={classes.showcaseRail} aria-label="Apresentação PortAI">
        <div className={classes.railHeader}>
          <PortAiLogo variant="full" width={176} height={60} themeMode="dark" />
          <span className={classes.liveBadge}>
            <span className={classes.liveDot} />
            SMART CX
          </span>
        </div>

        <div className={classes.railCenter}>
          <h2 className={classes.headline}>
            Atendimento WhatsApp com{" "}
            <span className={classes.headlineAccent}>filas e triagem por IA.</span>
          </h2>
          <p className={classes.subheadline}>
            Centralize números conectados, organize atendimentos por setor e
            transfira conversas com resumo automático para a equipe.
          </p>

          <div className={classes.previewFrame}>
            <div className={classes.previewTopbar}>
              <span className={classes.previewTicketId}>TICKET #1048 • MARINA COSTA</span>
              <span className={classes.previewQueuePill}>Suporte N2</span>
            </div>
            <div className={classes.previewBody}>
              <div className={classes.previewBubbleIn}>
                Olá, precisamos liberar dois novos operadores no faturamento ainda hoje.
              </div>
              <div className={classes.previewAiBox}>
                <span className={classes.previewAiLabel}>Resumo Interno • IA</span>
                <span className={classes.previewAiText}>
                  Solicitação de expansão de assentos. Cliente ativo encaminhado para atendimento humano.
                </span>
              </div>
              <div className={classes.previewBubbleOut}>
                Perfeito, Marina! Já assumi seu chamado e estou ativando os acessos agora.
              </div>
            </div>
            <div className={classes.previewFooter}>
              <span>WHATSAPP PRINCIPAL</span>
              <span>RESPOSTA 01M 18S</span>
            </div>
          </div>
        </div>

        <div className={classes.railFooter}>
          <span>MULTICANAL • FILAS • KANBAN • IA</span>
          <span>PORTAL SMART CX</span>
        </div>
      </aside>

      <main className={classes.formStage}>
        <div className={classes.formCard}>
          <div className={classes.mobileBrand}>
            <PortAiLogo variant="full" width={186} height={64} />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
};

export default AuthShell;
