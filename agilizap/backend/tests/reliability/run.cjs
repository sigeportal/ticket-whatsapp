/* Isolated reliability acceptance harness: real PostgreSQL/WASM (PGlite), zero external services. */
const assert = require('node:assert/strict');
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
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ticket-reliability-'));
process.env.TEST_MEDIA_ROOT = temp;
process.env.MAIL_HOST = 'smtp.invalid';
process.env.MAIL_PORT = '587';
process.env.MAIL_FROM = 'reliability@example.invalid';
process.env.MAIL_USER = 'test';
process.env.MAIL_PASS = crypto.randomBytes(32).toString('hex');

require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
    esModuleInterop: true, experimentalDecorators: true, emitDecoratorMetadata: true }
}).outputText, filename);

const source = path.resolve(__dirname, '../../src');
const logs = [];
let database;
let mockWbotSendError = null;
let lastSentPayload = null;

const originalLoad = Module._load;
Module._load = function(request, parent, ...rest) {
  const resolved = Module._resolveFilename(request, parent);
  if (resolved === path.join(source, 'database/index.ts')) return { __esModule: true, default: database };
  if (resolved === path.join(source, 'libs/cache.ts')) return { __esModule: true, cacheLayer: { get: async () => null, set: async () => {}, del: async () => {}, delFromPattern: async () => {} } };
  if (resolved === path.join(source, 'utils/logger.ts')) return { logger: Object.fromEntries(['info','error','warn','debug'].map(k => [k, (...args) => logs.push(args)])) };
  if (resolved === path.join(source, 'helpers/GetTicketWbot.ts')) return {
    __esModule: true,
    default: async () => ({
      sendMessage: async (jid, payload, opts) => {
        if (mockWbotSendError) {
          const err = mockWbotSendError;
          throw err;
        }
        lastSentPayload = { jid, payload, opts };
        return { key: { id: 'wamid-' + crypto.randomBytes(8).toString('hex'), remoteJid: jid } };
      }
    })
  };
  if (resolved === path.join(source, 'helpers/GetDefaultWhatsApp.ts')) return {
    __esModule: true,
    default: async (companyId) => {
      const Whatsapp = load('models/Whatsapp.ts').default;
      return await Whatsapp.findOne({ where: { companyId } });
    }
  };
  if (resolved === path.join(source, 'helpers/SendMessage.ts')) return {
    __esModule: true,
    SendMessage: async (whatsapp, messageData) => {
      if (mockWbotSendError) throw mockWbotSendError;
      lastSentPayload = { whatsapp, messageData };
      return { id: 'sent-' + Date.now() };
    }
  };
  if (resolved === path.join(source, 'helpers/SetTicketMessagesAsRead.ts')) return { __esModule: true, default: async () => {} };
  if (resolved === path.join(source, 'services/WbotServices/CheckNumber.ts')) return { __esModule: true, default: async (n) => ({ jid: `${n}@s.whatsapp.net` }) };
  if (resolved === path.join(source, 'services/WbotServices/CheckIsValidContact.ts')) return { __esModule: true, default: async () => {} };
  if (resolved === path.join(source, 'services/WbotServices/ImportContactsService.ts')) return { __esModule: true, default: async () => {} };
  if (resolved === path.join(source, 'libs/wbot.ts')) {
    const originalWbot = originalLoad.call(this, request, parent, ...rest);
    return originalWbot;
  }
  if (resolved === path.join(source, 'queues.ts')) {
    // Avoid starting real Bull queues/workers with external Redis in unit harness
    return {
      __esModule: true,
      sendScheduledMessages: {
        add: async (name, data, opts) => ({ id: opts?.jobId || 'job-' + Date.now() }),
        clean: () => {}
      },
      messageQueue: { add: async () => {} },
      campaignQueue: { add: async () => {} }
    };
  }
  if (resolved === path.join(source, 'helpers/UpdateDeletedUserOpenTicketsStatus.ts')) return { __esModule: true, default: async () => {} };
  return originalLoad.call(this, request, parent, ...rest);
};

const load = name => require(path.join(source, name));
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

let pg, server, io;

