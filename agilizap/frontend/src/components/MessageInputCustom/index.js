import React, { useState, useEffect, useContext, useRef } from "react";
import withWidth, { isWidthUp } from "@material-ui/core/withWidth";
import "emoji-mart/css/emoji-mart.css";
import { Picker } from "emoji-mart";
import MicRecorder from "../../helpers/MicRecorder";
import clsx from "clsx";
import { isNil, isString, isEmpty, isObject, has } from "lodash";
import { Reply } from "@material-ui/icons";
import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import InputBase from "@material-ui/core/InputBase";
import CircularProgress from "@material-ui/core/CircularProgress";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import IconButton from "@material-ui/core/IconButton";
import MoodIcon from "@material-ui/icons/Mood";
import SendIcon from "@material-ui/icons/Send";
import CancelIcon from "@material-ui/icons/Cancel";
import ClearIcon from "@material-ui/icons/Clear";
import MicIcon from "@material-ui/icons/Mic";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import HighlightOffIcon from "@material-ui/icons/HighlightOff";
import { FormControlLabel, Switch, Tooltip } from "@material-ui/core";
import Autocomplete from "@material-ui/lab/Autocomplete";
import axios from "axios";
import Compressor from "compressorjs";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import RecordingTimer from "./RecordingTimer";
import { ReplyMessageContext } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { ForwardMessageContext } from "../../context/ForwarMessage/ForwardMessageContext";
import { AuthContext } from "../../context/Auth/AuthContext";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import toastError from "../../errors/toastError";
import LinearWithValueLabel from "./ProgressBarCustom";
import useQuickMessages from "../../hooks/useQuickMessages";

const Mp3Recorder = new MicRecorder({ bitRate: 128 });

const useStyles = makeStyles((theme) => ({
  mainWrapper: {
    backgroundColor: theme.palette.type === "dark" ? "#14181f" : "#f8fafc",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    borderTop: `1px solid ${
      theme.palette.type === "dark" ? "rgba(255, 255, 255, 0.08)" : "#e2e8f0"
    }`,
    position: "relative",
    width: "100%",
  },

  newMessageBox: {
    backgroundColor: theme.palette.type === "dark" ? "#07130e" : "#f1f5f9",
    width: "100%",
    display: "flex",
    padding: "8px 12px",
    alignItems: "center",
    gap: "6px",
    borderTop: `1px solid ${
      theme.palette.type === "dark" ? "rgba(16, 185, 129, 0.15)" : "#e2e8f0"
    }`,
  },

  messageInputWrapper: {
    padding: "3px 14px",
    backgroundColor: theme.palette.type === "dark" ? "#0d2219" : "#ffffff",
    display: "flex",
    borderRadius: 24,
    flex: 1,
    alignItems: "center",
    border: `1px solid ${
      theme.palette.type === "dark" ? "rgba(16, 185, 129, 0.2)" : "#e2e8f0"
    }`,
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
    transition: "all 0.2s ease",
    "&:focus-within": {
      borderColor: theme.palette.type === "dark" ? "#25d366" : "#10b981",
      boxShadow: "0 0 0 3px rgba(16, 185, 129, 0.15)",
      backgroundColor: theme.palette.type === "dark" ? "#122c21" : "#ffffff",
    },
  },

  messageInput: {
    paddingLeft: 4,
    flex: 1,
    border: "none",
    fontSize: "0.9rem",
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#1e293b",
  },

  iconButton: {
    padding: 8,
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    transition: "all 0.2s ease",
    "&:hover": {
      color: "#10b981",
      backgroundColor: "rgba(16, 185, 129, 0.08)",
    },
  },

  sendFloatingButton: {
    backgroundColor: "#10b981",
    color: "#ffffff",
    width: 40,
    height: 40,
    borderRadius: "50%",
    boxShadow: "0 2px 6px rgba(16, 185, 129, 0.35)",
    transition: "all 0.2s ease",
    padding: 8,
    "&:hover": {
      backgroundColor: "#059669",
      transform: "scale(1.05)",
    },
    "&:disabled": {
      backgroundColor: theme.palette.type === "dark" ? "#334155" : "#cbd5e1",
      color: "#94a3b8",
      boxShadow: "none",
    },
  },

  micButton: {
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    padding: 8,
    transition: "all 0.2s ease",
    "&:hover": {
      color: "#10b981",
      backgroundColor: "rgba(16, 185, 129, 0.08)",
    },
  },

  ForwardMessageIcons: {
    color: "#ffffff",
    transform: "scaleX(-1)",
  },

  uploadInput: {
    display: "none",
  },

  viewMediaInputWrapper: {
    display: "flex",
    padding: "10px 16px",
    position: "relative",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.palette.type === "dark" ? "#1e242d" : "#f1f5f9",
    borderTop: `1px solid ${
      theme.palette.type === "dark" ? "rgba(255, 255, 255, 0.08)" : "#e2e8f0"
    }`,
    width: "100%",
  },

  emojiBox: {
    position: "absolute",
    bottom: 64,
    left: 12,
    zIndex: 100,
    boxShadow: "0 10px 25px rgba(0, 0, 0, 0.25)",
    borderRadius: 16,
    overflow: "hidden",
    border: `1px solid ${
      theme.palette.type === "dark" ? "rgba(255,255,255,0.1)" : "#e2e8f0"
    }`,
  },

  audioLoading: {
    color: "#10b981",
    opacity: "80%",
  },

  recorderWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: theme.palette.type === "dark" ? "#222731" : "#ffffff",
    borderRadius: 24,
    padding: "2px 10px",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    boxShadow: "0 1px 4px rgba(239, 68, 68, 0.1)",
  },

  cancelAudioIcon: {
    color: "#ef4444",
  },

  sendAudioIcon: {
    color: "#10b981",
  },

  replyginMsgWrapper: {
    display: "flex",
    width: "100%",
    padding: "8px 12px 0 12px",
  },

  replyginMsgContainer: {
    flex: 1,
    overflowY: "hidden",
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255, 255, 255, 0.05)"
        : "rgba(0, 0, 0, 0.04)",
    borderRadius: 10,
    borderLeft: "4px solid #10b981",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 12px",
  },

  replyginMsgBody: {
    fontSize: "0.82rem",
    lineHeight: "1.3",
    color: theme.palette.type === "dark" ? "#cbd5e1" : "#475569",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
  },

  messageContactName: {
    fontSize: "0.8rem",
    fontWeight: 700,
    color: "#10b981",
    marginBottom: 2,
  },

  switchLabel: {
    fontSize: "0.78rem",
    fontWeight: 600,
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
  },

  customSwitch: {
    "& .MuiSwitch-switchBase.Mui-checked": {
      color: "#10b981",
      "&:hover": {
        backgroundColor: "rgba(16, 185, 129, 0.08)",
      },
    },
    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
      backgroundColor: "#10b981",
    },
  },
}));

