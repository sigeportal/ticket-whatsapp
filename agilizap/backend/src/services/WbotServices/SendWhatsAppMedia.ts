import { randomBytes } from "crypto";
import { WAMessage, AnyMessageContent } from "@whiskeysockets/baileys";
import * as Sentry from "@sentry/node";
import fs from "fs";
import { execFile } from "child_process";
import path from "path";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import mime from "mime-types";
import formatBody from "../../helpers/Mustache";
import { getRecipientJid } from "../../helpers/GetRecipientJid";

interface Request {
  media: Express.Multer.File;
  ticket: Ticket;
  body?: string;
  isForwarded?: boolean;  
}

const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

const getFfmpegPath = (): string => {
  try {
    if (ffmpegPath?.path && fs.existsSync(ffmpegPath.path)) {
      return ffmpegPath.path;
    }
  } catch (e) {
    // ignore
  }
  return "ffmpeg";
};

const processAudio = async (audio: string): Promise<string> => {
  const outputAudio = `${publicFolder}/${randomBytes(24).toString("hex")}.mp3`;
  const ffmpegCmd = getFfmpegPath();
  return new Promise((resolve, reject) => {
    execFile(
      ffmpegCmd, ["-nostdin", "-threads", "1", "-i", audio, "-vn", "-ab", "128k", "-ar", "44100", "-f", "ipod", outputAudio],
      { timeout: 60000, maxBuffer: 1024 * 1024 },
      (error, _stdout, _stderr) => {
        if (error) { fs.rmSync(outputAudio, { force: true }); reject(error); return; }
        try {
          fs.unlinkSync(audio);
        } catch (e) {}
        resolve(outputAudio);
      }
    );
  });
};

const processAudioFile = async (audio: string): Promise<string> => {
  const outputAudio = `${publicFolder}/${randomBytes(24).toString("hex")}.mp3`;
  const ffmpegCmd = getFfmpegPath();
  return new Promise((resolve, reject) => {
    execFile(
      ffmpegCmd, ["-nostdin", "-threads", "1", "-i", audio, "-vn", "-ar", "44100", "-ac", "2", "-b:a", "192k", outputAudio],
      { timeout: 60000, maxBuffer: 1024 * 1024 },
      (error, _stdout, _stderr) => {
        if (error) { fs.rmSync(outputAudio, { force: true }); reject(error); return; }
        try {
          fs.unlinkSync(audio);
        } catch (e) {}
        resolve(outputAudio);
      }
    );
  });
};

export const getMessageOptions = async (
  fileName: string,
  pathMedia: string,
  body?: string
): Promise<any> => {
  const mimeType = mime.lookup(pathMedia);
  const typeMessage = mimeType.split("/")[0];

  try {
    if (!mimeType) {
      throw new Error("Invalid mimetype");
    }
    let options: AnyMessageContent;

    if (typeMessage === "video") {
      options = {
        video: fs.readFileSync(pathMedia),
        caption: body ? body : '',
        fileName: fileName
        // gifPlayback: true
      };
    } else if (typeMessage === "audio") {
      const typeAudio = true; //fileName.includes("audio-record-site");
      const convert = await processAudio(pathMedia);
      if (typeAudio) {
        options = {
          audio: fs.readFileSync(convert),
          mimetype: typeAudio ? "audio/mp4" : mimeType,
          caption: body ? body : null,
          ptt: true
        };
      } else {
        options = {
          audio: fs.readFileSync(convert),
          mimetype: typeAudio ? "audio/mp4" : mimeType,
          caption: body ? body : null,
          ptt: true
        };
      }
    } else if (typeMessage === "document") {
      options = {
        document: fs.readFileSync(pathMedia),
        caption: body ? body : null,
        fileName: fileName,
        mimetype: mimeType
      };
    } else if (typeMessage === "application") {
      options = {
        document: fs.readFileSync(pathMedia),
        caption: body ? body : null,
        fileName: fileName,
        mimetype: mimeType
      };
    } else {
      options = {
        image: fs.readFileSync(pathMedia),
        caption: body ? body : null
      };
    }

    return options;
  } catch (e) {
    Sentry.captureException(e);
    console.log(e);
    return null;
  }
};

const SendWhatsAppMedia = async ({
  media,
  ticket,
  body,
  isForwarded = false
}: Request): Promise<WAMessage> => {
  try {
    const wbot = await GetTicketWbot(ticket);

    const pathMedia = media.path;
    const typeMessage = media.mimetype.split("/")[0];
    let options: AnyMessageContent;
    const bodyMessage = formatBody(body, ticket.contact)

    if (typeMessage === "video") {
      options = {
        video: fs.readFileSync(pathMedia),
        caption: bodyMessage,
        fileName: media.originalname,
        contextInfo: { forwardingScore: isForwarded ? 2 : 0, isForwarded: isForwarded }
        // gifPlayback: true
      };
    } else if (typeMessage === "audio") {
      const typeAudio = media.originalname.includes("audio-record-site");
      if (typeAudio) {
        const convert = await processAudio(media.path);
        options = {
          audio: fs.readFileSync(convert),
          mimetype: typeAudio ? "audio/mp4" : media.mimetype,
          ptt: true,
          contextInfo: { forwardingScore: isForwarded ? 2 : 0, isForwarded: isForwarded }
        };
      } else {
        const convert = await processAudioFile(media.path);
        options = {
          audio: fs.readFileSync(convert),
          mimetype: typeAudio ? "audio/mp4" : media.mimetype,
          contextInfo: { forwardingScore: isForwarded ? 2 : 0, isForwarded: isForwarded }
        };
      }
    } else if (typeMessage === "document" || typeMessage === "text") {
      options = {
        document: fs.readFileSync(pathMedia),
        caption: bodyMessage,
        fileName: media.originalname,
        mimetype: media.mimetype,
        contextInfo: { forwardingScore: isForwarded ? 2 : 0, isForwarded: isForwarded }
      };
    } else if (typeMessage === "application") {
      options = {
        document: fs.readFileSync(pathMedia),
        caption: bodyMessage,
        fileName: media.originalname,
        mimetype: media.mimetype,
        contextInfo: { forwardingScore: isForwarded ? 2 : 0, isForwarded: isForwarded }
      };
    } else {
      options = {
        image: fs.readFileSync(pathMedia),
        caption: bodyMessage,
        contextInfo: { forwardingScore: isForwarded ? 2 : 0, isForwarded: isForwarded }
      };
    }

    const contact = ticket.contact || (ticket.contactId ? await Contact.findByPk(ticket.contactId) : null);
    const destinationJid = getRecipientJid(ticket, contact);

    const sentMessage = await wbot.sendMessage(
      destinationJid,
      {
        ...options
      }
    );

    await ticket.update({ lastMessage: bodyMessage });

    return sentMessage;
  } catch (err) {
    Sentry.captureException(err);
    console.log(err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMedia;
