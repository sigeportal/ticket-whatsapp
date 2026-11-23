import React, { useState, useCallback, useContext, useMemo } from "react";
import { toast } from "react-toastify";
import { format, parseISO } from "date-fns";

import { makeStyles } from "@material-ui/core/styles";
import {
	Button,
	IconButton,
	Paper,
	Tooltip,
	Typography,
	CircularProgress,
	Grid,
	Chip,
	Box,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableRow,
	Avatar,
} from "@material-ui/core";
import { Skeleton } from "@material-ui/lab";

import {
	Edit,
	DeleteOutline,
	CropFree,
	PowerSettingsNew,
	RotateLeft,
	Add,
	Star,
	Phone,
	AccessTime,
	ViewModule,
	ViewList,
	CheckCircle,
	Sync,
	BatteryFull,
	Battery80,
	Battery50,
	BatteryAlert,
	BatteryChargingFull,
	BatteryUnknown,
} from "@material-ui/icons";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";

import formatSerializedId from "../../utils/formatSerializedId";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import TableRowSkeleton from "../../components/TableRowSkeleton";

import api from "../../services/api";
import WhatsAppModal from "../../components/WhatsAppModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import QrcodeModal from "../../components/QrcodeModal";
import { i18n } from "../../translate/i18n";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import toastError from "../../errors/toastError";

import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../../components/Can";

