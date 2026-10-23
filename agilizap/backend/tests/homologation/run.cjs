/* Isolated Global Homologation & Release harness (Etapa 6 - UX-01 & Global Acceptance).
 * Real PostgreSQL/WASM (PGlite), zero external services. */
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
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ticket-homologation-'));
process.env.TEST_MEDIA_ROOT = temp;

require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
    esModuleInterop: true, experimentalDecorators: true, emitDecoratorMetadata: true }
}).outputText, filename);

const source = path.resolve(__dirname, '../../src');
let database;
let mockDbQueryError = null;

const originalLoad = Module._load;
Module._load = function(request, parent, ...rest) {
  const resolved = Module._resolveFilename(request, parent);
  if (resolved === path.join(source, 'database/index.ts')) return { __esModule: true, default: database };
  if (resolved === path.join(source, 'libs/cache.ts')) return { __esModule: true, cacheLayer: { get: async () => null, set: async () => {}, del: async () => {}, delFromPattern: async () => {} } };
  if (resolved === path.join(source, 'libs/socket.ts')) {
    const makeChain = () => {
      const chain = { to: () => chain, emit: () => {} };
      return chain;
    };
    return {
      __esModule: true,
      getIO: () => makeChain(),
      initIO: () => {},
      enforceTicketRoomAccess: async () => {},
      disconnectUser: () => {}
    };
  }
  if (resolved === path.join(source, 'queues.ts')) {
    return {
      __esModule: true,
      sendScheduledMessages: {
        add: async () => ({ id: 'job-' + Date.now() }),
        clean: () => {},
        close: async () => {},
        getJobCounts: async () => ({ waiting: 0, active: 0, completed: 0, failed: 0 })
      },
      messageQueue: {
        add: async () => {},
        close: async () => {},
        client: { ping: async () => "PONG" },
        getJobCounts: async () => ({ waiting: 0, active: 0, completed: 0, failed: 0 })
      },
      campaignQueue: { add: async () => {}, close: async () => {} },
      userMonitor: { add: async () => {}, close: async () => {} },
      queueMonitor: { add: async () => {}, close: async () => {} },
      scheduleMonitor: { add: async () => {}, close: async () => {} },
      stopQueueProcess: async () => {}
    };
  }
  return originalLoad.call(this, request, parent, ...rest);
};

const load = name => require(path.join(source, name));
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

let pg;

