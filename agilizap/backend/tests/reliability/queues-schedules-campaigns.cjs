/* Isolated reliability tests for Bull queues: Schedule retries, Campaign delays, and LGPD opt-out (PGlite, zero external services). */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const crypto = require("node:crypto");
const ts = require("typescript");
const { PGlite } = require("@electric-sql/pglite");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = crypto.randomBytes(48).toString("base64");
process.env.JWT_REFRESH_SECRET = crypto.randomBytes(48).toString("base64");
process.env.FRONTEND_URL = "http://localhost:3000";
process.env.BACKEND_URL = "http://localhost:8080";
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ticket-queues-test-"));
process.env.TEST_MEDIA_ROOT = temp;

const unhandledRejections = [];
process.on("unhandledRejection", reason => {
  unhandledRejections.push(reason);
});

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

const source = path.resolve(__dirname, "../../src");
let database;
let sendScheduleError = null;
const sentScheduleMessages = [];
const sentWbotMessages = [];
const emittedEvents = [];

const fakeIO = {
  to: () => fakeIO,
  emit: (event, payload) => emittedEvents.push({ event, payload })
};

/**
 * Faithful in-memory Bull Queue simulation:
 * - Enforces jobId collision/deduplication while a job remains in waiting/delayed/failed/completed.
 * - Honors removeOnComplete and removeOnFail when simulating job execution.
 */
class FakeBullQueue {
  constructor(name) {
    this.name = name;
    this.jobsById = new Map();
    this.addedCalls = [];
    this.handlers = new Map();
    this.seq = 1;
  }

  process(jobName, handler) {
    this.handlers.set(jobName, handler);
  }

  async add(jobName, data, opts = {}) {
    if (opts.repeat) {
      return { id: opts.repeat.key || `repeat-${this.seq++}`, name: jobName, data, opts };
    }
    const id = opts.jobId != null ? String(opts.jobId) : `job-${this.seq++}`;
    this.addedCalls.push({ name: jobName, data, opts, accepted: !this.jobsById.has(id) });

    if (this.jobsById.has(id)) {
      // Bull silently ignores .add() when a job with the same jobId still exists (e.g. failed without removeOnFail)
      return this.jobsById.get(id);
    }

    const job = {
      id,
      name: jobName,
      data,
      opts,
      state: opts.delay > 0 ? "delayed" : "waiting"
    };
    this.jobsById.set(id, job);
    return job;
  }

  async runJob(job, handler) {
    try {
      await handler(job);
      if (job.opts.removeOnComplete) {
        this.jobsById.delete(job.id);
      } else {
        job.state = "completed";
      }
    } catch (err) {
      if (job.opts.removeOnFail) {
        this.jobsById.delete(job.id);
      } else {
        job.state = "failed";
      }
      throw err;
    }
  }

  async getJob(id) {
    return this.jobsById.get(String(id)) || null;
  }

  clean() {}

  async close() {}
}

const fakeQueues = [];

