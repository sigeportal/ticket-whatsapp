import { validateUploads } from "../../services/uploadLimits";
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
    backgroundColor: "var(--bg-surface)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    borderTop: "1px solid var(--border-hairline)",
    position: "relative",
    width: "100%",
  },

  newMessageBox: {
    backgroundColor: "var(--bg-surface)",
    width: "100%",
    display: "flex",
    padding: "10px 14px",
    alignItems: "center",
    gap: "8px",
    borderTop: "1px solid var(--border-hairline)",
  },

  messageInputWrapper: {
    padding: "4px 14px",
    backgroundColor: "var(--field-bg)",
    display: "flex",
    borderRadius: 14,
    flex: 1,
    alignItems: "center",
    border: "1px solid var(--field-border)",
    boxShadow: "none",
    transition: "all var(--t-in) var(--ease-ui)",
    "&:focus-within": {
      borderColor: "var(--action)",
      boxShadow: "0 0 0 3px var(--focus-ring)",
      backgroundColor: "var(--field-focus)",
    },
  },

  messageInput: {
    paddingLeft: 4,
    flex: 1,
    border: "none",
    fontFamily: "var(--font-sans)",
    fontSize: "0.9125rem",
    color: "var(--ink-primary)",
  },

  iconButton: {
    padding: 8,
    color: "var(--ink-secondary)",
    borderRadius: 9,
    transition: "all var(--t-in) var(--ease-ui)",
    "&:hover": {
      color: "var(--action)",
      backgroundColor: "var(--action-soft)",
    },
  },

  sendFloatingButton: {
    backgroundColor: "var(--action)",
    color: "var(--action-ink)",
    width: 40,
    height: 40,
    borderRadius: 11,
    boxShadow: "none",
    transition: "all var(--t-in) var(--ease-ui)",
    padding: 8,
    "&:hover": {
      backgroundColor: "var(--action-hover)",
      transform: "translateY(-1px)",
    },
    "&:active": {
      transform: "scale(0.97)",
    },
    "&:disabled": {
      backgroundColor: "var(--bg-subtle)",
      color: "var(--ink-muted)",
      boxShadow: "none",
    },
  },

  micButton: {
    color: "var(--ink-secondary)",
    padding: 8,
    borderRadius: 9,
    transition: "all var(--t-in) var(--ease-ui)",
    "&:hover": {
      color: "var(--action)",
      backgroundColor: "var(--action-soft)",
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
    backgroundColor: "var(--bg-subtle)",
    borderTop: "1px solid var(--border-hairline)",
    width: "100%",
  },

  emojiBox: {
    position: "absolute",
    bottom: 64,
    left: 12,
    zIndex: 100,
    boxShadow: "var(--shadow-popover)",
    borderRadius: 14,
    overflow: "hidden",
    border: "1px solid var(--border-hairline)",
  },

  audioLoading: {
    color: "var(--action)",
    opacity: "85%",
  },

  recorderWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "var(--bg-elevated)",
    borderRadius: 12,
    padding: "3px 10px",
    border: "1px solid rgba(225, 29, 72, 0.35)",
  },

  cancelAudioIcon: {
    color: "var(--status-danger)",
  },

  sendAudioIcon: {
    color: "var(--action)",
  },

  replyginMsgWrapper: {
    display: "flex",
    width: "100%",
    padding: "8px 14px 0 14px",
  },

  replyginMsgContainer: {
    flex: 1,
    overflowY: "hidden",
    backgroundColor: "var(--bg-subtle)",
    borderRadius: 10,
    borderLeft: "3.5px solid var(--action)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 12px",
  },

  replyginMsgBody: {
    fontSize: "0.82rem",
    lineHeight: "1.35",
    color: "var(--ink-secondary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
  },

  messageContactName: {
    fontSize: "0.8rem",
    fontWeight: 700,
    color: "var(--action)",
    marginBottom: 2,
  },

  switchLabel: {
    fontSize: "0.78rem",
    fontWeight: 600,
    color: "var(--ink-secondary)",
  },

  customSwitch: {
    "& .MuiSwitch-switchBase.Mui-checked": {
      color: "var(--action)",
      "&:hover": {
        backgroundColor: "var(--action-soft)",
      },
    },
    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
      backgroundColor: "var(--action)",
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
      const formatted = (messages || []).map((m) => {
        const rawText = isString(m.message) ? m.message.trim().replace(/\s+/g, " ") : "";
        const shortPreview =
          rawText.length > 26 ? `${rawText.substring(0, 26)}...` : rawText;
        return {
          shortcode: String(m.shortcode || ""),
          value: m.message,
          label: `/${m.shortcode}`,
          preview: shortPreview,
          mediaPath: m.mediaPath,
        };
      });
      setQuickMessages(formatted);
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isString(inputMessage) && inputMessage.startsWith("/")) {
      const typed = inputMessage.slice(1);
      // Fecha o guia se o usuário já digitou espaço após o comando
      if (typed.includes(" ") || typed.includes("\n")) {
        setPopupOpen(false);
        return;
      }
      const query = typed.toLowerCase();
      const filteredOptions = quickMessages.filter((m) =>
        m.shortcode.toLowerCase().includes(query)
      );
      setOptions(filteredOptions);
      setPopupOpen(filteredOptions.length > 0);
    } else {
      setPopupOpen(false);
    }
  }, [inputMessage, quickMessages]);

  const onKeyPress = (e) => {
    if (loading || e.shiftKey || popupOpen) return;
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
        filterOptions={(opts) => opts}
        getOptionLabel={(option) => {
          if (isObject(option)) {
            return option.label;
          } else {
            return option;
          }
        }}
        renderOption={(option) => (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%" }}>
            <span style={{ fontWeight: 700, color: "var(--action)", fontSize: "0.86rem" }}>
              {option.label}
            </span>
            {option.preview && (
              <span style={{ fontSize: "0.76rem", color: "var(--ink-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {option.preview}
              </span>
            )}
          </div>
        )}
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
    try { validateUploads(selectedMedias); } catch (err) { toastError(err); return; }
    setMedias(selectedMedias);
  };

  const handleInputPaste = (e) => {
    if (e.clipboardData.files[0]) {
      try { validateUploads([e.clipboardData.files[0]]); } catch (err) { toastError(err); return; }
      setMedias([e.clipboardData.files[0]]);
    }
  };

  const handleUploadQuickMessageMedia = async (blob, message, mediaPath) => {
    setLoading(true);
    try {
      const cleanPath = String(mediaPath || "").split(/[?#]/)[0];
      const pathBasename = cleanPath.split(/[\\/]/).pop() || "";
      const pathExtMatch = pathBasename.match(/\.([a-z0-9]+)$/i);
      const mimeType = (blob?.type || "").split(";")[0].trim().toLowerCase();
      const mimeMap = {
        "audio/mpeg": "mp3",
        "audio/mp3": "mp3",
        "text/plain": "txt",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
        "image/jpeg": "jpg",
        "image/x-icon": "ico",
        "image/vnd.microsoft.icon": "ico",
      };
      const mimeSubtype = mimeType.split("/")[1] || "";
      const extension = (
        pathExtMatch ? pathExtMatch[1] : (mimeMap[mimeType] || mimeSubtype)
      ).toLowerCase();

      const formData = new FormData();
      const filename = extension
        ? `${new Date().getTime()}.${extension}`
        : `${new Date().getTime()}`;
      formData.append("medias", blob, filename);
      formData.append("body", message);
      formData.append("fromMe", true);

      await api.post(`/messages/${ticketId}`, formData);
      return true;
    } catch (err) {
      toastError(err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAnswersClick = async (value) => {
    if (value.mediaPath) {
      try {
        const { data } = await api.get(value.mediaPath, {
          responseType: "blob",
        });

        if (await handleUploadQuickMessageMedia(data, value.value, value.mediaPath)) setInputMessage("");
        return;
      } catch (err) {
        toastError(err);
        return;
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

    try {
      const prepared = await Promise.all(medias.filter(Boolean).map(media =>
        media.type.split("/")[0] === "image"
          ? new Promise((resolve, reject) => new Compressor(media, { quality: 0.7, success: resolve, error: reject }))
          : media
      ));
      prepared.forEach(media => {
        const mimeType = (media?.type || "").split(";")[0].trim().toLowerCase();
        const rawSubtype = mimeType.startsWith("image/") ? mimeType.slice(6) : "";
        const fallbackExt = rawSubtype === "jpeg" ? "jpg" : (/^[a-z0-9]+$/.test(rawSubtype) ? rawSubtype : "jpg");
        const filename = media?.name && /\.[a-z0-9]+$/i.test(media.name)
          ? media.name
          : `${media?.name || "image"}.${fallbackExt}`;
        formData.append("medias", media, filename);
        formData.append("body", filename);
      });
      await api.post(`/messages/${ticketId}`, formData, {
        onUploadProgress: (event) => {
          let progress = Math.round((event.loaded * 100) / event.total);
          setPercentLoading(progress);
        },
      });
      setMedias([]);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
      setPercentLoading(0);
    }
  };

  const handleSendMessage = async () => {
    if (inputMessage.trim() === "") return;
    setLoading(true);

    const message = {
      read: 1,
      fromMe: true,
      body: signMessage
        ? `*${user?.name}:*\n${inputMessage.trim()}`
        : inputMessage.trim(),
      quotedMsg: replyingMessage ? { id: replyingMessage.id } : null,
    };
    try {
      await api.post(`/messages/${ticketId}`, message);
      setInputMessage("");
      setShowEmoji(false);
      setReplyingMessage(null);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
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
