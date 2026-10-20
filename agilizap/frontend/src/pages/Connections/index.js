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
		backgroundColor: theme.palette.type === "dark" ? "#07130e" : "#f8fafc",
		border: theme.palette.type === "dark" ? "1px solid rgba(16, 185, 129, 0.18)" : "1px solid rgba(226, 232, 240, 0.9)",
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
		background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		color: "#ffffff",
		boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)",
	},
	titleText: {
		fontWeight: 700,
		fontSize: "1.45rem",
		color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
		lineHeight: 1.2,
	},
	subtitleText: {
		fontSize: "0.85rem",
		color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
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
		backgroundColor: theme.palette.type === "dark" ? "#1e293b" : "#ffffff",
		borderRadius: 10,
		padding: 3,
		border: theme.palette.type === "dark" ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid #e2e8f0",
		boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
	},
	viewToggleBtn: {
		padding: 6,
		borderRadius: 8,
		color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
		transition: "all 0.2s ease",
		"&:hover": {
			color: "#10b981",
		},
	},
	viewToggleBtnActive: {
		backgroundColor: theme.palette.type === "dark" ? "#334155" : "#ecfdf5",
		color: "#10b981",
		boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
	},
	btnRestart: {
		textTransform: "none",
		fontWeight: 600,
		borderRadius: 10,
		padding: "7px 14px",
		color: theme.palette.type === "dark" ? "#cbd5e1" : "#475569",
		backgroundColor: theme.palette.type === "dark" ? "#0d2219" : "#ffffff",
		border: theme.palette.type === "dark" ? "1px solid rgba(16, 185, 129, 0.2)" : "1px solid #cbd5e1",
		boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
		"&:hover": {
			backgroundColor: theme.palette.type === "dark" ? "#122c21" : "#f1f5f9",
			borderColor: "#10b981",
		},
	},
	btnAdd: {
		textTransform: "none",
		fontWeight: 600,
		borderRadius: 10,
		padding: "8px 18px",
		background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
		color: "#ffffff",
		boxShadow: "0 4px 14px rgba(16, 185, 129, 0.35)",
		transition: "all 0.2s ease",
		"&:hover": {
			background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
			boxShadow: "0 6px 18px rgba(16, 185, 129, 0.45)",
			transform: "translateY(-1px)",
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
		backgroundColor: theme.palette.type === "dark" ? "#0d2219" : "#ffffff",
		border: theme.palette.type === "dark" ? "1px solid rgba(16, 185, 129, 0.18)" : "1px solid rgba(226, 232, 240, 0.9)",
		boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
	},
	statIconCirclePrimary: {
		width: 38,
		height: 38,
		borderRadius: 10,
		backgroundColor: theme.palette.type === "dark" ? "rgba(16, 185, 129, 0.15)" : "#ecfdf5",
		color: "#10b981",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
	},
	statIconCircleGreen: {
		width: 38,
		height: 38,
		borderRadius: 10,
		backgroundColor: theme.palette.type === "dark" ? "rgba(34, 197, 94, 0.15)" : "#f0fdf4",
		color: "#22c55e",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
	},
	statIconCircleAmber: {
		width: 38,
		height: 38,
		borderRadius: 10,
		backgroundColor: theme.palette.type === "dark" ? "rgba(245, 158, 11, 0.15)" : "#fffbeb",
		color: "#f59e0b",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
	},
	statIconCircleRed: {
		width: 38,
		height: 38,
		borderRadius: 10,
		backgroundColor: theme.palette.type === "dark" ? "rgba(239, 68, 68, 0.15)" : "#fef2f2",
		color: "#ef4444",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
	},
	statLabel: {
		fontSize: "0.75rem",
		fontWeight: 500,
		color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
		textTransform: "uppercase",
		letterSpacing: "0.5px",
	},
	statValue: {
		fontWeight: 700,
		fontSize: "1.25rem",
		color: theme.palette.type === "dark" ? "#f8fafc" : "#0f172a",
		lineHeight: 1.2,
	},
	connectionCard: {
		borderRadius: 16,
		backgroundColor: theme.palette.type === "dark" ? "#0d2219" : "#ffffff",
		border: theme.palette.type === "dark" ? "1px solid rgba(16, 185, 129, 0.18)" : "1px solid rgba(226, 232, 240, 0.9)",
		boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
		display: "flex",
		flexDirection: "column",
		justifyContent: "space-between",
		transition: "all 0.25s ease-in-out",
		position: "relative",
		overflow: "hidden",
		"&:hover": {
			transform: "translateY(-3px)",
			boxShadow: theme.palette.type === "dark" ? "0 12px 28px rgba(0, 0, 0, 0.4)" : "0 12px 28px rgba(0, 0, 0, 0.08)",
			borderColor: theme.palette.type === "dark" ? "rgba(16, 185, 129, 0.4)" : "#a7f3d0",
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
		borderRadius: 14,
		background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		color: "#ffffff",
		boxShadow: "0 4px 10px rgba(18, 140, 126, 0.25)",
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
		fontWeight: 700,
		fontSize: "1rem",
		color: theme.palette.type === "dark" ? "#f8fafc" : "#0f172a",
		whiteSpace: "nowrap",
		overflow: "hidden",
		textOverflow: "ellipsis",
	},
	defaultChip: {
		height: 20,
		fontSize: "0.68rem",
		fontWeight: 700,
		backgroundColor: theme.palette.type === "dark" ? "rgba(245, 158, 11, 0.2)" : "#fef3c7",
		color: theme.palette.type === "dark" ? "#fbbf24" : "#b45309",
		border: "1px solid #fde68a",
		"& .MuiChip-icon": {
			color: "inherit",
			marginLeft: 4,
			marginRight: -4,
		},
	},
	channelPhone: {
		fontSize: "0.82rem",
		color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
		display: "flex",
		alignItems: "center",
		gap: 4,
		marginTop: 2,
	},
	phoneIcon: {
		fontSize: 14,
		color: theme.palette.type === "dark" ? "#64748b" : "#94a3b8",
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
		backgroundColor: theme.palette.type === "dark" ? "rgba(15, 23, 42, 0.5)" : "#f8fafc",
		borderTop: theme.palette.type === "dark" ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid #f1f5f9",
	},
	btnQrCodeAction: {
		width: "100%",
		fontWeight: 700,
		fontSize: "0.82rem",
		textTransform: "none",
		borderRadius: 10,
		padding: "8px 14px",
		background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
		color: "#ffffff",
		boxShadow: "0 3px 10px rgba(16, 185, 129, 0.3)",
		transition: "all 0.2s ease",
		"&:hover": {
			background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
			boxShadow: "0 4px 14px rgba(16, 185, 129, 0.4)",
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
		backgroundColor: theme.palette.type === "dark" ? "#1e3a8a" : "#eff6ff",
		color: theme.palette.type === "dark" ? "#93c5fd" : "#1d4ed8",
		border: "1px solid #bfdbfe",
		"&:hover": {
			backgroundColor: theme.palette.type === "dark" ? "#1d4ed8" : "#dbeafe",
		},
	},
	btnActionNewQr: {
		flex: 1,
		textTransform: "none",
		fontWeight: 600,
		fontSize: "0.8rem",
		borderRadius: 10,
		padding: "6px 12px",
		backgroundColor: theme.palette.type === "dark" ? "#78350f" : "#fffbeb",
		color: theme.palette.type === "dark" ? "#fcd34d" : "#b45309",
		border: "1px solid #fde68a",
		"&:hover": {
			backgroundColor: theme.palette.type === "dark" ? "#92400e" : "#fef3c7",
		},
	},
	btnActionSync: {
		flex: 1,
		textTransform: "none",
		fontWeight: 600,
		fontSize: "0.8rem",
		borderRadius: 10,
		padding: "6px 12px",
		backgroundColor: theme.palette.type === "dark" ? "rgba(16, 185, 129, 0.12)" : "#ecfdf5",
		color: theme.palette.type === "dark" ? "#34d399" : "#059669",
		border: "1px solid #a7f3d0",
		"&:hover": {
			backgroundColor: theme.palette.type === "dark" ? "rgba(16, 185, 129, 0.22)" : "#d1fae5",
		},
	},
	btnActionDisconnect: {
		flex: 1,
		textTransform: "none",
		fontWeight: 600,
		fontSize: "0.8rem",
		borderRadius: 10,
		padding: "6px 12px",
		backgroundColor: theme.palette.type === "dark" ? "rgba(239, 68, 68, 0.12)" : "#fef2f2",
		color: theme.palette.type === "dark" ? "#f87171" : "#dc2626",
		border: "1px solid #fecaca",
		"&:hover": {
			backgroundColor: theme.palette.type === "dark" ? "rgba(239, 68, 68, 0.22)" : "#fee2e2",
		},
	},
	btnActionConnecting: {
		width: "100%",
		textTransform: "none",
		fontWeight: 600,
		fontSize: "0.8rem",
		borderRadius: 10,
		padding: "6px 12px",
		backgroundColor: theme.palette.type === "dark" ? "#1e293b" : "#f1f5f9",
		color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
	},
	tablePaper: {
		borderRadius: 14,
		overflow: "hidden",
		border: theme.palette.type === "dark" ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
		backgroundColor: theme.palette.type === "dark" ? "#1e293b" : "#ffffff",
		boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
	},
	tableHeaderRow: {
		backgroundColor: theme.palette.type === "dark" ? "#0f172a" : "#f8fafc",
		"& th": {
			fontWeight: 700,
			fontSize: "0.8rem",
			textTransform: "uppercase",
			letterSpacing: "0.5px",
			color: theme.palette.type === "dark" ? "#94a3b8" : "#475569",
			borderBottom: theme.palette.type === "dark" ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
			padding: theme.spacing(1.75, 2),
		},
	},
	tableRow: {
		transition: "background-color 0.15s ease",
		"&:hover": {
			backgroundColor: theme.palette.type === "dark" ? "rgba(255, 255, 255, 0.03)" : "#f8fafc",
		},
		"& td": {
			padding: theme.spacing(1.5, 2),
			borderBottom: theme.palette.type === "dark" ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid #f1f5f9",
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
		background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
		color: "#ffffff",
	},
	emptyStatePaper: {
		padding: theme.spacing(6, 3),
		borderRadius: 16,
		textAlign: "center",
		backgroundColor: theme.palette.type === "dark" ? "#1e293b" : "#ffffff",
		border: theme.palette.type === "dark" ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
		boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		maxWidth: 480,
		margin: "40px auto",
	},
	emptyStateAvatar: {
		width: 72,
		height: 72,
		borderRadius: 24,
		backgroundColor: theme.palette.type === "dark" ? "rgba(16, 185, 129, 0.15)" : "#ecfdf5",
		color: "#10b981",
		marginBottom: theme.spacing(2),
	},
	emptyStateIcon: {
		fontSize: 36,
	},
	emptyStateTitle: {
		fontWeight: 700,
		fontSize: "1.2rem",
		color: theme.palette.type === "dark" ? "#f8fafc" : "#0f172a",
		marginBottom: theme.spacing(1),
	},
	emptyStateSubtitle: {
		fontSize: "0.9rem",
		color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
		marginBottom: theme.spacing(3),
		maxWidth: 380,
	},
	skeletonCard: {
		padding: theme.spacing(2.5),
		borderRadius: 16,
		backgroundColor: theme.palette.type === "dark" ? "#1e293b" : "#ffffff",
		border: theme.palette.type === "dark" ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
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
		const disconnected = whatsApps?.filter(w => w.status === "DISCONNECTED" || w.status === "TIMEOUT").length || 0;
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
			case "DISCONNECTED":
				return (
					<Tooltip
						title={
							i18n.t("connections.toolTips.disconnected.title") ||
							"Sessão desconectada. Clique para reconectar."
						}
					>
						<span className={`${classes.statusBadge} ${classes.statusDisconnected}`}>
							<span className={`${classes.statusDot} ${classes.dotRed}`} />
							Desconectado
						</span>
					</Tooltip>
				);
			case "OPENING":
				return (
					<Tooltip title="Iniciando e autenticando sessão...">
						<span className={`${classes.statusBadge} ${classes.statusOpening}`}>
							<CircularProgress size={12} className={classes.statusSpinner} />
							Conectando...
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

						{whatsApp.status === "DISCONNECTED" && (
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

						{whatsApp.status === "CONNECTED" && (
							<div className={classes.cardActionsGrid}>
								<Button
									size="small"
									variant="outlined"
									className={classes.btnActionSync}
									startIcon={<Sync />}
									onClick={() => handleSyncTickets(whatsApp.id)}
								>
									Sincronizar
								</Button>
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