const EmojiOptions = (props) => {
  const { disabled, showEmoji, setShowEmoji, handleAddEmoji } = props;
  const classes = useStyles();
  return (
    <>
      <Tooltip title="Emojis">
        <span>
          <IconButton
            aria-label="emojiPicker"
            component="span"
            disabled={disabled}
            className={classes.iconButton}
            onClick={() => setShowEmoji((prevState) => !prevState)}
          >
            <MoodIcon />
          </IconButton>
        </span>
      </Tooltip>
      {showEmoji ? (
        <div className={classes.emojiBox}>
          <Picker
            perLine={16}
            showPreview={false}
            showSkinTones={false}
            onSelect={handleAddEmoji}
          />
        </div>
      ) : null}
    </>
  );
};

const SignSwitch = (props) => {
  const { width, setSignMessage, signMessage } = props;
  const classes = useStyles();
  if (isWidthUp("md", width)) {
    return (
      <FormControlLabel
        style={{ marginRight: 6 }}
        label={
          <span className={classes.switchLabel}>
            {i18n.t("messagesInput.signMessage")}
          </span>
        }
        labelPlacement="start"
        control={
          <Switch
            size="small"
            checked={signMessage}
            onChange={(e) => {
              setSignMessage(e.target.checked);
            }}
            name="signMessage"
            className={classes.customSwitch}
          />
        }
      />
    );
  }
  return null;
};

const FileInput = (props) => {
  const { handleChangeMedias, disableOption } = props;
  const classes = useStyles();
  return (
    <>
      <input
        multiple
        type="file"
        id="upload-button"
        disabled={disableOption()}
        className={classes.uploadInput}
        onChange={handleChangeMedias}
      />
      <label htmlFor="upload-button">
        <Tooltip title={i18n.t("messagesInput.attach") || "Anexar arquivo"}>
          <span>
            <IconButton
              aria-label="upload"
              component="span"
              disabled={disableOption()}
              className={classes.iconButton}
            >
              <AttachFileIcon />
            </IconButton>
          </span>
        </Tooltip>
      </label>
    </>
  );
};

