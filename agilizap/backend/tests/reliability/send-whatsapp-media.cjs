/* Isolated reliability tests for SendWhatsAppMedia & getMessageOptions: preserves source audio files and cleans up temporary converted MP3 files. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const crypto = require("node:crypto");
const ts = require("typescript");

process.env.NODE_ENV = "test";
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ticket-media-test-"));
const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), "ticket-media-src-"));
process.env.TEST_MEDIA_ROOT = tempRoot;

require("reflect-metadata");
require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true
      }
    }).outputText,
    filename
  );

const srcRoot = path.resolve(__dirname, "../../src");
const sentMessages = [];
let mockFfmpegError = null;
const ffmpegCalls = [];

const originalChildProcess = require("node:child_process");

const originalLoad = Module._load;
Module._load = function (request, parent, ...rest) {
  if (request === "child_process" || request === "node:child_process") {
    return {
      ...originalChildProcess,
      execFile: (cmd, args, opts, cb) => {
        const callback = typeof opts === "function" ? opts : cb;
        const outputPath = args[args.length - 1];
        ffmpegCalls.push({ cmd, args: [...args], outputPath });
        if (mockFfmpegError) {
          fs.writeFileSync(outputPath, Buffer.from("partial-corrupt-mp3"));
          callback(mockFfmpegError, "", "ffmpeg failed");
          return;
        }
        fs.writeFileSync(outputPath, Buffer.from(`converted:${path.basename(args[args.indexOf("-i") + 1])}`));
        callback(null, "", "");
      }
    };
  }

  let resolved = request;
  try {
    resolved = Module._resolveFilename(request, parent);
  } catch (e) {
    // Let originalLoad handle unresolved module if needed
  }

  if (resolved === path.join(srcRoot, "helpers/GetTicketWbot.ts")) {
    return {
      __esModule: true,
      default: async () => ({
        sendMessage: async (jid, payload) => {
          sentMessages.push({ jid, payload });
          return { key: { id: "wamid-" + crypto.randomBytes(6).toString("hex"), remoteJid: jid } };
        }
      })
    };
  }

  if (resolved === path.join(srcRoot, "helpers/GetWhatsappWbot.ts")) {
    return {
      __esModule: true,
      default: async () => ({
        sendMessage: async (jid, payload) => {
          sentMessages.push({ jid, payload });
          return { key: { id: "wamid-" + crypto.randomBytes(6).toString("hex"), remoteJid: jid } };
        }
      })
    };
  }

  if (resolved === path.join(srcRoot, "models/Ticket.ts")) {
    return { __esModule: true, default: class Ticket {} };
  }

  if (resolved === path.join(srcRoot, "models/Contact.ts")) {
    return { __esModule: true, default: { findByPk: async () => null } };
  }

  if (resolved === path.join(srcRoot, "helpers/Mustache.ts")) {
    return { __esModule: true, default: (body) => body || "" };
  }

  if (resolved === path.join(srcRoot, "helpers/GetRecipientJid.ts")) {
    return {
      __esModule: true,
      getRecipientJid: (ticket) => `${ticket.contact?.number || "5511999999999"}@s.whatsapp.net`
    };
  }

  if (request === "@sentry/node") {
    return { captureException: () => {} };
  }

  return originalLoad.call(this, request, parent, ...rest);
};

const SendWhatsAppMediaModule = require(path.join(srcRoot, "services/WbotServices/SendWhatsAppMedia.ts"));
const SendWhatsAppMedia = SendWhatsAppMediaModule.default;
const { getMessageOptions } = SendWhatsAppMediaModule;
const { SendMessage } = require(path.join(srcRoot, "helpers/SendMessage.ts"));

const listTempMp3Files = () =>
  fs.readdirSync(tempRoot).filter((name) => name.endsWith(".mp3"));

async function run() {
  // 1. getMessageOptions (Campaigns, Queue greetings, Chatbot options):
  //    Must keep the original source audio across multiple recipients and leak 0 temp .mp3 files.
  const campaignAudio = path.join(sourceDir, "campaign-greeting.mp3");
  fs.writeFileSync(campaignAudio, Buffer.from("original-campaign-audio"));

  for (let i = 0; i < 3; i += 1) {
    const options = await getMessageOptions("campaign-greeting.mp3", campaignAudio, `Msg ${i + 1}`);
    assert.ok(options, `getMessageOptions must succeed on recipient #${i + 1}`);
    assert.equal(options.mimetype, "audio/mp4");
    assert.equal(options.ptt, true);
    assert.equal(options.caption, `Msg ${i + 1}`);
    assert.equal(options.audio.toString(), "converted:campaign-greeting.mp3");
    assert.equal(fs.existsSync(campaignAudio), true, "Source campaign audio must NOT be deleted");
    assert.deepEqual(listTempMp3Files(), [], "Temporary converted .mp3 must be deleted immediately");
  }

  // 2. SendMessage (Schedules):
  //    Must work multiple times (e.g. retries / shared media) without ENOENT and without leaking .mp3 files.
  const scheduleAudio = path.join(sourceDir, "schedule-reminder.ogg");
  fs.writeFileSync(scheduleAudio, Buffer.from("original-schedule-audio"));

  await SendMessage({ id: 1 }, {
    number: "5511999990001",
    body: "Lembrete 1",
    mediaPath: scheduleAudio,
    fileName: "schedule-reminder.ogg"
  });
  await SendMessage({ id: 1 }, {
    number: "5511999990002",
    body: "Lembrete 2",
    mediaPath: scheduleAudio,
    fileName: "schedule-reminder.ogg"
  });

  assert.equal(fs.existsSync(scheduleAudio), true, "Schedule source audio must remain intact");
  assert.deepEqual(listTempMp3Files(), [], "SendMessage must not leak temporary .mp3 files");
  assert.equal(sentMessages.length, 2);

  // 3. SendWhatsAppMedia with audio-record-site (default deleteSource = true) and regular audio:
  //    Cleans up one-time Multer upload and cleans up converted .mp3.
  const recordedAudio = path.join(sourceDir, "multer-recorded-1.mp3");
  fs.writeFileSync(recordedAudio, Buffer.from("recorded-bytes"));
  let updatedLastMessage = null;
  const fakeTicket = {
    id: 10,
    contact: { number: "5511988887777" },
    update: async (data) => { updatedLastMessage = data.lastMessage; }
  };

  await SendWhatsAppMedia({
    media: {
      path: recordedAudio,
      mimetype: "audio/mp3",
      originalname: "audio-record-site-123.mp3"
    },
    ticket: fakeTicket,
    body: ""
  });

  assert.equal(fs.existsSync(recordedAudio), false, "One-time Multer audio upload should be deleted after conversion");
  assert.deepEqual(listTempMp3Files(), [], "Converted .mp3 from processAudio must be deleted");
  assert.equal(sentMessages.at(-1).payload.mimetype, "audio/mp4");
  assert.equal(sentMessages.at(-1).payload.ptt, true);
  assert.equal(updatedLastMessage, "");

  // 4. SendWhatsAppMedia with regular audio file (processAudioFile) and deleteSource = false (forwarded message):
  //    Preserves persisted message audio and cleans up converted .mp3.
  const forwardedAudio = path.join(sourceDir, "persisted-msg-audio.ogg");
  fs.writeFileSync(forwardedAudio, Buffer.from("persisted-audio"));

  await SendWhatsAppMedia({
    media: {
      path: forwardedAudio,
      mimetype: "audio/ogg",
      originalname: "persisted-msg-audio.ogg"
    },
    ticket: fakeTicket,
    body: "",
    isForwarded: true,
    deleteSource: false
  });

  assert.equal(fs.existsSync(forwardedAudio), true, "Forwarded message source audio must NOT be deleted");
  assert.deepEqual(listTempMp3Files(), [], "Converted .mp3 from processAudioFile must be deleted");
  assert.equal(sentMessages.at(-1).payload.mimetype, "audio/ogg");
  assert.equal(sentMessages.at(-1).payload.contextInfo.isForwarded, true);

  // 5. FFmpeg failure cleanup & unknown mimetype handling:
  mockFfmpegError = new Error("ffmpeg crashed");
  const failedResult = await getMessageOptions("campaign-greeting.mp3", campaignAudio, "Fail");
  assert.equal(failedResult, null);
  assert.equal(fs.existsSync(campaignAudio), true, "Source audio must remain intact even when FFmpeg fails");
  assert.deepEqual(listTempMp3Files(), [], "Partial converted .mp3 must be removed when FFmpeg fails");
  mockFfmpegError = null;

  const invalidExtFile = path.join(sourceDir, "weirdfile.unknownext");
  fs.writeFileSync(invalidExtFile, Buffer.from("abc"));
  const invalidMimeResult = await getMessageOptions("weirdfile.unknownext", invalidExtFile, "Test");
  assert.equal(invalidMimeResult, null, "Unknown mimetype must return null inside try/catch");

  console.log("PASS send-whatsapp-media reliability checks (5 scenarios)");
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    fs.rmSync(sourceDir, { recursive: true, force: true });
  });
