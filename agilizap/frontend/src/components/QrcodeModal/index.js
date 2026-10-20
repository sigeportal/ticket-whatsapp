import React, { useEffect, useState, useContext } from "react";
import QRCode from "qrcode.react";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  Button,
  Box,
  CircularProgress,
  TextField,
  Divider
} from "@material-ui/core";
import CloseIcon from "@material-ui/icons/Close";
import FileCopyIcon from "@material-ui/icons/FileCopy";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import SmartphoneIcon from "@material-ui/icons/Smartphone";
import QrCodeIcon from "@material-ui/icons/CropFree";
import ArrowForwardIcon from "@material-ui/icons/ArrowForward";

import api from "../../services/api";
import { SocketContext } from "../../context/Socket/SocketContext";

const QrcodeModal = ({ open, onClose, whatsAppId }) => {
  const [qrCode, setQrCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [pairingPhone, setPairingPhone] = useState("");
  const [showPairingInput, setShowPairingInput] = useState(false);
  const [loadingPairing, setLoadingPairing] = useState(false);
  const socketManager = useContext(SocketContext);

  useEffect(() => {
    const fetchSession = async () => {
      if (!whatsAppId) return;

      try {
        const { data } = await api.get(`/whatsapp/${whatsAppId}`);
        setQrCode(data.qrcode || "");
      } catch (err) {
        toastError(err);
      }
    };
    fetchSession();
  }, [whatsAppId]);

  useEffect(() => {
    if (!whatsAppId) return;
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    const handleSessionUpdate = (data) => {
      if (data.action === "update" && data.session.id === whatsAppId) {
        setQrCode(data.session.qrcode || "");
      }

      if (data.action === "update" && data.session.qrcode === "") {
        onClose();
      }
    };

    socket.on(`company-${companyId}-whatsappSession`, handleSessionUpdate);

    return () => {
      socket.off(`company-${companyId}-whatsappSession`, handleSessionUpdate);
    };
  }, [whatsAppId, onClose, socketManager]);

  const isPairingCode = Boolean(
    qrCode && qrCode.length <= 16 && !qrCode.includes("@") && !qrCode.includes(",")
  );

  const formattedPairingCode = isPairingCode
    ? qrCode.length === 8
      ? `${qrCode.slice(0, 4)} - ${qrCode.slice(4)}`
      : qrCode
    : "";

  const handleCopyCode = () => {
    if (!qrCode) return;
    navigator.clipboard.writeText(qrCode.replace(/[^a-zA-Z0-9]/g, ""));
    setCopied(true);
    toast.success("Código de pareamento copiado com sucesso!");
    setTimeout(() => setCopied(false), 3000);
  };

  const handleRequestPairingCode = async () => {
    const cleanNumber = pairingPhone.replace(/\D/g, "");
    if (cleanNumber.length < 10) {
      toast.error("Informe o número completo com DDI e DDD (ex: 5567998615053)");
      return;
    }
    setLoadingPairing(true);
    try {
      await api.post(`/whatsappsession/${whatsAppId}/pairing-code`, {
        phoneNumber: cleanNumber
      });
      toast.info("Solicitando código de 8 dígitos ao WhatsApp...");
      setShowPairingInput(false);
    } catch (err) {
      toastError(err);
    } finally {
      setLoadingPairing(false);
    }
  };

  const handleSwitchToQr = async () => {
    setLoadingPairing(true);
    try {
      await api.put(`/whatsappsession/${whatsAppId}`);
      toast.info("Gerando novo QR Code...");
      setShowPairingInput(false);
    } catch (err) {
      toastError(err);
    } finally {
      setLoadingPairing(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        style: {
          borderRadius: "16px",
          padding: "8px",
          overflow: "hidden"
        }
      }}
    >
      <DialogTitle style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box display="flex" alignItems="center" gridGap="10px">
          {isPairingCode ? (
            <SmartphoneIcon style={{ color: "#10b981", fontSize: "28px" }} />
          ) : (
            <QrCodeIcon style={{ color: "#10b981", fontSize: "28px" }} />
          )}
          <Typography variant="h6" style={{ fontWeight: 700, fontFamily: "Inter, sans-serif", color: "#1f2937" }}>
            {isPairingCode ? "Conectar via Código de Pareamento" : "Conectar via QR Code"}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" style={{ color: "#9ca3af" }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent style={{ padding: "0 24px 24px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", alignItems: "center", justifyContent: "center" }}>
          
          {/* Instruções */}
          <div style={{ flex: "1 1 300px", minWidth: "260px" }}>
            <Typography variant="subtitle1" style={{ fontWeight: 600, color: "#111827", marginBottom: "16px" }}>
              Siga os passos no seu WhatsApp:
            </Typography>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <span style={{ background: "#ecfdf5", color: "#059669", width: "26px", height: "26px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "13px", flexShrink: 0 }}>
                  1
                </span>
                <Typography variant="body2" style={{ color: "#4b5563", lineHeight: 1.5 }}>
                  Abra o WhatsApp no seu smartphone.
                </Typography>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <span style={{ background: "#ecfdf5", color: "#059669", width: "26px", height: "26px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "13px", flexShrink: 0 }}>
                  2
                </span>
                <Typography variant="body2" style={{ color: "#4b5563", lineHeight: 1.5 }}>
                  Toque em <strong>Mais opções</strong> (Android) ou <strong>Configurações</strong> (iPhone) e selecione <strong>Aparelhos conectados</strong>.
                </Typography>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <span style={{ background: "#ecfdf5", color: "#059669", width: "26px", height: "26px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "13px", flexShrink: 0 }}>
                  3
                </span>
                <Typography variant="body2" style={{ color: "#4b5563", lineHeight: 1.5 }}>
                  {isPairingCode ? (
                    <>
                      Toque em <strong>Conectar um aparelho</strong> e depois em <strong>"Conectar com número de telefone"</strong> no rodapé.
                    </>
                  ) : (
                    <>
                      Toque em <strong>Conectar um aparelho</strong> e aponte a câmera para o QR Code ao lado.
                    </>
                  )}
                </Typography>
              </div>

              {isPairingCode && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  <span style={{ background: "#ecfdf5", color: "#059669", width: "26px", height: "26px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "13px", flexShrink: 0 }}>
                    4
                  </span>
                  <Typography variant="body2" style={{ color: "#4b5563", lineHeight: 1.5 }}>
                    Insira o código de 8 dígitos abaixo no seu aparelho.
                  </Typography>
                </div>
              )}
            </div>

            {/* Alternador de Método QR Code vs Código de Pareamento */}
            <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px dashed #e2e8f0" }}>
              {isPairingCode ? (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleSwitchToQr}
                  disabled={loadingPairing}
                  startIcon={<QrCodeIcon />}
                  style={{ textTransform: "none", color: "#059669", borderColor: "#a7f3d0" }}
                >
                  Voltar para leitura via QR Code
                </Button>
              ) : showPairingInput ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <Typography variant="caption" style={{ color: "#4b5563", fontWeight: 600 }}>
                    Informe o telefone com DDI (55) e DDD:
                  </Typography>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <TextField
                      size="small"
                      variant="outlined"
                      placeholder="Ex: 5567998615053"
                      value={pairingPhone}
                      onChange={(e) => setPairingPhone(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <Button
                      variant="contained"
                      onClick={handleRequestPairingCode}
                      disabled={loadingPairing}
                      style={{ background: "#10b981", color: "#ffffff", textTransform: "none" }}
                    >
                      {loadingPairing ? <CircularProgress size={18} color="inherit" /> : "Gerar"}
                    </Button>
                  </div>
                  <Button
                    size="small"
                    onClick={() => setShowPairingInput(false)}
                    style={{ textTransform: "none", color: "#9ca3af", alignSelf: "flex-start" }}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setShowPairingInput(true)}
                  startIcon={<SmartphoneIcon />}
                  style={{ textTransform: "none", color: "#059669", fontWeight: 500 }}
                >
                  Prefere conectar via Código de Telefone (8 dígitos)?
                </Button>
              )}
            </div>
          </div>

          {/* Área do Código / QR Code */}
          <div style={{ flex: "1 1 280px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", background: "#f9fafb", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
            {qrCode ? (
              isPairingCode ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", width: "100%" }}>
                  <Typography variant="caption" style={{ color: "#6b7280", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600 }}>
                    Código de Pareamento
                  </Typography>

                  <div style={{
                    background: "#ffffff",
                    border: "2px dashed #10b981",
                    borderRadius: "12px",
                    padding: "16px 28px",
                    fontSize: "26px",
                    fontWeight: 800,
                    letterSpacing: "4px",
                    color: "#065f46",
                    fontFamily: "monospace",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)"
                  }}>
                    {formattedPairingCode}
                  </div>

                  <Button
                    variant="contained"
                    onClick={handleCopyCode}
                    startIcon={copied ? <CheckCircleIcon /> : <FileCopyIcon />}
                    style={{
                      background: copied ? "#059669" : "#10b981",
                      color: "#ffffff",
                      textTransform: "none",
                      fontWeight: 600,
                      borderRadius: "8px",
                      padding: "8px 20px"
                    }}
                  >
                    {copied ? "Copiado!" : "Copiar Código"}
                  </Button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                  <div style={{ background: "#ffffff", padding: "16px", borderRadius: "12px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)", border: "1px solid #e5e7eb" }}>
                    <QRCode value={qrCode} size={240} level="H" includeMargin={true} />
                  </div>
                  <Typography variant="caption" style={{ color: "#6b7280" }}>
                    Atualiza automaticamente caso expire
                  </Typography>
                </div>
              )
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", padding: "40px 0" }}>
                <CircularProgress style={{ color: "#10b981" }} size={44} />
                <Typography variant="body2" style={{ color: "#6b7280", fontWeight: 500 }}>
                  Aguardando geração do código...
                </Typography>
              </div>
            )}
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
};

export default React.memo(QrcodeModal);