const ActionButtons = (props) => {
  const {
    inputMessage,
    loading,
    recording,
    ticketStatus,
    handleSendMessage,
    handleCancelAudio,
    handleUploadAudio,
    handleStartRecording,
    handleOpenModalForward,
    showSelectMessageCheckbox,
  } = props;
  const classes = useStyles();

  if (inputMessage || showSelectMessageCheckbox) {
    return (
      <IconButton
        aria-label="sendMessage"
        component="span"
        className={classes.sendFloatingButton}
        onClick={
          showSelectMessageCheckbox ? handleOpenModalForward : handleSendMessage
        }
        disabled={loading}
      >
        {showSelectMessageCheckbox ? (
          <Reply className={classes.ForwardMessageIcons} />
        ) : (
          <SendIcon fontSize="small" />
        )}
      </IconButton>
    );
  } else if (recording) {
    return (
      <div className={classes.recorderWrapper}>
        <Tooltip title="Cancelar gravação">
          <IconButton
            aria-label="cancelRecording"
            component="span"
            size="small"
            disabled={loading}
            onClick={handleCancelAudio}
          >
            <HighlightOffIcon className={classes.cancelAudioIcon} />
          </IconButton>
        </Tooltip>

        {loading ? (
          <div>
            <CircularProgress size={20} className={classes.audioLoading} />
          </div>
        ) : (
          <RecordingTimer />
        )}

        <Tooltip title="Enviar áudio">
          <IconButton
            aria-label="sendRecordedAudio"
            component="span"
            size="small"
            onClick={handleUploadAudio}
            disabled={loading}
          >
            <CheckCircleOutlineIcon className={classes.sendAudioIcon} />
          </IconButton>
        </Tooltip>
      </div>
    );
  } else {
    return (
      <Tooltip title="Gravar áudio">
        <span>
          <IconButton
            aria-label="showRecorder"
            component="span"
            className={classes.micButton}
            disabled={loading || ticketStatus !== "open"}
            onClick={handleStartRecording}
          >
            <MicIcon />
          </IconButton>
        </span>
      </Tooltip>
    );
  }
};

