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

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 250));

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
  const WhatsappQueue = load('models/WhatsappQueue.ts').default;
  const { map_msg } = load('utils/global.ts');

  const UpdateTicketService = load('services/TicketServices/UpdateTicketService.ts').default;
  const { wbotMessageListener, handleRating } = load('services/WbotServices/wbotMessageListener.ts');
  const { invalidateGroupMetadataCache } = load('libs/wbot.ts');
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

    let readMessagesCalls = 0;
    const wbot = createFakeWbot({
      readMessages: async () => {
        readMessagesCalls++;
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
    assert.equal(readMessagesCalls, 0, 'messages.update nao deve chamar readMessages em cascata');
    assert.equal(msgAck.ack, 2, 'ACK deve ser atualizado normalmente');
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

  const setSetting = async (key, value) => {
    const existing = await Setting.findOne({ where: { key, companyId: company.id } });
    if (existing) {
      await existing.update({ value });
    } else {
      await Setting.create({ key, value, companyId: company.id });
    }
  };

  test('6. Opcao A: resposta do cliente apos finalizacao direta reabre na mesma conversa (status open, mesmo userId e queueId) sem "Opcao invalida"', async () => {
    await setSetting('userRating', 'disabled');
    await setSetting('chatBotType', 'text');

    await whatsapp.update({ greetingMessage: 'Ola, escolha uma fila:' });
    const queue2 = await Queue.create({ id: 2, name: 'Comercial', color: '#111', companyId: company.id, orderQueue: 2 });
    await queue.update({ orderQueue: 1 });
    await WhatsappQueue.findOrCreate({ where: { whatsappId: whatsapp.id, queueId: queue.id } });
    await WhatsappQueue.findOrCreate({ where: { whatsappId: whatsapp.id, queueId: queue2.id } });

    const contact = await Contact.create({ name: 'Cliente Pos Finalizacao', number: '5567999991007', companyId: company.id });
    const ticket = await Ticket.create({
      contactId: contact.id,
      companyId: company.id,
      whatsappId: whatsapp.id,
      userId: user.id,
      queueId: queue.id,
      status: 'open'
    });
    await TicketTraking.create({
      ticketId: ticket.id,
      companyId: company.id,
      whatsappId: whatsapp.id,
      userId: user.id,
      startedAt: new Date()
    });

    // Simula estado residual de menu do atendimento anterior em map_msg
    map_msg.set(contact.number, {
      ticketId: ticket.id,
      msg: `\u200eOla, escolha uma fila:\n\n*[ 1 ]* - ${queue.name}\n*[ 2 ]* - ${queue2.name}\n`,
      invalid_option: false
    });

    await UpdateTicketService({
      ticketData: { status: 'closed' },
      ticketId: ticket.id,
      companyId: company.id,
      userId: user.id
    });

    await ticket.reload();
    assert.equal(ticket.status, 'closed');
    assert.equal(ticket.userId, user.id, 'Fechamento preserva userId no ticket');
    assert.equal(ticket.queueId, queue.id, 'Fechamento preserva queueId no ticket');
    assert.equal(map_msg.has(contact.number), false, 'map_msg deve ser limpo ao fechar o ticket');

    const wbot = createFakeWbot();
    await wbotMessageListener(wbot, company.id);

    const beforeSent = sentMessages.length;
    wbot.ev.emit('messages.upsert', {
      type: 'notify',
      messages: [{
        key: { id: 'msg-after-close-ok', remoteJid: `${contact.number}@s.whatsapp.net`, fromMe: false },
        message: { conversation: 'Ok' },
        messageTimestamp: Math.floor(Date.now() / 1000)
      }]
    });
    await flushPromises();

    await ticket.reload();
    const newSent = sentMessages.slice(beforeSent);
    assert.equal(ticket.status, 'open', 'Ticket deve reabrir como open para o mesmo atendente');
    assert.equal(ticket.userId, user.id, 'Deve manter o mesmo atendente');
    assert.equal(ticket.queueId, queue.id, 'Deve manter a mesma fila');
    assert.equal(ticket.closedAt, null, 'closedAt deve ser limpo na reabertura');
    assert.equal(newSent.length, 0, 'Nao deve enviar Opcao invalida nem reenviar menu de filas');
  });

  test('7. Opcao A com userRating enabled: apos avaliar e fechar, resposta do cliente reabre na mesma conversa sem "Opcao invalida"', async () => {
    await setSetting('userRating', 'enabled');
    await setSetting('chatBotType', 'text');

    const contact = await Contact.create({ name: 'Cliente Rating Opcao A', number: '5567999991008', companyId: company.id });
    const ticket = await Ticket.create({
      contactId: contact.id,
      companyId: company.id,
      whatsappId: whatsapp.id,
      userId: user.id,
      queueId: queue.id,
      status: 'open'
    });
    const traking = await TicketTraking.create({
      ticketId: ticket.id,
      companyId: company.id,
      whatsappId: whatsapp.id,
      userId: user.id,
      startedAt: new Date()
    });

    await UpdateTicketService({
      ticketData: { status: 'closed' },
      ticketId: ticket.id,
      companyId: company.id,
      userId: user.id
    });

    const wbot = createFakeWbot();
    await wbotMessageListener(wbot, company.id);

    // Cliente responde a avaliacao com nota 3
    wbot.ev.emit('messages.upsert', {
      type: 'notify',
      messages: [{
        key: { id: 'msg-rate-3', remoteJid: `${contact.number}@s.whatsapp.net`, fromMe: false },
        message: { conversation: '3' },
        messageTimestamp: Math.floor(Date.now() / 1000)
      }]
    });
    await flushPromises();

    await ticket.reload();
    assert.equal(ticket.status, 'closed');
    assert.equal(ticket.userId, user.id, 'handleRating deve preservar userId no ticket fechado');
    assert.equal(ticket.queueId, queue.id, 'handleRating deve preservar queueId no ticket fechado');
    assert.equal(map_msg.has(contact.number), false, 'map_msg deve ser limpo apos handleRating');

    // Agora cliente manda "Ok" depois de receber a mensagem de finalizacao
    const beforeSent = sentMessages.length;
    wbot.ev.emit('messages.upsert', {
      type: 'notify',
      messages: [{
        key: { id: 'msg-after-rating-ok', remoteJid: `${contact.number}@s.whatsapp.net`, fromMe: false },
        message: { conversation: 'Ok' },
        messageTimestamp: Math.floor(Date.now() / 1000)
      }]
    });
    await flushPromises();

    await ticket.reload();
    const newSent = sentMessages.slice(beforeSent);
    assert.equal(ticket.status, 'open', 'Ticket deve retornar na mesma conversa como open');
    assert.equal(ticket.userId, user.id);
    assert.equal(ticket.queueId, queue.id);
    assert.equal(newSent.length, 0, 'Nao deve enviar Opcao invalida nem menu');
  });

  test('8. Opcao A fallback: se atendente do ticket fechado estiver bloqueado, reabre como pending na mesma fila sem "Opcao invalida"', async () => {
    await setSetting('userRating', 'disabled');
    const blockedUser = await User.create({
      id: 99,
      name: 'Atendente Bloqueado',
      email: 'bloqueado@teste.local',
      passwordHash: 'hash',
      profile: 'user',
      blocked: true,
      companyId: company.id
    });
    const contact = await Contact.create({ name: 'Cliente Fallback User', number: '5567999991009', companyId: company.id });
    const ticket = await Ticket.create({
      contactId: contact.id,
      companyId: company.id,
      whatsappId: whatsapp.id,
      userId: blockedUser.id,
      queueId: queue.id,
      status: 'closed',
      closedAt: new Date(Date.now() - 5 * 60 * 1000)
    });

    const wbot = createFakeWbot();
    await wbotMessageListener(wbot, company.id);

    const beforeSent = sentMessages.length;
    wbot.ev.emit('messages.upsert', {
      type: 'notify',
      messages: [{
        key: { id: 'msg-blocked-user-ok', remoteJid: `${contact.number}@s.whatsapp.net`, fromMe: false },
        message: { conversation: 'Ok' },
        messageTimestamp: Math.floor(Date.now() / 1000)
      }]
    });
    await flushPromises();

    await ticket.reload();
    const newSent = sentMessages.slice(beforeSent);
    assert.equal(ticket.status, 'pending', 'Com usuario bloqueado deve reabrir como pending');
    assert.equal(ticket.userId, null, 'Usuario bloqueado nao deve receber o ticket');
    assert.equal(ticket.queueId, queue.id, 'Fila valida deve ser preservada');
    assert.equal(newSent.length, 0, 'Com queueId preservado nao deve acionar verifyQueue');
  });

  test('9. botText nao trava apos opcao invalida e isola estado por ticketId', async () => {
    await setSetting('userRating', 'disabled');
    await setSetting('chatBotType', 'text');

    const contact = await Contact.create({ name: 'Cliente Menu Novo', number: '5567999991010', companyId: company.id });
    // Simula estado travado (invalid_option: true) deixado por um ticket antigo
    map_msg.set(contact.number, {
      ticketId: 99999,
      msg: 'Opção inválida, por favor, escolha uma opção válida.',
      invalid_option: true
    });

    const wbot = createFakeWbot();
    await wbotMessageListener(wbot, company.id);

    // 1a mensagem em ticket novo -> deve enviar o menu de filas (NAO "Opcao invalida")
    let beforeSent = sentMessages.length;
    wbot.ev.emit('messages.upsert', {
      type: 'notify',
      messages: [{
        key: { id: 'msg-menu-1', remoteJid: `${contact.number}@s.whatsapp.net`, fromMe: false },
        message: { conversation: 'Oi' },
        messageTimestamp: Math.floor(Date.now() / 1000)
      }]
    });
    await flushPromises();
    let batch = sentMessages.slice(beforeSent);
    assert.equal(batch.length, 1);
    assert.ok(batch[0].payload.text.includes('*[ 1 ]*'), 'Primeira mensagem deve enviar o menu de filas');

    // 2a mensagem invalida -> envia "Opção inválida..."
    beforeSent = sentMessages.length;
    wbot.ev.emit('messages.upsert', {
      type: 'notify',
      messages: [{
        key: { id: 'msg-menu-2', remoteJid: `${contact.number}@s.whatsapp.net`, fromMe: false },
        message: { conversation: 'abc' },
        messageTimestamp: Math.floor(Date.now() / 1000)
      }]
    });
    await flushPromises();
    batch = sentMessages.slice(beforeSent);
    assert.equal(batch.length, 1);
    assert.ok(batch[0].payload.text.includes('Opção inválida'), 'Segunda tentativa invalida deve avisar opcao invalida');

    // 3a mensagem invalida -> reenvia o menu em vez de ficar mudo para sempre
    beforeSent = sentMessages.length;
    wbot.ev.emit('messages.upsert', {
      type: 'notify',
      messages: [{
        key: { id: 'msg-menu-3', remoteJid: `${contact.number}@s.whatsapp.net`, fromMe: false },
        message: { conversation: 'xyz' },
        messageTimestamp: Math.floor(Date.now() / 1000)
      }]
    });
    await flushPromises();
    batch = sentMessages.slice(beforeSent);
    assert.equal(batch.length, 1);
    assert.ok(batch[0].payload.text.includes('*[ 1 ]*'), 'Terceira mensagem deve reenviar o menu ao cliente');

    // 4a mensagem valida ("1") -> escolhe fila 1 e limpa map_msg
    wbot.ev.emit('messages.upsert', {
      type: 'notify',
      messages: [{
        key: { id: 'msg-menu-4', remoteJid: `${contact.number}@s.whatsapp.net`, fromMe: false },
        message: { conversation: '1' },
        messageTimestamp: Math.floor(Date.now() / 1000)
      }]
    });
    await flushPromises();
    const activeTicket = await Ticket.findOne({ where: { contactId: contact.id } });
    assert.equal(activeTicket.queueId, queue.id, 'Escolha valida deve atribuir a fila 1');
    assert.equal(map_msg.has(contact.number), false, 'Escolha valida deve limpar map_msg');
  });

  test('10. verifyContact usa cache de profilePictureUrl inclusive quando foto falha/privada', async () => {
    await setSetting('userRating', 'disabled');
    const picCalls = new Map();
    const wbot = createFakeWbot({
      profilePictureUrl: async jid => {
        picCalls.set(jid, (picCalls.get(jid) || 0) + 1);
        if (jid.includes('5567999992002')) {
          throw new Error('401 item-not-found');
        }
        return 'https://cdn.example.invalid/avatar-a.jpg';
      }
    });
    await wbotMessageListener(wbot, company.id);

    const jidA = '5567999992001@s.whatsapp.net';
    const jidB = '5567999992002@s.whatsapp.net';
    for (let i = 1; i <= 3; i++) {
      wbot.ev.emit('messages.upsert', {
        type: 'notify',
        messages: [
          {
            key: { id: `msg-pic-a-${i}`, remoteJid: jidA, fromMe: false },
            pushName: 'Contato A',
            message: { conversation: `Oi A ${i}` },
            messageTimestamp: Math.floor(Date.now() / 1000)
          },
          {
            key: { id: `msg-pic-b-${i}`, remoteJid: jidB, fromMe: false },
            pushName: 'Contato B',
            message: { conversation: `Oi B ${i}` },
            messageTimestamp: Math.floor(Date.now() / 1000)
          }
        ]
      });
      await flushPromises();
    }

    assert.equal(picCalls.get(jidA), 1, 'profilePictureUrl deve ser consultada apenas 1x para Contato A');
    assert.equal(picCalls.get(jidB), 1, 'profilePictureUrl deve ser consultada apenas 1x mesmo quando falha para Contato B');
    const contactA = await Contact.findOne({ where: { number: '5567999992001', companyId: company.id } });
    const contactB = await Contact.findOne({ where: { number: '5567999992002', companyId: company.id } });
    assert.equal(contactA.profilePicUrl, 'https://cdn.example.invalid/avatar-a.jpg');
    assert.equal(contactB.profilePicUrl, 'http://localhost:3000/nopicture.png');
  });

  test('11. handleMessage usa cache de groupMetadata e reconsulta apos invalidacao', async () => {
    await setSetting('CheckMsgIsGroup', 'disabled');
    let groupMetaCalls = 0;
    const groupJid = '120363000000001@g.us';
    const wbot = createFakeWbot({
      profilePictureUrl: async () => 'http://localhost:3000/nopicture.png',
      groupMetadata: async jid => {
        groupMetaCalls++;
        return { id: jid, subject: 'Grupo Suporte Teste', participants: [] };
      }
    });
    await wbotMessageListener(wbot, company.id);

    for (let i = 1; i <= 3; i++) {
      wbot.ev.emit('messages.upsert', {
        type: 'notify',
        messages: [{
          key: { id: `msg-grp-${i}`, remoteJid: groupJid, participant: '5567999992003@s.whatsapp.net', fromMe: false },
          pushName: 'Participante',
          message: { conversation: `Mensagem grupo ${i}` },
          messageTimestamp: Math.floor(Date.now() / 1000)
        }]
      });
      await flushPromises();
    }
    assert.equal(groupMetaCalls, 1, 'groupMetadata deve ser consultada apenas 1x em 3 mensagens seguidas');

    invalidateGroupMetadataCache(whatsapp.id, groupJid);
    wbot.ev.emit('messages.upsert', {
      type: 'notify',
      messages: [{
        key: { id: 'msg-grp-4', remoteJid: groupJid, participant: '5567999992003@s.whatsapp.net', fromMe: false },
        pushName: 'Participante',
        message: { conversation: 'Mensagem grupo 4' },
        messageTimestamp: Math.floor(Date.now() / 1000)
      }]
    });
    await flushPromises();
    assert.equal(groupMetaCalls, 2, 'Apos invalidateGroupMetadataCache deve buscar novamente');
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
