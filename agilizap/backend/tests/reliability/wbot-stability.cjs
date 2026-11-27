/* Isolated reliability checks for wbot listener hardening, shutdown cleanup, and unhandledRejection guards. */
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

process.env.NODE_ENV = 'test';

const unhandledRejections = [];
process.on('unhandledRejection', reason => {
  unhandledRejections.push(reason);
});

require('reflect-metadata');
require.extensions['.ts'] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
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

const source = path.resolve(__dirname, '../../src');
let saveStateError = null;
let whatsappFindByPkError = null;
let mockWhatsappRow = null;
let lastMakeWASocketConfig = null;
let groupMetadataImpl = async jid => ({ id: jid, subject: 'Grupo', participants: [] });
let messageFindOneImpl = async () => null;
let deleteSessionFilesCalls = 0;
let deleteBaileysCalls = 0;
let pairingCodeCalls = 0;
let fetchVersionCalls = 0;
let lastSignalKeyStoreLogger = null;
let startSessionCalls = [];
let delegateStartToInit = false;
let listWhatsAppsImpl = async () => [];
const createdSockets = [];

const originalLoad = Module._load;
Module._load = function (request, parent, ...rest) {
  if (request === '@whiskeysockets/baileys') {
    const makeWASocket = config => {
      lastMakeWASocketConfig = config;
      const ev = new EventEmitter();
      const ws = new EventEmitter();
      const sock = {
        ev,
        ws,
        user: { id: '5567999990001@s.whatsapp.net' },
        authState: config.auth,
        groupMetadata: jid => groupMetadataImpl(jid),
        requestPairingCode: async () => {
          pairingCodeCalls++;
          return 'ABCD-1234';
        },
        logout: async () => { sock.logoutCalled = true; },
        end: () => { sock.endCalled = true; }
      };
      createdSockets.push(sock);
      return sock;
    };
    return {
      __esModule: true,
      default: makeWASocket,
      DisconnectReason: { loggedOut: 401, connectionReplaced: 440, restartRequired: 515 },
      fetchLatestBaileysVersion: async () => {
        fetchVersionCalls++;
        return { version: [2, 3000, 1], isLatest: true };
      },
      makeCacheableSignalKeyStore: (keys, storeLogger) => {
        lastSignalKeyStoreLogger = storeLogger;
        return keys;
      },
      isJidBroadcast: () => false,
      jidNormalizedUser: jid => jid,
      Browsers: { ubuntu: b => ['Ubuntu', b, '22.04.4'] },
      proto: {
        Message: {
          fromObject: obj => ({ ...obj, __isProtoMessage: true })
        }
      }
    };
  }
  if (request === '@whiskeysockets/baileys/lib/Utils/logger') {
    return { __esModule: true, default: { child: () => ({ level: 'error' }) } };
  }

  let resolved;
  try {
    resolved = Module._resolveFilename(request, parent);
  } catch (_) {
    return originalLoad.call(this, request, parent, ...rest);
  }

  if (resolved === path.join(source, 'utils/logger.ts')) {
    const noop = () => {};
    return { logger: { info: noop, error: noop, warn: noop, debug: noop } };
  }
  if (resolved === path.join(source, 'libs/socket.ts')) {
    const io = { to: () => io, emit: () => {} };
    return { __esModule: true, getIO: () => io };
  }
  if (resolved === path.join(source, 'helpers/authState.ts')) {
    return {
      __esModule: true,
      default: async () => ({
        state: { creds: { registered: mockWhatsappRow?.registered !== false }, keys: {} },
        saveState: async () => {
          if (saveStateError) throw saveStateError;
        }
      }),
      deleteSessionFiles: async () => {
        deleteSessionFilesCalls++;
      },
      getSessionDir: id => `/tmp/whatsapp_${id}`
    };
  }
  if (resolved === path.join(source, 'services/BaileysServices/DeleteBaileysService.ts')) {
    return {
      __esModule: true,
      default: async () => {
        deleteBaileysCalls++;
      }
    };
  }
  if (resolved === path.join(source, 'services/WbotServices/StartWhatsAppSession.ts')) {
    return {
      __esModule: true,
      StartWhatsAppSession: async (whatsapp, companyId, reconnecting) => {
        startSessionCalls.push({ id: whatsapp.id, status: whatsapp.status, companyId, reconnecting });
        if (delegateStartToInit) {
          const { initWASocket } = load('libs/wbot.ts');
          await initWASocket(whatsapp, reconnecting);
        }
      }
    };
  }
  if (resolved === path.join(source, 'services/WhatsappService/ListWhatsAppsService.ts')) {
    return {
      __esModule: true,
      default: async query => listWhatsAppsImpl(query)
    };
  }
  if (resolved === path.join(source, 'models/Whatsapp.ts')) {
    return {
      __esModule: true,
      default: {
        findOne: async () => mockWhatsappRow,
        findByPk: async () => {
          if (whatsappFindByPkError) throw whatsappFindByPkError;
          return mockWhatsappRow;
        }
      }
    };
  }
  if (resolved === path.join(source, 'models/Contact.ts')) {
    return { __esModule: true, default: { findOne: async () => null } };
  }
  if (resolved === path.join(source, 'models/Ticket.ts')) {
    return { __esModule: true, default: { findOne: async () => null } };
  }
  if (resolved === path.join(source, 'models/Message.ts')) {
    return {
      __esModule: true,
      default: {
        findOne: async query => messageFindOneImpl(query),
        findAll: async () => [],
        update: async () => {}
      }
    };
  }
  return originalLoad.call(this, request, parent, ...rest);
};