const CustomInput = (props) => {
  const {
    loading,
    inputRef,
    ticketStatus,
    inputMessage,
    setInputMessage,
    handleSendMessage,
    handleInputPaste,
    disableOption,
    handleQuickAnswersClick,
  } = props;
  const classes = useStyles();
  const [quickMessages, setQuickMessages] = useState([]);
  const [options, setOptions] = useState([]);
  const [popupOpen, setPopupOpen] = useState(false);
  const { user } = useContext(AuthContext);

  const { list: listQuickMessages } = useQuickMessages();

  useEffect(() => {
    async function fetchData() {
      const companyId = localStorage.getItem("companyId");
      const messages = await listQuickMessages({ companyId, userId: user.id });
      const options = messages.map((m) => {
        let truncatedMessage = m.message;
        if (isString(truncatedMessage) && truncatedMessage.length > 35) {
          truncatedMessage = m.message.substring(0, 35) + "...";
        }
        return {
          value: m.message,
          label: `/${m.shortcode} - ${truncatedMessage}`,
          mediaPath: m.mediaPath,
        };
      });
      setQuickMessages(options);
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (
      isString(inputMessage) &&
      !isEmpty(inputMessage) &&
      inputMessage.length > 1
    ) {
      const firstWord = inputMessage.charAt(0);
      setPopupOpen(firstWord.indexOf("/") > -1);

      const filteredOptions = quickMessages.filter(
        (m) => m.label.indexOf(inputMessage) > -1
      );
      setOptions(filteredOptions);
    } else {
      setPopupOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputMessage]);

  const onKeyPress = (e) => {
    if (loading || e.shiftKey) return;
    else if (e.key === "Enter") {
      handleSendMessage();
    }
  };

  const onPaste = (e) => {
    if (ticketStatus === "open") {
      handleInputPaste(e);
    }
  };

  const renderPlaceholder = () => {
    if (ticketStatus === "open") {
      return i18n.t("messagesInput.placeholderOpen");
    }
    return i18n.t("messagesInput.placeholderClosed");
  };

  const setInputRef = (input) => {
    if (input) {
      input.focus();
      inputRef.current = input;
    }
  };

  return (
    <div className={classes.messageInputWrapper}>
      <Autocomplete
        freeSolo
        open={popupOpen}
        id="grouped-demo"
        value={inputMessage}
        options={options}
        closeIcon={null}
        getOptionLabel={(option) => {
          if (isObject(option)) {
            return option.label;
          } else {
            return option;
          }
        }}
        onChange={(event, opt) => {
          if (isObject(opt) && has(opt, "value") && isNil(opt.mediaPath)) {
            setInputMessage(opt.value);
            setTimeout(() => {
              if (inputRef.current) {
                inputRef.current.scrollTop = inputRef.current.scrollHeight;
              }
            }, 200);
          } else if (
            isObject(opt) &&
            has(opt, "value") &&
            !isNil(opt.mediaPath)
          ) {
            handleQuickAnswersClick(opt);

            setTimeout(() => {
              if (inputRef.current) {
                inputRef.current.scrollTop = inputRef.current.scrollHeight;
              }
            }, 200);
          }
        }}
        onInputChange={(event, opt, reason) => {
          if (reason === "input") {
            setInputMessage(event.target.value);
          }
        }}
        onPaste={onPaste}
        onKeyPress={onKeyPress}
        style={{ width: "100%" }}
        renderInput={(params) => {
          const { InputLabelProps, InputProps, ...rest } = params;
          return (
            <InputBase
              {...params.InputProps}
              {...rest}
              disabled={disableOption()}
              inputRef={setInputRef}
              placeholder={renderPlaceholder()}
              multiline
              className={classes.messageInput}
              maxRows={5}
            />
          );
        }}
      />
    </div>
  );
};

const MessageInputCustom = (props) => {
  const { ticketStatus, ticketId } = props;
  const classes = useStyles();
  const [percentLoading, setPercentLoading] = useState(0);
  const [medias, setMedias] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const inputRef = useRef();
  const { setReplyingMessage, replyingMessage } =
    useContext(ReplyMessageContext);
  const { user } = useContext(AuthContext);

  const [signMessage, setSignMessage] = useLocalStorage("signOption", true);

  const {
    selectedMessages,
    setForwardMessageModalOpen,
    showSelectMessageCheckbox,
  } = useContext(ForwardMessageContext);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [replyingMessage]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
    return () => {
      setInputMessage("");
      setShowEmoji(false);
      setMedias([]);
      setReplyingMessage(null);
    };
  }, [ticketId, setReplyingMessage]);

  const handleOpenModalForward = () => {
    if (selectedMessages.length === 0) {
      setForwardMessageModalOpen(false);
      toastError(i18n.t("messagesList.header.notMessage"));
      return;
    }
    setForwardMessageModalOpen(true);
  };

  const handleAddEmoji = (e) => {
    let emoji = e.native;
    setInputMessage((prevState) => prevState + emoji);
  };

  const handleChangeMedias = (e) => {
    if (!e.target.files) {
      return;
    }

    const selectedMedias = Array.from(e.target.files);
    setMedias(selectedMedias);
  };

  const handleInputPaste = (e) => {
    if (e.clipboardData.files[0]) {
      setMedias([e.clipboardData.files[0]]);
    }
  };

  const handleUploadQuickMessageMedia = async (blob, message) => {
    setLoading(true);
    try {
      const extension = blob.type.split("/")[1];

      const formData = new FormData();
      const filename = `${new Date().getTime()}.${extension}`;
      formData.append("medias", blob, filename);
      formData.append("body", message);
      formData.append("fromMe", true);

      await api.post(`/messages/${ticketId}`, formData);
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
    setLoading(false);
  };

  const handleQuickAnswersClick = async (value) => {
    if (value.mediaPath) {
      try {
        const { data } = await axios.get(value.mediaPath, {
          responseType: "blob",
        });

        handleUploadQuickMessageMedia(data, value.value);
        setInputMessage("");
        return;
      } catch (err) {
        toastError(err);
      }
    }

    setInputMessage("");
    setInputMessage(value.value);
  };

  const handleUploadMedia = async (e) => {
    setLoading(true);
    e.preventDefault();

    const formData = new FormData();
    formData.append("fromMe", true);

    medias.forEach(async (media) => {
      const file = media;

      if (!file) {
        return;
      }

      if (media?.type.split("/")[0] === "image") {
        new Compressor(file, {
          quality: 0.7,
          async success(media) {
            formData.append("medias", media);
            formData.append("body", media.name);
          },
          error(err) {
            console.log(err.message);
          },
        });
      } else {
        formData.append("medias", media);
        formData.append("body", media.name);
      }
    });

    setTimeout(async () => {
      try {
        await api.post(`/messages/${ticketId}`, formData, {
          onUploadProgress: (event) => {
            let progress = Math.round((event.loaded * 100) / event.total);
            setPercentLoading(progress);
          },
        });
        setLoading(false);
        setMedias([]);
        setPercentLoading(0);
      } catch (err) {
        setLoading(false);
        toastError(err);
      }
    }, 2000);
  };

  const handleSendMessage = async () => {
    if (inputMessage.trim() === "") return;
    setLoading(true);

    const message = {
      read: 1,
      fromMe: true,
      mediaUrl: "",
      body: signMessage
        ? `*${user?.name}:*\n${inputMessage.trim()}`
        : inputMessage.trim(),
      quotedMsg: replyingMessage,
    };
    try {
      await api.post(`/messages/${ticketId}`, message);
    } catch (err) {
      toastError(err);
    }

    setInputMessage("");
    setShowEmoji(false);
    setLoading(false);
    setReplyingMessage(null);
  };

  const handleStartRecording = async () => {
    setLoading(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await Mp3Recorder.start();
      setRecording(true);
      setLoading(false);
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  };

  const handleUploadAudio = async () => {
    setLoading(true);
    try {
      const [, blob] = await Mp3Recorder.stop().getMp3();
      if (blob.size < 10000) {
        setLoading(false);
        setRecording(false);
        return;
      }

      const formData = new FormData();
      const filename = `audio-record-site-${new Date().getTime()}.mp3`;
      formData.append("medias", blob, filename);
      formData.append("body", filename);
      formData.append("fromMe", true);

      await api.post(`/messages/${ticketId}`, formData);
    } catch (err) {
      toastError(err);
    }

    setRecording(false);
    setLoading(false);
  };

  const handleCancelAudio = async () => {
    try {
      await Mp3Recorder.stop().getMp3();
      setRecording(false);
    } catch (err) {
      toastError(err);
    }
  };

  const disableOption = () => {
    return loading || recording || ticketStatus !== "open";
  };

  const renderReplyingMessage = (message) => {
    return (
      <div className={classes.replyginMsgWrapper}>
        <div className={classes.replyginMsgContainer}>
          <div>
            {!message.fromMe && (
              <div className={classes.messageContactName}>
                {message.contact?.name}
              </div>
            )}
            <div className={classes.replyginMsgBody}>{message.body}</div>
          </div>
          <IconButton
            aria-label="cancelReply"
            component="span"
            size="small"
            disabled={loading || ticketStatus !== "open"}
            onClick={() => setReplyingMessage(null)}
          >
            <ClearIcon fontSize="small" />
          </IconButton>
        </div>
      </div>
    );
  };

  if (medias.length > 0)
    return (
      <Paper elevation={0} square className={classes.viewMediaInputWrapper}>
        <IconButton
          aria-label="cancel-upload"
          component="span"
          onClick={() => setMedias([])}
        >
          <CancelIcon />
        </IconButton>

        {loading ? (
          <div>
            <LinearWithValueLabel progress={percentLoading} />
          </div>
        ) : (
          <span>{medias[0]?.name}</span>
        )}
        <IconButton
          aria-label="send-upload"
          component="span"
          onClick={handleUploadMedia}
          disabled={loading}
          className={classes.sendFloatingButton}
        >
          <SendIcon fontSize="small" />
        </IconButton>
      </Paper>
    );
  else {
    return (
      <Paper square elevation={0} className={classes.mainWrapper}>
        {replyingMessage && renderReplyingMessage(replyingMessage)}
        <div className={classes.newMessageBox}>
          <EmojiOptions
            disabled={disableOption()}
            handleAddEmoji={handleAddEmoji}
            showEmoji={showEmoji}
            setShowEmoji={setShowEmoji}
          />

          <FileInput
            disableOption={disableOption}
            handleChangeMedias={handleChangeMedias}
          />

          <SignSwitch
            width={props.width}
            setSignMessage={setSignMessage}
            signMessage={signMessage}
          />

          <CustomInput
            loading={loading}
            inputRef={inputRef}
            ticketStatus={ticketStatus}
            inputMessage={inputMessage}
            setInputMessage={setInputMessage}
            handleSendMessage={handleSendMessage}
            handleInputPaste={handleInputPaste}
            disableOption={disableOption}
            replyingMessage={replyingMessage}
            handleQuickAnswersClick={handleQuickAnswersClick}
          />

          <ActionButtons
            inputMessage={inputMessage}
            loading={loading}
            recording={recording}
            ticketStatus={ticketStatus}
            handleSendMessage={handleSendMessage}
            handleCancelAudio={handleCancelAudio}
            handleUploadAudio={handleUploadAudio}
            handleStartRecording={handleStartRecording}
            handleOpenModalForward={handleOpenModalForward}
            showSelectMessageCheckbox={showSelectMessageCheckbox}
          />
        </div>
      </Paper>
    );
  }
};

export default withWidth()(MessageInputCustom);
