import React, { useState, useEffect, useCallback } from "react";
import { makeStyles, Paper, Typography, Modal } from "@material-ui/core";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import { i18n } from "../../translate/i18n";
import useHelps from "../../hooks/useHelps";

const useStyles = makeStyles((theme) => ({
  mainPaperContainer: {
    overflowY: "auto",
    flex: 1,
    borderRadius: 14,
    border: "1px solid var(--border-hairline)",
    backgroundColor: "var(--bg-surface)",
    padding: theme.spacing(2.5),
    ...theme.scrollbarStyles,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: theme.spacing(2.5),
  },
  helpPaper: {
    position: "relative",
    width: "100%",
    borderRadius: 12,
    border: "1px solid var(--border-hairline)",
    backgroundColor: "var(--bg-canvas)",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "none",
    transition: "transform var(--t-in) var(--ease-ui), border-color var(--t-in) var(--ease-ui)",
    "&:hover": {
      transform: "translateY(-2px)",
      borderColor: "var(--border-strong)",
      "& $videoThumbnail": {
        transform: "scale(1.03)",
      },
    },
  },
  thumbFrame: {
    width: "100%",
    aspectRatio: "16 / 9",
    overflow: "hidden",
    backgroundColor: "#07130E",
  },
  videoThumbnail: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    transition: "transform 400ms var(--ease-ui)",
  },
  cardContent: {
    padding: theme.spacing(2),
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  videoTitle: {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: "0.95rem",
    color: "var(--ink-primary)",
    lineHeight: 1.3,
  },
  videoDescription: {
    fontSize: "0.825rem",
    color: "var(--ink-secondary)",
    lineHeight: 1.45,
    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  videoModal: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(2),
  },
  videoModalContent: {
    outline: "none",
    width: "100%",
    maxWidth: 960,
    aspectRatio: "16 / 9",
    position: "relative",
    backgroundColor: "#07130E",
    borderRadius: 16,
    border: "1px solid var(--border-strong)",
    overflow: "hidden",
  },
  emptyState: {
    padding: theme.spacing(5),
    textAlign: "center",
    color: "var(--ink-secondary)",
  },
}));

const Helps = () => {
  const classes = useStyles();
  const [records, setRecords] = useState([]);
  const { list } = useHelps();
  const [selectedVideo, setSelectedVideo] = useState(null);

  useEffect(() => {
    async function fetchData() {
      const helps = await list();
      setRecords(helps);
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openVideoModal = (video) => {
    setSelectedVideo(video);
  };

  const closeVideoModal = () => {
    setSelectedVideo(null);
  };

  const handleModalClose = useCallback((event) => {
    if (event.key === "Escape") {
      closeVideoModal();
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleModalClose);
    return () => {
      document.removeEventListener("keydown", handleModalClose);
    };
  }, [handleModalClose]);

  const renderVideoModal = () => {
    return (
      <Modal
        open={Boolean(selectedVideo)}
        onClose={closeVideoModal}
        className={classes.videoModal}
      >
        <div className={classes.videoModalContent}>
          {selectedVideo && (
            <iframe
              style={{
                width: "100%",
                height: "100%",
                position: "absolute",
                top: 0,
                left: 0,
              }}
              src={`https://www.youtube.com/embed/${selectedVideo}`}
              title="Tutorial PortAI"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
      </Modal>
    );
  };

  return (
    <MainContainer>
      <MainHeader>
        <Title>
          {i18n.t("helps.title")} ({records.length})
        </Title>
        <MainHeaderButtonsWrapper />
      </MainHeader>

      <Paper className={classes.mainPaperContainer} elevation={0}>
        {records.length ? (
          <div className={classes.grid}>
            {records.map((record, key) => (
              <Paper
                key={key}
                elevation={0}
                className={classes.helpPaper}
                onClick={() => openVideoModal(record.video)}
              >
                <div className={classes.thumbFrame}>
                  <img
                    src={`https://img.youtube.com/vi/${record.video}/mqdefault.jpg`}
                    alt={record.title || "Thumbnail do tutorial"}
                    className={classes.videoThumbnail}
                  />
                </div>
                <div className={classes.cardContent}>
                  <Typography className={classes.videoTitle}>
                    {record.title}
                  </Typography>
                  <Typography className={classes.videoDescription}>
                    {record.description}
                  </Typography>
                </div>
              </Paper>
            ))}
          </div>
        ) : (
          <div className={classes.emptyState}>
            <Typography variant="body2">
              Nenhum tutorial cadastrado no momento.
            </Typography>
          </div>
        )}
      </Paper>

      {renderVideoModal()}
    </MainContainer>
  );
};

export default Helps;
