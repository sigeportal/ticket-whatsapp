/* Isolated reliability tests for WhatsApp listeners and cron jobs (PGlite, zero external services). */
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const crypto = require('node:crypto');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = crypto.randomBytes(48).toString('base64');
process.env.JWT_REFRESH_SECRET = crypto.randomBytes(48).toString('base64');
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.BACKEND_URL = 'http://localhost:8080';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ticket-listeners-crons-'));
process.env.TEST_MEDIA_ROOT = temp;

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
let database;
let baileysError = null;
let mockSendError = null;
const sentMessages = [];
const emittedEvents = [];

const fakeIO = {
  to: () => fakeIO,
  emit: (event, payload) => emittedEvents.push({ event, payload })
};

const originalLoad = Module._load;
Module._load = function (request, parent, ...rest) {
  let resolved;
  try {
    resolved = Module._resolveFilename(request, parent);
  } catch (_) {
    return originalLoad.call(this, request, parent, ...rest);
  }

  if (resolved === path.join(source, 'database/index.ts')) {
    return { __esModule: true, default: database };
  }
  if (resolved === path.join(source, 'libs/cache.ts')) {
    return {
      __esModule: true,
      cacheLayer: { get: async () => null, set: async () => {}, del: async () => {}, delFromPattern: async () => {} }
    };
  }
  if (resolved === path.join(source, 'libs/socket.ts')) {
    return { __esModule: true, getIO: () => fakeIO, initIO: () => fakeIO, enforceTicketRoomAccess: async () => {} };
  }
  if (resolved === path.join(source, 'utils/logger.ts')) {
    const noop = () => {};
    return { logger: { info: noop, error: noop, warn: noop, debug: noop } };
  }
  if (resolved === path.join(source, 'queues.ts')) {
    return {
      __esModule: true,
      sendScheduledMessages: { add: async () => ({ id: 'job-1' }), clean: () => {} },
      messageQueue: { add: async () => {} },
      campaignQueue: { add: async () => {} },
      parseToMilliseconds: v => v,
      randomValue: () => 0
    };
  }
  if (resolved === path.join(source, 'helpers/SetTicketMessagesAsRead.ts')) {
    return { __esModule: true, default: async () => {} };
  }
  if (resolved === path.join(source, 'helpers/GetTicketWbot.ts')) {
    return {
      __esModule: true,
      default: async () => ({
        sendMessage: async (jid, payload) => {
          if (mockSendError) throw mockSendError;
          sentMessages.push({ jid, payload });
          return { key: { id: 'wamid-' + crypto.randomBytes(6).toString('hex'), remoteJid: jid }, message: { conversation: payload.text || '' } };
        }
      })
    };
  }
  if (resolved === path.join(source, 'services/WbotServices/SendWhatsAppMessage.ts')) {
    return {
      __esModule: true,
      default: async ({ body, ticket }) => {
        if (mockSendError) throw mockSendError;
        sentMessages.push({ ticketId: ticket.id, body });
        return { key: { id: 'wamid-' + crypto.randomBytes(6).toString('hex'), remoteJid: `${ticket.contact?.number || '5500'}@s.whatsapp.net`, fromMe: true }, message: { conversation: body } };
      }
    };
  }
  if (resolved === path.join(source, 'services/BaileysServices/CreateOrUpdateBaileysService.ts')) {
    return {
      __esModule: true,
      default: async () => {
        if (baileysError) throw baileysError;
      }
    };
  }
  if (resolved === path.join(source, 'services/WbotServices/CheckNumber.ts')) {
    return { __esModule: true, default: async n => ({ jid: `${n}@s.whatsapp.net` }) };
  }
  if (resolved === path.join(source, 'services/WbotServices/CheckIsValidContact.ts')) {
    return { __esModule: true, default: async () => {} };
  }
  if (resolved === path.join(source, 'services/WbotServices/ImportContactsService.ts')) {
    return { __esModule: true, default: async () => {} };
  }
  if (resolved === path.join(source, 'helpers/UpdateDeletedUserOpenTicketsStatus.ts')) {
    return { __esModule: true, default: async () => {} };
  }
  return originalLoad.call(this, request, parent, ...rest);
};

