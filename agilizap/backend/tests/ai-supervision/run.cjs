/* Isolated AI & Supervision acceptance harness: real PostgreSQL/WASM (PGlite), zero external services. */
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
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ticket-ai-supervision-'));
process.env.TEST_MEDIA_ROOT = temp;

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
const socketEmittedEvents = [];

const originalLoad = Module._load;
Module._load = function(request, parent, ...rest) {
  const resolved = Module._resolveFilename(request, parent);
  if (resolved === path.join(source, 'database/index.ts')) return { __esModule: true, default: database };
  if (resolved === path.join(source, 'libs/cache.ts')) return { __esModule: true, cacheLayer: { get: async () => null, set: async () => {}, del: async () => {}, delFromPattern: async () => {} } };
  if (resolved === path.join(source, 'utils/logger.ts')) return { logger: Object.fromEntries(['info','error','warn','debug'].map(k => [k, (...args) => logs.push(args)])) };
  if (resolved === path.join(source, 'libs/socket.ts')) {
    const chain = {
      to: () => chain,
      emit: (event, payload) => socketEmittedEvents.push({ event, payload })
    };
    return {
      __esModule: true,
      getIO: () => chain,
      enforceTicketRoomAccess: async () => {},
      disconnectUser: () => {}
    };
  }
  if (resolved === path.join(source, 'helpers/SetTicketMessagesAsRead.ts')) return { __esModule: true, default: async () => {} };
  if (resolved === path.join(source, 'helpers/GetTicketWbot.ts')) return {
    __esModule: true,
    default: async () => ({
      sendMessage: async (jid, payload, opts) => {
        if (mockWbotSendError) throw mockWbotSendError;
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
  if (resolved === path.join(source, 'queues.ts')) {
    return {
      __esModule: true,
      sendScheduledMessages: { add: async () => ({ id: 'job-' + Date.now() }), clean: () => {} },
      messageQueue: { add: async () => {} },
      campaignQueue: { add: async () => {} },
      queueMonitor: { add: async () => {}, process: () => {} }
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
    database: 'ai_supervision_memory',
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

  // Exclude columns added by migrations during initial sync
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
  const UserQueue = load('models/UserQueue.ts').default;
  const Prompt = load('models/Prompt.ts').default;
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

  const stage1Migration = require(path.join(source, 'database/migrations/20261021000000-security-access.ts'));
  const stage2Migration = require(path.join(source, 'database/migrations/20261022000000-data-governance.ts'));
  const stage3Migration = require(path.join(source, 'database/migrations/20261022010000-service-reliability.ts'));
  const qi = database.getQueryInterface();

  await stage1Migration.up(qi);
  await stage2Migration.up(qi);
  await stage3Migration.up(qi);

  const stage4Migration = require(path.join(source, 'database/migrations/20261022020000-ai-supervision.ts'));
  await stage4Migration.up(qi);
  console.log('PASS migration up executed inside isolated PostgreSQL/WASM');

  // Verify Stage 4 migration reversibility (down and up)
  await stage4Migration.down(qi);
  await stage4Migration.up(qi);
  console.log('PASS migration down/up reversibility verified');


  database.addModels([QueueWaitAlert]);

  // Seed baseline company, queues, users, prompt
  const company = await Company.create({
    id: 1,
    name: 'Softwares de Gestao Empresarial',
    status: true,
    aiMonthlyBudgetLimit: 100.0,
    aiMonthlySpent: 0,
    aiBudgetPeriod: '2026-10',
    aiRequestsCount: 0
  });

  const queueSuporte = await Queue.create({ id: 1, name: 'Suporte', color: '#0055ff', companyId: 1 });
  const queueFinanceiro = await Queue.create({ id: 2, name: 'Financeiro', color: '#00ff55', companyId: 1 });
  const queueComercial = await Queue.create({ id: 3, name: 'Comercial', color: '#ffaa00', companyId: 1 });

  const supervisorSuporte = await User.create({
    id: 10,
    name: 'Supervisor Suporte',
    email: 'sup.suporte@example.com',
    passwordHash: 'hash',
    profile: 'supervisor',
    companyId: 1
  });
  await UserQueue.create({ userId: 10, queueId: 1 });

  const supervisorFinanceiro = await User.create({
    id: 11,
    name: 'Supervisor Financeiro',
    email: 'sup.financeiro@example.com',
    passwordHash: 'hash',
    profile: 'supervisor',
    companyId: 1
  });
  await UserQueue.create({ userId: 11, queueId: 2 });

  const adminUser = await User.create({
    id: 1,
    name: 'Admin Empresa',
    email: 'admin@example.com',
    passwordHash: 'hash',
    profile: 'admin',
    companyId: 1
  });

  const contact = await Contact.create({
    id: 1,
    name: 'Cliente Gestao',
    number: '5567999990001',
    companyId: 1
  });

  const prompt = await Prompt.create({
    id: 1,
    name: 'Prompt Triagem',
    prompt: 'Seja cordial e encaminhe.',
    provider: 'gemini',
    model: 'gemini-3.5-flash-lite',
    apiKey: 'mock-key',
    queueId: 1,
    companyId: 1,
    voice: 'texto'
  });

  // 2. AI-01: Sanitização e prevenção de vazamento interno
  test('AI-01: Sanitizacao - [RESUMO_IA] e Acao: Transferir sao extraidos e removidos do texto do cliente', () => {
    const { sanitizeAIResponse } = load('services/AIServices/AISanitizer.ts');

    const rawResponse = `Entendi perfeitamente sua solicitacao! Estou transferindo seu atendimento agora.
Ação: Transferir para a fila [Financeiro]
[RESUMO_IA]
*Setor:* Financeiro
*Problema:* Segunda via de boleto
*Rotina/Erro:* Nao aplicavel
*Impacto/Urgência:* Normal
[/RESUMO_IA]`;

    const res = sanitizeAIResponse(rawResponse);
    assert.equal(res.transferAction.detected, true);
    assert.equal(res.transferAction.targetQueueName, 'Financeiro');
    assert(res.summary.includes('*Setor:* Financeiro'));
    assert(!res.clientText.includes('[RESUMO_IA]'));
    assert(!res.clientText.includes('[/RESUMO_IA]'));
    assert(!res.clientText.includes('Ação: Transferir'));
    assert(res.clientText.includes('Estou transferindo seu atendimento agora.'));
  });

  test('AI-01: Sanitizacao - Resposta truncada com [RESUMO_IA] sem fechamento nao vaza para o cliente', () => {
    const { sanitizeAIResponse } = load('services/AIServices/AISanitizer.ts');

    // Modelo interrompido no meio do resumo interno
    const rawTruncated = `Aguarde um momento enquanto encaminho suas informacoes.
[RESUMO_IA]
*Setor:* Suporte
*Problema:* Erro de conexao com banco`;

    const res = sanitizeAIResponse(rawTruncated);
    assert(!res.clientText.includes('[RESUMO_IA]'));
    assert(!res.clientText.includes('Erro de conexao'));
    assert.equal(res.clientText, 'Aguarde um momento enquanto encaminho suas informacoes.');
    assert(res.summary.includes('Erro de conexao com banco'));
  });

  // 3. AI-01: Fallback seguro em erros do provedor (timeout, quota, 503)
  test('AI-01: Fallback seguro - Timeout no provedor transfere para humano com resumo interno', async () => {
    const { generateAIResponse } = load('services/AIServices/AIService.ts');

    const ticket = await Ticket.create({
      id: 101,
      status: 'pending',
      contactId: 1,
      companyId: 1,
      queueId: 1
    });

    const result = await generateAIResponse({
      prompt,
      ticket,
      contact,
      userMessage: 'Preciso de ajuda urgente no sistema de vendas',
      timeoutMs: 1 // forcar timeout imediato
    });

    assert.equal(result.transferQueue, true);
    assert.equal(result.isFallback, true);
    assert(result.text.includes('Estou transferindo seu atendimento para a nossa equipe humana'));
    assert(result.summary.includes('Timeout'));
    assert(result.summary.includes('Preciso de ajuda urgente no sistema de vendas'));
  });

  test('AI-01: Fallback seguro - Chave de API ausente transfere deterministica para humano', async () => {
    const { generateAIResponse } = load('services/AIServices/AIService.ts');

    const promptNoKey = await Prompt.create({
      id: 2,
      name: 'Sem Chave',
      prompt: 'Teste',
      provider: 'openai',
      apiKey: '',
      queueId: 1,
      companyId: 1,
      voice: 'texto'
    });

    const ticket = await Ticket.create({
      id: 102,
      status: 'pending',
      contactId: 1,
      companyId: 1,
      queueId: 1
    });

    const result = await generateAIResponse({
      prompt: promptNoKey,
      ticket,
      contact,
      userMessage: 'Ola'
    });

    assert.equal(result.transferQueue, true);
    assert.equal(result.isFallback, true);
    assert.equal(result.fallbackReason, 'MISSING_API_KEY');
    assert(result.summary.includes('Chave de API de IA não configurada'));
  });

  // 4. AI-01: Validacao de audio no servidor (D-07: max 10 min e 20 MB)
  test('AI-01: Audio validation - Audio superior a 10 min (600s) e rejeitado para IA e vai para humano', async () => {
    const { validateAudioForAI } = load('services/AIServices/AIAudioValidator.ts');
    const { generateAIResponse } = load('services/AIServices/AIService.ts');

    const testAudioFile = path.join(temp, 'long-audio.ogg');
    fs.writeFileSync(testAudioFile, Buffer.alloc(1024)); // 1 KB

    const validation = await validateAudioForAI(testAudioFile, {
      mockDurationSeconds: 605 // 10 minutos e 5 segundos
    });

    assert.equal(validation.valid, false);
    assert.equal(validation.reason, 'DURATION_EXCEEDS_LIMIT');

    // Ao chamar generateAIResponse com audio excedente
    const ticket = await Ticket.create({
      id: 103,
      status: 'pending',
      contactId: 1,
      companyId: 1,
      queueId: 1
    });

    // Mockar probeAudioDurationServerSide
    const audioValModule = load('services/AIServices/AIAudioValidator.ts');
    const origProbe = audioValModule.probeAudioDurationServerSide;
    audioValModule.probeAudioDurationServerSide = async () => 610;

    const result = await generateAIResponse({
      prompt,
      ticket,
      contact,
      audioFilePath: testAudioFile
    });

    audioValModule.probeAudioDurationServerSide = origProbe;

    assert.equal(result.transferQueue, true);
    assert.equal(result.isFallback, true);
    assert(result.text.includes('Identificamos que seu áudio possui mais de 10 minutos'));
    assert(result.summary.includes('Áudio superior a 10 minutos'));
  });

  // 5. AI-01: Teto mensal de orcamento de IA
  test('AI-01: Orcamento - Teto mensal atingido bloqueia chamada a IA e encaminha para humano', async () => {
    const { checkCompanyAIBudget } = load('services/AIServices/AIBudgetService.ts');
    const { generateAIResponse } = load('services/AIServices/AIService.ts');

    const companyWithBudget = await Company.create({
      id: 2,
      name: 'Empresa Orcamento Excedido',
      status: true,
      aiMonthlyBudgetLimit: 10.0,
      aiMonthlySpent: 10.5,
      aiBudgetPeriod: '2026-10',
      aiRequestsCount: 50
    });

    const budgetCheck = await checkCompanyAIBudget(2);
    assert.equal(budgetCheck.allowed, false);
    assert.equal(budgetCheck.reason, 'MONTHLY_BUDGET_EXCEEDED');

    const ticket = await Ticket.create({
      id: 104,
      status: 'pending',
      contactId: 1,
      companyId: 2,
      queueId: 1
    });

    const result = await generateAIResponse({
      prompt,
      ticket,
      contact,
      userMessage: 'Ajuda'
    });

    assert.equal(result.transferQueue, true);
    assert.equal(result.isFallback, true);
    assert.equal(result.fallbackReason, 'MONTHLY_BUDGET_EXCEEDED');
    assert(result.summary.includes('Teto orçamentário mensal de IA atingido'));
  });

  // 6. OPS-04: Calculo de expediente no fuso America/Campo_Grande (D-08)
  test('OPS-04: Horario util - Sabado 11h55 -> Segunda 08h05 sem feriado = exatamente 10 minutos uteis', () => {
    const { addBusinessMinutes, calculateBusinessMinutesBetween } = load('services/ScheduleServices/BusinessHoursService.ts');

    // 24/10/2026 e Sabado. 11h55 no fuso America/Campo_Grande (UTC-4) corresponde a 15h55 UTC
    const sabado1155 = new Date('2026-10-24T15:55:00.000Z');
    const targetDate = addBusinessMinutes(sabado1155, 10);

    // 26/10/2026 e Segunda. 08h05 no fuso America/Campo_Grande (UTC-4) corresponde a 12h05 UTC
    assert.equal(targetDate.toISOString(), '2026-10-26T12:05:00.000Z');

    const elapsed = calculateBusinessMinutesBetween(sabado1155, targetDate);
    assert.equal(elapsed, 10);
  });

  test('OPS-04: Horario util - Pausa fora do expediente e retomada na abertura', () => {
    const { calculateBusinessMinutesBetween, isBusinessTime } = load('services/ScheduleServices/BusinessHoursService.ts');

    // Sexta-feira 23/10/2026 as 16h58 (20h58 UTC) -> faltam 2 minutos para fechar as 17h00
    const sexta1658 = new Date('2026-10-23T20:58:00.000Z');
    assert.equal(isBusinessTime(sexta1658), true);

    // Sexta-feira 17h30 (21h30 UTC) -> fechado
    const sexta1730 = new Date('2026-10-23T21:30:00.000Z');
    assert.equal(isBusinessTime(sexta1730), false);

    // Minutos uteis entre 16h58 e 17h30: devem ser exatamente 2 minutos! (16h58 as 17h00)
    const elapsedSexta = calculateBusinessMinutesBetween(sexta1658, sexta1730);
    assert.equal(elapsedSexta, 2);

    // Domingo 25/10/2026 as 10h00 -> fechado
    const domingo1000 = new Date('2026-10-25T14:00:00.000Z');
    assert.equal(isBusinessTime(domingo1000), false);
    const elapsedFimDeSemana = calculateBusinessMinutesBetween(sexta1658, domingo1000);
    // 2 minutos de sexta + 240 minutos de sabado (08h as 12h) = 242 minutos
    assert.equal(elapsedFimDeSemana, 242);
  });

  test('OPS-04: Horario util - Feriado suspende contagem', () => {
    const { addBusinessMinutes } = load('services/ScheduleServices/BusinessHoursService.ts');

    // Sabado 11h55 -> Se segunda-feira (26/10) for feriado, deve pular para terca-feira 27/10 as 08h05!
    const sabado1155 = new Date('2026-10-24T15:55:00.000Z');
    const holidays = ['2026-10-26'];
    const targetWithHoliday = addBusinessMinutes(sabado1155, 10, holidays);

    // Terca-feira 27/10/2026 as 08h05 UTC-4 = 12h05 UTC
    assert.equal(targetWithHoliday.toISOString(), '2026-10-27T12:05:00.000Z');
  });

  // 7. OPS-04: Disparo e desduplicacao de alertas de espera
  test('OPS-04: Alerta de espera - Disparo apos 10 minutos uteis e desduplicacao por episodio', async () => {
    const { checkAndTriggerQueueWaitAlerts } = load('services/TicketServices/QueueWaitAlertService');

    // Ticket na fila de suporte (queueId: 1)
    const waitingSince = new Date('2026-10-22T13:00:00.000Z'); // 09:00 Campo Grande
    const checkTime = new Date('2026-10-22T13:12:00.000Z'); // 09:12 Campo Grande (12 min uteis)

    const ticket = await Ticket.create({
      id: 201,
      status: 'pending',
      contactId: 1,
      companyId: 1,
      queueId: 1,
      lastClientMessageAt: waitingSince,
      currentWaitEpisodeId: 'ep-wait-201'
    });

    const alerts = await checkAndTriggerQueueWaitAlerts({
      companyId: 1,
      now: checkTime
    });

    assert.equal(alerts.length, 1);
    const alert = alerts[0];
    assert.equal(alert.ticketId, 201);
    assert.equal(alert.queueId, 1);
    assert.equal(alert.businessMinutesWaiting, 12);
    assert.deepEqual(alert.recipientUserIds, [10]); // Supervisor Suporte (id 10)
    assert.equal(alert.status, 'pending_response');

    // Desduplicação: segunda checagem as 09:15 NÃO deve disparar alerta duplicado!
    const secondCheckTime = new Date('2026-10-22T13:15:00.000Z');
    const alertsSecond = await checkAndTriggerQueueWaitAlerts({
      companyId: 1,
      now: secondCheckTime
    });

    assert.equal(alertsSecond.length, 0);

    const totalInDb = await QueueWaitAlert.count({ where: { ticketId: 201, episodeId: 'ep-wait-201' } });
    assert.equal(totalInDb, 1);
  });

  test('OPS-04: Alerta de espera - Fila sem supervisor escala para administradores (destinatario substituto)', async () => {
    const { checkAndTriggerQueueWaitAlerts } = load('services/TicketServices/QueueWaitAlertService');

    // Fila Comercial (queueId: 3) nao tem supervisor cadastrado
    const waitingSince = new Date('2026-10-22T13:00:00.000Z');
    const checkTime = new Date('2026-10-22T13:15:00.000Z'); // 15 min uteis

    const ticket = await Ticket.create({
      id: 202,
      status: 'pending',
      contactId: 1,
      companyId: 1,
      queueId: 3,
      lastClientMessageAt: waitingSince,
      currentWaitEpisodeId: 'ep-wait-202'
    });

    const alerts = await checkAndTriggerQueueWaitAlerts({
      companyId: 1,
      now: checkTime
    });

    assert.equal(alerts.length, 1);
    const alert = alerts[0];
    assert.equal(alert.queueId, 3);
    assert.deepEqual(alert.recipientUserIds, [1]); // Admin (id 1) como substituto
  });

  test('OPS-04: Semantica - Assumir ticket sem responder NAO encerra a espera', async () => {
    const { checkAndTriggerQueueWaitAlerts } = load('services/TicketServices/QueueWaitAlertService');
    const UpdateTicketService = load('services/TicketServices/UpdateTicketService.ts').default;

    // Ticket na fila de suporte
    const waitingSince = new Date('2026-10-22T13:00:00.000Z');
    const ticket = await Ticket.create({
      id: 203,
      status: 'pending',
      contactId: 1,
      companyId: 1,
      queueId: 1,
      lastClientMessageAt: waitingSince,
      currentWaitEpisodeId: 'ep-wait-203'
    });

    // Atendente assume o ticket (status open e userId definido), porem NAO responde
    await UpdateTicketService({
      ticketData: { status: 'open', userId: 10 },
      ticketId: 203,
      companyId: 1
    });

    const checkTime = new Date('2026-10-22T13:12:00.000Z'); // 12 min uteis
    const alerts = await checkAndTriggerQueueWaitAlerts({
      companyId: 1,
      now: checkTime
    });

    // Mesmo com userId definido (assumido), a espera permanece ativa e dispara o alerta
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].ticketId, 203);
  });

  test('OPS-04: Semantica - Resposta humana encerra espera e resolve alerta pendente', async () => {
    const { resolveQueueWaitAlert } = load('services/TicketServices/QueueWaitAlertService');

    // Verificar alerta pendente do ticket 203
    const alertPending = await QueueWaitAlert.findOne({ where: { ticketId: 203, status: 'pending_response' } });
    assert(alertPending);

    // Atendente responde o cliente
    const responseTime = new Date('2026-10-22T13:14:00.000Z');
    await resolveQueueWaitAlert(203, 10, responseTime);

    const alertResolved = await QueueWaitAlert.findOne({ where: { ticketId: 203 } });
    assert.equal(alertResolved.status, 'resolved');
    assert.equal(alertResolved.resolvedByUserId, 10);
    assert.equal(new Date(alertResolved.resolvedAt).toISOString(), responseTime.toISOString());

    const reloadedTicket = await Ticket.findByPk(203);
    assert.equal(reloadedTicket.currentWaitEpisodeId, null);
  });

  test('OPS-04: API REST - Supervisor ve apenas alertas de suas filas e Atendente recebe 403', async () => {
    const { listQueueWaitAlerts } = load('services/TicketServices/QueueWaitAlertService');

    // Supervisor de suporte (id 10) possui fila 1
    const alertsSupSuporte = await listQueueWaitAlerts(1, {
      id: 10,
      profile: 'supervisor',
      queues: [{ id: 1 }]
    });

    assert(alertsSupSuporte.length > 0);
    assert(alertsSupSuporte.every(a => a.queueId === 1));

    // Supervisor de suporte tentando filtrar fila alheia (fila 2) deve receber ERR_NO_PERMISSION
    await assert.rejects(
      async () => {
        await listQueueWaitAlerts(1, { id: 10, profile: 'supervisor', queues: [{ id: 1 }] }, { queueId: 2 });
      },
      /ERR_NO_PERMISSION/
    );

    // Atendente comum (user) tentando acessar deve receber ERR_NO_PERMISSION
    await assert.rejects(
      async () => {
        await listQueueWaitAlerts(1, { id: 99, profile: 'user', queues: [{ id: 1 }] });
      },
      /ERR_NO_PERMISSION/
    );

    // Administrador tem visibilidade ampla de todas as filas da sua empresa
    const adminAlerts = await listQueueWaitAlerts(1, { id: 1, profile: 'admin' });
    const queueIds = new Set(adminAlerts.map(a => a.queueId));
    assert(queueIds.has(1));
    assert(queueIds.has(3));
  });

  // Run all registered tests sequentially
  let passed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      passed++;
      console.log(`PASS ${t.name}`);
    } catch (err) {
      console.error(`FAIL ${t.name}`);
      console.error(err);
      process.exit(1);
    }
  }

  console.log(`RESULT ${passed}/${tests.length} passed; isolated PostgreSQL/WASM, zero external services`);
  process.exit(0);
})().catch(err => {
  console.error('Test runner bootstrap error:', err);
  process.exit(1);
});
