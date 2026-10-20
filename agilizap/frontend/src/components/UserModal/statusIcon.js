import React from "react";
import { makeStyles } from "@material-ui/core";

const useStyles = makeStyles((theme) => ({
    statusPillOnline: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 14,
        fontSize: "0.75rem",
        fontWeight: 700,
        backgroundColor:
            theme.palette.type === "dark"
                ? "rgba(16, 185, 129, 0.18)"
                : "rgba(16, 185, 129, 0.12)",
        color: theme.palette.type === "dark" ? "#34d399" : "#059669",
        border: `1px solid ${
            theme.palette.type === "dark"
                ? "rgba(16, 185, 129, 0.3)"
                : "rgba(16, 185, 129, 0.25)"
        }`,
    },
    statusPillOffline: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 14,
        fontSize: "0.75rem",
        fontWeight: 600,
        backgroundColor:
            theme.palette.type === "dark"
                ? "rgba(148, 163, 184, 0.1)"
                : "#f1f5f9",
        color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
        border: `1px solid ${
            theme.palette.type === "dark"
                ? "rgba(148, 163, 184, 0.15)"
                : "rgba(226, 232, 240, 0.8)"
        }`,
    },
    statusDotOnline: {
        width: 7,
        height: 7,
        borderRadius: "50%",
        backgroundColor: "#10b981",
        boxShadow: "0 0 0 2px rgba(16, 185, 129, 0.35)",
    },
    statusDotOffline: {
        width: 7,
        height: 7,
        borderRadius: "50%",
        backgroundColor: "#94a3b8",
    },
}));

const UserStatusIcon = ({ user }) => {
    const classes = useStyles();
    const isOnline = Boolean(user && user.online);

    return (
        <span className={isOnline ? classes.statusPillOnline : classes.statusPillOffline}>
            <span className={isOnline ? classes.statusDotOnline : classes.statusDotOffline} />
            <span>{isOnline ? "Online" : "Offline"}</span>
        </span>
    );
};

export default UserStatusIcon;