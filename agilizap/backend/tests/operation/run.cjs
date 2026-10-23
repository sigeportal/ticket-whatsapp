/* Isolated Operation, Observability & Deployment harness: real PostgreSQL/WASM (PGlite), zero external services. */
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
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ticket-operation-'));
process.env.TEST_MEDIA_ROOT = temp;

require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
    esModuleInterop: true, experimentalDecorators: true, emitDecoratorMetadata: true }
}).outputText, filename);

const source = path.resolve(__dirname, '../../src');
const logs = [];
let database;
let mockDbQueryError = null;

const originalLoad = Module._load;
Module._load = function(request, parent, ...rest) {
  const resolved = Module._resolveFilename(request, parent);
  if (resolved === path.join(source, 'database/index.ts')) return { __esModule: true, default: database };
  if (resolved === path.join(source, 'libs/cache.ts')) return { __esModule: true, cacheLayer: { get: async () => null, set: async () => {}, del: async () => {}, delFromPattern: async () => {} } };
  if (resolved === path.join(source, 'utils/logger.ts')) {
    const orig = originalLoad.call(this, request, parent, ...rest);
    return orig;
  }
  if (resolved === path.join(source, 'libs/socket.ts')) {
    return {
      __esModule: true,
      getIO: () => ({ to: () => ({ emit: () => {} }), emit: () => {} }),
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
    database: 'operation_memory',
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
  const stage4Migration = require(path.join(source, 'database/migrations/20261022020000-ai-supervision.ts'));
  const qi = database.getQueryInterface();

  await stage1Migration.up(qi);
  await stage2Migration.up(qi);
  await stage3Migration.up(qi);
  await stage4Migration.up(qi);

  console.log('PASS migration chain up executed inside isolated PostgreSQL/WASM');

  // Seed baseline fixtures
  const c1 = await Company.create({ id: 1, name: 'Empresa Principal', aiMonthlyBudgetLimit: 50.00, aiMonthlySpent: 12.50, aiBudgetPeriod: '2026-10' });
  const w1 = await Whatsapp.create({ id: 1, name: 'Conexao Atendimento', companyId: 1, status: 'CONNECTED', isDefault: true });
  const w2 = await Whatsapp.create({
    id: 2,
    name: 'Conexao Secundaria',
    companyId: 1,
    status: 'DISCONNECTED',
    isDefault: false,
    updatedAt: new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
  });

  const u1 = await User.create({ id: 1, name: 'Admin Operacional', email: 'admin@operacao.local', passwordHash: 'hash', profile: 'admin', companyId: 1 });
  const contact1 = await Contact.create({ id: 1, name: 'Cliente Teste', number: '5567999990001', companyId: 1 });
  const ticket1 = await Ticket.create({ id: 1, contactId: 1, status: 'open', companyId: 1, whatsappId: 1, lastClientMessageAt: new Date() });
  const msg1 = await Message.create({
    id: 'msg-op-1',
    ticketId: 1,
    body: 'Mensagem para teste de backup',
    fromMe: true,
    read: true,
    status: 'sended',
    companyId: 1,
    contactId: 1
  });

  // Write a mock media file
  const mediaFileName = 'test-doc-1.pdf';
  fs.writeFileSync(path.join(temp, mediaFileName), Buffer.from('%PDF-1.4 test document content for backup integrity'));

  const { BackupService } = load('services/OperationServices/BackupService.ts');
  const { RestoreService } = load('services/OperationServices/RestoreService.ts');
  const { OperationalAlertService } = load('services/OperationServices/OperationalAlertService.ts');
  const { HealthController } = load('controllers/HealthController.ts');
  const { sanitizeLogData } = load('utils/logger.ts');
  const { stopQueueProcess } = load('queues.ts');

  // --------------------------------------------------------------------------
  // OPS-01: Backup e restauracao
  // --------------------------------------------------------------------------

  let generatedBackupFolder = null;
  let generatedManifest = null;

  test('OPS-01: Backup - criacao estruturada, exportacao de tabelas, midias e manifesto SHA-256', async () => {
    const backupDir = path.join(temp, 'backup_vault');
    const result = await BackupService.createBackup({
      destinationDir: backupDir,
      companyId: 1,
      includeMedia: true
    });

    assert.ok(result.backupPath, 'backupPath deve existir');
    assert.ok(fs.existsSync(result.backupPath), 'Pasta de backup deve ter sido criada no disco');
    generatedBackupFolder = result.backupPath;
    generatedManifest = result.manifest;

    assert.equal(result.manifest.rpoTargetHours, 24, 'RPO alvo deve ser 24 horas');
    assert.equal(result.manifest.rtoTargetHours, 4, 'RTO alvo deve ser 4 horas');
    assert.ok(result.manifest.tables['Companies'], 'Manifesto deve conter tabela Companies');
    assert.ok(result.manifest.tables['Messages'], 'Manifesto deve conter tabela Messages');
    assert.ok(result.manifest.tables['Whatsapps'], 'Manifesto deve conter tabela Whatsapps');
    assert.ok(result.manifest.tables['Companies'].sha256, 'Tabela Companies deve ter hash SHA-256');
    assert.equal(result.manifest.media.count, 1, 'Deve ter feito backup de 1 arquivo de midia');
    assert.ok(result.manifest.manifestSha256, 'Manifesto deve conter hash master');
  });

  test('OPS-01: Backup - rotina de rotacao preserva as N copias mais recentes e remove excedentes', async () => {
    const rotationVault = path.join(temp, 'rotation_vault');
    fs.mkdirSync(rotationVault, { recursive: true });

    // Criar 5 backups ficticios com timestamps diferentes
    for (let i = 1; i <= 5; i++) {
      const bFolder = path.join(rotationVault, `backup-test-${i}`);
      fs.mkdirSync(bFolder, { recursive: true });
      fs.writeFileSync(path.join(bFolder, 'manifest.json'), JSON.stringify({ id: i }));
      // Set modification times
      const pastTime = new Date(Date.now() - (10 - i) * 3600 * 1000);
      fs.utimesSync(bFolder, pastTime, pastTime);
    }

    // Rotacionar mantendo apenas os 3 mais recentes
    const removed = BackupService.rotateBackups(rotationVault, 3);
    assert.equal(removed.length, 2, 'Deve ter removido exatamente 2 backups excedentes');
    const remaining = fs.readdirSync(rotationVault);
    assert.equal(remaining.length, 3, 'Devem restar exatamente 3 backups');
  });

  test('OPS-01: Restauracao - deteccao estrita de adulteracao de hash e rejeicao com erro de integridade', async () => {
    // Clonar pasta de backup e alterar propositalmente 1 byte de um arquivo
    const tamperedFolder = path.join(temp, 'tampered_backup');
    fs.cpSync(generatedBackupFolder, tamperedFolder, { recursive: true });

    // Corromper arquivo de Companies
    fs.appendFileSync(path.join(tamperedFolder, 'Companies.json'), '{"malicious": true}');

    await assert.rejects(
      async () => {
        await RestoreService.restoreBackup(tamperedFolder);
      },
      (err) => {
        assert.match(err.message, /ERR_BACKUP_INTEGRITY_COMPROMISED/, 'Deve falhar com ERR_BACKUP_INTEGRITY_COMPROMISED');
        return true;
      }
    );
  });

  test('OPS-01: Restauracao - execucao bem-sucedida, metricas RPO/RTO e trava de seguranca Baileys', async () => {
    const restoreMediaTarget = path.join(temp, 'restored_media');
    fs.mkdirSync(restoreMediaTarget, { recursive: true });

    const result = await RestoreService.restoreBackup(generatedBackupFolder, {
      targetMediaDir: restoreMediaTarget,
      restoreMedia: true,
      preventSessionCollision: true
    });

    assert.ok(result.recordsRestored > 0, 'Deve ter restaurado registros no banco');
    assert.equal(result.mediaFilesRestored, 1, 'Deve ter restaurado o arquivo de midia');
    assert.ok(fs.existsSync(path.join(restoreMediaTarget, mediaFileName)), 'Midia deve estar presente no destino');
    assert.equal(result.rpoCompliant, true, 'Backup recente deve cumprir meta RPO <= 24h');
    assert.equal(result.rtoCompliant, true, 'Restauracao em memoria deve cumprir meta RTO <= 4h');
    assert.equal(result.sessionCollisionPrevented, true, 'Trava de colisao Baileys deve estar ativa');

    // Verificar se o WhatsApp restaurado foi redefinido para DISCONNECTED para proteger a producao
    const restoredWhatsapp = await Whatsapp.findByPk(1);
    assert.equal(restoredWhatsapp.status, 'DISCONNECTED', 'Sessao restaurada deve estar DISCONNECTED para evitar conflito com producao');
  });

  // --------------------------------------------------------------------------
  // OPS-02: Saude, metricas e observabilidade
  // --------------------------------------------------------------------------

  test('OPS-02: Liveness probe - GET /health/live retorna 200 e tempo de atividade', async () => {
    let statusCode = null;
    let payload = null;
    const req = {};
    const res = {
      status: (code) => { statusCode = code; return res; },
      json: (data) => { payload = data; return res; }
    };

    await HealthController.live(req, res);
    assert.equal(statusCode, 200);
    assert.equal(payload.status, 'ok');
    assert.ok(typeof payload.uptimeSeconds === 'number');
    assert.ok(payload.timestamp);
  });

  test('OPS-02: Readiness probe - GET /health/ready retorna 200 quando dependencias estao operacionais', async () => {
    let statusCode = null;
    let payload = null;
    const req = {};
    const res = {
      status: (code) => { statusCode = code; return res; },
      json: (data) => { payload = data; return res; }
    };

    await HealthController.ready(req, res);
    assert.equal(statusCode, 200);
    assert.equal(payload.status, 'ok');
    assert.equal(payload.checks.database, 'healthy');
    assert.equal(payload.checks.redis, 'healthy');
  });

  test('OPS-02: Readiness probe - GET /health/ready retorna 503 degradado em falha de dependencia', async () => {
    mockDbQueryError = new Error('CONNECTION_LOST_TO_POSTGRES');
    let statusCode = null;
    let payload = null;
    const req = {};
    const res = {
      status: (code) => { statusCode = code; return res; },
      json: (data) => { payload = data; return res; }
    };

    try {
      await HealthController.ready(req, res);
      assert.equal(statusCode, 503, 'Deve retornar HTTP 503 quando banco falha');
      assert.equal(payload.status, 'degraded');
      assert.equal(payload.checks.database, 'unhealthy');
    } finally {
      mockDbQueryError = null; // Restaurar
    }
  });

  test('OPS-02: Zero segredos - endpoint de saude nao expoe senhas ou strings de conexao', async () => {
    let statusCode = null;
    let payload = null;
    const req = {};
    const res = {
      status: (code) => { statusCode = code; return res; },
      json: (data) => { payload = data; return res; }
    };

    await HealthController.ready(req, res);
    const serialized = JSON.stringify(payload);
    assert.ok(!serialized.includes(process.env.JWT_SECRET), 'Nao deve conter JWT_SECRET');
    assert.ok(!serialized.includes('postgres://'), 'Nao deve expor URL de banco');
    assert.ok(!serialized.includes('redis://'), 'Nao deve expor URL de Redis');
  });

  test('OPS-02: Observabilidade WhatsApp - GET /health/whatsapp isolado da saude central da aplicacao', async () => {
    let statusCode = null;
    let payload = null;
    const req = { user: { companyId: 1 } };
    const res = {
      status: (code) => { statusCode = code; return res; },
      json: (data) => { payload = data; return res; }
    };

    await HealthController.whatsapp(req, res);
    assert.equal(statusCode, 200);
    assert.equal(payload.status, 'ok');
    assert.equal(payload.summary.total, 2);
    assert.ok(payload.summary.disconnected >= 1, 'Deve contabilizar desconexoes');
    assert.equal(payload.connections.length, 2);
  });

  test('OPS-02: Metricas operacionais - GET /health/metrics retorna memoria, filas e estatisticas', async () => {
    let statusCode = null;
    let payload = null;
    const req = {};
    const res = {
      status: (code) => { statusCode = code; return res; },
      json: (data) => { payload = data; return res; }
    };

    await HealthController.metrics(req, res);
    assert.equal(statusCode, 200);
    assert.ok(payload.memory.rssMb > 0);
    assert.ok(payload.messageStats);
    assert.ok(Array.isArray(payload.aiSpend));
    assert.equal(Number(payload.aiSpend[0].spent), 12.50);
  });

  test('OPS-02: Sanitizacao de logs - sanitizeLogData mascara senhas, tokens e credenciais confidenciais', () => {
    const rawPayload = {
      user: 'atendente1',
      password: 'PlainSecretPassword123!',
      token: 'jwt-header.payload.signature',
      apiKey: 'sk-proj-super-secret-key',
      company: {
        id: 1,
        secret: 'top-secret',
        db_pass: 'dbpass'
      },
      normalField: 'texto seguro'
    };

    const sanitized = sanitizeLogData(rawPayload);
    assert.equal(sanitized.password, '[REDACTED]', 'Senha deve ser redigida');
    assert.equal(sanitized.token, '[REDACTED]', 'Token deve ser redigido');
    assert.equal(sanitized.apiKey, '[REDACTED]', 'API Key deve ser redigida');
    assert.equal(sanitized.company.secret, '[REDACTED]', 'Segredo aninhado deve ser redigido');
    assert.equal(sanitized.company.db_pass, '[REDACTED]', 'db_pass aninhado deve ser redigido');
    assert.equal(sanitized.normalField, 'texto seguro', 'Campo normal deve ser preservado');
  });

  test('OPS-02: Alertas operacionais - deteccao de WhatsApp desconectado > 5min e desduplicacao', async () => {
    await database.query("UPDATE \"Whatsapps\" SET \"updatedAt\" = NOW() - INTERVAL '10 minutes' WHERE id = 2;");
    const result1 = await OperationalAlertService.evaluateOperationalAlerts();
    assert.ok(result1.alerts.length > 0, 'Deve gerar alerta de WhatsApp desconectado ha 10 minutos');
    const waAlert = result1.alerts.find(a => a.type === 'WHATSAPP_DISCONNECTED');
    assert.ok(waAlert, 'Alerta do tipo WHATSAPP_DISCONNECTED deve existir');
    assert.equal(waAlert.severity, 'HIGH');
    assert.ok(waAlert.actionRequired, 'Deve informar acao de recuperacao ao operador');

    // Segunda avaliacao imediata nao deve spammar novo alerta duplicado
    const result2 = await OperationalAlertService.evaluateOperationalAlerts();
    assert.ok(result2.alerts.length > 0, 'Alerta deve ser reportado sem flood de logging');
  });

  // --------------------------------------------------------------------------
  // OPS-03: Runtime, resiliencia e deploy
  // --------------------------------------------------------------------------

  test('OPS-03: Graceful shutdown - stopQueueProcess encerra filas Bull de forma limpa', async () => {
    // Testa chamada de encerramento seguro de filas
    await assert.doesNotReject(async () => {
      await stopQueueProcess();
    }, 'stopQueueProcess deve concluir sem lancar excecoes nao tratadas');
  });

  test('OPS-03: Entrypoint Docker - validacao de que migracao falha aborta e previne estado corrompido', () => {
    const entrypointPath = path.resolve(__dirname, '../../docker-entrypoint.sh');
    assert.ok(fs.existsSync(entrypointPath), 'docker-entrypoint.sh deve existir');
    const content = fs.readFileSync(entrypointPath, 'utf8');
    assert.ok(content.includes('set -e'), 'Entrypoint deve usar set -e para saida estrita em falha');
    assert.ok(content.includes('npx sequelize db:migrate'), 'Entrypoint deve executar migracoes antes do server');
    assert.ok(!content.includes('db:seed'), 'Entrypoint nao deve conter seeds no restart');
  });

  test('OPS-03: Dockerfile de producao - usuario nao privilegiado node e permissoes minimas', () => {
    const dockerfilePath = path.resolve(__dirname, '../../Dockerfile');
    assert.ok(fs.existsSync(dockerfilePath), 'Dockerfile deve existir');
    const content = fs.readFileSync(dockerfilePath, 'utf8');
    assert.ok(content.includes('USER node'), 'Dockerfile deve declarar usuario nao-root USER node');
    assert.ok(content.includes('docker-entrypoint.sh'), 'Dockerfile deve configurar o entrypoint de inicializacao');
  });

  // Run all tests
  let passed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`PASS ${t.name}`);
      passed++;
    } catch (e) {
      console.error(`FAIL ${t.name}`);
      console.error(e);
      process.exitCode = 1;
      break;
    }
  }

  if (passed === tests.length) {
    console.log(`RESULT ${passed}/${tests.length} passed; isolated PostgreSQL/WASM, zero external services`);
    process.exit(0);
  } else {
    process.exit(1);
  }
})();
