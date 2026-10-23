/* Isolated governance & data life cycle acceptance harness: real PostgreSQL/WASM (PGlite), zero external services. */
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
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ticket-governance-'));
process.env.TEST_MEDIA_ROOT = temp;
process.env.MAIL_HOST = 'smtp.invalid';
process.env.MAIL_PORT = '587';
process.env.MAIL_FROM = 'governance@example.invalid';
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
const originalLoad = Module._load;
Module._load = function(request, parent, ...rest) {
  const resolved = Module._resolveFilename(request, parent);
  if (resolved === path.join(source, 'database/index.ts')) return { __esModule: true, default: database };
  if (resolved === path.join(source, 'utils/logger.ts')) return { logger: Object.fromEntries(['info','error','warn','debug'].map(k => [k, (...args) => logs.push(args)])) };
  if (resolved === path.join(source, 'helpers/GetTicketWbot.ts')) return { __esModule: true, default: async () => ({ sendMessage: async () => ({}) }) };
  if (resolved === path.join(source, 'helpers/SetTicketMessagesAsRead.ts')) return { __esModule: true, default: async () => {} };
  if (resolved === path.join(source, 'services/WbotServices/SendWhatsAppMessage.ts')) return { __esModule: true, default: async () => {} };
  if (resolved === path.join(source, 'services/WbotServices/wbotMessageListener.ts')) return { __esModule: true, verifyMessage: async () => {} };
  if (resolved === path.join(source, 'services/WbotServices/CheckNumber.ts')) return { __esModule: true, default: async (n) => ({ jid: `${n}@s.whatsapp.net` }) };
  if (resolved === path.join(source, 'services/WbotServices/CheckIsValidContact.ts')) return { __esModule: true, default: async () => {} };
  if (resolved === path.join(source, 'services/WbotServices/ImportContactsService.ts')) return { __esModule: true, default: async () => {} };
  if (resolved === path.join(source, 'libs/wbot.ts')) return { __esModule: true, initWASocket: () => {}, getWbot: () => ({}) };
  if (/[\\/]services[\\/]WbotServices[\\/]/.test(resolved) || resolved === path.join(source, 'queues.ts')) {
    throw new Error('External runtime import forbidden in governance harness: ' + request);
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
    database: 'governance_memory_only',
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

  for (const model of models) {
    if (model.name === 'AuditLog') continue; // Created by migration 2
    const attributes = Object.fromEntries(Object.entries(model.rawAttributes).filter(([name, attr]) => {
      if (attr.type.key === 'VIRTUAL') return false;
      if (model.name === 'User' && stage1Added.includes(name)) return false;
      if (model.name === 'Ticket' && stage2AddedTickets.includes(name)) return false;
      if ((model.name === 'Contact' || model.name === 'ContactListItem') && stage2AddedContacts.includes(name)) return false;
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
  console.log('PASS migration up executed inside isolated PostgreSQL/WASM');

  // Verify migration down and up works
  await migration2.down(database.getQueryInterface());
  await migration2.up(database.getQueryInterface());
  console.log('PASS migration down/up reversibility verified');

  // Load models & services
  const User = load('models/User.ts').default;
  const Company = load('models/Company.ts').default;
  const Queue = load('models/Queue.ts').default;
  const Ticket = load('models/Ticket.ts').default;
  const Contact = load('models/Contact.ts').default;
  const ContactListItem = load('models/ContactListItem.ts').default;
  const Message = load('models/Message.ts').default;
  const TicketTraking = load('models/TicketTraking.ts').default;
  const AuditLog = load('models/AuditLog.ts').default;
  const Setting = load('models/Setting.ts').default;
  const Whatsapp = load('models/Whatsapp.ts').default;

  const { logAuditEvent, sanitizeAuditDetails } = load('security/audit.ts');
  const { previewRetention, executeRetentionPurge, setLegalHold, exportDataSubject, anonymizeDataSubject, toggleCampaignOptOut } = load('services/DataRetentionService/DataRetentionService.ts');
  const FindOrCreateTicketService = load('services/TicketServices/FindOrCreateTicketService.ts').default;
  const UpdateTicketService = load('services/TicketServices/UpdateTicketService.ts').default;
  const { createAccessToken } = load('helpers/CreateTokens.ts');
  const isAuth = load('middleware/isAuth.ts').default;

  // Setup express test server with controllers & routes
  const express = require('express');
  require('express-async-errors');
  const app = express();
  app.use(express.json());
  app.use(require('cookie-parser')());
  app.use(load('middleware/securityHttp.ts').securityHeaders);
  app.use(load('middleware/securityHttp.ts').trustedOrigin);

  app.use(load('routes/auditLogRoutes.ts').default);
  app.use(load('routes/dataRetentionRoutes.ts').default);
  app.use(load('routes/userRoutes.ts').default);
  app.use(load('routes/contactRoutes.ts').default);
  app.use(load('routes/ticketRoutes.ts').default);

  app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ error: err.message || 'Internal Server Error' });
  });

  const http = require('node:http');
  server = http.createServer(app);
  const { initIO } = load('libs/socket.ts');
  initIO(server);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const request = async (method, pathUrl, options = {}) => {
    const { token, body } = options;
    const headers = { 'Content-Type': 'application/json', 'Origin': 'http://localhost:3000' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${pathUrl}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    const status = res.status;
    let data = null;
    try { data = await res.json(); } catch (_) { try { data = await res.text(); } catch (_2) {} }
    return { status, data };
  };

  // Seed two companies and users for testing
  const comp1 = await Company.create({ id: 1, name: 'Empresa Alfa Software', status: true });
  const comp2 = await Company.create({ id: 2, name: 'Empresa Beta Gestao', status: true });

  const admin1 = await User.create({
    id: 1, name: 'Admin Alfa', email: 'admin@alfa.test', passwordHash: 'hash',
    profile: 'admin', companyId: 1, tokenVersion: 0
  });
  const attendant1 = await User.create({
    id: 2, name: 'Atendente Alfa', email: 'atendente@alfa.test', passwordHash: 'hash',
    profile: 'user', companyId: 1, tokenVersion: 0
  });
  const admin2 = await User.create({
    id: 3, name: 'Admin Beta', email: 'admin@beta.test', passwordHash: 'hash',
    profile: 'admin', companyId: 2, tokenVersion: 0
  });

  const tokenAdmin1 = createAccessToken(admin1);
  const tokenAttendant1 = createAccessToken(attendant1);
  const tokenAdmin2 = createAccessToken(admin2);

  const wbot1 = await Whatsapp.create({ id: 1, name: 'Conexao 1', status: 'CONNECTED', companyId: 1 });
  const wbot2 = await Whatsapp.create({ id: 2, name: 'Conexao 2', status: 'CONNECTED', companyId: 2 });

  // ==========================================
  // TESTS
  // ==========================================

  // TEST 1: Sanitization and Audit Log Creation (GOV-01)
  test('Auditoria: registro imutavel, higienizacao de segredos e gravacao segura', async () => {
    const entry = await logAuditEvent({
      companyId: 1,
      userId: 1,
      userEmail: 'admin@alfa.test',
      userRole: 'admin',
      resource: 'auth',
      action: 'login',
      result: 'success',
      targetId: '1',
      details: {
        password: 'mySuperSecretPassword123!',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        passwordHash: '$2a$12$e8Yk23...',
        jwt: 'secret-token',
        ip: '127.0.0.1',
        safeProperty: 'allowedMetadata'
      },
      ip: '127.0.0.1'
    });

    assert.ok(entry);
    assert.equal(entry.companyId, 1);
    assert.equal(entry.resource, 'auth');
    assert.equal(entry.details.safeProperty, 'allowedMetadata');
    assert.equal(entry.details.password, '[REDACTED]');
    assert.equal(entry.details.token, '[REDACTED]');
    assert.equal(entry.details.passwordHash, '[REDACTED]');
    assert.equal(entry.details.jwt, '[REDACTED]');
  });

  // TEST 2: Audit Log API & Company Isolation (GOV-01)
  test('Auditoria: listagem e isolamento estrito entre empresas (Company 1 vs Company 2)', async () => {
    await logAuditEvent({
      companyId: 1,
      resource: 'user',
      action: 'role_change',
      result: 'success',
      details: { role: 'supervisor' }
    });
    await logAuditEvent({
      companyId: 2,
      resource: 'user',
      action: 'role_change',
      result: 'success',
      details: { role: 'admin' }
    });

    // Company 1 query
    const res1 = await request('GET', '/audit-logs', { token: tokenAdmin1 });
    assert.equal(res1.status, 200);
    assert.ok(res1.data.logs.length >= 2);
    for (const l of res1.data.logs) {
      assert.equal(l.companyId, 1, 'Company 1 must never receive Company 2 logs');
    }

    // Company 2 query
    const res2 = await request('GET', '/audit-logs', { token: tokenAdmin2 });
    assert.equal(res2.status, 200);
    assert.ok(res2.data.logs.length >= 1);
    for (const l of res2.data.logs) {
      assert.equal(l.companyId, 2, 'Company 2 must never receive Company 1 logs');
    }
  });

  // TEST 3: RBAC Restriction on Audit Logs (GOV-01)
  test('Auditoria: atendente tem acesso negado (403) e tentativa gera log com result denied', async () => {
    const res = await request('GET', '/audit-logs', { token: tokenAttendant1 });
    assert.equal(res.status, 403);

    const exportRes = await request('GET', '/audit-logs/export', { token: tokenAttendant1 });
    assert.equal(exportRes.status, 403);

    // Verify denied attempt was recorded
    const deniedEntry = await AuditLog.findOne({
      where: {
        companyId: 1,
        userId: 2,
        resource: 'audit_log',
        result: 'denied'
      }
    });
    assert.ok(deniedEntry, 'Unauthorized audit access must be logged as denied');
  });

  // TEST 4: Audit Export with Filters (GOV-01)
  test('Auditoria: exportacao estruturada com filtros por recurso e acao', async () => {
    const res = await request('GET', '/audit-logs/export?resource=user', { token: tokenAdmin1 });
    assert.equal(res.status, 200);
    assert.equal(res.data.companyId, 1);
    assert.ok(Array.isArray(res.data.logs));
    for (const item of res.data.logs) {
      assert.equal(item.resource, 'user');
    }
  });

  // TEST 5: Ticket Lifecycle: close sets closedAt, reopen clears closedAt, actions audited (GOV-02)
  test('Ciclo de vida: fechamento grava closedAt, reabertura limpa closedAt e acoes sao auditadas', async () => {
    const contact = await Contact.create({
      id: 101, name: 'Cliente Teste 1', number: '5511999990001', companyId: 1
    });

    const ticket = await Ticket.create({
      id: 201, contactId: contact.id, companyId: 1, whatsappId: 1, status: 'open'
    });

    // Close ticket via UpdateTicketService
    await UpdateTicketService({
      ticketId: ticket.id,
      companyId: 1,
      ticketData: { status: 'closed' },
      userId: 1
    });

    await ticket.reload();
    assert.equal(ticket.status, 'closed');
    assert.ok(ticket.closedAt instanceof Date);

    // Verify close audit entry
    const closeLog = await AuditLog.findOne({
      where: { companyId: 1, targetId: '201', action: 'close' }
    });
    assert.ok(closeLog, 'Ticket close must be audited');

    // Reopen ticket
    await UpdateTicketService({
      ticketId: ticket.id,
      companyId: 1,
      ticketData: { status: 'open' },
      userId: 1
    });

    await ticket.reload();
    assert.equal(ticket.status, 'open');
    assert.equal(ticket.closedAt, null, 'Reopened ticket must have closedAt cleared');

    const reopenLog = await AuditLog.findOne({
      where: { companyId: 1, targetId: '201', action: 'reopen' }
    });
    assert.ok(reopenLog, 'Ticket reopen must be audited');
  });

  // TEST 6: Grace Period Reopening vs Brand New Ticket (GOV-02)
  test('Ciclo de vida: dentro da tolerancia reabre; apos tolerancia cria NOVO ticket e preserva closedAt antigo', async () => {
    const contactA = await Contact.create({
      id: 102, name: 'Cliente Reabertura Recente', number: '5511999990002', companyId: 1
    });

    // Ticket closed 15 minutes ago
    const tRecent = await Ticket.create({
      id: 202, contactId: contactA.id, companyId: 1, whatsappId: 1, status: 'closed',
      closedAt: new Date(Date.now() - 15 * 60 * 1000)
    });

    // Customer sends message 15 mins after close -> reopens tRecent
    const reopened = await FindOrCreateTicketService(contactA, 1, 1, 1);
    assert.equal(reopened.id, tRecent.id);
    assert.equal(reopened.status, 'pending');

    // Customer B: ticket closed 10 days ago (well beyond 2-hour grace period)
    const contactB = await Contact.create({
      id: 103, name: 'Cliente Retencao Antiga', number: '5511999990003', companyId: 1
    });
    const closedDateOld = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const tOld = await Ticket.create({
      id: 203, contactId: contactB.id, companyId: 1, whatsappId: 1, status: 'closed',
      closedAt: closedDateOld
    });

    // Customer sends message -> must create a NEW ticket, NOT reopen tOld!
    const newTicket = await FindOrCreateTicketService(contactB, 1, 1, 1);
    assert.notEqual(newTicket.id, tOld.id);
    assert.ok(newTicket.id);

    // Old ticket is preserved with its original closedAt!
    await tOld.reload();
    assert.equal(tOld.status, 'closed');
    assert.equal(tOld.closedAt.getTime(), closedDateOld.getTime());
  });

  // TEST 7: Legal Hold Management & RBAC (GOV-02)
  test('Legal Hold: protecao contra expurgo com justificativa obrigatoria, auditada e RBAC', async () => {
    const ticket = await Ticket.create({
      id: 204, contactId: 101, companyId: 1, whatsappId: 1, status: 'closed',
      closedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    });

    // Attendant denied
    const deniedRes = await request('POST', `/tickets/${ticket.id}/legal-hold`, {
      token: tokenAttendant1,
      body: { legalHold: true, reason: 'Tentativa atendente' }
    });
    assert.equal(deniedRes.status, 403);

    // Admin without reason rejected (400)
    const badRes = await request('POST', `/tickets/${ticket.id}/legal-hold`, {
      token: tokenAdmin1,
      body: { legalHold: true, reason: '   ' }
    });
    assert.equal(badRes.status, 400);

    // Admin with valid reason
    const okRes = await request('POST', `/tickets/${ticket.id}/legal-hold`, {
      token: tokenAdmin1,
      body: { legalHold: true, reason: 'Notificação judicial recebida em 22/10/2026' }
    });
    assert.equal(okRes.status, 200);

    await ticket.reload();
    assert.equal(ticket.legalHold, true);
    assert.equal(ticket.legalHoldReason, 'Notificação judicial recebida em 22/10/2026');

    const holdLog = await AuditLog.findOne({
      where: { companyId: 1, targetId: '204', action: 'legal_hold' }
    });
    assert.ok(holdLog);
  });

  // TEST 8: Retention Simulation (Dry-Run) (GOV-02)
  test('Retencao: simulacao (dry-run) calcula conversas e anexos elegiveis sem apagar registros ou arquivos', async () => {
    // Ticket 1: 3 years old, closed, normal -> eligible for both conversation and attachment
    const t3y = await Ticket.create({
      id: 205, contactId: 101, companyId: 1, whatsappId: 1, status: 'closed',
      closedAt: new Date(Date.now() - 1100 * 24 * 60 * 60 * 1000), legalHold: false
    });
    const msg3y = await Message.create({
      id: 'msg-3y-1', ticketId: t3y.id, companyId: 1, body: 'Mensagem antiga 3 anos',
      mediaUrl: 'company1/dummy-3y.pdf', mediaType: 'document'
    });

    // Ticket 2: 1.5 years old (500 days), closed, normal -> eligible for attachment, NOT conversation
    const t15y = await Ticket.create({
      id: 206, contactId: 101, companyId: 1, whatsappId: 1, status: 'closed',
      closedAt: new Date(Date.now() - 500 * 24 * 60 * 60 * 1000), legalHold: false
    });
    const msg15y = await Message.create({
      id: 'msg-15y-1', ticketId: t15y.id, companyId: 1, body: 'Mensagem 1.5 anos',
      mediaUrl: 'company1/dummy-15y.png', mediaType: 'image'
    });

    // Ticket 3: 3 years old, BUT on legal hold -> PRESERVED!
    const tHeld = await Ticket.create({
      id: 207, contactId: 101, companyId: 1, whatsappId: 1, status: 'closed',
      closedAt: new Date(Date.now() - 1100 * 24 * 60 * 60 * 1000),
      legalHold: true, legalHoldReason: 'Preservação de litígio'
    });
    const msgHeld = await Message.create({
      id: 'msg-held-1', ticketId: tHeld.id, companyId: 1, body: 'Mensagem sob tutela legal',
      mediaUrl: 'company1/dummy-held.pdf', mediaType: 'document'
    });

    // Dry-run preview
    const previewRes = await request('GET', '/data-retention/preview?conversationRetentionDays=730&attachmentRetentionDays=365', {
      token: tokenAdmin1
    });
    assert.equal(previewRes.status, 200);
    assert.ok(previewRes.data.conversations.eligibleTicketsCount >= 1);
    assert.ok(previewRes.data.attachments.eligibleAttachmentsCount >= 2);
    assert.ok(previewRes.data.preservedLegalHoldTicketsCount >= 2);

    // Records must NOT be modified
    const checkMsg = await Message.findByPk('msg-3y-1');
    assert.ok(checkMsg.mediaUrl, 'Dry-run must not delete media');
    const checkTicket = await Ticket.findByPk(205);
    assert.ok(checkTicket, 'Dry-run must not delete tickets');
  });

  // TEST 9: Retention Execution (Purge) (GOV-02)
  test('Retencao: expurgo real de anexos (1 ano) e conversas (2 anos) preserva legal hold e unlinks arquivos', async () => {
    // Setup physical files in temp storage
    const subFolder = path.join(temp, 'company1');
    fs.mkdirSync(subFolder, { recursive: true });
    const f3y = path.join(subFolder, 'dummy-3y.pdf');
    const f15y = path.join(subFolder, 'dummy-15y.png');
    const fHeld = path.join(subFolder, 'dummy-held.pdf');
    fs.writeFileSync(f3y, 'conteudo 3 anos');
    fs.writeFileSync(f15y, 'conteudo 1.5 anos');
    fs.writeFileSync(fHeld, 'conteudo preservado sob judicial hold');

    assert.ok(fs.existsSync(f3y));
    assert.ok(fs.existsSync(f15y));
    assert.ok(fs.existsSync(fHeld));

    // Execute purge: purgeAttachments = true, purgeConversations = true, dryRun = false
    const purgeRes = await request('POST', '/data-retention/purge', {
      token: tokenAdmin1,
      body: {
        conversationRetentionDays: 730,
        attachmentRetentionDays: 365,
        purgeConversations: true,
        purgeAttachments: true,
        dryRun: false
      }
    });
    assert.equal(purgeRes.status, 200);
    assert.equal(purgeRes.data.dryRun, false);
    assert.ok(purgeRes.data.purgedAttachmentsCount >= 2);
    assert.ok(purgeRes.data.purgedTicketsCount >= 1);

    // Verify files on disk:
    assert.equal(fs.existsSync(f3y), false, 'Attachment older than 1y must be unlinked');
    assert.equal(fs.existsSync(f15y), false, 'Attachment older than 1y must be unlinked');
    assert.equal(fs.existsSync(fHeld), true, 'Attachment under legal hold must NEVER be unlinked');

    // Verify database state:
    // Ticket 205 (3y old) must be purged
    const purgedTicket = await Ticket.findByPk(205);
    assert.equal(purgedTicket, null, 'Ticket older than 2y must be purged');

    // Ticket 206 (1.5y old) conversation retained, but mediaUrl cleared!
    const retainedTicket = await Ticket.findByPk(206);
    assert.ok(retainedTicket, 'Ticket within 2y must be kept');
    const msg15yReloaded = await Message.findByPk('msg-15y-1');
    assert.equal(msg15yReloaded.mediaUrl, null, 'Attachment must be cleared from message');
    assert.ok(msg15yReloaded.body.includes('[Anexo expirado'));

    // Ticket 207 (3y old on legal hold) must be COMPLETELY PRESERVED!
    const heldTicket = await Ticket.findByPk(207);
    assert.ok(heldTicket, 'Ticket on legal hold must be preserved');
    const msgHeldReloaded = await Message.findByPk('msg-held-1');
    assert.ok(msgHeldReloaded, 'Message on legal hold must be preserved');
    assert.ok(msgHeldReloaded.mediaUrl, 'Media reference on legal hold must be preserved');

    // Audit log must exist
    const purgeAudit = await AuditLog.findOne({
      where: { companyId: 1, action: 'execute_purge' }
    });
    assert.ok(purgeAudit);
  });

  // TEST 10: Data Subject Export (Portabilidade LGPD Art. 18) (GOV-02)
  test('Titular LGPD: exportacao integral de dados cadastrais, tickets e mensagens com isolamento', async () => {
    const contact = await Contact.create({
      id: 104, name: 'Titular Portabilidade', number: '5511999990004', email: 'titular@exemplo.test',
      companyId: 1
    });
    const t = await Ticket.create({
      id: 208, contactId: contact.id, companyId: 1, whatsappId: 1, status: 'open'
    });
    await Message.create({
      id: 'msg-port-1', ticketId: t.id, companyId: 1, body: 'Texto para portabilidade do titular'
    });

    // Attendant receives 403
    const attRes = await request('GET', `/contacts/${contact.id}/data-dossier`, { token: tokenAttendant1 });
    assert.equal(attRes.status, 403);

    // Company 2 receives 403 or 404 (denied/not found in company 2)
    const comp2Res = await request('GET', `/contacts/${contact.id}/data-dossier`, { token: tokenAdmin2 });
    assert.ok(comp2Res.status === 403 || comp2Res.status === 404, 'Cross-company data export must be denied');

    // Company 1 admin receives complete dossier
    const okRes = await request('GET', `/contacts/${contact.id}/data-dossier`, { token: tokenAdmin1 });
    assert.equal(okRes.status, 200);
    assert.equal(okRes.data.contact.name, 'Titular Portabilidade');
    assert.equal(okRes.data.tickets.length, 1);
    assert.equal(okRes.data.messages.length, 1);
    assert.equal(okRes.data.messages[0].body, 'Texto para portabilidade do titular');

    const expAudit = await AuditLog.findOne({
      where: { companyId: 1, targetId: '104', action: 'export' }
    });
    assert.ok(expAudit);
  });

  // TEST 11: Data Subject Erasure / Anonymization (LGPD Art. 18, VI) (GOV-02)
  test('Titular LGPD: anonimizacao bloqueada se houver legal hold e realizada com sucesso sem hold', async () => {
    // Case A: Contact with ticket under legal hold
    const contactHeld = await Contact.create({
      id: 105, name: 'Titular Bloqueado Hold', number: '5511999990005', companyId: 1
    });
    await Ticket.create({
      id: 209, contactId: contactHeld.id, companyId: 1, whatsappId: 1, status: 'closed',
      legalHold: true, legalHoldReason: 'Processo judicial ativo'
    });

    const blockRes = await request('POST', `/contacts/${contactHeld.id}/anonymize`, { token: tokenAdmin1 });
    assert.equal(blockRes.status, 409, 'Erasure must be refused when legal hold is active');

    // Case B: Contact without legal hold
    const contactFree = await Contact.create({
      id: 106, name: 'Titular Para Exclusao', number: '5511999990006', email: 'excluir@teste.invalid',
      companyId: 1
    });
    const tFree = await Ticket.create({
      id: 210, contactId: contactFree.id, companyId: 1, whatsappId: 1, status: 'closed', legalHold: false
    });
    await Message.create({
      id: 'msg-free-1', ticketId: tFree.id, companyId: 1, body: 'Dados pessoais sensiveis do cliente'
    });

    const anonRes = await request('POST', `/contacts/${contactFree.id}/anonymize`, { token: tokenAdmin1 });
    assert.equal(anonRes.status, 200);
    assert.equal(anonRes.data.success, true);

    await contactFree.reload();
    assert.ok(contactFree.name.includes('Titular Excluído'));
    assert.ok(contactFree.number.startsWith('deleted-'));
    assert.equal(contactFree.optOutCampaign, true);

    const scrubbedMsg = await Message.findByPk('msg-free-1');
    assert.equal(scrubbedMsg.body, '[Mensagem anonimizada a pedido do titular]');

    const anonAudit = await AuditLog.findOne({
      where: { companyId: 1, targetId: '106', action: 'anonymize' }
    });
    assert.ok(anonAudit);
  });

  // TEST 12: Campaign Opt-Out (GOV-02)
  test('Campanhas: opt-out bloqueia envios ao contato e atualiza listas com auditoria', async () => {
    const contact = await Contact.create({
      id: 107, name: 'Cliente OptOut', number: '5511999990007', companyId: 1, optOutCampaign: false
    });
    const item = await ContactListItem.create({
      id: 501, name: 'Item Lista OptOut', number: '5511999990007', companyId: 1,
      contactListId: 1, optOutCampaign: false
    });

    // Toggle opt-out
    const optRes = await request('POST', `/contacts/${contact.id}/campaign-opt-out`, {
      token: tokenAdmin1,
      body: { optOut: true }
    });
    assert.equal(optRes.status, 200);

    await contact.reload();
    await item.reload();
    assert.equal(contact.optOutCampaign, true);
    assert.equal(item.optOutCampaign, true, 'ContactListItem with same number must be updated');

    const optAudit = await AuditLog.findOne({
      where: { companyId: 1, targetId: '107', action: 'opt_out' }
    });
    assert.ok(optAudit);
  });

  // Run all tests sequentially
  let passed = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`PASS ${name}`);
      passed++;
    } catch (err) {
      console.error(`FAIL ${name}`);
      console.error(err);
      console.error("Captured logs:", logs);
      process.exitCode = 1;
      break;
    }
  }

  if (passed === tests.length) {
    console.log(`RESULT ${passed}/${tests.length} passed; isolated PostgreSQL/WASM, zero external services`);
  }

  server.close();
  await pg.close();
  try { fs.rmSync(temp, { recursive: true, force: true }); } catch (_) {}
  process.exit(process.exitCode || 0);
})().catch(err => {
  console.error('CRITICAL HARNESS ERROR:', err);
  if (server) server.close();
  process.exit(1);
});