const load = name => require(path.join(source, name));
const flush = () => new Promise(resolve => setTimeout(resolve, 60));

(async () => {
  const { initWASocket, removeWbot, closeAllWbots, getWbot, isTransientBaileysError } = load('libs/wbot.ts');
  const SetTicketMessagesAsRead = load('helpers/SetTicketMessagesAsRead.ts').default;

  // 1. isTransientBaileysError classification
  const baileysBoom = new Error('Connection Closed');
  baileysBoom.isBoom = true;
  baileysBoom.stack = 'Error: Connection Closed\n    at end (/app/node_modules/@whiskeysockets/baileys/lib/Socket/socket.js:240:13)';
  assert.equal(isTransientBaileysError(baileysBoom), true);

  const baileysNet = new Error('read ECONNRESET');
  baileysNet.code = 'ECONNRESET';
  baileysNet.stack = 'Error: read ECONNRESET\n    at Socket.onError (node_modules/@whiskeysockets/baileys/lib/Socket/Client/websocket.js:35:10)';
  assert.equal(isTransientBaileysError(baileysNet), true);

  const appBug = new TypeError("Cannot read properties of undefined (reading 'id')");
  appBug.stack = 'TypeError\n    at handleMessage (/app/dist/services/WbotServices/wbotMessageListener.js:100:5)';
  assert.equal(isTransientBaileysError(appBug), false);

  const baileysCodeBug = new TypeError("Cannot read properties of null");
  baileysCodeBug.stack = 'TypeError\n    at foo (node_modules/@whiskeysockets/baileys/lib/Socket/socket.js:10:1)';
  assert.equal(isTransientBaileysError(baileysCodeBug), false);
  console.log('PASS 1. isTransientBaileysError differentiates transient Baileys errors from app/code bugs');

  // 2. connection.update and creds.update errors do not cause unhandledRejection
  let updateFail = true;
  mockWhatsappRow = {
    id: 1,
    name: 'Suporte',
    companyId: 1,
    status: 'CONNECTED',
    number: '5567999990001',
    update: async patch => {
      if (updateFail) throw new Error('DB connection lost during update');
      Object.assign(mockWhatsappRow, patch);
      return mockWhatsappRow;
    }
  };
  // Allow initial OPENING update in initWASocket, then fail inside connection.update
  updateFail = false;
  const sock = await initWASocket(mockWhatsappRow, false);
  assert.ok(sock);

  updateFail = true;
  saveStateError = new Error('ENOSPC during creds save');
  sock.ev.emit('connection.update', { connection: 'open' });
  sock.ev.emit('creds.update', {});
  await flush();
  assert.equal(unhandledRejections.length, 0, 'connection.update and creds.update failures must be caught');
  console.log('PASS 2. connection.update and creds.update errors caught without unhandledRejection');

  // 3. removeWbot clears wbotMonitor listeners and closeAllWbots closes active sessions without logout
  sock.ev.on('contacts.upsert', () => {});
  sock.ws.on('CB:call', () => {});
  assert.equal(sock.ev.listenerCount('contacts.upsert'), 1);
  assert.equal(sock.ws.listenerCount('CB:call'), 1);

  await closeAllWbots();
  assert.equal(sock.ev.listenerCount('contacts.upsert'), 0, 'contacts.upsert listener must be removed');
  assert.equal(sock.ws.listenerCount('CB:call'), 0, 'CB:call ws listener must be removed');
  assert.equal(sock.endCalled, true, 'closeAllWbots must call session.end');
  assert.equal(sock.logoutCalled, undefined, 'closeAllWbots must NOT logout the session');
  assert.throws(() => getWbot(1), err => err?.message === 'ERR_WAPP_NOT_INITIALIZED');
  console.log('PASS 3. removeWbot/closeAllWbots clear wbotMonitor listeners and close sockets cleanly');

  // 4. SetTicketMessagesAsRead never rejects when ticket.update fails
  await SetTicketMessagesAsRead({
    id: 77,
    companyId: 1,
    queueId: 1,
    update: async () => {
      throw new Error('DB temporarily unavailable');
    }
  });
  await flush();
  assert.equal(unhandledRejections.length, 0, 'SetTicketMessagesAsRead must not produce unhandledRejection');
  console.log('PASS 4. SetTicketMessagesAsRead handles ticket.update failure safely');

  // 5. cachedGroupMetadata caches, invalidates on group events, handles errors, and cleans listeners
  updateFail = false;
  saveStateError = null;
  let groupFetchCount = 0;
  groupMetadataImpl = async jid => {
    groupFetchCount++;
    return { id: jid, subject: `Grupo #${groupFetchCount}`, participants: [] };
  };
  const sock2 = await initWASocket(mockWhatsappRow, false);
  assert.ok(sock2);
  assert.equal(typeof lastMakeWASocketConfig.cachedGroupMetadata, 'function');

  const groupJid = '120363999@g.us';
  const m1 = await lastMakeWASocketConfig.cachedGroupMetadata(groupJid);
  const m2 = await lastMakeWASocketConfig.cachedGroupMetadata(groupJid);
  const m3 = await lastMakeWASocketConfig.cachedGroupMetadata(groupJid);
  assert.equal(groupFetchCount, 1, 'cachedGroupMetadata must cache groupMetadata queries');
  assert.equal(m1.subject, 'Grupo #1');
  assert.equal(m3.subject, 'Grupo #1');

  sock2.ev.emit('groups.update', [{ id: groupJid, subject: 'Novo Nome' }]);
  const m4 = await lastMakeWASocketConfig.cachedGroupMetadata(groupJid);
  assert.equal(groupFetchCount, 2, 'groups.update must invalidate cachedGroupMetadata');
  assert.equal(m4.subject, 'Grupo #2');

  sock2.ev.emit('group-participants.update', { id: groupJid });
  const m5 = await lastMakeWASocketConfig.cachedGroupMetadata(groupJid);
  assert.equal(groupFetchCount, 3, 'group-participants.update must invalidate cachedGroupMetadata');
  assert.equal(m5.subject, 'Grupo #3');

  sock2.ev.emit('groups.update', [{ id: groupJid }]);
  groupMetadataImpl = async () => {
    throw new Error('rate-overlimit');
  };
  const mErr = await lastMakeWASocketConfig.cachedGroupMetadata(groupJid);
  assert.equal(mErr, undefined, 'cachedGroupMetadata must return undefined on fetch error');

  assert.equal(sock2.ev.listenerCount('groups.update'), 1);
  assert.equal(sock2.ev.listenerCount('group-participants.update'), 1);
  await removeWbot(1, false);
  assert.equal(sock2.ev.listenerCount('groups.update'), 0, 'removeWbot must clear groups.update listener');
  assert.equal(sock2.ev.listenerCount('group-participants.update'), 0, 'removeWbot must clear group-participants.update listener');
  console.log('PASS 5. cachedGroupMetadata caches, invalidates on events, handles errors, and removes listeners');

  // 6. getMessage resolves stored proto.Message and guards against missing/corrupt/DB failures
  let seenQueries = [];
  messageFindOneImpl = async query => {
    seenQueries.push(query);
    if (query.where.id === 'wamid-ok') {
      return { dataJson: JSON.stringify({ message: { conversation: 'Mensagem recuperada' } }) };
    }
    if (query.where.id === 'wamid-bad-json') {
      return { dataJson: '{invalid-json' };
    }
    if (query.where.id === 'wamid-db-err') {
      throw new Error('DB timeout');
    }
    return null;
  };

  assert.equal(typeof lastMakeWASocketConfig.getMessage, 'function');
  assert.equal(await lastMakeWASocketConfig.getMessage({}), undefined);
  assert.equal(seenQueries.length, 0, 'getMessage without key.id must not query DB');

  const recovered = await lastMakeWASocketConfig.getMessage({ id: 'wamid-ok' });
  assert.equal(recovered.conversation, 'Mensagem recuperada');
  assert.equal(recovered.__isProtoMessage, true);
  assert.equal(seenQueries[0].where.companyId, 1, 'getMessage must scope query by companyId');

  assert.equal(await lastMakeWASocketConfig.getMessage({ id: 'wamid-missing' }), undefined);
  assert.equal(await lastMakeWASocketConfig.getMessage({ id: 'wamid-bad-json' }), undefined);
  assert.equal(await lastMakeWASocketConfig.getMessage({ id: 'wamid-db-err' }), undefined);
  assert.equal(unhandledRejections.length, 0);
  console.log('PASS 6. getMessage returns proto.Message and safely handles missing/corrupt/error cases');

  // Helper to capture setTimeout/clearTimeout deterministically for reconnect/watchdog tests
  const withCapturedTimers = async fn => {
    const realSetTimeout = global.setTimeout;
    const realClearTimeout = global.clearTimeout;
    let nextId = 1;
    const timers = new Map();
    global.setTimeout = (cb, delay = 0, ...args) => {
      const id = nextId++;
      timers.set(id, { id, cb, delay, args, cleared: false, ran: false });
      return id;
    };
    global.clearTimeout = id => {
      const entry = timers.get(id);
      if (entry) entry.cleared = true;
    };
    const flushNext = async () => {
      await new Promise(resolve => realSetTimeout(resolve, 10));
    };
    const runNextByDelay = async predicate => {
      const entry = [...timers.values()].find(t => !t.cleared && !t.ran && (!predicate || predicate(t)));
      assert.ok(entry, 'Expected pending timer');
      entry.ran = true;
      await entry.cb(...entry.args);
      await flushNext();
      return entry;
    };
    try {
      await fn({ timers, flushNext, runNextByDelay });
    } finally {
      global.setTimeout = realSetTimeout;
      global.clearTimeout = realClearTimeout;
    }
  };

  // 7. 403 retries twice without wiping creds.json before marking DISCONNECTED
  await withCapturedTimers(async ({ timers, flushNext, runNextByDelay }) => {
    deleteSessionFilesCalls = 0;
    deleteBaileysCalls = 0;
    delegateStartToInit = true;
    mockWhatsappRow.status = 'CONNECTED';
    mockWhatsappRow.disconnectReason = null;
    mockWhatsappRow.actionRequired = null;

    let s = await initWASocket(mockWhatsappRow, false);
    for (let i = 1; i <= 2; i++) {
      s.ev.emit('connection.update', { connection: 'close', lastDisconnect: { error: { output: { statusCode: 403 } } } });
      await flushNext();
      assert.equal(mockWhatsappRow.status, 'RECONNECTING', `403 attempt ${i} should schedule RECONNECTING`);
      assert.equal(deleteSessionFilesCalls, 0, '403 must NOT wipe session files');
      await runNextByDelay(t => t.delay < 65000);
      s = createdSockets[createdSockets.length - 1];
    }

    s.ev.emit('connection.update', { connection: 'close', lastDisconnect: { error: { output: { statusCode: 403 } } } });
    await flushNext();
    assert.equal(mockWhatsappRow.status, 'DISCONNECTED');
    assert.equal(mockWhatsappRow.disconnectReason, 'BANNED_OR_FORBIDDEN');
    assert.ok(mockWhatsappRow.actionRequired.includes('403'));
    assert.ok(mockWhatsappRow.lastDisconnectedAt instanceof Date);
    assert.equal(deleteSessionFilesCalls, 0, '403 must preserve session files even after retries exhausted');
    await removeWbot(1, false);
  });
  console.log('PASS 7. 403 retries before stopping and preserves session files with disconnect metadata');

  // 8. 440 allows delayed retries (20s) before giving up
  await withCapturedTimers(async ({ timers, flushNext, runNextByDelay }) => {
    delegateStartToInit = true;
    mockWhatsappRow.status = 'CONNECTED';
    let s = await initWASocket(mockWhatsappRow, false);

    for (let i = 1; i <= 2; i++) {
      s.ev.emit('connection.update', { connection: 'close', lastDisconnect: { error: { output: { statusCode: 440 } } } });
      await flushNext();
      assert.equal(mockWhatsappRow.status, 'RECONNECTING');
      const timer = await runNextByDelay(t => t.delay === 20000);
      assert.equal(timer.delay, 20000, '440 retry must use 20s delayed backoff');
      s = createdSockets[createdSockets.length - 1];
    }

    s.ev.emit('connection.update', { connection: 'close', lastDisconnect: { error: { output: { statusCode: 440 } } } });
    await flushNext();
    assert.equal(mockWhatsappRow.status, 'DISCONNECTED');
    assert.equal(mockWhatsappRow.disconnectReason, 'CONNECTION_REPLACED');
    assert.ok(mockWhatsappRow.actionRequired.includes('outro navegador'));
    await removeWbot(1, false);
  });
  console.log('PASS 8. 440 permits delayed retries and records CONNECTION_REPLACED after limit');

  // 9. 401 loggedOut updates metadata, deletes session files, and skips session.logout()
  await withCapturedTimers(async ({ flushNext }) => {
    deleteSessionFilesCalls = 0;
    deleteBaileysCalls = 0;
    mockWhatsappRow.status = 'CONNECTED';
    const s = await initWASocket(mockWhatsappRow, false);

    s.ev.emit('connection.update', { connection: 'close', lastDisconnect: { error: { output: { statusCode: 401 } } } });
    await flushNext();
    assert.equal(mockWhatsappRow.status, 'DISCONNECTED');
    assert.equal(mockWhatsappRow.disconnectReason, 'LOGGED_OUT');
    assert.ok(mockWhatsappRow.actionRequired.includes('QR Code'));
    assert.equal(deleteSessionFilesCalls, 1);
    assert.equal(deleteBaileysCalls, 1);
    assert.equal(s.logoutCalled, undefined, '401 must not call session.logout() on already logged out socket');
  });
  console.log('PASS 9. 401 loggedOut cleans session files and records LOGGED_OUT without calling logout()');

  // 10. Persistent network failure switches to slow 3m retry (RECONNECT_PAUSED) and recovers on open
  await withCapturedTimers(async ({ timers, flushNext, runNextByDelay }) => {
    delegateStartToInit = true;
    mockWhatsappRow.status = 'CONNECTED';
    let s = await initWASocket(mockWhatsappRow, false);

    for (let i = 0; i < 10; i++) {
      s.ev.emit('connection.update', { connection: 'close', lastDisconnect: { error: { output: { statusCode: 408 } } } });
      await flushNext();
      assert.equal(mockWhatsappRow.status, 'RECONNECTING');
      await runNextByDelay(t => t.delay < 65000);
      s = createdSockets[createdSockets.length - 1];
    }

    // 11th failure enters RECONNECT_PAUSED with 180s slow retry loop (not permanent dead stop)
    s.ev.emit('connection.update', { connection: 'close', lastDisconnect: { error: { output: { statusCode: 408 } } } });
    await flushNext();
    assert.equal(mockWhatsappRow.status, 'RECONNECT_PAUSED');
    assert.equal(mockWhatsappRow.disconnectReason, 'PERSISTENT_NETWORK_FAILURE');
    assert.ok(mockWhatsappRow.actionRequired.includes('3 minutos'));

    const slowTimer = await runNextByDelay(t => t.delay === 180000);
    assert.equal(slowTimer.delay, 180000);
    const recoveredSock = createdSockets[createdSockets.length - 1];
    recoveredSock.ev.emit('connection.update', { connection: 'open' });
    await flushNext();
    assert.equal(mockWhatsappRow.status, 'CONNECTED');
    assert.equal(mockWhatsappRow.disconnectReason, null);
    assert.equal(mockWhatsappRow.actionRequired, null);

    // Fire stable connection timer (60s) and confirm no stale retry timers remain active
    await runNextByDelay(t => t.delay === 60000);
    await removeWbot(1, false);
  });
  console.log('PASS 10. RECONNECT_PAUSED continues slow 3m retries and clears metadata on recovery');

  // 11. Pairing Code cancels connectWatchdog so pairing does not abort at 65s
  await withCapturedTimers(async ({ timers, flushNext, runNextByDelay }) => {
    pairingCodeCalls = 0;
    mockWhatsappRow.status = 'pairing';
    mockWhatsappRow.registered = false;
    mockWhatsappRow.number = '5567999990001';
    await initWASocket(mockWhatsappRow, false);

    const watchdogTimer = [...timers.values()].find(t => !t.cleared && t.delay === 65000);
    assert.ok(watchdogTimer, 'connectWatchdog (65s) should be scheduled initially');

    await runNextByDelay(t => t.delay === 3500);
    assert.equal(pairingCodeCalls, 1);
    assert.equal(mockWhatsappRow.qrcode, 'ABCD-1234');
    assert.equal(watchdogTimer.cleared, true, 'connectWatchdog must be cleared after pairing code generation');
    mockWhatsappRow.registered = true;
    await removeWbot(1, false);
  });
  console.log('PASS 11. Pairing Code cancels connectWatchdog after generating code');

  // 12. StartAllWhatsAppsSessions resumes RECONNECT_PAUSED sessions on boot
  delegateStartToInit = false;
  startSessionCalls = [];
  listWhatsAppsImpl = async () => [
    { id: 10, name: 'Pausado', status: 'RECONNECT_PAUSED', companyId: 1 },
    { id: 11, name: 'Desconectado', status: 'DISCONNECTED', companyId: 1 }
  ];
  const { StartAllWhatsAppsSessions } = load('services/WbotServices/StartAllWhatsAppsSessions.ts');
  await StartAllWhatsAppsSessions(1);
  assert.equal(startSessionCalls.length, 1);
  assert.equal(startSessionCalls[0].id, 10, 'StartAllWhatsAppsSessions must resume RECONNECT_PAUSED on boot');
  console.log('PASS 12. StartAllWhatsAppsSessions resumes RECONNECT_PAUSED on startup');

  // 13. Hardened makeWASocket config + module-scoped caches + cached Baileys version
  const { clearBaileysVersionCache } = load('libs/wbot.ts');
  clearBaileysVersionCache();
  fetchVersionCalls = 0;
  mockWhatsappRow.status = 'CONNECTED';
  await initWASocket(mockWhatsappRow, false);
  const firstCfg = lastMakeWASocketConfig;
  await removeWbot(1, false);
  await initWASocket(mockWhatsappRow, false);
  const secondCfg = lastMakeWASocketConfig;
  await removeWbot(1, false);

  assert.equal(fetchVersionCalls, 1, 'getCachedBaileysVersion must reuse cached version across reconnects');
  clearBaileysVersionCache();
  await initWASocket(mockWhatsappRow, false);
  assert.equal(fetchVersionCalls, 2, 'clearBaileysVersionCache must force fresh lookup');
  await removeWbot(1, false);

  assert.ok(firstCfg.userDevicesCache, 'userDevicesCache must be passed to makeWASocket');
  assert.equal(firstCfg.userDevicesCache, secondCfg.userDevicesCache, 'userDevicesCache must persist across reconnects');
  assert.equal(firstCfg.msgRetryCounterCache, secondCfg.msgRetryCounterCache, 'msgRetryCounterCache must persist across reconnects');
  assert.equal(firstCfg.msgRetryCounterCache.options.stdTTL, 3600);
  assert.equal(firstCfg.syncFullHistory, false);
  assert.equal(firstCfg.shouldSyncHistoryMessage(), false);
  assert.equal(firstCfg.markOnlineOnConnect, false);
  assert.equal(firstCfg.keepAliveIntervalMs, 30000);
  assert.equal(lastSignalKeyStoreLogger?.level, 'error', 'makeCacheableSignalKeyStore must use loggerBaileys');
  console.log('PASS 13. Hardened makeWASocket options, shared caches, and cached WA version verified');

  assert.equal(unhandledRejections.length, 0);
  console.log('RESULT 13/13 passed; zero unhandledRejections');
  process.exit(0);
})().catch(err => {
  console.error('FAIL in wbot-stability test:', err);
  process.exit(1);
});
