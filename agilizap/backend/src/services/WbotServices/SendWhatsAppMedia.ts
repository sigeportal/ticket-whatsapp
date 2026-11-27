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
  deleteSource?: boolean;
}

const publicFolder =
  (process.env.NODE_ENV === "test" && process.env.TEST_MEDIA_ROOT) ||
  path.resolve(__dirname, "..", "..", "..", "public");

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

const runFfmpegAudio = async (
  audio: string,
  buildArgs: (outputAudio: string) => string[],
  deleteSource = false
): Promise<string> => {
  fs.mkdirSync(publicFolder, { recursive: true });
  const outputAudio = path.join(publicFolder, `${randomBytes(24).toString("hex")}.mp3`);
  const ffmpegCmd = getFfmpegPath();

  return new Promise((resolve, reject) => {
    execFile(
      ffmpegCmd,
      buildArgs(outputAudio),
      { timeout: 60000, maxBuffer: 1024 * 1024 },
      (error, _stdout, _stderr) => {
        if (error) {
          fs.rmSync(outputAudio, { force: true });
          reject(error);
          return;
        }
        if (deleteSource) {
          try {
            fs.unlinkSync(audio);
          } catch (e) {}
        }
        resolve(outputAudio);
      }
    );
  });
};

const processAudio = (audio: string, deleteSource = false): Promise<string> =>
  runFfmpegAudio(
    audio,
    outputAudio => ["-nostdin", "-threads", "1", "-i", audio, "-vn", "-ab", "128k", "-ar", "44100", "-f", "ipod", outputAudio],
    deleteSource
  );

const processAudioFile = (audio: string, deleteSource = false): Promise<string> =>
  runFfmpegAudio(
    audio,
    outputAudio => ["-nostdin", "-threads", "1", "-i", audio, "-vn", "-ar", "44100", "-ac", "2", "-b:a", "192k", outputAudio],
    deleteSource
  );

const readAndRemoveTempFile = async (filePath: string): Promise<Buffer> => {
  try {
    return await fs.promises.readFile(filePath);
  } finally {
    await fs.promises.rm(filePath, { force: true });
  }
};

export const getMessageOptions = async (
  fileName: string,
  pathMedia: string,
  body?: string
): Promise<any> => {
  try {
    const mimeType = mime.lookup(pathMedia);
    if (!mimeType) {
      throw new Error("Invalid mimetype");
    }
    const typeMessage = mimeType.split("/")[0];
    let options: AnyMessageContent;

    if (typeMessage === "video") {
      options = {
        video: await fs.promises.readFile(pathMedia),
        caption: body ? body : '',
        fileName: fileName
        // gifPlayback: true
      };
    } else if (typeMessage === "audio") {
      const convert = await processAudio(pathMedia, false);
      options = {
        audio: await readAndRemoveTempFile(convert),
        mimetype: "audio/mp4",
        caption: body ? body : null,
        ptt: true
      };
    } else if (typeMessage === "document") {
      options = {
        document: await fs.promises.readFile(pathMedia),
        caption: body ? body : null,
        fileName: fileName,
        mimetype: mimeType
      };
    } else if (typeMessage === "application") {
      options = {
        document: await fs.promises.readFile(pathMedia),
        caption: body ? body : null,
        fileName: fileName,
        mimetype: mimeType
      };
    } else {
      options = {
        image: await fs.promises.readFile(pathMedia),
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
  isForwarded = false,
  deleteSource = true
}: Request): Promise<WAMessage> => {
  try {
    const wbot = await GetTicketWbot(ticket);

    const pathMedia = media.path;
    const typeMessage = media.mimetype.split("/")[0];
    let options: AnyMessageContent;
    const bodyMessage = formatBody(body, ticket.contact)

    if (typeMessage === "video") {
      options = {
        video: await fs.promises.readFile(pathMedia),
        caption: bodyMessage,
        fileName: media.originalname,
        contextInfo: { forwardingScore: isForwarded ? 2 : 0, isForwarded: isForwarded }
        // gifPlayback: true
      };
    } else if (typeMessage === "audio") {
      const typeAudio = media.originalname.includes("audio-record-site");
      const convert = typeAudio
        ? await processAudio(media.path, deleteSource)
        : await processAudioFile(media.path, deleteSource);
      const audioBuffer = await readAndRemoveTempFile(convert);
      options = typeAudio
        ? {
            audio: audioBuffer,
            mimetype: "audio/mp4",
            ptt: true,
            contextInfo: { forwardingScore: isForwarded ? 2 : 0, isForwarded: isForwarded }
          }
        : {
            audio: audioBuffer,
            mimetype: media.mimetype,
            contextInfo: { forwardingScore: isForwarded ? 2 : 0, isForwarded: isForwarded }
          };
    } else if (typeMessage === "document" || typeMessage === "text") {
      options = {
        document: await fs.promises.readFile(pathMedia),
        caption: bodyMessage,
        fileName: media.originalname,
        mimetype: media.mimetype,
        contextInfo: { forwardingScore: isForwarded ? 2 : 0, isForwarded: isForwarded }
      };
    } else if (typeMessage === "application") {
      options = {
        document: await fs.promises.readFile(pathMedia),
        caption: bodyMessage,
        fileName: media.originalname,
        mimetype: media.mimetype,
        contextInfo: { forwardingScore: isForwarded ? 2 : 0, isForwarded: isForwarded }
      };
    } else {
      options = {
        image: await fs.promises.readFile(pathMedia),
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
