import React, { useState, useRef } from "react";

import Popover from "@material-ui/core/Popover";
import IconButton from "@material-ui/core/IconButton";
import List from "@material-ui/core/List";
import { makeStyles } from "@material-ui/core/styles";
import VolumeUpIcon from "@material-ui/icons/VolumeUp";
import VolumeDownIcon from "@material-ui/icons/VolumeDown";

import { Grid, Slider } from "@material-ui/core";

const useStyles = makeStyles((theme) => ({
    tabContainer: {
        padding: theme.spacing(2),
    },
    popoverPaper: {
        width: "100%",
        maxWidth: 350,
        marginLeft: theme.spacing(2),
        marginRight: theme.spacing(1),
        [theme.breakpoints.down("sm")]: {
            maxWidth: 270,
        },
    },
    noShadow: {
        boxShadow: "none !important",
    },
    icons: {
		color: theme.mode === "light" ? "#475569" : "#cbd5e1",
		backgroundColor:
			theme.mode === "light"
				? "rgba(248, 250, 252, 0.95)"
				: "rgba(255, 255, 255, 0.04)",
		border:
			theme.mode === "light"
				? "1px solid rgba(226, 232, 240, 0.95)"
				: "1px solid rgba(16, 185, 129, 0.18)",
		width: 40,
		height: 40,
		minWidth: 40,
		borderRadius: 12,
		padding: 0,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02)",
		transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
		"&:hover": {
			backgroundColor:
				theme.mode === "light"
					? "rgba(16, 185, 129, 0.08)"
					: "rgba(37, 211, 102, 0.12)",
			borderColor:
				theme.mode === "light"
					? "rgba(16, 185, 129, 0.35)"
					: "rgba(37, 211, 102, 0.35)",
			color: theme.mode === "light" ? "#10b981" : "#34d399",
			transform: "translateY(-1px)",
		},
	},
	customBadge: {
        backgroundColor: "#f44336",
        color: "#fff",
    },
}));

const NotificationsVolume = ({ volume, setVolume }) => {
    const classes = useStyles();

    const anchorEl = useRef();
    const [isOpen, setIsOpen] = useState(false);

    const handleClick = () => {
        setIsOpen((prevState) => !prevState);
    };

    const handleClickAway = () => {
        setIsOpen(false);
    };

    const handleVolumeChange = (value) => {
        setVolume(value);
        localStorage.setItem("volume", value);
    };

    return (
        <>
            <IconButton
                className={classes.icons}
                onClick={handleClick}
                ref={anchorEl}
                aria-label="Open Notifications"
                // color="inherit"
                // color="secondary"
            >
                <VolumeUpIcon color="inherit" />
            </IconButton>
            <Popover
                disableScrollLock
                open={isOpen}
                anchorEl={anchorEl.current}
                anchorOrigin={{
                    vertical: "bottom",
                    horizontal: "right",
                }}
                transformOrigin={{
                    vertical: "top",
                    horizontal: "right",
                }}
                classes={{ paper: classes.popoverPaper }}
                onClose={handleClickAway}
            >
                <List dense className={classes.tabContainer}>
                    <Grid container spacing={2}>
                        <Grid item>
                            <VolumeDownIcon />
                        </Grid>
                        <Grid item xs>
                            <Slider
                                value={volume}
                                aria-labelledby="continuous-slider"
                                step={0.1}
                                min={0}
                                max={1}
                                onChange={(e, value) =>
                                    handleVolumeChange(value)
                                }
                            />
                        </Grid>
                        <Grid item>
                            <VolumeUpIcon />
                        </Grid>
                    </Grid>
                </List>
            </Popover>
        </>
    );
};

export default NotificationsVolume;