const useStyles = makeStyles(theme => ({
	mainPaper: {
		flex: 1,
		padding: theme.spacing(2),
		overflowY: "auto",
		borderRadius: 16,
		backgroundColor: "var(--bg-subtle)",
		border: "1px solid var(--border-subtle)",
		...theme.scrollbarStyles,
	},
	headerContainer: {
		display: "flex",
		flexDirection: "column",
		width: "100%",
		marginBottom: theme.spacing(2),
	},
	headerTop: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		flexWrap: "wrap",
		gap: theme.spacing(1.5),
	},
	titleWrapper: {
		display: "flex",
		alignItems: "center",
		gap: theme.spacing(1.5),
	},
	headerIconContainer: {
		width: 44,
		height: 44,
		borderRadius: 12,
		backgroundColor: "var(--action-soft)",
		border: "1px solid var(--action-ring)",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		color: "var(--action)",
		boxShadow: "none",
	},
	titleText: {
		fontFamily: "var(--font-display)",
		fontWeight: 700,
		letterSpacing: "-0.02em",
		fontSize: "1.45rem",
		color: "var(--ink-primary)",
		lineHeight: 1.2,
	},
	subtitleText: {
		fontSize: "0.85rem",
		color: "var(--ink-secondary)",
	},
	headerActions: {
		display: "flex",
		alignItems: "center",
		gap: theme.spacing(1),
		flexWrap: "wrap",
	},
	viewToggleGroup: {
		display: "flex",
		alignItems: "center",
		backgroundColor: "var(--bg-surface)",
		borderRadius: 10,
		padding: 3,
		border: "1px solid var(--border-subtle)",
		boxShadow: "none",
	},
	viewToggleBtn: {
		padding: 6,
		borderRadius: 8,
		color: "var(--ink-muted)",
		transition: "color 150ms ease, background-color 150ms ease",
		"&:hover": {
			color: "var(--action)",
		},
	},
	viewToggleBtnActive: {
		backgroundColor: "var(--action-soft)",
		color: "var(--action)",
		boxShadow: "none",
	},
	btnRestart: {
		textTransform: "none",
		fontWeight: 600,
		borderRadius: 10,
		padding: "7px 14px",
		color: "var(--ink-secondary)",
		backgroundColor: "var(--bg-surface)",
		border: "1px solid var(--border-subtle)",
		boxShadow: "none",
		"&:hover": {
			backgroundColor: "var(--bg-elevated)",
			borderColor: "var(--action-ring)",
			color: "var(--ink-primary)",
		},
	},
	btnAdd: {
		textTransform: "none",
		fontWeight: 700,
		borderRadius: 10,
		padding: "8px 18px",
		backgroundColor: "var(--action)",
		color: "var(--action-ink)",
		boxShadow: "none",
		transition: "background-color 150ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 90ms ease",
		"&:hover": {
			backgroundColor: "var(--action-hover)",
			boxShadow: "none",
		},
		"&:active": {
			transform: "scale(0.985)",
		},
	},
	statsRow: {
		marginBottom: theme.spacing(2.5),
	},
	statCard: {
		padding: theme.spacing(1.5, 2),
		borderRadius: 12,
		display: "flex",
		alignItems: "center",
		gap: theme.spacing(1.5),
		backgroundColor: "var(--bg-surface)",
		border: "1px solid var(--border-subtle)",
		boxShadow: "none",
	},
	statIconCirclePrimary: {
		width: 38,
		height: 38,
		borderRadius: 10,
		backgroundColor: "var(--action-soft)",
		color: "var(--action)",
		border: "1px solid var(--action-ring)",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
	},
	statIconCircleGreen: {
		width: 38,
		height: 38,
		borderRadius: 10,
		backgroundColor: "var(--action-soft)",
		color: "var(--action)",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
	},
	statIconCircleAmber: {
		width: 38,
		height: 38,
		borderRadius: 10,
		backgroundColor: theme.palette.type === "dark" ? "rgba(245, 158, 11, 0.14)" : "#FFFBEB",
		color: theme.palette.type === "dark" ? "#FBBF24" : "#D97706",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
	},
	statIconCircleRed: {
		width: 38,
		height: 38,
		borderRadius: 10,
		backgroundColor: theme.palette.type === "dark" ? "rgba(239, 68, 68, 0.14)" : "#FEF2F2",
		color: theme.palette.type === "dark" ? "#FCA5A5" : "#DC2626",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
	},
	statLabel: {
		fontFamily: "var(--font-mono)",
		fontSize: "0.7rem",
		fontWeight: 600,
		color: "var(--ink-muted)",
		textTransform: "uppercase",
		letterSpacing: "0.06em",
	},
	statValue: {
		fontFamily: "var(--font-display)",
		fontVariantNumeric: "tabular-nums",
		fontWeight: 700,
		fontSize: "1.35rem",
		color: "var(--ink-primary)",
		lineHeight: 1.2,
	},
	connectionCard: {
		borderRadius: 14,
		backgroundColor: "var(--bg-surface)",
		border: "1px solid var(--border-subtle)",
		boxShadow: "none",
		display: "flex",
		flexDirection: "column",
		justifyContent: "space-between",
		transition: "transform 150ms cubic-bezier(0.2, 0.8, 0.2, 1), border-color 150ms ease, box-shadow 150ms ease",
		position: "relative",
		overflow: "hidden",
		"&:hover": {
			transform: "translateY(-2px)",
			boxShadow: "var(--shadow-md)",
			borderColor: "var(--action-ring)",
		},
	},
	cardHeader: {
		padding: theme.spacing(2, 2, 1.5, 2),
		display: "flex",
		alignItems: "flex-start",
		justifyContent: "space-between",
	},
	channelAvatarWrapper: {
		width: 48,
		height: 48,
		borderRadius: 12,
		backgroundColor: "var(--action)",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		color: "var(--action-ink)",
		boxShadow: "none",
		flexShrink: 0,
	},
	channelMeta: {
		marginLeft: theme.spacing(1.5),
		flex: 1,
		minWidth: 0,
	},
	channelNameRow: {
		display: "flex",
		alignItems: "center",
		gap: theme.spacing(0.75),
		flexWrap: "wrap",
	},
	channelName: {
		fontFamily: "var(--font-display)",
		fontWeight: 700,
		fontSize: "1rem",
		color: "var(--ink-primary)",
		whiteSpace: "nowrap",
		overflow: "hidden",
		textOverflow: "ellipsis",
	},
	defaultChip: {
		height: 20,
		fontSize: "0.68rem",
		fontWeight: 700,
		backgroundColor: theme.palette.type === "dark" ? "rgba(245, 158, 11, 0.16)" : "#FEF3C7",
		color: theme.palette.type === "dark" ? "#FBBF24" : "#B45309",
		border: theme.palette.type === "dark" ? "1px solid rgba(251, 191, 36, 0.28)" : "1px solid #FDE68A",
		"& .MuiChip-icon": {
			color: "inherit",
			marginLeft: 4,
			marginRight: -4,
		},
	},
	channelPhone: {
		fontFamily: "var(--font-mono)",
		fontSize: "0.78rem",
		color: "var(--ink-secondary)",
		display: "flex",
		alignItems: "center",
		gap: 4,
		marginTop: 2,
	},
	phoneIcon: {
		fontSize: 14,
		color: "var(--ink-muted)",
	},
	cardActionsMenu: {
		display: "flex",
		alignItems: "center",
		gap: 2,
	},
	iconActionBtn: {
		padding: 6,
		color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
		borderRadius: 8,
		transition: "all 0.15s ease",
		"&:hover": {
			backgroundColor: theme.palette.type === "dark" ? "rgba(255,255,255,0.08)" : "#f1f5f9",
			color: theme.palette.type === "dark" ? "#f8fafc" : "#0f172a",
		},
	},
	iconActionBtnDelete: {
		"&:hover": {
			backgroundColor: theme.palette.type === "dark" ? "rgba(239, 68, 68, 0.15)" : "#fef2f2",
			color: "#ef4444",
		},
	},
	cardBody: {
		padding: theme.spacing(0, 2, 1.5, 2),
		display: "flex",
		flexDirection: "column",
		gap: theme.spacing(1.2),
	},
	statusRow: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		flexWrap: "wrap",
		gap: theme.spacing(1),
	},
	statusBadge: {
		display: "inline-flex",
		alignItems: "center",
		gap: 6,
		padding: "4px 10px",
		borderRadius: 20,
		fontSize: "0.78rem",
		fontWeight: 600,
		letterSpacing: "0.2px",
	},
	statusConnected: {
		backgroundColor: theme.palette.type === "dark" ? "rgba(16, 185, 129, 0.18)" : "#ecfdf5",
		color: theme.palette.type === "dark" ? "#34d399" : "#065f46",
		border: "1px solid #a7f3d0",
	},
	statusQrcode: {
		backgroundColor: theme.palette.type === "dark" ? "rgba(245, 158, 11, 0.18)" : "#fffbeb",
		color: theme.palette.type === "dark" ? "#fbbf24" : "#92400e",
		border: "1px solid #fde68a",
	},
	statusDisconnected: {
		backgroundColor: theme.palette.type === "dark" ? "rgba(239, 68, 68, 0.18)" : "#fef2f2",
		color: theme.palette.type === "dark" ? "#f87171" : "#991b1b",
		border: "1px solid #fecaca",
	},
	statusOpening: {
		backgroundColor: theme.palette.type === "dark" ? "rgba(59, 130, 246, 0.18)" : "#eff6ff",
		color: theme.palette.type === "dark" ? "#60a5fa" : "#1e40af",
		border: "1px solid #bfdbfe",
	},
	statusTimeout: {
		backgroundColor: theme.palette.type === "dark" ? "rgba(249, 115, 22, 0.18)" : "#fff7ed",
		color: theme.palette.type === "dark" ? "#fb923c" : "#9a3412",
		border: "1px solid #fed7aa",
	},
	statusDefault: {
		backgroundColor: theme.palette.type === "dark" ? "#334155" : "#f1f5f9",
		color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
		border: "1px solid #cbd5e1",
	},
	statusDot: {
		width: 7,
		height: 7,
		borderRadius: "50%",
		display: "inline-block",
	},
	pulseDotGreen: {
		backgroundColor: "#10b981",
		boxShadow: "0 0 0 rgba(16, 185, 129, 0.4)",
		animation: "$pulseGreen 1.8s infinite ease-in-out",
	},
	pulseDotAmber: {
		backgroundColor: "#f59e0b",
		boxShadow: "0 0 0 rgba(245, 158, 11, 0.4)",
		animation: "$pulseAmber 1.8s infinite ease-in-out",
	},
	dotRed: {
		backgroundColor: "#ef4444",
	},
	dotOrange: {
		backgroundColor: "#f97316",
	},
	statusSpinner: {
		color: "inherit",
	},
	"@keyframes pulseGreen": {
		"0%": {
			transform: "scale(0.95)",
			boxShadow: "0 0 0 0 rgba(16, 185, 129, 0.7)",
		},
		"70%": {
			transform: "scale(1)",
			boxShadow: "0 0 0 6px rgba(16, 185, 129, 0)",
		},
		"100%": {
			transform: "scale(0.95)",
			boxShadow: "0 0 0 0 rgba(16, 185, 129, 0)",
		},
	},
	"@keyframes pulseAmber": {
		"0%": {
			transform: "scale(0.95)",
			boxShadow: "0 0 0 0 rgba(245, 158, 11, 0.7)",
		},
		"70%": {
			transform: "scale(1)",
			boxShadow: "0 0 0 6px rgba(245, 158, 11, 0)",
		},
		"100%": {
			transform: "scale(0.95)",
			boxShadow: "0 0 0 0 rgba(245, 158, 11, 0)",
		},
	},
	batteryContainer: {
		display: "inline-flex",
		alignItems: "center",
		gap: 4,
		padding: "3px 8px",
		borderRadius: 14,
		fontSize: "0.75rem",
		fontWeight: 600,
	},
	batteryGreen: {
		backgroundColor: theme.palette.type === "dark" ? "rgba(16, 185, 129, 0.15)" : "#ecfdf5",
		color: theme.palette.type === "dark" ? "#34d399" : "#059669",
		border: "1px solid rgba(16, 185, 129, 0.25)",
	},
	batteryAmber: {
		backgroundColor: theme.palette.type === "dark" ? "rgba(245, 158, 11, 0.15)" : "#fffbeb",
		color: theme.palette.type === "dark" ? "#fbbf24" : "#d97706",
		border: "1px solid rgba(245, 158, 11, 0.25)",
	},
	batteryRed: {
		backgroundColor: theme.palette.type === "dark" ? "rgba(239, 68, 68, 0.15)" : "#fef2f2",
		color: theme.palette.type === "dark" ? "#f87171" : "#dc2626",
		border: "1px solid rgba(239, 68, 68, 0.25)",
	},
	batteryCharging: {
		backgroundColor: theme.palette.type === "dark" ? "rgba(16, 185, 129, 0.2)" : "#ecfdf5",
		color: theme.palette.type === "dark" ? "#34d399" : "#059669",
		border: "1px solid rgba(16, 185, 129, 0.35)",
	},
	batteryMuted: {
		backgroundColor: theme.palette.type === "dark" ? "rgba(148, 163, 184, 0.1)" : "#f1f5f9",
		color: theme.palette.type === "dark" ? "#94a3b8" : "#94a3b8",
		border: "1px solid rgba(148, 163, 184, 0.2)",
	},
	batteryIcon: {
		fontSize: 16,
	},
	metaInfoRow: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		fontSize: "0.78rem",
		color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
		paddingTop: theme.spacing(0.5),
		borderTop: theme.palette.type === "dark" ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid #f1f5f9",
	},
	lastSyncTime: {
		display: "flex",
		alignItems: "center",
		gap: 4,
	},
	clockIcon: {
		fontSize: 14,
		color: theme.palette.type === "dark" ? "#64748b" : "#94a3b8",
	},
	queuesContainer: {
		display: "flex",
		flexWrap: "wrap",
		gap: 4,
		marginTop: 4,
	},
	queueChip: {
		height: 20,
		fontSize: "0.68rem",
		borderRadius: 6,
		fontWeight: 500,
	},
	cardFooter: {
		padding: theme.spacing(1.5, 2),
		backgroundColor: "var(--bg-subtle)",
		borderTop: "1px solid var(--border-subtle)",
	},
	btnQrCodeAction: {
		width: "100%",
		fontWeight: 700,
		fontSize: "0.82rem",
		textTransform: "none",
		borderRadius: 10,
		padding: "8px 14px",
		backgroundColor: "var(--action)",
		color: "var(--action-ink)",
		boxShadow: "none",
		transition: "background-color 150ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 90ms ease",
		"&:hover": {
			backgroundColor: "var(--action-hover)",
			boxShadow: "none",
		},
		"&:active": {
			transform: "scale(0.985)",
		},
	},
	cardActionsGrid: {
		display: "flex",
		gap: theme.spacing(1),
		width: "100%",
	},
	btnActionReconnect: {
		flex: 1,
		textTransform: "none",
		fontWeight: 600,
		fontSize: "0.8rem",
		borderRadius: 10,
		padding: "6px 12px",
		backgroundColor: theme.palette.type === "dark" ? "rgba(59, 130, 246, 0.14)" : "#EFF6FF",
		color: theme.palette.type === "dark" ? "#93C5FD" : "#1D4ED8",
		border: theme.palette.type === "dark" ? "1px solid rgba(147, 197, 253, 0.28)" : "1px solid #BFDBFE",
		"&:hover": {
			backgroundColor: theme.palette.type === "dark" ? "rgba(59, 130, 246, 0.22)" : "#DBEAFE",
		},
	},
	btnActionNewQr: {
		flex: 1,
		textTransform: "none",
		fontWeight: 600,
		fontSize: "0.8rem",
		borderRadius: 10,
		padding: "6px 12px",
		backgroundColor: theme.palette.type === "dark" ? "rgba(245, 158, 11, 0.14)" : "#FFFBEB",
		color: theme.palette.type === "dark" ? "#FCD34D" : "#B45309",
		border: theme.palette.type === "dark" ? "1px solid rgba(252, 211, 77, 0.28)" : "1px solid #FDE68A",
		"&:hover": {
			backgroundColor: theme.palette.type === "dark" ? "rgba(245, 158, 11, 0.22)" : "#FEF3C7",
		},
	},
	btnActionSync: {
		flex: 1,
		textTransform: "none",
		fontWeight: 600,
		fontSize: "0.8rem",
		borderRadius: 10,
		padding: "6px 12px",
		backgroundColor: "var(--action-soft)",
		color: "var(--action)",
		border: "1px solid var(--action-ring)",
		"&:hover": {
			backgroundColor: "var(--action-ring)",
		},
	},
	btnActionDisconnect: {
		flex: 1,
		textTransform: "none",
		fontWeight: 600,
		fontSize: "0.8rem",
		borderRadius: 10,
		padding: "6px 12px",
		backgroundColor: theme.palette.type === "dark" ? "rgba(239, 68, 68, 0.12)" : "#FEF2F2",
		color: theme.palette.type === "dark" ? "#FCA5A5" : "#DC2626",
		border: theme.palette.type === "dark" ? "1px solid rgba(248, 113, 113, 0.28)" : "1px solid #FECACA",
		"&:hover": {
			backgroundColor: theme.palette.type === "dark" ? "rgba(239, 68, 68, 0.22)" : "#FEE2E2",
		},
	},
	btnActionConnecting: {
		width: "100%",
		textTransform: "none",
		fontWeight: 600,
		fontSize: "0.8rem",
		borderRadius: 10,
		padding: "6px 12px",
		backgroundColor: "var(--bg-elevated)",
		color: "var(--ink-secondary)",
	},
	tablePaper: {
		borderRadius: 14,
		overflow: "hidden",
		border: "1px solid var(--border-subtle)",
		backgroundColor: "var(--bg-surface)",
		boxShadow: "none",
	},
	tableHeaderRow: {
		backgroundColor: "var(--bg-subtle)",
		"& th": {
			fontFamily: "var(--font-mono)",
			fontWeight: 700,
			fontSize: "0.72rem",
			textTransform: "uppercase",
			letterSpacing: "0.06em",
			color: "var(--ink-secondary)",
			borderBottom: "1px solid var(--border-subtle)",
			padding: theme.spacing(1.75, 2),
		},
	},
	tableRow: {
		transition: "background-color 150ms ease",
		"&:hover": {
			backgroundColor: "var(--bg-subtle)",
		},
		"& td": {
			padding: theme.spacing(1.5, 2),
			borderBottom: "1px solid var(--border-subtle)",
		},
	},
	tableChannelCell: {
		display: "flex",
		alignItems: "center",
		gap: theme.spacing(1.5),
	},
	tableAvatar: {
		width: 38,
		height: 38,
		borderRadius: 10,
		backgroundColor: "var(--action)",
		color: "var(--action-ink)",
	},
	emptyStatePaper: {
		padding: theme.spacing(6, 3),
		borderRadius: 16,
		textAlign: "center",
		backgroundColor: "var(--bg-surface)",
		border: "1px solid var(--border-subtle)",
		boxShadow: "none",
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		maxWidth: 480,
		margin: "40px auto",
	},
	emptyStateAvatar: {
		width: 72,
		height: 72,
		borderRadius: 20,
		backgroundColor: "var(--action-soft)",
		border: "1px solid var(--action-ring)",
		color: "var(--action)",
		marginBottom: theme.spacing(2),
	},
	emptyStateIcon: {
		fontSize: 36,
	},
	emptyStateTitle: {
		fontFamily: "var(--font-display)",
		fontWeight: 700,
		letterSpacing: "-0.02em",
		fontSize: "1.2rem",
		color: "var(--ink-primary)",
		marginBottom: theme.spacing(1),
	},
	emptyStateSubtitle: {
		fontSize: "0.9rem",
		color: "var(--ink-secondary)",
		marginBottom: theme.spacing(3),
		maxWidth: 380,
	},
	skeletonCard: {
		padding: theme.spacing(2.5),
		borderRadius: 16,
		backgroundColor: "var(--bg-surface)",
		border: "1px solid var(--border-subtle)",
	},
}));