const originalLoad = Module._load;
Module._load = function (request, parent, ...rest) {
  if (request === "bull") {
    return function FakeBull(name) {
      const q = new FakeBullQueue(name);
      fakeQueues.push(q);
      return q;
    };
  }
  if (request === "cron") {
    return {
      CronJob: class {
        start() {}
      }
    };
  }
  if (request === "@sentry/node") {
    return { captureException: () => {} };
  }

  let resolved;
  try {
    resolved = Module._resolveFilename(request, parent);
  } catch (_) {
    return originalLoad.call(this, request, parent, ...rest);
  }

  if (resolved === path.join(source, "database/index.ts")) {
    return { __esModule: true, default: database };
  }
  if (resolved === path.join(source, "libs/cache.ts")) {
    return {
      __esModule: true,
      cacheLayer: { get: async () => null, set: async () => {}, del: async () => {}, delFromPattern: async () => {} }
    };
  }
  if (resolved === path.join(source, "libs/socket.ts")) {
    return { __esModule: true, getIO: () => fakeIO, initIO: () => fakeIO };
  }
  if (resolved === path.join(source, "utils/logger.ts")) {
    const noop = () => {};
    return { logger: { info: noop, error: noop, warn: noop, debug: noop } };
  }
  if (resolved === path.join(source, "helpers/GetDefaultWhatsApp.ts")) {
    return {
      __esModule: true,
      default: async companyId => {
        const Whatsapp = load("models/Whatsapp.ts").default;
        return Whatsapp.findOne({ where: { companyId } });
      }
    };
  }
  if (resolved === path.join(source, "helpers/GetWhatsappWbot.ts")) {
    return {
      __esModule: true,
      default: async whatsapp => ({
        user: { id: "5567999990000@s.whatsapp.net" },
        sendMessage: async (jid, payload) => {
          sentWbotMessages.push({ whatsappId: whatsapp?.id, jid, payload });
          return { key: { id: "wamid-" + crypto.randomBytes(4).toString("hex") } };
        }
      })
    };
  }
  if (resolved === path.join(source, "helpers/SendMessage.ts")) {
    return {
      __esModule: true,
      SendMessage: async (whatsapp, messageData) => {
        if (sendScheduleError) {
          throw sendScheduleError;
        }
        sentScheduleMessages.push({ whatsappId: whatsapp?.id, messageData });
        return { id: "sent-" + Date.now() };
      }
    };
  }

  return originalLoad.call(this, request, parent, ...rest);
};

const load = name => require(path.join(source, name));
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