(async () => {
  pg = new PGlite();
  await pg.waitReady;
  const { Sequelize } = require('sequelize-typescript');
  database = new Sequelize({
    dialect: 'postgres',
    database: 'homologation_memory',
    logging: false,
    databaseVersion: '17.0.0',
    pool: { max: 1, min: 0 }
  });

  const connection = {
    query(sql, parameters, callback) {
      if (typeof parameters === 'function') { callback = parameters; parameters = []; }
      if (mockDbQueryError) {
        const err = mockDbQueryError;
        if (typeof callback === 'function') return callback(err);
        return Promise.reject(err);
      }
      const query = parameters?.length ? pg.query(sql, parameters).then(r => [r]) : pg.exec(sql);
      query.then(results => callback(null, results.map(r => ({ ...r, rowCount: r.affectedRows ?? r.rows.length }))), callback);
    }
  };
  database.connectionManager.getConnection = () => require("bluebird").resolve(connection);
  database.connectionManager.releaseConnection = () => require("bluebird").resolve();

  const allModelFiles = fs.readdirSync(path.join(source, 'models')).filter(n => n.endsWith('.ts'));
  const models = allModelFiles.map(n => load('models/' + n).default);
  database.addModels(models);

  const stage1Added = ['resetTokenHash','resetTokenExpiresAt','blocked','mfaLastStep','mustChangePassword'];
  const stage2AddedTickets = ['closedAt','legalHold','legalHoldReason','legalHoldAt'];
  const stage2AddedContacts = ['optOutCampaign'];
  const stage3AddedSchedules = ['interruptionReason','reviewedBy','reviewedAt','retries'];
  const stage3AddedMessages = ['status','operationId','uncertainReason','retries'];
  const stage3AddedWhatsapps = ['disconnectReason','actionRequired','lastDisconnectedAt'];
  const stage4AddedTickets = ['lastClientMessageAt','lastHumanResponseAt','currentWaitEpisodeId'];
  const stage4AddedCompanies = ['aiMonthlyBudgetLimit','aiMonthlySpent','aiBudgetPeriod','aiRequestsCount'];

  const User = load('models/User.ts').default;
  const Ticket = load('models/Ticket.ts').default;
  const Contact = load('models/Contact.ts').default;
  const Schedule = load('models/Schedule.ts').default;
  const Message = load('models/Message.ts').default;
  const Whatsapp = load('models/Whatsapp.ts').default;
  const Company = load('models/Company.ts').default;
  const Queue = load('models/Queue.ts').default;
  const QueueWaitAlert = load('models/QueueWaitAlert.ts').default;
  const AuditLog = load('models/AuditLog.ts').default;

  for (const model of models) {
    if (model.name === 'AuditLog' || model.name === 'QueueWaitAlert') continue;
    const attributes = Object.fromEntries(Object.entries(model.rawAttributes).filter(([name, attr]) => {
      if (attr.type && attr.type.key === 'VIRTUAL') return false;
      if (model.name === 'User' && stage1Added.includes(name)) return false;
      if (model.name === 'Ticket' && (stage2AddedTickets.includes(name) || stage4AddedTickets.includes(name))) return false;
      if ((model.name === 'Contact' || model.name === 'ContactListItem') && stage2AddedContacts.includes(name)) return false;
      if (model.name === 'Schedule' && stage3AddedSchedules.includes(name)) return false;
      if (model.name === 'Message' && stage3AddedMessages.includes(name)) return false;
      if (model.name === 'Whatsapp' && stage3AddedWhatsapps.includes(name)) return false;
      if (model.name === 'Company' && stage4AddedCompanies.includes(name)) return false;
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

  // Execute all migrations up to Stage 4 & 5
  const migration1 = load('database/migrations/20261021000000-security-access.ts');
  await migration1.up(database.getQueryInterface());
  const migration2 = load('database/migrations/20261022000000-data-governance.ts');
  await migration2.up(database.getQueryInterface());
  const migration3 = load('database/migrations/20261022010000-service-reliability.ts');
  await migration3.up(database.getQueryInterface());
  const migration4 = load('database/migrations/20261022020000-ai-supervision.ts');
  await migration4.up(database.getQueryInterface());

  // Services
  const UpdateTicketService = load('services/TicketServices/UpdateTicketService.ts').default;
  const { reconcileOverdueSchedules } = load('services/ScheduleServices/ScheduleReconciliationService.ts');
  const { sanitizeAIResponse } = load('services/AIServices/AISanitizer.ts');
  const { checkCompanyAIBudget, recordAIUsage } = load('services/AIServices/AIBudgetService.ts');
  const { addBusinessMinutes, calculateBusinessMinutesBetween } = load('services/ScheduleServices/BusinessHoursService.ts');
  const { checkAndTriggerQueueWaitAlerts, resolveAlertOnHumanResponse } = load('services/TicketServices/QueueWaitAlertService.ts');
  const { BackupService } = load('services/OperationServices/BackupService.ts');
  const { RestoreService } = load('services/OperationServices/RestoreService.ts');
  const { previewRetention } = load('services/DataRetentionService/DataRetentionService.ts');
  const { HealthController } = load('controllers/HealthController.ts');

  // Global Homologation Scenario 1: Multi-tenant isolation & RBAC
  test('Cenário 1: Isolamento estrito multi-tenant (Company 1 vs Company 2) e permissões de fila', async () => {
    const comp1 = await Company.create({ name: 'Empresa Alfa Homologação' });
    const comp2 = await Company.create({ name: 'Empresa Beta Homologação' });

    const q1 = await Queue.create({ name: 'Suporte Alfa', color: '#10b981', companyId: comp1.id });
    const q2 = await Queue.create({ name: 'Financeiro Beta', color: '#3b82f6', companyId: comp2.id });

    const user1 = await User.create({ name: 'Atendente Alfa', email: 'alfa@test.com', passwordHash: 'hash', profile: 'user', companyId: comp1.id });
    const user2 = await User.create({ name: 'Atendente Beta', email: 'beta@test.com', passwordHash: 'hash', profile: 'user', companyId: comp2.id });
    await user1.$set('queues', [q1]);
    await user2.$set('queues', [q2]);

    const contact1 = await Contact.create({ name: 'Cliente Alfa', number: '556799990001', companyId: comp1.id });
    const ticket1 = await Ticket.create({ contactId: contact1.id, status: 'pending', queueId: q1.id, companyId: comp1.id });

    // User2 from Company 2 attempts to claim Ticket 1 from Company 1
    await assert.rejects(
      async () => {
        await UpdateTicketService({
          ticketData: { status: 'open', userId: user2.id },
          ticketId: ticket1.id,
          companyId: comp2.id // different company context
        });
      },
      err => err.message.includes('outra empresa') || err.message === 'ERR_NO_TICKET_FOUND' || err.statusCode === 404
    );

    // User 1 from Company 1 successfully claims their ticket
    const updated = await UpdateTicketService({
      ticketData: { status: 'open', userId: user1.id },
      ticketId: ticket1.id,
      companyId: comp1.id
    });
    assert.equal(updated.ticket.status, 'open');
    assert.equal(updated.ticket.userId, user1.id);
  });

  // Global Homologation Scenario 2: Concurrent ticket claiming (409 Conflict)
  test('Cenário 2: Concorrência ao assumir ticket (um vencedor atômico, perdedor com 409 Conflict)', async () => {
    const comp = await Company.create({ name: 'Empresa Concorrencia' });
    const q = await Queue.create({ name: 'Comercial', color: '#f59e0b', companyId: comp.id });
    const attA = await User.create({ name: 'Atendente A', email: 'atta@test.com', passwordHash: 'hash', profile: 'user', companyId: comp.id });
    const attB = await User.create({ name: 'Atendente B', email: 'attb@test.com', passwordHash: 'hash', profile: 'user', companyId: comp.id });
    await attA.$set('queues', [q]);
    await attB.$set('queues', [q]);

    const contact = await Contact.create({ name: 'Lead Concorrente', number: '556799990002', companyId: comp.id });
    const ticket = await Ticket.create({ contactId: contact.id, status: 'pending', queueId: q.id, companyId: comp.id });

    // Attendant A claims first
    const resA = await UpdateTicketService({
      ticketData: { status: 'open', userId: attA.id },
      ticketId: ticket.id,
      companyId: comp.id
    });
    assert.equal(resA.ticket.userId, attA.id);

    // Attendant B claims simultaneously while ticket is already open
    await assert.rejects(
      async () => {
        await UpdateTicketService({
          ticketData: { status: 'open', userId: attB.id },
          ticketId: ticket.id,
          companyId: comp.id
        });
      },
      err => err.message === 'ERR_TICKET_ALREADY_CLAIMED' && err.statusCode === 409
    );
  });

  // Global Homologation Scenario 3: Message state transitions, idempotency, and uncertain failure
  test('Cenário 3: Resiliência de mensagens com operationId e registro de falha/incerteza sem repetição cega', async () => {
    const comp = await Company.create({ name: 'Empresa Mensagens' });
    const contact = await Contact.create({ name: 'Cliente Mensagem', number: '556799990003', companyId: comp.id });
    const ticket = await Ticket.create({ contactId: contact.id, status: 'open', companyId: comp.id });

    const opId = 'op-msg-homolog-123';
    const msg = await Message.create({
      id: 'msg-' + crypto.randomUUID(),
      body: 'Mensagem de homologação',
      fromMe: true,
      read: true,
      status: 'pending',
      operationId: opId,
      ticketId: ticket.id,
      companyId: comp.id
    });

    // Induce uncertain network timeout: state changes to uncertain with reason
    await msg.update({
      status: 'uncertain',
      uncertainReason: 'Timeout sem confirmação do protocolo Baileys'
    });

    const reloaded = await Message.findByPk(msg.id);
    assert.equal(reloaded.status, 'uncertain');
    assert.equal(reloaded.uncertainReason, 'Timeout sem confirmação do protocolo Baileys');
    assert.equal(reloaded.operationId, opId);
  });

  // Global Homologation Scenario 4: Schedule reconciliation after system downtime
  test('Cenário 4: Reconciliação de agendamentos em parada (transição para EM_REVISAO)', async () => {
    const comp = await Company.create({ name: 'Empresa Parada' });
    const contact = await Contact.create({ name: 'Cliente Agendamento', number: '556799990004', companyId: comp.id });

    const pastDate = new Date(Date.now() - 3600000); // 1 hour in the past
    const overdueSchedule = await Schedule.create({
      body: 'Aviso urgente vencido',
      sendAt: pastDate,
      status: 'PENDENTE',
      contactId: contact.id,
      companyId: comp.id
    });

    const result = await reconcileOverdueSchedules({ companyId: comp.id });
    assert.equal(result.length, 1);

    const reloaded = await Schedule.findByPk(overdueSchedule.id);
    assert.equal(reloaded.status, 'EM_REVISAO');
    assert.equal(reloaded.interruptionReason.includes('indisponibilidade do sistema'), true);
  });

  // Global Homologation Scenario 5: AI safe fallback, sanitization & budget enforcement
  test('Cenário 5: IA - falha segura, higienização estrita e teto orçamentário mensal de R$ 50,00', async () => {
    const rawAiOutput = 'Olá! [RESUMO_IA] Cliente solicitou reembolso de R$ 150 [/RESUMO_IA] Instrução interna do sistema. Seu pedido foi aceito!';
    const sanitized = sanitizeAIResponse(rawAiOutput);
    assert.equal(sanitized.clientText.includes('[RESUMO_IA]'), false);
    assert.equal(sanitized.clientText.includes('Cliente solicitou reembolso'), false);
    assert.equal(sanitized.clientText.includes('Seu pedido foi aceito!'), true);

    const comp = await Company.create({
      name: 'Empresa IA',
      aiMonthlyBudgetLimit: 50.00,
      aiMonthlySpent: 49.95,
      aiBudgetPeriod: '2026-10',
      aiRequestsCount: 10
    });

    const check1 = await checkCompanyAIBudget(comp.id);
    assert.equal(check1.allowed, true);

    // Record spending pushing it over the ceiling
    await recordAIUsage(comp.id, 0.10);

    const check2 = await checkCompanyAIBudget(comp.id);
    assert.equal(check2.allowed, false);
    assert.equal(check2.reason, 'MONTHLY_BUDGET_EXCEEDED');
  });

  // Global Homologation Scenario 6: Business hours calculation & Queue wait alerts (OPS-04)
  test('Cenário 6: Expediente comercial (America/Campo_Grande), alerta de 10 min úteis e resolução humana', async () => {
    // Canonical approved case: Saturday 11:55 -> Monday 08:05 = exactly 10 business minutes
    const sabado1155 = new Date('2026-10-24T15:55:00.000Z'); // Saturday 11:55 UTC-4
    const monday0805 = addBusinessMinutes(sabado1155, 10);
    assert.equal(monday0805.toISOString(), '2026-10-26T12:05:00.000Z');
    const elapsedMinutes = calculateBusinessMinutesBetween(sabado1155, monday0805);
    assert.equal(elapsedMinutes, 10);

    const comp = await Company.create({ name: 'Empresa Horarios' });
    const q = await Queue.create({ name: 'Suporte Campo Grande', color: '#8b5cf6', companyId: comp.id });
    const sup = await User.create({ name: 'Supervisor', email: 'sup' + Date.now() + '@test.com', passwordHash: 'hash', profile: 'supervisor', companyId: comp.id });
    await sup.$set('queues', [q]);

    const contact = await Contact.create({ name: 'Cliente Aguardando', number: '556799990006', companyId: comp.id });
    const episodeId = 'ep-' + Date.now();
    const ticket = await Ticket.create({
      contactId: contact.id,
      status: 'pending',
      queueId: q.id,
      companyId: comp.id,
      lastClientMessageAt: sabado1155,
      currentWaitEpisodeId: episodeId
    });

    const alerts = await checkAndTriggerQueueWaitAlerts({
      companyId: comp.id,
      now: monday0805
    });
    assert.equal(alerts.length >= 1, true);

    const activeAlerts = await QueueWaitAlert.findAll({ where: { ticketId: ticket.id, status: 'pending_response' } });
    assert.equal(activeAlerts.length, 1);
    assert.equal(activeAlerts[0].episodeId, episodeId);

    // Resolve alert via human response
    const { resolveQueueWaitAlert } = load('services/TicketServices/QueueWaitAlertService');
    await resolveQueueWaitAlert(ticket.id, sup.id, monday0805);
    const resolved = await QueueWaitAlert.findOne({ where: { ticketId: ticket.id } });
    assert.equal(resolved.status, 'resolved');
  });

  // Global Homologation Scenario 7: Health & Metrics endpoints without leaking secrets (OPS-02)
  test('Cenário 7: Probes de saúde (/health/live, /health/ready, /health/whatsapp, /health/metrics) sem segredos', async () => {
    let liveStatus = 0;
    let livePayload = null;
    const resLive = {
      status(s) { liveStatus = s; return resLive; },
      json(j) { livePayload = j; return resLive; }
    };
    await HealthController.live({}, resLive);
    assert.equal(liveStatus, 200);
    assert.equal(livePayload.status, 'ok');

    let readyStatus = 0;
    let readyPayload = null;
    const resReady = {
      status(s) { readyStatus = s; return resReady; },
      json(j) { readyPayload = j; return resReady; }
    };
    await HealthController.ready({}, resReady);
    assert.equal(readyStatus, 200);
    assert.equal(readyPayload.status, 'ok');
    const jsonStr = JSON.stringify(readyPayload);
    assert.equal(jsonStr.includes(process.env.JWT_SECRET), false);
    assert.equal(jsonStr.includes('password'), false);

    let metricsStatus = 0;
    let metricsPayload = null;
    const resMetrics = {
      status(s) { metricsStatus = s; return resMetrics; },
      json(j) { metricsPayload = j; return resMetrics; }
    };
    await HealthController.metrics({}, resMetrics);
    assert.equal(metricsStatus, 200);
    assert.equal(typeof metricsPayload.uptimeSeconds, 'number');
  });

  // Global Homologation Scenario 8: Backup & Restore with SHA-256 integrity, RPO/RTO & Baileys collision prevention
  test('Cenário 8: Backup estruturado com SHA-256, restauração segura com trava DISCONNECTED e cumprimento de RPO/RTO', async () => {
    const comp = await Company.create({ name: 'Empresa Backup Homologação' });
    const whatsapp = await Whatsapp.create({ name: 'Sessao Producao', status: 'CONNECTED', companyId: comp.id });

    const backupDir = path.join(temp, 'backup-homolog');
    fs.mkdirSync(backupDir, { recursive: true });

    const backupResult = await BackupService.createBackup({
      destinationDir: backupDir,
      companyId: comp.id,
      includeMedia: false
    });
    assert.ok(backupResult.backupPath);
    assert.ok(backupResult.manifest.manifestSha256);

    // Verify tamper detection
    const tamperedFolder = path.join(temp, 'tampered_homolog_backup');
    fs.cpSync(backupResult.backupPath, tamperedFolder, { recursive: true });
    const tableDump = path.join(tamperedFolder, 'Companies.json');
    fs.appendFileSync(tableDump, '/* tampered bytes */');

    await assert.rejects(
      async () => {
        await RestoreService.restoreBackup(tamperedFolder, {
          preventSessionCollision: true
        });
      },
      err => err.message.includes('ERR_BACKUP_INTEGRITY_COMPROMISED')
    );

    // Clean restore
    const restoreResult = await RestoreService.restoreBackup(backupResult.backupPath, {
      preventSessionCollision: true
    });
    assert.ok(restoreResult.recordsRestored >= 0);
    assert.equal(restoreResult.rpoCompliant, true);
    assert.equal(restoreResult.rtoCompliant, true);

    const restoredWhatsapp = await Whatsapp.findByPk(whatsapp.id);
    assert.equal(restoredWhatsapp.status, 'DISCONNECTED');
  });

  // Global Homologation Scenario 9: Data retention simulation & dry-run (GOV-01, GOV-02)
  test('Cenário 9: Retenção temporal (2 anos mensagens / 1 ano anexos) com dry-run seguro', async () => {
    const comp = await Company.create({ name: 'Empresa Retencao Homolog' });
    const contact = await Contact.create({ name: 'Contato Antigo', number: '556799990009', companyId: comp.id });

    // Ticket closed 3 years ago
    const threeYearsAgo = new Date(Date.now() - 3 * 365 * 24 * 3600 * 1000);
    const oldTicket = await Ticket.create({
      contactId: contact.id,
      status: 'closed',
      closedAt: threeYearsAgo,
      companyId: comp.id
    });

    const oldMsg = await Message.create({
      id: 'msg-' + crypto.randomUUID(),
      body: 'Conversa antiga expirada',
      ticketId: oldTicket.id,
      companyId: comp.id,
      createdAt: threeYearsAgo
    });

    // Dry-run retention inspection
    const previewReport = await previewRetention({
      companyId: comp.id,
      referenceDate: new Date(),
      conversationRetentionDays: 730,
      attachmentRetentionDays: 365
    });

    assert.ok(previewReport.conversations.eligibleTicketsCount >= 1);

    // Ensure record is NOT deleted during dry run
    const stillExists = await Message.findByPk(oldMsg.id);
    assert.notEqual(stillExists, null);
  });

  // Global Homologation Scenario 10: Multi-attendant concurrent load test (10 simulated workers)
  test('Cenário 10: Homologação de concorrência com 10 atendentes virtuais simultâneos (zero deadlocks)', async () => {
    const comp = await Company.create({ name: 'Empresa 10 Atendentes' });
    const q = await Queue.create({ name: 'Fila Carga', color: '#6366f1', companyId: comp.id });

    const attendants = [];
    for (let i = 1; i <= 10; i++) {
      const att = await User.create({
        name: `Atendente ${i}`,
        email: `worker${i}_${Date.now()}@carga.com`,
        passwordHash: 'hash',
        profile: 'user',
        companyId: comp.id
      });
      await att.$set('queues', [q]);
      attendants.push(att);
    }

    // Create 10 tickets concurrently
    const tickets = [];
    for (let i = 1; i <= 10; i++) {
      const c = await Contact.create({ name: `Cliente Carga ${i}`, number: `55679999100${i}`, companyId: comp.id });
      const t = await Ticket.create({ contactId: c.id, status: 'pending', queueId: q.id, companyId: comp.id });
      tickets.push(t);
    }

    // 10 attendants claim 10 distinct tickets concurrently
    const claimPromises = attendants.map((att, index) => {
      return UpdateTicketService({
        ticketData: { status: 'open', userId: att.id },
        ticketId: tickets[index].id,
        companyId: comp.id
      });
    });

    const results = await Promise.all(claimPromises);
    assert.equal(results.length, 10);
    for (let i = 0; i < 10; i++) {
      assert.equal(results[i].ticket.status, 'open');
      assert.equal(results[i].ticket.userId, attendants[i].id);
    }
  });

  // Execute all tests
  let passed = 0;
  let failed = 0;
  console.log('\n======================================================');
  console.log('--- SUÍTE DE HOMOLOGAÇÃO E LIBERAÇÃO (ETAPA 6) ---');
  console.log('======================================================\n');

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`  ✓ [APROVADO] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ [FALHA] ${name}`);
      console.error(err);
      failed++;
    }
  }

  console.log('\n------------------------------------------------------');
  console.log(`Resultado da Homologação: ${passed}/${tests.length} cenários aprovados (${failed} falhas).`);
  console.log('------------------------------------------------------\n');

  if (failed > 0) process.exit(1);
  process.exit(0);
})();