const Connections = () => {
	const classes = useStyles();

	const { user } = useContext(AuthContext);
	const { whatsApps, loading } = useContext(WhatsAppsContext);

	const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
	const [qrModalOpen, setQrModalOpen] = useState(false);
	const [selectedWhatsApp, setSelectedWhatsApp] = useState(null);
	const [confirmModalOpen, setConfirmModalOpen] = useState(false);
	const [viewMode, setViewMode] = useState("cards"); // 'cards' | 'table'

	const confirmationModalInitialState = {
		action: "",
		title: "",
		message: "",
		whatsAppId: "",
		open: false,
	};

	const [confirmModalInfo, setConfirmModalInfo] = useState(
		confirmationModalInitialState
	);

	// Estatísticas resumidas para os cards de KPI
	const stats = useMemo(() => {
		const total = whatsApps?.length || 0;
		const connected = whatsApps?.filter(w => w.status === "CONNECTED").length || 0;
		const qrcode = whatsApps?.filter(w => w.status === "qrcode").length || 0;
		const disconnected = whatsApps?.filter(w => ["DISCONNECTED", "TIMEOUT", "RECONNECT_PAUSED"].includes(w.status)).length || 0;
		return { total, connected, qrcode, disconnected };
	}, [whatsApps]);

	const restartWhatsapps = async () => {
		try {
			await api.post(`/whatsapp-restart/`);
			toast.warn(i18n.t("Aguarde... reiniciando conexões..."));
		} catch (err) {
			toastError(err);
		}
	};

	const handleStartWhatsAppSession = async whatsAppId => {
		try {
			await api.post(`/whatsappsession/${whatsAppId}`);
			toast.info("Iniciando sessão do WhatsApp...");
		} catch (err) {
			toastError(err);
		}
	};

	const handleRequestNewQrCode = async whatsAppId => {
		try {
			await api.put(`/whatsappsession/${whatsAppId}`);
			toast.info("Solicitando novo QR Code...");
		} catch (err) {
			toastError(err);
		}
	};

	const handleSyncTickets = async whatsAppId => {
		try {
			await api.post(`/whatsappsession/${whatsAppId}`);
			toast.success(i18n.t("connections.toasts.synced") || "Sincronização iniciada com sucesso!");
		} catch (err) {
			toastError(err);
		}
	};

	const handleOpenWhatsAppModal = () => {
		setSelectedWhatsApp(null);
		setWhatsAppModalOpen(true);
	};

	const handleCloseWhatsAppModal = useCallback(() => {
		setWhatsAppModalOpen(false);
		setSelectedWhatsApp(null);
	}, [setSelectedWhatsApp, setWhatsAppModalOpen]);

	const handleOpenQrModal = whatsApp => {
		setSelectedWhatsApp(whatsApp);
		setQrModalOpen(true);
	};

	const handleCloseQrModal = useCallback(() => {
		setSelectedWhatsApp(null);
		setQrModalOpen(false);
	}, [setQrModalOpen, setSelectedWhatsApp]);

	const handleEditWhatsApp = whatsApp => {
		setSelectedWhatsApp(whatsApp);
		setWhatsAppModalOpen(true);
	};

	const handleOpenConfirmationModal = (action, whatsAppId) => {
		if (action === "disconnect") {
			setConfirmModalInfo({
				action: action,
				title: i18n.t("connections.confirmationModal.disconnectTitle"),
				message: i18n.t("connections.confirmationModal.disconnectMessage"),
				whatsAppId: whatsAppId,
			});
		}

		if (action === "delete") {
			setConfirmModalInfo({
				action: action,
				title: i18n.t("connections.confirmationModal.deleteTitle"),
				message: i18n.t("connections.confirmationModal.deleteMessage"),
				whatsAppId: whatsAppId,
			});
		}
		setConfirmModalOpen(true);
	};

	const handleDeleteWhatsApp = whatsAppId => {
		handleOpenConfirmationModal("delete", whatsAppId);
	};

	const handleDisconnectWhatsApp = whatsAppId => {
		handleOpenConfirmationModal("disconnect", whatsAppId);
	};

	const handleSubmitConfirmationModal = async () => {
		if (confirmModalInfo.action === "disconnect") {
			try {
				await api.delete(`/whatsappsession/${confirmModalInfo.whatsAppId}`);
			} catch (err) {
				toastError(err);
			}
		}

		if (confirmModalInfo.action === "delete") {
			try {
				await api.delete(`/whatsapp/${confirmModalInfo.whatsAppId}`);
				toast.success(i18n.t("connections.toasts.deleted"));
			} catch (err) {
				toastError(err);
			}
		}

		setConfirmModalInfo(confirmationModalInitialState);
	};

	// Renderizador de Status Badge com Ponto Pulsante
	const renderStatusBadge = status => {
		switch (status) {
			case "CONNECTED":
				return (
					<Tooltip title={i18n.t("connections.toolTips.connected.title") || "Conexão ativa e funcionando"}>
						<span className={`${classes.statusBadge} ${classes.statusConnected}`}>
							<span className={`${classes.statusDot} ${classes.pulseDotGreen}`} />
							Conectado
						</span>
					</Tooltip>
				);
			case "qrcode":
				return (
					<Tooltip
						title={
							i18n.t("connections.toolTips.qrcode.title") ||
							"Aguardando leitura do QR Code pelo smartphone"
						}
					>
						<span className={`${classes.statusBadge} ${classes.statusQrcode}`}>
							<span className={`${classes.statusDot} ${classes.pulseDotAmber}`} />
							Aguardando QR Code
						</span>
					</Tooltip>
				);
			case "RECONNECT_PAUSED":
			case "DISCONNECTED":
				return (
					<Tooltip
						title={
							status === "RECONNECT_PAUSED"
								? "Limite de tentativas atingido. Você pode reconectar manualmente."
								: i18n.t("connections.toolTips.disconnected.title") ||
							"Sessão desconectada. Clique para reconectar."
						}
					>
						<span className={`${classes.statusBadge} ${classes.statusDisconnected}`}>
							<span className={`${classes.statusDot} ${classes.dotRed}`} />
							{status === "RECONNECT_PAUSED" ? "Reconexão automática pausada" : "Desconectado"}
						</span>
					</Tooltip>
				);
			case "RECONNECTING":
			case "OPENING":
				return (
					<Tooltip title={status === "RECONNECTING" ? "Tentando recuperar a sessão automaticamente" : "Iniciando e autenticando sessão..."}>
						<span className={`${classes.statusBadge} ${classes.statusOpening}`}>
							<CircularProgress size={12} className={classes.statusSpinner} />
							{status === "RECONNECTING" ? "Reconectando..." : "Conectando..."}
						</span>
					</Tooltip>
				);
			case "TIMEOUT":
			case "PAIRING":
				return (
					<Tooltip
						title={
							i18n.t("connections.toolTips.timeout.title") ||
							"Conexão instável ou expirada"
						}
					>
						<span className={`${classes.statusBadge} ${classes.statusTimeout}`}>
							<span className={`${classes.statusDot} ${classes.dotOrange}`} />
							Sessão Expirada
						</span>
					</Tooltip>
				);
			default:
				return (
					<span className={`${classes.statusBadge} ${classes.statusDefault}`}>
						<span className={classes.statusDot} />
						{status || "Desconhecido"}
					</span>
				);
		}
	};

	// Renderizador do Nível de Bateria do Smartphone
	const renderBatteryInfo = whatsApp => {
		const batteryVal = whatsApp.battery ? parseInt(whatsApp.battery, 10) : null;
		const isCharging = Boolean(whatsApp.plugged);

		if (batteryVal === null || isNaN(batteryVal)) {
			return (
				<Tooltip title="Nível de bateria não disponível no momento">
					<div className={`${classes.batteryContainer} ${classes.batteryMuted}`}>
						<BatteryUnknown className={classes.batteryIcon} />
						<span>N/D</span>
					</div>
				</Tooltip>
			);
		}

		let BatteryComponent = BatteryFull;
		let batteryClass = classes.batteryGreen;

		if (isCharging) {
			BatteryComponent = BatteryChargingFull;
			batteryClass = classes.batteryCharging;
		} else if (batteryVal >= 80) {
			BatteryComponent = BatteryFull;
			batteryClass = classes.batteryGreen;
		} else if (batteryVal >= 50) {
			BatteryComponent = Battery80;
			batteryClass = classes.batteryGreen;
		} else if (batteryVal >= 20) {
			BatteryComponent = Battery50;
			batteryClass = classes.batteryAmber;
		} else {
			BatteryComponent = BatteryAlert;
			batteryClass = classes.batteryRed;
		}

		const tooltipText = isCharging
			? `Smartphone carregando (${batteryVal}%)`
			: `Nível de bateria do smartphone: ${batteryVal}%`;

		return (
			<Tooltip title={tooltipText}>
				<div className={`${classes.batteryContainer} ${batteryClass}`}>
					<BatteryComponent className={classes.batteryIcon} />
					<span>
						{batteryVal}% {isCharging ? "⚡" : ""}
					</span>
				</div>
			</Tooltip>
		);
	};

	// Botões de ação contextualizados por status
	const renderCardActionButtons = whatsApp => {
		return (
			<Can
				role={user.profile}
				perform="connections-page:actionButtons"
				yes={() => (
					<>
						{whatsApp.status === "qrcode" && (
							<Button
								variant="contained"
								className={classes.btnQrCodeAction}
								startIcon={<CropFree />}
								onClick={() => handleOpenQrModal(whatsApp)}
							>
								{i18n.t("connections.buttons.qrcode") || "LER QR CODE"}
							</Button>
						)}

						{["DISCONNECTED", "RECONNECT_PAUSED"].includes(whatsApp.status) && (
							<div className={classes.cardActionsGrid}>
								<Button
									size="small"
									variant="outlined"
									className={classes.btnActionReconnect}
									startIcon={<RotateLeft />}
									onClick={() => handleStartWhatsAppSession(whatsApp.id)}
								>
									{i18n.t("connections.buttons.tryAgain") || "Reconectar"}
								</Button>
								<Button
									size="small"
									variant="outlined"
									className={classes.btnActionNewQr}
									startIcon={<CropFree />}
									onClick={() => handleRequestNewQrCode(whatsApp.id)}
								>
									{i18n.t("connections.buttons.newQr") || "Novo QR"}
								</Button>
							</div>
						)}

						{["CONNECTED", "RECONNECTING"].includes(whatsApp.status) && (
							<div className={classes.cardActionsGrid}>
								{whatsApp.status === "CONNECTED" && <Button
									size="small"
									variant="outlined"
									className={classes.btnActionSync}
									startIcon={<Sync />}
									onClick={() => handleSyncTickets(whatsApp.id)}
								>
									Sincronizar
								</Button>}
								<Button
									size="small"
									variant="outlined"
									className={classes.btnActionDisconnect}
									startIcon={<PowerSettingsNew />}
									onClick={() => handleDisconnectWhatsApp(whatsApp.id)}
								>
									{i18n.t("connections.buttons.disconnect") || "Desconectar"}
								</Button>
							</div>
						)}

						{whatsApp.status === "OPENING" && (
							<Button
								size="small"
								variant="outlined"
								disabled
								className={classes.btnActionConnecting}
								startIcon={<CircularProgress size={14} />}
							>
								{i18n.t("connections.buttons.connecting") || "Conectando..."}
							</Button>
						)}

						{(whatsApp.status === "TIMEOUT" || whatsApp.status === "PAIRING") && (
							<div className={classes.cardActionsGrid}>
								<Button
									size="small"
									variant="outlined"
									className={classes.btnActionReconnect}
									startIcon={<RotateLeft />}
									onClick={() => handleStartWhatsAppSession(whatsApp.id)}
								>
									Reconectar
								</Button>
								<Button
									size="small"
									variant="outlined"
									className={classes.btnActionDisconnect}
									startIcon={<PowerSettingsNew />}
									onClick={() => handleDisconnectWhatsApp(whatsApp.id)}
								>
									Desconectar
								</Button>
							</div>
						)}
					</>
				)}
			/>
		);
	};

	return (
		<MainContainer>
			<ConfirmationModal
				title={confirmModalInfo.title}
				open={confirmModalOpen}
				onClose={setConfirmModalOpen}
				onConfirm={handleSubmitConfirmationModal}
			>
				{confirmModalInfo.message}
			</ConfirmationModal>

			<QrcodeModal
				open={qrModalOpen}
				onClose={handleCloseQrModal}
				whatsAppId={!whatsAppModalOpen && selectedWhatsApp?.id}
			/>

			<WhatsAppModal
				open={whatsAppModalOpen}
				onClose={handleCloseWhatsAppModal}
				whatsAppId={!qrModalOpen && selectedWhatsApp?.id}
			/>

			<div className={classes.headerContainer}>
				<div className={classes.headerTop}>
					<div className={classes.titleWrapper}>
						<div className={classes.headerIconContainer}>
							<WhatsAppIcon />
						</div>
						<div>
							<Typography className={classes.titleText}>
								{i18n.t("connections.title") || "Conexões WhatsApp"}
							</Typography>
							<Typography className={classes.subtitleText}>
								Gerencie canais de atendimento, emparelhamento e status em tempo real
							</Typography>
						</div>
					</div>

					<div className={classes.headerActions}>
						<div className={classes.viewToggleGroup}>
							<Tooltip title="Exibição em Cards">
								<IconButton
									size="small"
									className={`${classes.viewToggleBtn} ${
										viewMode === "cards" ? classes.viewToggleBtnActive : ""
									}`}
									onClick={() => setViewMode("cards")}
								>
									<ViewModule fontSize="small" />
								</IconButton>
							</Tooltip>
							<Tooltip title="Exibição em Tabela">
								<IconButton
									size="small"
									className={`${classes.viewToggleBtn} ${
										viewMode === "table" ? classes.viewToggleBtnActive : ""
									}`}
									onClick={() => setViewMode("table")}
								>
									<ViewList fontSize="small" />
								</IconButton>
							</Tooltip>
						</div>

						<Can
							role={user.profile}
							perform="connections-page:addConnection"
							yes={() => (
								<>
									<Button
										variant="outlined"
										className={classes.btnRestart}
										startIcon={<RotateLeft />}
										onClick={restartWhatsapps}
									>
										Reiniciar Conexões
									</Button>
									<Button
										variant="contained"
										className={classes.btnAdd}
										startIcon={<Add />}
										onClick={handleOpenWhatsAppModal}
									>
										{i18n.t("connections.buttons.add") || "Adicionar WhatsApp"}
									</Button>
								</>
							)}
						/>
					</div>
				</div>
			</div>

			<Paper className={classes.mainPaper} elevation={0}>
				{/* Barra de Cards KPI / Métricas Rápidas */}
				<Grid container spacing={2} className={classes.statsRow}>
					<Grid item xs={6} sm={3}>
						<div className={classes.statCard}>
							<div className={classes.statIconCirclePrimary}>
								<WhatsAppIcon fontSize="small" />
							</div>
							<div>
								<div className={classes.statLabel}>Total Conexões</div>
								<div className={classes.statValue}>{stats.total}</div>
							</div>
						</div>
					</Grid>
					<Grid item xs={6} sm={3}>
						<div className={classes.statCard}>
							<div className={classes.statIconCircleGreen}>
								<CheckCircle fontSize="small" />
							</div>
							<div>
								<div className={classes.statLabel}>Online / Ativas</div>
								<div className={classes.statValue} style={{ color: "#10b981" }}>
									{stats.connected}
								</div>
							</div>
						</div>
					</Grid>
					<Grid item xs={6} sm={3}>
						<div className={classes.statCard}>
							<div className={classes.statIconCircleAmber}>
								<CropFree fontSize="small" />
							</div>
							<div>
								<div className={classes.statLabel}>Aguardando QR</div>
								<div className={classes.statValue} style={{ color: "#f59e0b" }}>
									{stats.qrcode}
								</div>
							</div>
						</div>
					</Grid>
					<Grid item xs={6} sm={3}>
						<div className={classes.statCard}>
							<div className={classes.statIconCircleRed}>
								<PowerSettingsNew fontSize="small" />
							</div>
							<div>
								<div className={classes.statLabel}>Desconectadas</div>
								<div className={classes.statValue} style={{ color: "#ef4444" }}>
									{stats.disconnected}
								</div>
							</div>
						</div>
					</Grid>
				</Grid>

				{/* Estado de Carregamento (Loading Skeleton) */}
				{loading ? (
					viewMode === "cards" ? (
						<Grid container spacing={2.5}>
							{[1, 2, 3].map(item => (
								<Grid item xs={12} sm={6} md={4} key={item}>
									<div className={classes.skeletonCard}>
										<Box display="flex" alignItems="center" mb={2}>
											<Skeleton variant="circle" width={48} height={48} />
											<Box ml={2} flex={1}>
												<Skeleton variant="text" width="65%" height={24} />
												<Skeleton variant="text" width="45%" height={18} />
											</Box>
										</Box>
										<Skeleton
											variant="rect"
											height={28}
											style={{ borderRadius: 14, marginBottom: 16 }}
										/>
										<Skeleton variant="text" width="90%" height={20} />
										<Skeleton variant="text" width="55%" height={20} />
										<Box mt={2.5}>
											<Skeleton
												variant="rect"
												height={36}
												style={{ borderRadius: 10 }}
											/>
										</Box>
									</div>
								</Grid>
							))}
						</Grid>
					) : (
						<Table size="small">
							<TableHead>
								<TableRow className={classes.tableHeaderRow}>
									<TableCell>{i18n.t("connections.table.name")}</TableCell>
									<TableCell align="center">{i18n.t("connections.table.number")}</TableCell>
									<TableCell align="center">{i18n.t("connections.table.status")}</TableCell>
									<TableCell align="center">Bateria</TableCell>
									<TableCell align="center">{i18n.t("connections.table.lastUpdate")}</TableCell>
									<TableCell align="center">{i18n.t("connections.table.session")}</TableCell>
									<TableCell align="center">{i18n.t("connections.table.actions")}</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								<TableRowSkeleton columns={7} />
							</TableBody>
						</Table>
					)
				) : whatsApps?.length === 0 ? (
					/* Estado Vazio (Empty State) */
					<div className={classes.emptyStatePaper}>
						<Avatar className={classes.emptyStateAvatar}>
							<WhatsAppIcon className={classes.emptyStateIcon} />
						</Avatar>
						<Typography className={classes.emptyStateTitle}>
							Nenhum canal de WhatsApp conectado
						</Typography>
						<Typography className={classes.emptyStateSubtitle}>
							Conecte seu primeiro número de WhatsApp para começar a atender seus clientes com filas e respostas automáticas.
						</Typography>
						<Can
							role={user.profile}
							perform="connections-page:addConnection"
							yes={() => (
								<Button
									variant="contained"
									className={classes.btnAdd}
									startIcon={<Add />}
									onClick={handleOpenWhatsAppModal}
								>
									{i18n.t("connections.buttons.add") || "Adicionar WhatsApp"}
								</Button>
							)}
						/>
					</div>
				) : viewMode === "cards" ? (
					/* Visualização em Cards (Grid Moderno) */
					<Grid container spacing={2.5}>
						{whatsApps.map(whatsApp => (
							<Grid item xs={12} sm={6} md={4} key={whatsApp.id}>
								<div className={classes.connectionCard}>
									<div className={classes.cardHeader}>
										<div className={classes.channelAvatarWrapper}>
											<WhatsAppIcon />
										</div>
										<div className={classes.channelMeta}>
											<div className={classes.channelNameRow}>
												<Typography className={classes.channelName} title={whatsApp.name}>
													{whatsApp.name}
												</Typography>
												{whatsApp.isDefault && (
													<Chip
														size="small"
														icon={<Star fontSize="small" />}
														label="Padrão"
														className={classes.defaultChip}
													/>
												)}
											</div>
											<div className={classes.channelPhone}>
												<Phone className={classes.phoneIcon} />
												<span>
													{whatsApp.number
														? formatSerializedId(whatsApp.number)
														: "Sem número"}
												</span>
											</div>
										</div>
										<Can
											role={user.profile}
											perform="connections-page:editOrDeleteConnection"
											yes={() => (
												<div className={classes.cardActionsMenu}>
													<Tooltip title="Editar Conexão">
														<IconButton
															size="small"
															className={classes.iconActionBtn}
															onClick={() => handleEditWhatsApp(whatsApp)}
														>
															<Edit fontSize="small" />
														</IconButton>
													</Tooltip>
													<Tooltip title="Excluir Conexão">
														<IconButton
															size="small"
															className={`${classes.iconActionBtn} ${classes.iconActionBtnDelete}`}
															onClick={() => handleDeleteWhatsApp(whatsApp.id)}
														>
															<DeleteOutline fontSize="small" />
														</IconButton>
													</Tooltip>
												</div>
											)}
										/>
									</div>

									<div className={classes.cardBody}>
										<div className={classes.statusRow}>
											<div>{renderStatusBadge(whatsApp.status)}</div>
											<div>{renderBatteryInfo(whatsApp)}</div>
										</div>

										{whatsApp.queues && whatsApp.queues.length > 0 && (
											<div className={classes.queuesContainer}>
												{whatsApp.queues.map(queue => (
													<Chip
														key={queue.id}
														label={queue.name}
														size="small"
														className={classes.queueChip}
														style={{
															backgroundColor: queue.color
																? `${queue.color}25`
																: "#e2e8f0",
															color: queue.color || "#475569",
															border: `1px solid ${queue.color || "#cbd5e1"}`,
														}}
													/>
												))}
											</div>
										)}

										<div className={classes.metaInfoRow}>
											<div className={classes.lastSyncTime}>
												<AccessTime className={classes.clockIcon} />
												<span>
													{whatsApp.updatedAt
														? format(parseISO(whatsApp.updatedAt), "dd/MM/yyyy HH:mm")
														: "-"}
												</span>
											</div>
											<span>ID #{whatsApp.id}</span>
										</div>
									</div>

									<div className={classes.cardFooter}>
										{renderCardActionButtons(whatsApp)}
									</div>
								</div>
							</Grid>
						))}
					</Grid>
				) : (
					/* Visualização em Tabela Refinada SaaS */
					<div className={classes.tablePaper}>
						<Table size="small">
							<TableHead>
								<TableRow className={classes.tableHeaderRow}>
									<TableCell>{i18n.t("connections.table.name")}</TableCell>
									<TableCell align="center">{i18n.t("connections.table.number")}</TableCell>
									<TableCell align="center">{i18n.t("connections.table.status")}</TableCell>
									<TableCell align="center">Bateria</TableCell>
									<TableCell align="center">Filas</TableCell>
									<TableCell align="center">{i18n.t("connections.table.lastUpdate")}</TableCell>
									<Can
										role={user.profile}
										perform="connections-page:actionButtons"
										yes={() => (
											<TableCell align="center">{i18n.t("connections.table.session")}</TableCell>
										)}
									/>
									<Can
										role={user.profile}
										perform="connections-page:editOrDeleteConnection"
										yes={() => (
											<TableCell align="center">{i18n.t("connections.table.actions")}</TableCell>
										)}
									/>
								</TableRow>
							</TableHead>
							<TableBody>
								{whatsApps.map(whatsApp => (
									<TableRow key={whatsApp.id} className={classes.tableRow}>
										<TableCell>
											<div className={classes.tableChannelCell}>
												<Avatar className={classes.tableAvatar}>
													<WhatsAppIcon fontSize="small" />
												</Avatar>
												<div>
													<Typography
														variant="subtitle2"
														style={{ fontWeight: 600 }}
													>
														{whatsApp.name}
													</Typography>
													{whatsApp.isDefault && (
														<Chip
															size="small"
															icon={<Star fontSize="small" />}
															label="Padrão"
															className={classes.defaultChip}
															style={{ marginTop: 2 }}
														/>
													)}
												</div>
											</div>
										</TableCell>
										<TableCell align="center">
											<Typography variant="body2" style={{ fontWeight: 500 }}>
												{whatsApp.number
													? formatSerializedId(whatsApp.number)
													: "-"}
											</Typography>
										</TableCell>
										<TableCell align="center">
											{renderStatusBadge(whatsApp.status)}
										</TableCell>
										<TableCell align="center">
											{renderBatteryInfo(whatsApp)}
										</TableCell>
										<TableCell align="center">
											{whatsApp.queues && whatsApp.queues.length > 0 ? (
												<div
													style={{
														display: "flex",
														gap: 4,
														justifyContent: "center",
														flexWrap: "wrap",
													}}
												>
													{whatsApp.queues.map(queue => (
														<Chip
															key={queue.id}
															label={queue.name}
															size="small"
															className={classes.queueChip}
															style={{
																backgroundColor: queue.color
																	? `${queue.color}25`
																	: "#e2e8f0",
																color: queue.color || "#475569",
																border: `1px solid ${queue.color || "#cbd5e1"}`,
															}}
														/>
													))}
												</div>
											) : (
												"-"
											)}
										</TableCell>
										<TableCell align="center">
											<Typography variant="body2" color="textSecondary">
												{whatsApp.updatedAt
													? format(parseISO(whatsApp.updatedAt), "dd/MM/yy HH:mm")
													: "-"}
											</Typography>
										</TableCell>
										<Can
											role={user.profile}
											perform="connections-page:actionButtons"
											yes={() => (
												<TableCell align="center" style={{ minWidth: 200 }}>
													{renderCardActionButtons(whatsApp)}
												</TableCell>
											)}
										/>
										<Can
											role={user.profile}
											perform="connections-page:editOrDeleteConnection"
											yes={() => (
												<TableCell align="center">
													<Tooltip title="Editar">
														<IconButton
															size="small"
															className={classes.iconActionBtn}
															onClick={() => handleEditWhatsApp(whatsApp)}
														>
															<Edit fontSize="small" />
														</IconButton>
													</Tooltip>
													<Tooltip title="Excluir">
														<IconButton
															size="small"
															className={`${classes.iconActionBtn} ${classes.iconActionBtnDelete}`}
															onClick={() => handleDeleteWhatsApp(whatsApp.id)}
														>
															<DeleteOutline fontSize="small" />
														</IconButton>
													</Tooltip>
												</TableCell>
											)}
										/>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</Paper>
		</MainContainer>
	);
};

export default Connections;
