import { Mp3Encoder } from "@breezystack/lamejs";

class Encoder {
  constructor(config) {
    this.config = config;
    this.mp3Encoder = new Mp3Encoder(1, this.config.sampleRate || 44100, this.config.bitRate || 128);
    this.dataBuffer = [];
  }

  encode(buffer) {
    const samples = new Int16Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      samples[i] = buffer[i] < 0 ? buffer[i] * 0x8000 : buffer[i] * 0x7fff;
    }
    const mp3buf = this.mp3Encoder.encodeBuffer(samples);
    if (mp3buf.length > 0) {
      this.dataBuffer.push(new Int8Array(mp3buf));
    }
  }

  finish() {
    const mp3buf = this.mp3Encoder.flush();
    if (mp3buf.length > 0) {
      this.dataBuffer.push(new Int8Array(mp3buf));
    }
    return this.dataBuffer;
  }

  clearBuffer() {
    this.dataBuffer = [];
  }
}

export default class MicRecorder {
  constructor(config = {}) {
    this.config = {
      bitRate: 128,
      startRecordingAt: 300,
      deviceId: null,
      ...config,
    };
    this.activeStream = null;
    this.context = null;
    this.microphone = null;
    this.processor = null;
    this.lameEncoder = null;
    this.timerToStart = null;
  }

  addMicrophoneListener(stream) {
    this.activeStream = stream;

    this.timerToStart = setTimeout(() => {
      this.timerToStart = null;
    }, this.config.startRecordingAt);

    this.microphone = this.context.createMediaStreamSource(stream);
    this.processor = this.context.createScriptProcessor(0, 1, 1);

    this.processor.onaudioprocess = (event) => {
      if (this.timerToStart) return;
      if (this.lameEncoder) {
        this.lameEncoder.encode(event.inputBuffer.getChannelData(0));
      }
    };

    this.microphone.connect(this.processor);
    this.processor.connect(this.context.destination);
  }

  stop() {
    if (this.processor && this.microphone) {
      this.microphone.disconnect();
      this.processor.disconnect();

      if (this.context && this.context.state !== "closed") {
        this.context.close().catch(() => {});
      }

      this.processor.onaudioprocess = null;

      if (this.activeStream) {
        this.activeStream.getAudioTracks().forEach((track) => track.stop());
      }
    }
    return this;
  }

  start() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.context = new AudioContextClass();
    this.config.sampleRate = this.context.sampleRate;
    this.lameEncoder = new Encoder(this.config);

    const audioConstraints = this.config.deviceId
      ? { deviceId: { exact: this.config.deviceId } }
      : true;

    return new Promise((resolve, reject) => {
      navigator.mediaDevices
        .getUserMedia({ audio: audioConstraints })
        .then((stream) => {
          this.addMicrophoneListener(stream);
          resolve(stream);
        })
        .catch(reject);
    });
  }

  getMp3() {
    const finalBuffer = this.lameEncoder ? this.lameEncoder.finish() : [];

    return new Promise((resolve, reject) => {
      if (finalBuffer.length === 0) {
        reject(new Error("No buffer to send"));
      } else {
        const blob = new Blob(finalBuffer, { type: "audio/mp3" });
        resolve([finalBuffer, blob]);
        if (this.lameEncoder) {
          this.lameEncoder.clearBuffer();
        }
      }
    });
  }
}