(async () => {
  const pg = new PGlite();
  await pg.waitReady;

  const { Sequelize } = require("sequelize-typescript");
  database = new Sequelize({
    dialect: "postgres",
    database: "queues_test_memory",
    logging: false,
    databaseVersion: "17.0.0",
    pool: { max: 1, min: 0 }
  });

  const connection = {
    query(sql, parameters, callback) {
      if (typeof parameters === "function") {
        callback = parameters;
        parameters = [];
      }
      const query = parameters?.length
        ? pg.query(sql, parameters).then(r => [r])
        : pg.exec(sql);
      query.then(
        results =>
          callback(
            null,
            results.map(r => ({
              ...r,
              rowCount: r.affectedRows ?? r.rows.length
            }))
          ),
        callback
      );
    }
  };
  database.connectionManager.getConnection = () =>
    require("bluebird").resolve(connection);
  database.connectionManager.releaseConnection = () =>
    require("bluebird").resolve();

  const allModelFiles = fs
    .readdirSync(path.join(source, "models"))
    .filter(n => n.endsWith(".ts"));
  const models = allModelFiles.map(n => load("models/" + n).default);
  database.addModels(models);

  const stage1Added = [
    "resetTokenHash",
    "resetTokenExpiresAt",
    "blocked",
    "mfaLastStep",
    "mustChangePassword"
  ];
  const stage2AddedTickets = [
    "closedAt",
    "legalHold",
    "legalHoldReason",
    "legalHoldAt"
  ];
  const stage2AddedContacts = ["optOutCampaign"];
  const stage3AddedSchedules = [
    "interruptionReason",
    "reviewedBy",
    "reviewedAt",
    "retries"
  ];
  const stage3AddedMessages = [
    "status",
    "operationId",
    "uncertainReason",
    "retries"
  ];
  const stage3AddedWhatsapps = [
    "disconnectReason",
    "actionRequired",
    "lastDisconnectedAt"
  ];

  for (const model of models) {
    if (model.name === "AuditLog") continue;
    const attributes = Object.fromEntries(
      Object.entries(model.rawAttributes)
        .filter(([name, attr]) => {
          if (attr.type.key === "VIRTUAL") return false;
          if (model.name === "User" && stage1Added.includes(name)) return false;
          if (model.name === "Ticket" && stage2AddedTickets.includes(name))
            return false;
          if (
            (model.name === "Contact" || model.name === "ContactListItem") &&
            stage2AddedContacts.includes(name)
          )
            return false;
          if (model.name === "Schedule" && stage3AddedSchedules.includes(name))
            return false;
          if (model.name === "Message" && stage3AddedMessages.includes(name))
            return false;
          if (model.name === "Whatsapp" && stage3AddedWhatsapps.includes(name))
            return false;
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
    await database
      .getQueryInterface()
      .createTable(model.getTableName(), attributes);
  }

  await database
    .getQueryInterface()
    .addColumn("Users", "resetPassword", {
      type: require("sequelize").STRING,
      allowNull: true
    });

  await load("database/migrations/20261021000000-security-access.ts").up(
    database.getQueryInterface()
  );
  await load("database/migrations/20261022000000-data-governance.ts").up(
    database.getQueryInterface()
  );
  await load("database/migrations/20261022010000-service-reliability.ts").up(
    database.getQueryInterface()
  );

  const Plan = load("models/Plan.ts").default;
  const Company = load("models/Company.ts").default;
  const User = load("models/User.ts").default;
  const Whatsapp = load("models/Whatsapp.ts").default;
  const Contact = load("models/Contact.ts").default;
  const Schedule = load("models/Schedule.ts").default;
  const ContactList = load("models/ContactList.ts").default;
  const ContactListItem = load("models/ContactListItem.ts").default;
  const Campaign = load("models/Campaign.ts").default;
  const CampaignSetting = load("models/CampaignSetting.ts").default;
  const CampaignShipping = load("models/CampaignShipping.ts").default;

  const {
    sendScheduledMessages,
    campaignQueue,
    handleVerifySchedules,
    handleSendScheduledMessage,
    handleVerifyCampaigns,
    getCampaign,
    handleProcessCampaign,
    handlePrepareContact,
    handleDispatchCampaign
  } = load("queues.ts");

  const plan = await Plan.create({
    name: "Plano Filas",
    users: 10,
    connections: 5,
    queues: 5,
    value: 0
  });
  const company = await Company.create({
    name: "Empresa Filas",
    planId: plan.id,
    status: true
  });
  const user = await User.create({
    name: "Operador",
    email: "op@filas.local",
    passwordHash: "hash",
    profile: "admin",
    companyId: company.id
  });
  const whatsapp = await Whatsapp.create({
    name: "WPP Principal",
    status: "CONNECTED",
    isDefault: true,
    companyId: company.id
  });

  test("Q-01: Agendamento falho e removido com removeOnFail:true e permite tentativas 2 e 3 sem colisao de jobId", async () => {
    const contact = await Contact.create({
      name: "Cliente Retry",
      number: "5567999991111",
      companyId: company.id
    });

    const schedule = await Schedule.create({
      body: "Lembrete de agendamento",
      sendAt: new Date(Date.now() + 2000),
      contactId: contact.id,
      companyId: company.id,
      userId: user.id,
      status: "PENDENTE"
    });

    // Tentativa 1: falha transitoria
    sendScheduleError = new Error("SOCKET_DISCONNECTED");
    await handleVerifySchedules({});
    const job1 = await sendScheduledMessages.getJob(`schedule-${schedule.id}`);
    assert.ok(job1, "Job 1 deve estar enfileirado");
    assert.equal(job1.opts.removeOnComplete, true);
    assert.equal(
      job1.opts.removeOnFail,
      true,
      "removeOnFail:true obrigatorio para liberar jobId apos falha"
    );

    await assert.rejects(
      () => sendScheduledMessages.runJob(job1, handleSendScheduledMessage),
      /SOCKET_DISCONNECTED/
    );
    await schedule.reload();
    assert.equal(schedule.status, "PENDENTE");
    assert.equal(schedule.retries, 1);
    assert.equal(
      await sendScheduledMessages.getJob(`schedule-${schedule.id}`),
      null,
      "Job falho deve ter sido removido do Bull"
    );

    // Tentativa 2: nova varredura enfileira sem colisao e falha novamente
    await handleVerifySchedules({});
    const job2 = await sendScheduledMessages.getJob(`schedule-${schedule.id}`);
    assert.ok(job2, "Job 2 deve ser aceito pelo Bull apos remocao do job falho");
    assert.equal(
      sendScheduledMessages.addedCalls[sendScheduledMessages.addedCalls.length - 1].accepted,
      true
    );

    await assert.rejects(
      () => sendScheduledMessages.runJob(job2, handleSendScheduledMessage),
      /SOCKET_DISCONNECTED/
    );
    await schedule.reload();
    assert.equal(schedule.status, "PENDENTE");
    assert.equal(schedule.retries, 2);

    // Tentativa 3: sucesso no envio
    sendScheduleError = null;
    await handleVerifySchedules({});
    const job3 = await sendScheduledMessages.getJob(`schedule-${schedule.id}`);
    assert.ok(job3, "Job 3 deve ser aceito pelo Bull");
    await sendScheduledMessages.runJob(job3, handleSendScheduledMessage);

    await schedule.reload();
    assert.equal(schedule.status, "ENVIADA");
    assert.ok(schedule.sentAt, "sentAt deve ser preenchido no sucesso");
    assert.equal(sentScheduleMessages.length, 1);

    // Segundo agendamento: esgota 3 tentativas e vai para ERRO
    const scheduleFail = await Schedule.create({
      body: "Agendamento que esgota retries",
      sendAt: new Date(Date.now() + 2000),
      contactId: contact.id,
      companyId: company.id,
      userId: user.id,
      status: "PENDENTE"
    });
    sendScheduleError = new Error("PERMANENT_ERROR");
    for (let attempt = 1; attempt <= 3; attempt++) {
      await handleVerifySchedules({});
      const j = await sendScheduledMessages.getJob(`schedule-${scheduleFail.id}`);
      assert.ok(j, `Tentativa ${attempt} deve estar na fila`);
      await assert.rejects(
        () => sendScheduledMessages.runJob(j, handleSendScheduledMessage),
        /PERMANENT_ERROR/
      );
    }
    sendScheduleError = null;
    await scheduleFail.reload();
    assert.equal(scheduleFail.retries, 3);
    assert.equal(scheduleFail.status, "ERRO");
  });

  test("Q-02: handleVerifyCampaigns passa jobId e delay nas opcoes do Bull e evita disparos duplicados", async () => {
    const contactList = await ContactList.create({
      name: "Lista Agendada",
      companyId: company.id
    });
    const scheduledAt = new Date(Date.now() + 20 * 60 * 1000);
    const campaign = await Campaign.create({
      name: "Campanha Futura 20min",
      status: "PROGRAMADA",
      scheduledAt,
      companyId: company.id,
      contactListId: contactList.id,
      whatsappId: whatsapp.id,
      message1: "Ola {nome}"
    });

    campaignQueue.addedCalls.length = 0;
    await handleVerifyCampaigns({});

    const job = await campaignQueue.getJob(`campaign-${campaign.id}`);
    assert.ok(job, "Job deve usar jobId campaign-<id> nas opcoes do Bull");
    assert.equal(job.name, "ProcessCampaign");
    assert.equal(job.opts.removeOnComplete, true);
    assert.equal(job.opts.removeOnFail, true);
    assert.ok(
      job.opts.delay >= 19 * 60 * 1000 && job.opts.delay <= 20 * 60 * 1000 + 5000,
      `Delay nas opcoes do Bull deve ser ~20min, recebido ${job.opts.delay}ms`
    );

    // Segunda varredura 20s depois enquanto PROGRAMADA nao duplica na fila
    await handleVerifyCampaigns({});
    assert.equal(campaignQueue.addedCalls.length, 2);
    assert.equal(campaignQueue.addedCalls[1].accepted, false);

    // Limpa job pendente da simulacao
    campaignQueue.jobsById.delete(`campaign-${campaign.id}`);
  });

  test("Q-03: handleProcessCampaign mantem intervalos em segundos (sem multiplicar por 1000x)", async () => {
    await CampaignSetting.create({
      key: "messageInterval",
      value: JSON.stringify(20),
      companyId: company.id
    });
    await CampaignSetting.create({
      key: "longerIntervalAfter",
      value: JSON.stringify(2),
      companyId: company.id
    });
    await CampaignSetting.create({
      key: "greaterInterval",
      value: JSON.stringify(60),
      companyId: company.id
    });

    const contactList = await ContactList.create({
      name: "Lista Delays",
      companyId: company.id
    });
    for (let i = 1; i <= 5; i++) {
      await ContactListItem.create({
        name: `Contato ${i}`,
        number: `556799990000${i}`,
        email: `c${i}@test.local`,
        isWhatsappValid: true,
        optOutCampaign: false,
        companyId: company.id,
        contactListId: contactList.id
      });
    }

    const campaign = await Campaign.create({
      name: "Campanha Intervalos",
      status: "PROGRAMADA",
      scheduledAt: new Date(Date.now() - 1000),
      companyId: company.id,
      contactListId: contactList.id,
      whatsappId: whatsapp.id,
      message1: "Mensagem {nome}"
    });

    campaignQueue.addedCalls.length = 0;
    await handleProcessCampaign({ data: { id: campaign.id, delay: 0 } });

    const prepareCalls = campaignQueue.addedCalls.filter(
      c => c.name === "PrepareContact"
    );
    assert.equal(prepareCalls.length, 5);

    // Esperado com i = 0,1,2 -> +20s cada (20s, 40s, 60s); i = 3,4 (>2) -> +60s cada (120s, 180s)
    const delaysMs = prepareCalls.map(c => c.data.delay);
    const expectedSeconds = [20, 40, 60, 120, 180];
    for (let i = 0; i < expectedSeconds.length; i++) {
      const targetMs = expectedSeconds[i] * 1000;
      assert.ok(
        Math.abs(delaysMs[i] - targetMs) <= 3000,
        `Contato ${i}: delay esperado ~${targetMs}ms, recebido ${delaysMs[i]}ms`
      );
      assert.ok(
        delaysMs[i] < 10 * 60 * 1000,
        `Contato ${i}: delay nao pode explodir para horas (${delaysMs[i]}ms)`
      );
    }

    await campaign.reload();
    assert.equal(campaign.status, "EM_ANDAMENTO");

    // Nao processa campanha CANCELADA
    const cancelled = await Campaign.create({
      name: "Campanha Cancelada",
      status: "CANCELADA",
      scheduledAt: new Date(),
      companyId: company.id,
      contactListId: contactList.id,
      whatsappId: whatsapp.id,
      message1: "Nao enviar"
    });
    campaignQueue.addedCalls.length = 0;
    await handleProcessCampaign({ data: { id: cancelled.id, delay: 0 } });
    assert.equal(campaignQueue.addedCalls.length, 0);
  });

  test("Q-04: LGPD optOutCampaign filtra getCampaign e bloqueia disparo em handlePrepareContact e handleDispatchCampaign", async () => {
    const list = await ContactList.create({
      name: "Lista LGPD",
      companyId: company.id
    });

    const itemOk = await ContactListItem.create({
      name: "Aceita Campanha",
      number: "5567999910001",
      isWhatsappValid: true,
      optOutCampaign: false,
      companyId: company.id,
      contactListId: list.id
    });
    const itemOptOut = await ContactListItem.create({
      name: "Pediu OptOut",
      number: "5567999910002",
      isWhatsappValid: true,
      optOutCampaign: true,
      companyId: company.id,
      contactListId: list.id
    });
    const itemLateOptOut = await ContactListItem.create({
      name: "OptOut Tardio",
      number: "5567999910003",
      isWhatsappValid: true,
      optOutCampaign: false,
      companyId: company.id,
      contactListId: list.id
    });
    const itemContactTableOptOut = await ContactListItem.create({
      name: "OptOut Tabela Contacts",
      number: "5567999910004",
      isWhatsappValid: true,
      optOutCampaign: false,
      companyId: company.id,
      contactListId: list.id
    });
    await Contact.create({
      name: "OptOut Tabela Contacts",
      number: "5567999910004",
      companyId: company.id,
      optOutCampaign: true
    });

    const campaign = await Campaign.create({
      name: "Campanha LGPD",
      status: "PROGRAMADA",
      scheduledAt: new Date(),
      companyId: company.id,
      contactListId: list.id,
      whatsappId: whatsapp.id,
      message1: "Promocao {nome}"
    });

    // 1. getCampaign exclui itemOptOut
    const loaded = await getCampaign(campaign.id);
    const loadedIds = loaded.contactList.contacts.map(c => c.id);
    assert.ok(loadedIds.includes(itemOk.id));
    assert.ok(!loadedIds.includes(itemOptOut.id), "optOutCampaign:true deve ser filtrado em getCampaign");

    // 2. handlePrepareContact tambem bloqueia item com optOutCampaign:true ou Contact.optOutCampaign:true
    campaignQueue.addedCalls.length = 0;
    await handlePrepareContact({
      data: { contactId: itemOptOut.id, campaignId: campaign.id, delay: 0, variables: [] }
    });
    await handlePrepareContact({
      data: { contactId: itemContactTableOptOut.id, campaignId: campaign.id, delay: 0, variables: [] }
    });
    assert.equal(
      campaignQueue.addedCalls.filter(c => c.name === "DispatchCampaign").length,
      0,
      "PrepareContact nao deve enfileirar DispatchCampaign para contato em opt-out"
    );

    // 3. Simula contato que estava ativo no PrepareContact, mas deu opt-out antes do DispatchCampaign
    await handlePrepareContact({
      data: { contactId: itemLateOptOut.id, campaignId: campaign.id, delay: 0, variables: [] }
    });
    const shipping = await CampaignShipping.findOne({
      where: { campaignId: campaign.id, contactId: itemLateOptOut.id }
    });
    assert.ok(shipping, "CampaignShipping criado enquanto contato nao tinha opt-out");

    await itemLateOptOut.update({ optOutCampaign: true });
    sentWbotMessages.length = 0;
    await handleDispatchCampaign({
      data: {
        campaignId: campaign.id,
        campaignShippingId: shipping.id,
        contactListItemId: itemLateOptOut.id
      }
    });
    assert.equal(
      sentWbotMessages.length,
      0,
      "handleDispatchCampaign deve bloquear envio se contato pediu opt-out apos agendamento"
    );
    await shipping.reload();
    assert.equal(shipping.deliveredAt, null);

    // 4. Lista onde TODOS os contatos tem optOutCampaign:true nao quebra getCampaign (required:false)
    const allOptOutList = await ContactList.create({
      name: "Lista Todos OptOut",
      companyId: company.id
    });
    await ContactListItem.create({
      name: "Unico OptOut",
      number: "5567999910099",
      isWhatsappValid: true,
      optOutCampaign: true,
      companyId: company.id,
      contactListId: allOptOutList.id
    });
    const emptyCampaign = await Campaign.create({
      name: "Campanha Sem Elegiveis",
      status: "PROGRAMADA",
      scheduledAt: new Date(),
      companyId: company.id,
      contactListId: allOptOutList.id,
      whatsappId: whatsapp.id,
      message1: "Teste"
    });
    const loadedEmpty = await getCampaign(emptyCampaign.id);
    assert.ok(loadedEmpty && loadedEmpty.contactList, "getCampaign nao pode retornar null por INNER JOIN");
    assert.equal(loadedEmpty.contactList.contacts.length, 0);

    await handleProcessCampaign({ data: { id: emptyCampaign.id, delay: 0 } });
    await emptyCampaign.reload();
    assert.equal(emptyCampaign.status, "FINALIZADA");
  });

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log("PASS " + name);
    } catch (err) {
      console.error("FAIL " + name);
      console.error(err);
      process.exit(1);
    }
  }

  assert.equal(
    unhandledRejections.length,
    0,
    `Unhandled rejections detectadas: ${unhandledRejections.length}`
  );
  console.log(
    `RESULT ${tests.length}/${tests.length} passed; isolated PostgreSQL/WASM, zero external services`
  );
  try {
    fs.rmSync(temp, { recursive: true, force: true });
  } catch (_) {}
  process.exit(0);
})().catch(err => {
  console.error("FATAL in test harness:");
  console.error(err);
  process.exit(1);
});