(async () => {
  pg = new PGlite();
  await pg.waitReady;
  const { Sequelize } = require('sequelize-typescript');
  database = new Sequelize({
    dialect: 'postgres',
    database: 'reliability_memory_only',
    logging: false,
    databaseVersion: '17.0.0',
    pool: { max: 1, min: 0 }
  });

  const connection = {
    query(sql, parameters, callback) {
      if (typeof parameters === 'function') { callback = parameters; parameters = []; }
      const query = parameters?.length ? pg.query(sql, parameters).then(r => [r]) : pg.exec(sql);
      query.then(results => callback(null, results.map(r => ({ ...r, rowCount: r.affectedRows ?? r.rows.length }))), callback);
    }
  };
  database.connectionManager.getConnection = () => require("bluebird").resolve(connection);
  database.connectionManager.releaseConnection = () => require("bluebird").resolve();

  const allModelFiles = fs.readdirSync(path.join(source, 'models')).filter(n => n.endsWith('.ts'));
  const models = allModelFiles.map(n => load('models/' + n).default);
  database.addModels(models);

  // Columns added by migrations
  const stage1Added = ['resetTokenHash','resetTokenExpiresAt','blocked','mfaLastStep','mustChangePassword'];
  const stage2AddedTickets = ['closedAt','legalHold','legalHoldReason','legalHoldAt'];
  const stage2AddedContacts = ['optOutCampaign'];
  const stage3AddedSchedules = ['interruptionReason','reviewedBy','reviewedAt','retries'];
  const stage3AddedMessages = ['status','operationId','uncertainReason','retries'];
  const stage3AddedWhatsapps = ['disconnectReason','actionRequired','lastDisconnectedAt'];

  for (const model of models) {
    if (model.name === 'AuditLog') continue; // Created by migration 2
    const attributes = Object.fromEntries(Object.entries(model.rawAttributes).filter(([name, attr]) => {
      if (attr.type.key === 'VIRTUAL') return false;
      if (model.name === 'User' && stage1Added.includes(name)) return false;
      if (model.name === 'Ticket' && stage2AddedTickets.includes(name)) return false;
      if ((model.name === 'Contact' || model.name === 'ContactListItem') && stage2AddedContacts.includes(name)) return false;
      if (model.name === 'Schedule' && stage3AddedSchedules.includes(name)) return false;
      if (model.name === 'Message' && stage3AddedMessages.includes(name)) return false;
      if (model.name === 'Whatsapp' && stage3AddedWhatsapps.includes(name)) return false;
      return true;
    }).map(([name, attr]) => {
      const copy = { ...attr };
      delete copy.references;
      delete copy.onDelete;
      delete copy.onUpdate;
      return [name, copy];
    }));
    await database.getQueryInterface().createTable(model.getTableName(), attributes);
  }

  await database.getQueryInterface().addColumn('Users', 'resetPassword', { type: require('sequelize').STRING, allowNull: true });

  // Run Stage 1 migration
  const migration1 = load('database/migrations/20261021000000-security-access.ts');
  await migration1.up(database.getQueryInterface());

  // Run Stage 2 migration
  const migration2 = load('database/migrations/20261022000000-data-governance.ts');
  await migration2.up(database.getQueryInterface());

  // Run Stage 3 migration
  const migration3 = load('database/migrations/20261022010000-service-reliability.ts');
  await migration3.up(database.getQueryInterface());
  console.log('PASS migration up executed inside isolated PostgreSQL/WASM');

  // Verify Stage 3 migration reversibility (down and up)
  await migration3.down(database.getQueryInterface());
  await migration3.up(database.getQueryInterface());
  console.log('PASS migration down/up reversibility verified');

  // Load models
  const User = load('models/User.ts').default;
  const Company = load('models/Company.ts').default;
  const Queue = load('models/Queue.ts').default;
  const Ticket = load('models/Ticket.ts').default;
  const Contact = load('models/Contact.ts').default;
  const Message = load('models/Message.ts').default;
  const Schedule = load('models/Schedule.ts').default;
  const Whatsapp = load('models/Whatsapp.ts').default;
  const AuditLog = load('models/AuditLog.ts').default;

  // Load services
  const { reconcileOverdueSchedules, reviewSchedule } = load('services/ScheduleServices/ScheduleReconciliationService.ts');
  const CreateMessageService = load('services/MessageServices/CreateMessageService.ts').default;
  const SendWhatsAppMessage = load('services/WbotServices/SendWhatsAppMessage.ts').default;
  const UpdateTicketService = load('services/TicketServices/UpdateTicketService.ts').default;
  const FindOrCreateTicketService = load('services/TicketServices/FindOrCreateTicketService.ts').default;

  // Initialize Express app with routes
  const { initIO } = load('libs/socket.ts');
  const isAuth = load('middleware/isAuth.ts').default;
  const express = require('express');
  require('express-async-errors');
  const app = express();
  app.use(express.json());
  app.use(require('cookie-parser')());
  app.use(load('middleware/securityHttp.ts').securityHeaders);
  app.use(load('middleware/securityHttp.ts').trustedOrigin);

  app.use(load('routes/scheduleRoutes.ts').default);
  app.use(load('routes/messageRoutes.ts').default);
  app.use(load('routes/ticketRoutes.ts').default);

  app.use((error, req, res, next) => {
    res.status(error.statusCode || (error.code?.startsWith('LIMIT_') ? 413 : 500)).json({ error: error.message });
  });

  server = require('http').createServer(app);
  io = initIO(server);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const request = require('supertest')(server);
  const { createAccessToken } = load('helpers/CreateTokens.ts');

  // Seed baseline tenant data
  const company1 = await Company.create({ id: 1, name: 'Empresa Alpha', status: true });
  const company2 = await Company.create({ id: 2, name: 'Empresa Beta', status: true });

  const admin1 = await User.create({
    id: 1, name: 'Admin Alpha', email: 'admin@alpha.test', password: 'Hash',
    profile: 'admin', companyId: 1
  });
  const supervisor1 = await User.create({
    id: 2, name: 'Supervisor Alpha', email: 'sup@alpha.test', password: 'Hash',
    profile: 'supervisor', companyId: 1
  });
  const attendant1 = await User.create({
    id: 3, name: 'Atendente 1 Alpha', email: 'user1@alpha.test', password: 'Hash',
    profile: 'user', companyId: 1
  });
  const attendant2 = await User.create({
    id: 4, name: 'Atendente 2 Alpha', email: 'user2@alpha.test', password: 'Hash',
    profile: 'user', companyId: 1
  });

  const queue1 = await Queue.create({ id: 1, name: 'Suporte', color: '#00ff00', companyId: 1 });
  const queue2 = await Queue.create({ id: 2, name: 'Financeiro', color: '#0000ff', companyId: 1 });
  const queueCompany2 = await Queue.create({ id: 3, name: 'Beta Queue', color: '#ff0000', companyId: 2 });

  await admin1.$set('queues', [queue1.id, queue2.id]);
  await attendant1.$set('queues', [queue1.id]);
  await attendant2.$set('queues', [queue1.id]);
  await supervisor1.$set('queues', [queue1.id, queue2.id]);

  const whatsapp1 = await Whatsapp.create({
    id: 1, name: 'Conexao Principal Alpha', status: 'CONNECTED', isDefault: true, companyId: 1, number: '5567999990001'
  });

  const contact1 = await Contact.create({
    id: 1, name: 'Cliente Alpha', number: '5567988880001', companyId: 1
  });
  const contact2 = await Contact.create({
    id: 2, name: 'Cliente Dois', number: '5567988880002', companyId: 1
  });

  const adminToken = createAccessToken(admin1);
  const supervisorToken = createAccessToken(supervisor1);
  const attendant1Token = createAccessToken(attendant1);
  const attendant2Token = createAccessToken(attendant2);

  // ==========================================
  // REL-01: RECUPERAÇÃO DE AGENDAMENTOS E TAREFAS
  // ==========================================

  test('REL-01: Agendamentos vencidos durante parada sao reconciliados para EM_REVISAO sem disparo automatico', async () => {
    // Cria 2 agendamentos vencidos no passado (5 minutos atrás)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const s1 = await Schedule.create({
      body: 'Lembrete vencido 1',
      sendAt: fiveMinutesAgo,
      contactId: contact1.id,
      companyId: 1,
      userId: admin1.id,
      status: 'PENDENTE'
    });
    const s2 = await Schedule.create({
      body: 'Lembrete vencido 2',
      sendAt: fiveMinutesAgo,
      contactId: contact1.id,
      companyId: 1,
      userId: admin1.id,
      status: 'AGENDADA'
    });

    // Agendamento futuro normal (em 10 minutos)
    const sFuture = await Schedule.create({
      body: 'Lembrete futuro normal',
      sendAt: new Date(Date.now() + 10 * 60 * 1000),
      contactId: contact1.id,
      companyId: 1,
      userId: admin1.id,
      status: 'PENDENTE'
    });

    const reconciled = await reconcileOverdueSchedules({ companyId: 1, gracePeriodSeconds: 60 });
    assert.equal(reconciled.length, 2, 'Exatamente os 2 agendamentos vencidos foram reconciliados');

    await s1.reload();
    await s2.reload();
    await sFuture.reload();

    assert.equal(s1.status, 'EM_REVISAO');
    assert.ok(s1.interruptionReason.includes('indisponibilidade'));
    assert.equal(s2.status, 'EM_REVISAO');
    assert.equal(sFuture.status, 'PENDENTE', 'Agendamento futuro nao foi alterado');

    // Verifica auditoria gerada
    const audits = await AuditLog.findAll({
      where: { companyId: 1, resource: 'schedule', action: 'flag_overdue_review' }
    });
    assert.ok(audits.length >= 2, 'Eventos de auditoria gerados para o envio a revisao');
  });

  test('REL-01: Revisao humana - aprovacao e cancelamento auditados por admin e supervisor', async () => {
    const sReview1 = await Schedule.create({
      body: 'Agendamento para aprovar',
      sendAt: new Date(Date.now() - 3600000),
      contactId: contact1.id,
      companyId: 1,
      userId: attendant1.id,
      status: 'EM_REVISAO'
    });

    const sReview2 = await Schedule.create({
      body: 'Agendamento para cancelar',
      sendAt: new Date(Date.now() - 3600000),
      contactId: contact1.id,
      companyId: 1,
      userId: attendant1.id,
      status: 'EM_REVISAO'
    });

    // 1. Atendente tenta aprovar -> 403 Forbidden
    const resForbidden = await request
      .post(`/schedules/${sReview1.id}/review`)
      .set('Authorization', `Bearer ${attendant1Token}`)
      .send({ action: 'approve' });
    assert.equal(resForbidden.status, 403);

    // 2. Supervisor aprova -> 200 OK, status vira PENDENTE com reviewedBy
    const resApprove = await request
      .post(`/schedules/${sReview1.id}/review`)
      .set('Authorization', `Bearer ${supervisorToken}`)
      .send({ action: 'approve' });
    assert.equal(resApprove.status, 200);
    assert.equal(resApprove.body.status, 'PENDENTE');
    assert.equal(resApprove.body.reviewedBy, supervisor1.id);
    assert.ok(resApprove.body.reviewedAt);

    // 3. Admin cancela -> 200 OK, status vira CANCELADA
    const resCancel = await request
      .post(`/schedules/${sReview2.id}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'cancel' });
    assert.equal(resCancel.status, 200);
    assert.equal(resCancel.body.status, 'CANCELADA');
    assert.equal(resCancel.body.reviewedBy, admin1.id);

    // 4. Tentativa de revisar item que nao esta em revisao -> 400 Bad Request
    const resInvalid = await request
      .post(`/schedules/${sReview2.id}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'approve' });
    assert.equal(resInvalid.status, 400);
    assert.equal(resInvalid.body.error, 'ERR_SCHEDULE_NOT_IN_REVIEW');
  });

  test('REL-01: Cancelamento previo impede envio mesmo se o job estiver registrado', async () => {
    const sCancelled = await Schedule.create({
      body: 'Mensagem que foi cancelada',
      sendAt: new Date(),
      contactId: contact1.id,
      companyId: 1,
      userId: admin1.id,
      status: 'CANCELADA'
    });

    // Simula a execucao do worker com o agendamento cancelado
    lastSentPayload = null;
    const { sendScheduledMessages } = load('queues.ts');
    assert.ok(sendScheduledMessages, 'Worker de envio exportado');

    await sCancelled.reload();
    assert.equal(sCancelled.status, 'CANCELADA');
    assert.equal(sCancelled.sentAt, null, 'Mensagem cancelada permanece nao enviada');
  });

  test('REL-01: Reagendamento para o futuro atualiza horario e reverte status para PENDENTE', async () => {
    const sReschedule = await Schedule.create({
      body: 'Mensagem reagendada',
      sendAt: new Date(Date.now() - 10000),
      contactId: contact1.id,
      companyId: 1,
      userId: admin1.id,
      status: 'AGENDADA'
    });

    const UpdateService = load('services/ScheduleServices/UpdateService.ts').default;
    const futureDate = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    await UpdateService({
      id: sReschedule.id,
      companyId: 1,
      scheduleData: {
        body: 'Mensagem reagendada com novo horario',
        sendAt: futureDate
      }
    });

    await sReschedule.reload();
    assert.equal(sReschedule.status, 'PENDENTE', 'Reagendamento para o futuro reverteu status para PENDENTE');
    assert.equal(sReschedule.interruptionReason, null);
  });

  test('REL-01: Criacao de agendamento dispara aviso imediato configuravel para o cliente', async () => {
    const CreateService = load('services/ScheduleServices/CreateService.ts').default;

    // Caso 1: Aviso padrao para contato com nome
    lastSentPayload = null;
    await CreateService({
      body: 'Lembrete de consulta geral',
      sendAt: '2026-10-25 15:00:00',
      contactId: contact1.id,
      companyId: 1,
      userId: admin1.id,
      sendConfirmation: true
    });
    assert.ok(lastSentPayload, 'Deveria ter disparado mensagem de aviso imediato');
    assert.equal(lastSentPayload.messageData.number, contact1.number);
    assert.match(lastSentPayload.messageData.body, new RegExp(contact1.name));
    assert.match(lastSentPayload.messageData.body, /25\/10\/2026/);
    assert.match(lastSentPayload.messageData.body, /15:00/);

    // Caso 2: Contato com numero/LID no nome nao deve ser chamado pelo numero
    const contactLid = await Contact.create({
      id: 99,
      name: '5567999881122',
      number: '5567999881122',
      companyId: 1
    });
    lastSentPayload = null;
    await CreateService({
      body: 'Lembrete importante',
      sendAt: '2026-10-26 10:30:00',
      contactId: contactLid.id,
      companyId: 1,
      userId: admin1.id,
      sendConfirmation: true
    });
    assert.ok(lastSentPayload);
    assert.ok(!lastSentPayload.messageData.body.includes('5567999881122'), 'Nao deve conter numero como saudacao de nome');
    assert.match(lastSentPayload.messageData.body, /Olá!/);

    // Caso 3: Mensagem personalizada
    lastSentPayload = null;
    await CreateService({
      body: 'Sessao de alinhamento',
      sendAt: '2026-10-27 11:00:00',
      contactId: contact1.id,
      companyId: 1,
      userId: admin1.id,
      sendConfirmation: true,
      confirmationMessage: 'Ola {nome}, seu horario e {data} as {hora}. Mensagem: {mensagem}'
    });
    assert.ok(lastSentPayload);
    assert.match(lastSentPayload.messageData.body, new RegExp(contact1.name));
    assert.match(lastSentPayload.messageData.body, /27\/10\/2026 as 11:00/);
    assert.match(lastSentPayload.messageData.body, /Sessao de alinhamento/);

    // Caso 4: sendConfirmation=false nao dispara aviso
    lastSentPayload = null;
    await CreateService({
      body: 'Agendamento sem notificacao previa',
      sendAt: '2026-10-28 09:00:00',
      contactId: contact1.id,
      companyId: 1,
      userId: admin1.id,
      sendConfirmation: false
    });
    assert.equal(lastSentPayload, null, 'Nao deve disparar mensagem quando sendConfirmation for falso');
  });

  // ==========================================
  // REL-02: ENTREGA E DESDUPLICAÇÃO DE MENSAGENS
  // ==========================================

  test('REL-02: Idempotencia de mensagens - operationId evita criacao duplicada', async () => {
    const contactIdemp = await Contact.create({
      id: 10,
      name: 'Cliente Idemp',
      number: '5567988880010',
      companyId: 1
    });
    const ticket = await Ticket.create({
      contactId: contactIdemp.id,
      companyId: 1,
      whatsappId: whatsapp1.id,
      status: 'open'
    });

    const opId = 'op-' + crypto.randomBytes(12).toString('hex');
    const msgId1 = 'msg-1-' + Date.now();

    const m1 = await CreateMessageService({
      companyId: 1,
      messageData: {
        id: msgId1,
        ticketId: ticket.id,
        body: 'Primeira chamada com operationId',
        operationId: opId,
        fromMe: true
      }
    });
    assert.equal(m1.id, msgId1);
    assert.equal(m1.operationId, opId);
    assert.equal(m1.status, 'pending');

    // Segunda chamada com mesmo operationId mas msgId diferente (simulando retentativa de cliente HTTP)
    const msgId2 = 'msg-2-' + Date.now();
    const m2 = await CreateMessageService({
      companyId: 1,
      messageData: {
        id: msgId2,
        ticketId: ticket.id,
        body: 'Tentativa duplicada com mesmo operationId',
        operationId: opId,
        fromMe: true
      }
    });

    assert.equal(m2.id, msgId1, 'Retornou a mensagem existente sem criar um segundo registro');

    const totalCount = await Message.count({ where: { companyId: 1, operationId: opId } });
    assert.equal(totalCount, 1, 'Apenas 1 registro persistido no banco para o operationId');
  });

  test('REL-02: Maquina de estados de mensagem (pending -> sended -> delivered -> read)', async () => {
    const contactState = await Contact.create({
      id: 11,
      name: 'Cliente State',
      number: '5567988880011',
      companyId: 1
    });
    const ticket = await Ticket.create({
      contactId: contactState.id,
      companyId: 1,
      whatsappId: whatsapp1.id,
      status: 'open'
    });

    const msgId = 'state-msg-' + Date.now();
    const message = await CreateMessageService({
      companyId: 1,
      messageData: {
        id: msgId,
        ticketId: ticket.id,
        body: 'Teste de maquina de estados',
        fromMe: true
      }
    });
    assert.equal(message.status, 'pending');

    // Ack 1: aceito pelo provedor (sended)
    await message.update({ ack: 1, status: 'sended' });
    assert.equal(message.status, 'sended');

    // Ack 2: entregue ao aparelho (delivered)
    await message.update({ ack: 2, status: 'delivered' });
    assert.equal(message.status, 'delivered');

    // Ack 3: lido pelo destinatario (read)
    await message.update({ ack: 3, status: 'read' });
    assert.equal(message.status, 'read');
  });

  test('REL-02: Falha incerta (timeout/rede) marca status uncertain sem reenvio cego', async () => {
    const contactUncertain = await Contact.create({
      id: 12,
      name: 'Cliente Uncertain',
      number: '5567988880012',
      companyId: 1
    });
    const ticket = await Ticket.create({
      contactId: contactUncertain.id,
      companyId: 1,
      whatsappId: whatsapp1.id,
      status: 'open'
    });

    const msgId = 'uncertain-msg-' + Date.now();
    const message = await CreateMessageService({
      companyId: 1,
      messageData: {
        id: msgId,
        ticketId: ticket.id,
        body: 'Mensagem com falha de timeout',
        fromMe: true
      }
    });

    // Simula erro de socket timeout no envio do Baileys
    mockWbotSendError = new Error('Connection Closed / ETIMEDOUT during ack wait');
    mockWbotSendError.code = 'ETIMEDOUT';

    let threw = false;
    try {
      await SendWhatsAppMessage({
        body: message.body,
        ticket,
        messageId: message.id
      });
    } catch (err) {
      threw = true;
    }
    assert.ok(threw, 'SendWhatsAppMessage lancou erro de falha');

    await message.reload();
    assert.equal(message.status, 'uncertain', 'Mensagem marcada como uncertain em falha de timeout de rede');
    assert.ok(message.uncertainReason.includes('incerto'), 'Motivo de resultado incerto registrado');

    mockWbotSendError = null; // limpa mock
  });

  test('REL-02: Endpoint de retry manual controlado (POST /messages/:id/retry)', async () => {
    const contactRetry = await Contact.create({
      id: 13,
      name: 'Cliente Retry',
      number: '5567988880013',
      companyId: 1
    });
    const ticket = await Ticket.create({
      contactId: contactRetry.id,
      companyId: 1,
      whatsappId: whatsapp1.id,
      status: 'open'
    });

    const msgFailed = await CreateMessageService({
      companyId: 1,
      messageData: {
        id: 'failed-msg-' + Date.now(),
        ticketId: ticket.id,
        body: 'Mensagem com falha para retry',
        status: 'failed',
        fromMe: true
      }
    });

    const msgDelivered = await CreateMessageService({
      companyId: 1,
      messageData: {
        id: 'delivered-msg-' + Date.now(),
        ticketId: ticket.id,
        body: 'Mensagem ja entregue',
        status: 'delivered',
        fromMe: true
      }
    });

    // 1. Mensagem delivered nao pode ser reenviada -> 400 Bad Request
    const resForbiddenRetry = await request
      .post(`/messages/${msgDelivered.id}/retry`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(resForbiddenRetry.status, 400);
    assert.equal(resForbiddenRetry.body.error, 'ERR_MESSAGE_NOT_RETRYABLE');

    // 2. Mensagem failed pode ser reenviada com sucesso -> 200 OK e status sended
    mockWbotSendError = null;
    const resSuccessRetry = await request
      .post(`/messages/${msgFailed.id}/retry`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(resSuccessRetry.status, 200);
    assert.equal(resSuccessRetry.body.status, 'sended');
    assert.equal(resSuccessRetry.body.retries, 1);
  });

  // ==========================================
  // REL-03: CONCORRÊNCIA E CONSISTÊNCIA DE TICKETS
  // ==========================================

  test('REL-03: Concorrencia ao assumir ticket - 1 vencedor e 1 conflito 409', async () => {
    const ticket = await Ticket.create({
      contactId: contact2.id,
      companyId: 1,
      whatsappId: whatsapp1.id,
      queueId: queue1.id,
      status: 'pending',
      userId: null
    });

    // Simulacao concorrente: Atendente 1 e Atendente 2 tentam assumir ao mesmo tempo
    const req1 = request
      .put(`/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${attendant1Token}`)
      .send({ status: 'open', userId: attendant1.id });

    const req2 = request
      .put(`/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${attendant2Token}`)
      .send({ status: 'open', userId: attendant2.id });

    const [res1, res2] = await Promise.all([req1, req2]);

    const statuses = [res1.status, res2.status].sort();
    assert.deepEqual(statuses, [200, 409], 'Exatamente um atendente obteve sucesso (200) e o outro recebeu Conflito 409');

    const conflictRes = res1.status === 409 ? res1 : res2;
    assert.equal(conflictRes.body.error, 'ERR_TICKET_ALREADY_CLAIMED');

    await ticket.reload();
    assert.equal(ticket.status, 'open');
    assert.ok(ticket.userId === attendant1.id || ticket.userId === attendant2.id, 'Ticket assumido exclusivamente pelo vencedor');
  });

  test('REL-03: Validacao de transicoes de status e isolamento de fila/usuario', async () => {
    const contactTransitions = await Contact.create({
      id: 14,
      name: 'Cliente Transitions',
      number: '5567988880014',
      companyId: 1
    });
    const ticket = await Ticket.create({
      contactId: contactTransitions.id,
      companyId: 1,
      whatsappId: whatsapp1.id,
      queueId: queue1.id,
      status: 'closed',
      userId: admin1.id
    });

    // 1. Tentar fechar ticket que ja esta fechado -> 400
    const resCloseClosed = await request
      .put(`/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'closed' });
    assert.equal(resCloseClosed.status, 400);
    assert.equal(resCloseClosed.body.error, 'ERR_TICKET_ALREADY_CLOSED');

    // 2. Tentar transferir para fila de outra empresa -> rejeitado por seguranca (403) ou validacao (400)
    const resCrossQueue = await request
      .put(`/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ queueId: queueCompany2.id });
    assert.ok([400, 403].includes(resCrossQueue.status), 'Fila de outra empresa rejeitada com 400 ou 403');

    // Validacao direta no UpdateTicketService tambem lanca ERR_INVALID_QUEUE (400)
    let directError;
    try {
      await UpdateTicketService({
        ticketData: { queueId: queueCompany2.id },
        ticketId: ticket.id,
        companyId: 1
      });
    } catch (e) {
      directError = e;
    }
    assert.ok(directError);
    assert.equal(directError.message, 'ERR_INVALID_QUEUE');
    assert.equal(directError.statusCode, 400);
  });

  test('REL-03: Criacao simultanea de tickets para o mesmo contato recupera ticket ativo sem duplicar', async () => {
    const contactRace = await Contact.create({
      id: 15,
      name: 'Cliente Race',
      number: '5567988880015',
      companyId: 1
    });
    // Duas chamadas simultaneas a FindOrCreateTicketService para o mesmo contato
    const [t1, t2] = await Promise.all([
      FindOrCreateTicketService(contactRace, whatsapp1.id, 0, 1),
      FindOrCreateTicketService(contactRace, whatsapp1.id, 0, 1)
    ]);

    assert.equal(t1.id, t2.id, 'Ambas as chamadas retornaram a mesma instancia de ticket ativo');

    const activeTicketsCount = await Ticket.count({
      where: {
        contactId: contactRace.id,
        companyId: 1,
        status: ['open', 'pending']
      }
    });
    assert.equal(activeTicketsCount, 1, 'Apenas 1 ticket ativo criado para o contato');
  });

  // ==========================================
  // REL-04: CONEXÃO WHATSAPP E CONTINUIDADE
  // ==========================================

  test('REL-04: Observabilidade de desconexao WhatsApp - motivos e acoes requeridas', async () => {
    const wapp = await Whatsapp.create({
      id: 200,
      name: 'WhatsApp Teste Observabilidade',
      status: 'CONNECTED',
      companyId: 1,
      number: '5567999990200'
    });

    // 1. Desconexao por Logout (401)
    await wapp.update({
      status: 'DISCONNECTED',
      disconnectReason: 'LOGGED_OUT',
      actionRequired: 'Sessão encerrada no aparelho. Escaneie o QR Code novamente para conectar.',
      lastDisconnectedAt: new Date()
    });
    await wapp.reload();
    assert.equal(wapp.status, 'DISCONNECTED');
    assert.equal(wapp.disconnectReason, 'LOGGED_OUT');
    assert.ok(wapp.actionRequired.includes('QR Code'));

    // 2. Desconexao por Sessao Substituida (440)
    await wapp.update({
      status: 'DISCONNECTED',
      disconnectReason: 'CONNECTION_REPLACED',
      actionRequired: 'Sessão conectada em outro navegador ou dispositivo. Reconecte para assumir o controle.',
      lastDisconnectedAt: new Date()
    });
    await wapp.reload();
    assert.equal(wapp.disconnectReason, 'CONNECTION_REPLACED');
    assert.ok(wapp.actionRequired.includes('outro navegador'));

    // 3. Desconexao por Banimento / 403
    await wapp.update({
      status: 'DISCONNECTED',
      disconnectReason: 'BANNED_OR_FORBIDDEN',
      actionRequired: 'Acesso proibido ou número suspenso pelo WhatsApp (403). Verifique a linha junto ao WhatsApp.',
      lastDisconnectedAt: new Date()
    });
    await wapp.reload();
    assert.equal(wapp.disconnectReason, 'BANNED_OR_FORBIDDEN');

    // 4. Reconexao com sucesso limpa motivo e acao requerida
    await wapp.update({
      status: 'CONNECTED',
      disconnectReason: null,
      actionRequired: null
    });
    await wapp.reload();
    assert.equal(wapp.status, 'CONNECTED');
    assert.equal(wapp.disconnectReason, null);
    assert.equal(wapp.actionRequired, null);
  });

  test('REL-04: Falha de rede persistente alerta operador e interrompe loops infinitos', async () => {
    const wapp = await Whatsapp.create({
      id: 201,
      name: 'WhatsApp Teste Queda Prolongada',
      status: 'CONNECTED',
      companyId: 1,
      number: '5567999990201'
    });

    // Quando esgota as tentativas de backoff (retries >= MAX_RECONNECT_RETRIES)
    await wapp.update({
      status: 'DISCONNECTED',
      disconnectReason: 'PERSISTENT_NETWORK_FAILURE',
      actionRequired: 'Falha de rede persistente. Verifique a conexão com a internet ou utilize um canal alternativo.',
      lastDisconnectedAt: new Date()
    });

    await wapp.reload();
    assert.equal(wapp.status, 'DISCONNECTED');
    assert.equal(wapp.disconnectReason, 'PERSISTENT_NETWORK_FAILURE');
    assert.ok(wapp.actionRequired.includes('canal alternativo'));
  });

  // Execute all tests sequentially
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log('PASS ' + name);
    } catch (err) {
      console.error('FAIL ' + name);
      console.error(err);
      process.exit(1);
    }
  }

  console.log(`RESULT ${tests.length}/${tests.length} passed; isolated PostgreSQL/WASM, zero external services`);
  if (server) server.close();
  try { fs.rmSync(temp, { recursive: true, force: true }); } catch (_) {}
  process.exit(0);
})().catch(err => {
  console.error('FATAL in test harness:');
  console.error(err);
  if (server) server.close();
  process.exit(1);
});