const load = name => require(path.join(source, name));
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 60));

(async () => {
  const pg = new PGlite();
  await pg.waitReady;
  const { Sequelize } = require('sequelize-typescript');
  database = new Sequelize({
    dialect: 'postgres',
    database: 'listeners_crons_test',
    logging: false,
    databaseVersion: '17.0.0',
    pool: { max: 1, min: 0 }
  });

  const connection = {
    query(sql, parameters, callback) {
      if (typeof parameters === 'function') {
        callback = parameters;
        parameters = [];
      }
      const query = parameters?.length ? pg.query(sql, parameters).then(r => [r]) : pg.exec(sql);
      query.then(
        results => callback(null, results.map(r => ({ ...r, rowCount: r.affectedRows ?? r.rows.length }))),
        callback
      );
    }
  };
  database.connectionManager.getConnection = () => require('bluebird').resolve(connection);
  database.connectionManager.releaseConnection = () => require('bluebird').resolve();

  const allModelFiles = fs.readdirSync(path.join(source, 'models')).filter(n => n.endsWith('.ts'));
  const models = allModelFiles.map(n => load('models/' + n).default);
  database.addModels(models);

  const stage1Added = ['resetTokenHash', 'resetTokenExpiresAt', 'blocked', 'mfaLastStep', 'mustChangePassword'];
  const stage2AddedTickets = ['closedAt', 'legalHold', 'legalHoldReason', 'legalHoldAt'];
  const stage2AddedContacts = ['optOutCampaign'];
  const stage3AddedSchedules = ['interruptionReason', 'reviewedBy', 'reviewedAt', 'retries'];
  const stage3AddedMessages = ['status', 'operationId', 'uncertainReason', 'retries'];
  const stage3AddedWhatsapps = ['disconnectReason', 'actionRequired', 'lastDisconnectedAt'];

  for (const model of models) {
    if (model.name === 'AuditLog') continue;
    const attributes = Object.fromEntries(
      Object.entries(model.rawAttributes)
        .filter(([name, attr]) => {
          if (attr.type.key === 'VIRTUAL') return false;
          if (model.name === 'User' && stage1Added.includes(name)) return false;
          if (model.name === 'Ticket' && stage2AddedTickets.includes(name)) return false;
          if ((model.name === 'Contact' || model.name === 'ContactListItem') && stage2AddedContacts.includes(name)) return false;
          if (model.name === 'Schedule' && stage3AddedSchedules.includes(name)) return false;
          if (model.name === 'Message' && stage3AddedMessages.includes(name)) return false;
          if (model.name === 'Whatsapp' && stage3AddedWhatsapps.includes(name)) return false;
          return true;
        })
        .map(([name, attr]) => {
          const copy = { ...attr };
          delete copy.references;
          delete copy.onDelete;
          delete copy.onUpdate;
          return [name, copy];
        })
    );
    await database.getQueryInterface().createTable(model.getTableName(), attributes);
  }
  await database.getQueryInterface().addColumn('Users', 'resetPassword', { type: require('sequelize').STRING, allowNull: true });
  await load('database/migrations/20261021000000-security-access.ts').up(database.getQueryInterface());
  await load('database/migrations/20261022000000-data-governance.ts').up(database.getQueryInterface());
  await load('database/migrations/20261022010000-service-reliability.ts').up(database.getQueryInterface());

  const Company = load('models/Company.ts').default;
  const User = load('models/User.ts').default;
  const Queue = load('models/Queue.ts').default;
  const Whatsapp = load('models/Whatsapp.ts').default;
  const Contact = load('models/Contact.ts').default;
  const Ticket = load('models/Ticket.ts').default;
  const TicketTraking = load('models/TicketTraking.ts').default;
  const Message = load('models/Message.ts').default;
  const Setting = load('models/Setting.ts').default;
  const UserRating = load('models/UserRating.ts').default;

  const UpdateTicketService = load('services/TicketServices/UpdateTicketService.ts').default;
  const { wbotMessageListener, handleRating } = load('services/WbotServices/wbotMessageListener.ts');
  const wbotMonitor = load('services/WbotServices/wbotMonitor.ts').default;
  const { TransferTicketQueue } = load('wbotTransferTicketQueue.ts');
  const { ClosedAllOpenTickets } = load('services/WbotServices/wbotClosedTickets.ts');

  // Seed shared fixtures
  const company = await Company.create({ id: 1, name: 'Empresa Teste' });
  const user = await User.create({ id: 1, name: 'Atendente', email: 'atendente@teste.local', passwordHash: 'hash', profile: 'user', companyId: company.id });
  const queue = await Queue.create({ id: 1, name: 'Suporte', color: '#000', companyId: company.id });
  const whatsapp = await Whatsapp.create({
    id: 1,
    name: 'WPP Principal',
    status: 'CONNECTED',
    companyId: company.id,
    number: '5567999990001',
    complationMessage: 'Obrigado pelo contato!',
    ratingMessage: 'Avalie o atendimento',
    timeToTransfer: 1,
    transferQueueId: queue.id,
    expiresTicket: 5,
    expiresInactiveMessage: 'Encerrado por inatividade'
  });

  function createFakeWbot(overrides = {}) {
    const ev = new EventEmitter();
    const ws = new EventEmitter();
    return {
      id: whatsapp.id,
      user: { id: '5567999990001@s.whatsapp.net' },
      ev,
      ws,
      sendMessage: async (jid, payload) => {
        if (mockSendError) throw mockSendError;
        sentMessages.push({ jid, payload });
        return { key: { id: 'wamid-out-' + Date.now(), remoteJid: jid, fromMe: true }, message: { conversation: payload.text || '' } };
      },
      readMessages: async () => {},
      ...overrides
    };
  }

  test('1a. userRating: resposta textual nao numerica ("Obrigado") nao gera NaN nem unhandledRejection e fecha o ticket', async () => {
    await Setting.create({ key: 'userRating', value: 'enabled', companyId: company.id });
    const contact = await Contact.create({ name: 'Cliente Rating Texto', number: '5567999991001', companyId: company.id });
    const ticket = await Ticket.create({ contactId: contact.id, companyId: company.id, whatsappId: whatsapp.id, userId: user.id, queueId: queue.id, status: 'open' });
    await TicketTraking.create({ ticketId: ticket.id, companyId: company.id, whatsappId: whatsapp.id, userId: user.id, startedAt: new Date() });

    // Close ticket with userRating enabled -> UpdateTicketService sets ratingAt and keeps ticket status="open"
    await UpdateTicketService({ ticketData: { status: 'closed' }, ticketId: ticket.id, companyId: company.id, userId: user.id });
    await ticket.reload();
    assert.equal(ticket.status, 'open');

    const wbot = createFakeWbot();
    await wbotMessageListener(wbot, company.id);

    wbot.ev.emit('messages.upsert', {
      type: 'notify',
      messages: [{
        key: { id: 'msg-rating-obrigado', remoteJid: '5567999991001@s.whatsapp.net', fromMe: false },
        message: { conversation: 'Obrigado' },
        messageTimestamp: Math.floor(Date.now() / 1000)
      }]
    });
    await flushPromises();

    await ticket.reload();
    const traking = await TicketTraking.findOne({ where: { ticketId: ticket.id } });
    const ratingsCount = await UserRating.count({ where: { ticketId: ticket.id } });
    assert.equal(ratingsCount, 0, 'Nao deve gravar UserRating quando resposta for nao numerica');
    assert.equal(ticket.status, 'closed', 'Ticket deve ser encerrado normalmente');
    assert.ok(traking.finishedAt !== null, 'TicketTraking deve ser finalizado');
    assert.equal(traking.rated, false);
  });

  test('1b. userRating: nota numerica e decimal ("2.5") persistem inteiro valido no PostgreSQL', async () => {
    const contact = await Contact.create({ name: 'Cliente Rating Num', number: '5567999991002', companyId: company.id });
    const ticket = await Ticket.create({ contactId: contact.id, companyId: company.id, whatsappId: whatsapp.id, userId: user.id, queueId: queue.id, status: 'open' });
    const traking = await TicketTraking.create({ ticketId: ticket.id, companyId: company.id, whatsappId: whatsapp.id, userId: user.id, startedAt: new Date(), ratingAt: new Date() });

    await handleRating(2.5, ticket, traking);
    await ticket.reload();
    await traking.reload();

    const saved = await UserRating.findOne({ where: { ticketId: ticket.id } });
    assert.ok(saved, 'UserRating deve ser criado');
    assert.equal(saved.rate, 3, 'Nota decimal deve ser arredondada para inteiro valido');
    assert.equal(ticket.status, 'closed');
    assert.equal(traking.rated, true);
  });

  test('2. wbotMonitor: CB:call sem Setting, contato desconhecido ou falha de sendMessage e contacts.upsert com erro nao geram unhandledRejection', async () => {
    const wbot = createFakeWbot();
    await wbotMonitor(wbot, whatsapp, company.id);

    // 2a. Setting "call" inexistente (null)
    wbot.ws.emit('CB:call', {
      attrs: { from: '5567988880001@s.whatsapp.net', id: 'call-1' },
      content: [{ tag: 'terminate', attrs: { 'call-id': 'call-1' } }]
    });
    await flushPromises();

    // 2b. Setting "call" = disabled, numero desconhecido (contact === null)
    await Setting.create({ key: 'call', value: 'disabled', companyId: company.id });
    wbot.ws.emit('CB:call', {
      attrs: { from: '5567988880002@s.whatsapp.net', id: 'call-2' },
      content: [{ tag: 'terminate', attrs: { 'call-id': 'call-2' } }]
    });
    await flushPromises();

    // 2c. sendMessage falha no CB:call e createOrUpdateBaileysService falha no contacts.upsert
    mockSendError = new Error('Socket closed during call reply');
    wbot.ws.emit('CB:call', {
      attrs: { from: '5567988880003@s.whatsapp.net', id: 'call-3' },
      content: [{ tag: 'terminate', attrs: { 'call-id': 'call-3' } }]
    });
    baileysError = new Error('Baileys store write failed');
    wbot.ev.emit('contacts.upsert', [{ id: '5567988880003@s.whatsapp.net', name: 'Desconhecido' }]);
    await flushPromises();

    mockSendError = null;
    baileysError = null;
  });

  test('3. verifyCampaignMessageAndCloseTicket: mensagem de campanha sem registro no banco (messageRecord null) nao derruba o servidor', async () => {
    const wbot = createFakeWbot();
    await wbotMessageListener(wbot, company.id);

    // Envia mensagem fromMe com marcador \u200c cujo id nao existe na tabela Messages
    wbot.ev.emit('messages.upsert', {
      type: 'notify',
      messages: [{
        key: { id: 'msg-campaign-missing-db', remoteJid: '5567999991099@s.whatsapp.net', fromMe: true },
        message: { conversation: '\u200e\u200cMensagem de campanha' },
        messageTimestamp: Math.floor(Date.now() / 1000)
      }]
    });
    await flushPromises();
  });

  test('4. messages.update: falha em readMessages nao aborta handleMsgAck e exclusao no indice > 0 do lote eh processada corretamente', async () => {
    const contact = await Contact.create({ name: 'Cliente Update', number: '5567999991004', companyId: company.id });
    const ticket = await Ticket.create({ contactId: contact.id, companyId: company.id, whatsappId: whatsapp.id, userId: user.id, status: 'open' });
    const msgAck = await Message.create({ id: 'msg-ack-0', body: 'Oi', ticketId: ticket.id, contactId: contact.id, companyId: company.id, fromMe: true, ack: 1, status: 'sended' });
    const msgDel = await Message.create({ id: 'msg-del-1', body: 'Apagar esta', ticketId: ticket.id, contactId: contact.id, companyId: company.id, fromMe: false, ack: 1 });

    const wbot = createFakeWbot({
      readMessages: async () => {
        throw new Error('Connection Closed while marking read');
      }
    });
    await wbotMessageListener(wbot, company.id);

    wbot.ev.emit('messages.update', [
      { key: { id: msgAck.id, remoteJid: '5567999991004@s.whatsapp.net', fromMe: true }, update: { status: 2 } },
      { key: { id: msgDel.id, remoteJid: '5567999991004@s.whatsapp.net', fromMe: false }, update: { messageStubType: 1, status: 3 } }
    ]);

    // handleMsgAck waits 500ms internally
    await new Promise(resolve => setTimeout(resolve, 650));

    await msgAck.reload();
    await msgDel.reload();
    assert.equal(msgAck.ack, 2, 'ACK deve ser atualizado mesmo se readMessages falhar');
    assert.equal(msgAck.status, 'delivered');
    assert.equal(msgDel.isDeleted, true, 'Item no indice 1 do lote deve ser marcado como apagado (nao apenas indice 0)');
  });

  test('5. Crons: TransferTicketQueue e ClosedAllOpenTickets funcionam sem TicketTraking (null) e isolam erros por ticket', async () => {
    const contact = await Contact.create({ name: 'Cliente Cron', number: '5567999991005', companyId: company.id });

    // 5a. Ticket pendente sem fila e SEM TicketTraking, com updatedAt vencido (ha 10 min)
    const pendingTicket = await Ticket.create({
      contactId: contact.id,
      companyId: company.id,
      whatsappId: whatsapp.id,
      status: 'pending',
      queueId: null
    });
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    await database.query('UPDATE "Tickets" SET "updatedAt" = :dt WHERE id = :id', {
      replacements: { dt: tenMinAgo, id: pendingTicket.id }
    });

    await TransferTicketQueue();
    await pendingTicket.reload();
    assert.equal(pendingTicket.queueId, queue.id, 'Ticket sem TicketTraking deve ser transferido sem crash');

    // 5b. Ticket aberto com fromMe=true, expirado e SEM TicketTraking
    const contact2 = await Contact.create({ name: 'Cliente Cron Close', number: '5567999991006', companyId: company.id });
    const openTicket = await Ticket.create({
      contactId: contact2.id,
      companyId: company.id,
      whatsappId: whatsapp.id,
      userId: user.id,
      status: 'open',
      fromMe: true,
      isGroup: false
    });
    await database.query('UPDATE "Tickets" SET "updatedAt" = :dt WHERE id = :id', {
      replacements: { dt: tenMinAgo, id: openTicket.id }
    });

    await ClosedAllOpenTickets(company.id);
    await openTicket.reload();
    assert.equal(openTicket.status, 'closed', 'Ticket expirado sem TicketTraking deve ser fechado sem crash');
  });

  for (const { name, fn } of tests) {
    const beforeCount = unhandledRejections.length;
    try {
      await fn();
      assert.equal(
        unhandledRejections.length,
        beforeCount,
        `Detectada(s) ${unhandledRejections.length - beforeCount} unhandledRejection(s): ${unhandledRejections.slice(beforeCount).map(e => e?.message || e).join('; ')}`
      );
      console.log('PASS ' + name);
    } catch (err) {
      console.error('FAIL ' + name);
      console.error(err);
      process.exit(1);
    }
  }

  console.log(`RESULT ${tests.length}/${tests.length} passed; zero unhandledRejections`);
  try { fs.rmSync(temp, { recursive: true, force: true }); } catch (_) {}
  process.exit(0);
})().catch(err => {
  console.error('FATAL in listeners-crons test harness:');
  console.error(err);
  process.exit(1);
});
