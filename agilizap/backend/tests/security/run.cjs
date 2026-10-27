/* Isolated security acceptance harness: real PostgreSQL/WASM, no TCP database, no workers or WhatsApp. */
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
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ticket-security-'));
process.env.TEST_MEDIA_ROOT = temp;
process.env.MAIL_HOST = 'smtp.invalid';
process.env.MAIL_PORT = '587';
process.env.MAIL_FROM = 'security@example.invalid';
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
  if (resolved === path.join(source, 'libs/wbot.ts') || /[\\/]services[\\/]WbotServices[\\/]/.test(resolved) || resolved === path.join(source, 'queues.ts')) {
    throw new Error('External runtime import forbidden in security harness: ' + request);
  }
  if (resolved === path.join(source, 'helpers/UpdateDeletedUserOpenTicketsStatus.ts')) return { __esModule: true, default: async () => { throw new Error('Real messaging forbidden'); } };
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
  database = new Sequelize({ dialect: 'postgres', database: 'security_memory_only', logging: false,
    databaseVersion: '17.0.0', pool: { max: 1, min: 0 } });
  // Adapt Sequelize's query transport directly to WASM Postgres. No TCP driver connection is ever opened.
  const connection = { query(sql, parameters, callback) {
    if (typeof parameters === 'function') { callback = parameters; parameters = []; }
    const query = parameters?.length ? pg.query(sql, parameters).then(r => [r]) : pg.exec(sql);
    query.then(results => callback(null, results.map(r => ({ ...r, rowCount: r.affectedRows ?? r.rows.length }))), callback);
  } };
  database.connectionManager.getConnection = () => require("bluebird").resolve(connection);
  database.connectionManager.releaseConnection = () => require("bluebird").resolve();
  const models = fs.readdirSync(path.join(source, 'models')).filter(n => n.endsWith('.ts')).map(n => load('models/' + n).default);
  database.addModels(models);
  // Legacy models have circular FK declarations; create tables without FKs in this fresh memory instance.
  // Authorization and ORM SQL are real; full historical migration-chain/constraint validation remains separate.
  const added = ['resetTokenHash','resetTokenExpiresAt','blocked','mfaLastStep','mustChangePassword'];
  for (const model of models) {
    const attributes = Object.fromEntries(Object.entries(model.rawAttributes).filter(([name, attr]) =>
      attr.type.key !== 'VIRTUAL' && !(model.name === 'User' && added.includes(name))).map(([name, attr]) => {
      const copy = { ...attr }; delete copy.references; delete copy.onDelete; delete copy.onUpdate; return [name, copy];
    }));
    await database.getQueryInterface().createTable(model.getTableName(), attributes);
  }
  await database.getQueryInterface().addColumn('Users', 'resetPassword', { type: require('sequelize').STRING, allowNull:true });
  const migration = load('database/migrations/20261021000000-security-access.ts');
  await migration.up(database.getQueryInterface());
  console.log('PASS migration up executed inside isolated PostgreSQL/WASM');
  const User = load('models/User.ts').default;
  const Company = load('models/Company.ts').default;
  const Queue = load('models/Queue.ts').default;
  const Ticket = load('models/Ticket.ts').default;
  const Contact = load('models/Contact.ts').default;
  const Message = load('models/Message.ts').default;
  const Note = load('models/TicketNote.ts').default;
  const { createAccessToken, createRefreshToken } = load('helpers/CreateTokens.ts');
  const { loadSession } = load('security/session.ts');
  const { authorizeRequest } = load('security/authorizeRequest.ts');
  const { MAX_FILE_BYTES, validateMedia, confinedPath } = load('security/media.ts');
  const { hashResetToken } = load('security/passwordReset.ts');
  const ResetPassword = load('services/ResetPasswordService/ResetPassword.ts').default;
  const SendMail = load('services/ForgotPassWordServices/SendMail.ts').default;
  const { initIO, disconnectUser } = load('libs/socket.ts');
  const isAuth = load('middleware/isAuth.ts').default;
  const express = require('express');
  require('express-async-errors');
  const app = express();
  app.use(express.json()); app.use(require('cookie-parser')());
  app.use(load('middleware/securityHttp.ts').securityHeaders);
  app.use(load('middleware/securityHttp.ts').trustedOrigin);
  app.use('/public', load('middleware/privateMedia.ts').default);
  app.use(load('routes/forgotPasswordRoutes.ts').default);
  app.use(load('routes/userRoutes.ts').default);
  app.use("/auth", load("routes/authRoutes.ts").default);
  app.use(load('routes/ticketNoteRoutes.ts').default);
  app.use(load('routes/invoicesRoutes.ts').default);
  app.put('/queue/:queueId', isAuth, load('controllers/QueueController.ts').update);
  app.put('/whatsapp/:whatsappId', isAuth, (req, res) => res.json({ ok: true }));
  app.get('/contacts/export', isAuth, load('controllers/ContactExportController.ts').exportContacts);
  const uploadConfig = load('config/upload.ts').default;
  const upload = load('security/secureUpload.ts').default(uploadConfig);
  app.post('/upload', isAuth, upload.array('medias'), (req, res) => res.json(req.files.map(f => ({ filename: f.filename, path: f.path }))));
  // Exercise the actual access middleware for each resource; controllers with sending side effects are deliberately absent.
  for (const [route, methods] of Object.entries({
    '/tickets/:ticketId': ['get','put','delete'], '/tickets/u/:uuid': ['get'],
    '/messages/:ticketId': ['get'], '/messages/edit/:messageId': ['post'],
    '/companies/:id/schedules': ['put'], '/queue/:queueId': ['get','put','delete'],
    '/prompt/:promptId': ['get','put','delete'], '/schedules/:id/media-upload': ['post'],
    '/dashboard/ticketsDay': ['get'], '/tickets': ['post']
  })) for (const method of methods) app[method](route, isAuth, (req, res) => res.json({ ok: true }));
  app.use((error, req, res, next) => res.status(error.statusCode || (error.code?.startsWith('LIMIT_') ? 413 : 500)).json({ error: error.message }));
  server = require('http').createServer(app);
  io = initIO(server);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const request = require('supertest')(server);
  const origin = process.env.FRONTEND_URL;
  const Plan = load('models/Plan.ts').default;
  const plan = await Plan.create({name:'Plano ficticio', users:100,connections:100,queues:100,value:0});
  const c1 = await Company.create({ name: 'Ficticia A', status: true, planId:plan.id });
  const c2 = await Company.create({ name: 'Ficticia B', status: true, planId:plan.id });
  const q1 = await Queue.create({ name: 'Suporte A', color: '#111111', companyId: c1.id });
  const qOther = await Queue.create({ name: 'Financeiro A', color: '#222222', companyId: c1.id });
  const q2 = await Queue.create({ name: 'Suporte B', color: '#333333', companyId: c2.id });
  const actors = {};
  for (const company of [c1,c2]) for (const profile of ['user','supervisor','admin']) {
    const user = await User.create({ name: profile, email: `${profile}${company.id}@example.invalid`, password: 'InitialPass123',
      profile, companyId: company.id, tokenVersion: 0, blocked: false });
    await user.$set('queues', [company.id === c1.id ? q1.id : q2.id]);
    actors[`${profile}${company.id}`] = await User.findByPk(user.id, { include: [Queue,Company] });
  }
  const contact = await Contact.create({ name: 'Teste A', number: '0000000001', companyId: c1.id });
  const t1 = await Ticket.create({ status: 'pending', companyId: c1.id, queueId: q1.id, contactId: contact.id });
  const tOther = await Ticket.create({ status: 'pending', companyId: c1.id, queueId: qOther.id, contactId: contact.id });
  const contact2 = await Contact.create({ name: 'Teste B', number: '0000000002', companyId: c2.id });
  const t2 = await Ticket.create({ status: 'pending', companyId: c2.id, queueId: q2.id, contactId: contact2.id });
  const admin = actors[`admin${c1.id}`], agent = actors[`user${c1.id}`], supervisor = actors[`supervisor${c1.id}`];
  const token = actor => createAccessToken(actor);
  const auth = actor => ({ Authorization: `Bearer ${token(actor)}`, Origin: origin });
  const note = await Note.create({ note: 'Nota privada A', ticketId: t1.id, contactId: contact.id, userId: agent.id });
  const note2 = await Note.create({ note: 'Nota privada B', ticketId: t2.id, contactId: contact2.id, userId: actors[`user${c2.id}`].id });
  test('REST: duas empresas e todos os papeis respeitam ticket, fila, UUID, leitura/alteracao/exclusao', async () => {
    for (const actor of Object.values(actors)) {
      const same = actor.companyId === c1.id;
      assert.equal((await request.get(`/tickets/${t1.id}`).set(auth(actor))).status, same ? 200 : 403);
      assert.equal((await request.get(`/tickets/u/${t1.uuid}`).set(auth(actor))).status, same ? 200 : 403);
      assert.equal((await request.put(`/tickets/${t1.id}`).set(auth(actor)).send({ status: 'open', userId: actor.id })).status, same ? 200 : 403);
      assert.equal((await request.delete(`/tickets/${t1.id}`).set(auth(actor))).status, same && actor.profile === 'admin' ? 200 : 403);
      assert.equal((await request.get(`/tickets/${tOther.id}`).set(auth(actor))).status, same && actor.profile === 'admin' ? 200 : 403);
    }
    assert.equal((await request.get(`/tickets/${t1.id}`)).status, 401);
    assert.equal((await request.put(`/companies/${c2.id}/schedules`).set(auth(admin)).send({ schedules: [] })).status, 403);
    assert.equal((await request.get(`/dashboard/ticketsDay?companyId=${c2.id}`).set(auth(admin))).status, 403);
  });
  test('REST: atendente assume disponivel, supervisor redistribui somente nas filas geridas', async () => {
    assert.equal((await request.put(`/tickets/${t1.id}`).set(auth(agent)).send({ userId: supervisor.id })).status, 403);
    assert.equal((await request.put(`/tickets/${t1.id}`).set(auth(supervisor)).send({ userId: agent.id })).status, 200);
    assert.equal((await request.put(`/tickets/${t1.id}`).set(auth(supervisor)).send({ queueId: qOther.id })).status, 403);
    assert.equal((await request.post('/tickets').set(auth(agent)).send({ contactId: contact2.id, queueId: q1.id, userId: agent.id })).status, 403);
  });
  test('REST: administrador encerra sem fila preservando responsavel e sem exigir vinculo a fila', async () => {
    const adminWithoutQueues = await User.create({ name: 'Admin sem filas', email: 'admin-no-queue@example.invalid', password: 'InitialPass123', profile: 'admin', companyId: c1.id, tokenVersion: 0, blocked: false });
    const actor = await User.findByPk(adminWithoutQueues.id, { include: [Queue, Company] });
    for (const fields of [
      { queueId: null, userId: null },
      { queueId: null, userId: agent.id },
      { queueId: qOther.id, userId: agent.id }
    ]) {
      const ticket = await Ticket.create({ status: 'pending', companyId: c1.id, contactId: contact.id, ...fields });
      const response = await request.put(`/tickets/${ticket.id}`).set(auth(actor)).send({ status: 'closed', useIntegration: false, promptId: null, integrationId: null });
      assert.equal(response.status, 200, JSON.stringify(response.body));
    }
  });
  test('REST: encerramento sem fila continua negado a atendente, supervisor e administrador de outra empresa', async () => {
    const ticket = await Ticket.create({ status: 'pending', companyId: c1.id, queueId: null, userId: null, contactId: contact.id });
    for (const actor of [agent, supervisor, actors[`admin${c2.id}`]]) {
      assert.equal((await request.put(`/tickets/${ticket.id}`).set(auth(actor)).send({ status: 'closed' })).status, 403);
    }
  });
  test('REST: encerramento administrativo nao contorna validacao de atribuicao ou transferencia', async () => {
    const ticket = await Ticket.create({ status: 'pending', companyId: c1.id, queueId: null, userId: agent.id, contactId: contact.id });
    for (const body of [
      { status: 'closed', userId: admin.id },
      { status: 'closed', queueId: qOther.id },
      { status: 'closed', userId: actors[`user${c2.id}`].id },
      { status: 'closed', queueId: q2.id },
      { status: 'open' }
    ]) {
      assert.equal((await request.put(`/tickets/${ticket.id}`).set(auth(admin)).send(body)).status, 403);
    }
  });
  test('Usuario: autopromocao, outro alvo, super e empresa no corpo sao rejeitados; campos pessoais funcionam sem apagar filas', async () => {
    for (const body of [{ profile:'admin' }, { super:true }, { companyId:c2.id }, { tokenVersion:999 }, { queueIds:[qOther.id] }]) {
      assert.equal((await request.put(`/users/${agent.id}`).set(auth(agent)).send(body)).status, 403);
    }
    assert.equal((await request.put(`/users/${actors[`user${c2.id}`].id}`).set(auth(admin)).send({ name:'Intruso' })).status, 403);
    const old = token(agent);
    const response = await request.put(`/users/${agent.id}`).set(auth(agent)).send({ name:'Agente atualizado' });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const fresh = await User.findByPk(agent.id, { include:[Queue,Company] });
    assert.deepEqual(fresh.queues.map(q=>q.id), [q1.id]);
    await assert.rejects(loadSession(old));
    actors[`user${c1.id}`] = fresh; Object.assign(agent, { tokenVersion:fresh.tokenVersion });
  });
  test('Admin protegido: edita as proprias filas sem manutencao global e revoga sessoes antigas', async () => {
    const account = await User.create({ name: 'Administrador protegido', email: 'protected-self@example.invalid', password: 'InitialPass123', profile: 'admin', super: true, blocked: false, companyId: c1.id, tokenVersion: 0 });
    const actor = await User.findByPk(account.id, { include: [Queue, Company] });
    const oldToken = token(actor);
    const response = await request.put(`/users/${actor.id}`).set(auth(actor)).send({ name: actor.name, email: actor.email, password: '', profile: 'admin', blocked: false, companyId: c1.id, queueIds: [qOther.id], whatsappId: null, allTicket: 'enabled' });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const updated = await User.findByPk(actor.id, { include: [Queue, Company] });
    assert.deepEqual(updated.queues.map(q => q.id), [qOther.id]);
    assert.equal(updated.super, true); assert.equal(updated.profile, 'admin'); assert.equal(updated.blocked, false);
    await assert.rejects(loadSession(oldToken));
  });
  test('Admin protegido: perfil, bloqueio, flags internas e contas alheias continuam protegidos', async () => {
    const account = await User.create({ name: 'Protegido', email: 'protected-guard@example.invalid', password: 'InitialPass123', profile: 'admin', super: true, blocked: false, companyId: c1.id, tokenVersion: 0 });
    const actor = await User.findByPk(account.id, { include: [Queue, Company] });
    for (const body of [{ profile: 'user' }, { blocked: true }, { super: false }, { tokenVersion: 0 }, { companyId: c2.id }, { queueIds: [q2.id] }]) {
      assert.equal((await request.put(`/users/${actor.id}`).set(auth(actor)).send(body)).status, 403);
    }
    assert.equal((await request.put(`/users/${actor.id}`).set(auth(admin)).send({ queueIds: [q1.id] })).status, 403);
    const otherProtected = await User.create({ name: 'Outro protegido', email: 'other-protected@example.invalid', password: 'InitialPass123', profile: 'admin', super: true, companyId: c1.id });
    assert.equal((await request.put(`/users/${otherProtected.id}`).set(auth(actor)).send({ queueIds: [q1.id] })).status, 403);
  });
  test('Admin comum: altera as proprias filas e pode remover todos os vinculos', async () => {
    const account = await User.create({ name: 'Administrador comum', email: 'normal-self@example.invalid', password: 'InitialPass123', profile: 'admin', companyId: c1.id, tokenVersion: 0 });
    let actor = await User.findByPk(account.id, { include: [Queue, Company] });
    for (const queueIds of [[qOther.id], []]) {
      assert.equal((await request.put(`/users/${actor.id}`).set(auth(actor)).send({ queueIds })).status, 200);
      actor = await User.findByPk(actor.id, { include: [Queue, Company] });
      assert.deepEqual(actor.queues.map(q => q.id), queueIds);
    }
  });
  test('Fila: administrador edita dados sem reenviar metadados; caminhos e outra empresa continuam bloqueados', async () => {
    const queue = await Queue.create({ name: 'Fila editavel', color: '#124578', companyId: c1.id });
    const body = { name: 'Fila atualizada', color: '#124578', greetingMessage: 'Bem-vindo', outOfHoursMessage: '', schedules: [], orderQueue: null, integrationId: null, promptId: null };
    const response = await request.put(`/queue/${queue.id}`).set(auth(admin)).send(body);
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal((await Queue.findByPk(queue.id)).greetingMessage, 'Bem-vindo');
    for (const bad of [{ ...body, mediaPath: null }, { ...body, id: q2.id }, { ...body, companyId: c2.id }]) {
      assert.equal((await request.put(`/queue/${queue.id}`).set(auth(admin)).send(bad)).status, 403);
    }
    for (const actor of [agent, supervisor, actors[`admin${c2.id}`]]) {
      assert.equal((await request.put(`/queue/${queue.id}`).set(auth(actor)).send(body)).status, 403);
    }
  });
  test('Identificador: edicao de conexao aceita id correspondente e rejeita id ou empresa divergentes', async () => {
    const Whatsapp = load('models/Whatsapp.ts').default;
    const connection = await Whatsapp.create({ name: 'Conexao editavel', companyId: c1.id });
    assert.equal((await request.put(`/whatsapp/${connection.id}`).set(auth(admin)).send({ id: connection.id, name: 'Conexao atualizada' })).status, 200);
    assert.equal((await request.put(`/whatsapp/${connection.id}`).set(auth(admin)).send({ id: connection.id + 1000, name: 'Invalida' })).status, 403);
    assert.equal((await request.put(`/whatsapp/${connection.id}`).set(auth(actors[`admin${c2.id}`])).send({ id: connection.id, name: 'Invalida' })).status, 403);
  });
  test('Notas: lista, leitura, criacao e alteracao nao atravessam empresa nem aceitam id do corpo', async () => {
    const response = await request.get('/ticket-notes').set(auth(admin));
    assert.equal(response.status,200, JSON.stringify(response.body));
    assert.deepEqual(response.body.ticketNotes.map(n=>n.id), [note.id]);
    assert.equal((await request.get(`/ticket-notes/${note2.id}`).set(auth(admin))).status,403);
    assert.equal((await request.put(`/ticket-notes/${note.id}`).set(auth(admin)).send({ id:note2.id,note:'Ataque' })).status,403);
    assert.equal((await request.post('/ticket-notes').set(auth(agent)).send({ ticketId:t2.id,contactId:contact2.id,note:'Ataque' })).status,403);
    assert.equal((await request.put(`/ticket-notes/${note.id}`).set(auth(admin)).send({ note:'Observacao alterada' })).status,200);
  });
  let mail;
  const nodemailer = require('nodemailer');
  let smtpError = false;
  nodemailer.createTransport = config => {
    assert.equal(config.secure,false); assert.equal(config.requireTLS,true);
    return { sendMail: async message => { if(smtpError) throw Error('secret SMTP provider error'); mail = message; } };
  };
  test('Recuperacao: conta existente/inexistente tem resposta generica; SMTP aguardado e sem segredo no log', async () => {
    const a = await request.post('/forgetpassword').send({ email:admin.email });
    const b = await request.post('/forgetpassword').send({ email:'absent@example.invalid' });
    assert.equal(a.status,202); assert.deepEqual(a.body,b.body);
    assert.ok(mail.text.includes('30 minutos'));
    const digest = (await User.findByPk(admin.id)).resetTokenHash;
    const code = mail.text.match(/[a-f0-9]{64}/)[0];
    assert.equal(digest,hashResetToken(code)); assert.notEqual(digest,code);
    smtpError=true; await SendMail(admin.email); smtpError=false;
    assert.equal((await User.findByPk(admin.id)).resetTokenHash,null);
    assert.ok(logs.some(l=>JSON.stringify(l).includes('password_reset_delivery_failed')));
    assert.ok(!JSON.stringify(logs).includes(code)); assert.ok(!JSON.stringify(logs).includes('secret SMTP'));
    assert.equal((await request.post(`/resetpasswords/${admin.email}/token/password`)).status,404);
  });
  test('Postgres/ORM: token expira, nao aceita aspas, consumo concorrente permite um sucesso e revoga sessoes', async () => {
    const code=crypto.randomBytes(32).toString('hex');
    await admin.update({resetTokenHash:hashResetToken(code),resetTokenExpiresAt:new Date(Date.now()+60000)});
    const resetSocket=await connect(admin);
    const resetDisconnected=new Promise(resolve=>resetSocket.once('disconnect',resolve));
    const old=token(admin), oldRefresh=createRefreshToken(admin);
    await assert.rejects(ResetPassword(`${admin.email}' OR 1=1 --`,code,'StrongNew123'));
    await assert.rejects(ResetPassword(admin.email,'a'.repeat(64),'StrongNew123'));
    const results=await Promise.allSettled([ResetPassword(admin.email,code,'StrongNew123'),ResetPassword(admin.email,code,'StrongOther123')]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    await Promise.race([resetDisconnected,new Promise((_,reject)=>setTimeout(()=>reject(Error('Reset socket revocation timeout')),1000))]);
    await assert.rejects(ResetPassword(admin.email,code,'StrongThird123'));
    await assert.rejects(loadSession(old)); await assert.rejects(loadSession(oldRefresh,true));
    await admin.reload();
    assert.equal(admin.resetTokenHash,null);
    await admin.update({resetTokenHash:hashResetToken(code),resetTokenExpiresAt:new Date(Date.now()-1000)});
    await assert.rejects(ResetPassword(admin.email,code,'StrongNew123'));
  });
  test('Upload: assinatura/MIME, travessia, sobrescrita, cinco arquivos e fronteira 20 MiB', async () => {
    const png=Buffer.from('89504e470d0a1a0a0000000000000000','hex');
    assert.throws(()=>validateMedia('.png','image/png',Buffer.from('fake'),4));
    assert.throws(()=>validateMedia('.png','image/jpeg',png,png.length));
    assert.throws(()=>validateMedia('.exe','application/octet-stream',png,png.length));
    for(const name of ['../outside','x/../../outside','C:/outside','x\\outside','/outside','x/../outside']) assert.throws(()=>confinedPath(temp,name));
    const first=await request.post('/upload').set(auth(admin)).attach('medias',png,'same.png');
    const second=await request.post('/upload').set(auth(admin)).attach('medias',png,'same.png');
    assert.equal(first.status,200,JSON.stringify(first.body)); assert.equal(second.status,200);
    assert.notEqual(first.body[0].filename,second.body[0].filename);
    const before=fs.readdirSync(temp).length;
    assert.equal((await request.post('/upload').set(auth(admin)).field('typeArch','../../escape').attach('medias',png,'a.png')).status,400);
    assert.equal(fs.readdirSync(temp).length,before);
    assert.equal((await request.post('/upload').set(auth(admin)).attach('medias',Buffer.from('fake'),'a.png')).status,400);
    const XLSX=require('xlsx');
    const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([['name'],['test']]),'test');
    const office=XLSX.write(workbook,{bookType:'xlsx',type:'buffer',compression:true});
    const {validateOfficeBuffer}=load('security/validateOffice.ts');
    await validateOfficeBuffer(office,'.xlsx',temp);
    await assert.rejects(validateOfficeBuffer(office,'.docx',temp));
    assert.ok(!fs.readdirSync(temp).some(name=>name.startsWith('tmp-office-')));
    assert.equal((await request.post('/upload').set(auth(admin)).attach('medias',office,{filename:'valid.xlsx',contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})).status,200);
    assert.equal((await request.post('/upload').set(auth(admin)).attach('medias',office,{filename:'fake.docx',contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})).status,400);
    let five=request.post('/upload').set(auth(admin)); for(let i=0;i<5;i++) five=five.attach('medias',png,`${i}.png`);
    assert.equal((await five).status,200);
    let six=request.post('/upload').set(auth(admin)); for(let i=0;i<6;i++) six=six.attach('medias',png,`${i}.png`);
    assert.equal((await six).status,413);
    const exact=Buffer.alloc(MAX_FILE_BYTES); png.copy(exact);
    assert.equal((await request.post('/upload').set(auth(admin)).attach('medias',exact,'max.png')).status,200);
    let aggregate=request.post('/upload').set(auth(admin));
    for(let i=0;i<5;i++) aggregate=aggregate.attach('medias',exact,`max${i}.png`);
    assert.equal((await aggregate).status,200);
    const over=Buffer.alloc(MAX_FILE_BYTES+1); png.copy(over);
    assert.equal((await request.post('/upload').set(auth(admin)).attach('medias',over,'over.png')).status,413);
  });
  test('Midia legada: anonimo/empresa alheia/fila alheia negados; cookie HttpOnly e painel autorizados funcionam', async () => {
    fs.writeFileSync(path.join(temp,'legacy.pdf'),'%PDF-1.4\nold file');
    await Message.create({id:'legacy-message',companyId:c1.id,ticketId:t1.id,contactId:contact.id,mediaUrl:'legacy.pdf',mediaType:'application'});
    assert.equal((await request.get('/public/legacy.pdf')).status,401);
    assert.equal((await request.get('/public/legacy.pdf').set(auth(admin))).status,200);
    assert.equal((await request.get('/public/legacy.pdf').set(auth(actors[`admin${c2.id}`]))).status,403);
    assert.equal((await request.get('/public/legacy.pdf').set('Cookie',`mediaAccess=${token(agent)}`)).status,200);
    assert.equal((await request.get('/public/legacy.pdf').set(auth(agent))).headers['cache-control'],'private, no-store');
    assert.equal((await request.get('/public/unreferenced.pdf').set(auth(admin))).status,403);
  });
  test('Sessoes: algoritmo restrito, exclusao, bloqueio, empresa inativa e versao revogada', async () => {
    const jwt=require('jsonwebtoken');
    const bad=jwt.sign({id:agent.id,companyId:c1.id,tokenVersion:agent.tokenVersion},process.env.JWT_SECRET,{algorithm:'HS384'});
    await assert.rejects(loadSession(bad));
    const expired=jwt.sign({id:agent.id,companyId:c1.id,tokenVersion:agent.tokenVersion},process.env.JWT_SECRET,{algorithm:'HS256',expiresIn:-1});
    await assert.rejects(loadSession(expired));
    const old=token(agent); await User.update({blocked:true},{where:{id:agent.id}}); await assert.rejects(loadSession(old));
    await User.update({blocked:false},{where:{id:agent.id}});
    await c1.update({status:false}); await assert.rejects(loadSession(old)); await c1.update({status:true});
  });
  const socketClient=require('socket.io-client').io;
  const connect=actor=>new Promise((resolve,reject)=>{
    const socket=socketClient(`http://127.0.0.1:${server.address().port}`,{auth:{token:token(actor)},transports:['websocket'],reconnection:false});
    socket.on('ready',()=>resolve(socket)); socket.on('connect_error',reject);
  });
  test('Sockets: salas de tickets por empresa/fila, sem sala null compartilhada, revogacao encerra conexao', async () => {
    const a=await connect(agent), b=await connect(actors[`user${c2.id}`]);
    const wait=()=>new Promise(resolve=>setTimeout(resolve,50));
    a.emit('joinChatBox',String(t2.id)); a.emit('joinChatBox',String(tOther.id)); a.emit('joinChatBox',String(t1.id));
    a.emit('joinNotification'); await wait();
    const socket=io.sockets.sockets.get(a.id);
    assert.ok(socket.rooms.has(String(t1.id))); assert.ok(!socket.rooms.has(String(t2.id))); assert.ok(!socket.rooms.has(String(tOther.id)));
    assert.ok(!socket.rooms.has('queue-null-notification'));
    let leaked=false; b.on('private-check',()=>{leaked=true;});
    io.to(String(t1.id)).emit('private-check',{text:'only A'}); await wait(); assert.equal(leaked,false);
    const disconnected=new Promise(resolve=>a.once('disconnect',resolve)); disconnectUser(agent.id); await disconnected;
    b.disconnect();
  });
  test('Administrador em producao entra com email e senha; politica de senha preservada', async () => {
    const {validatePassword}=load('security/policy.ts');
    assert.throws(()=>validatePassword('short')); assert.throws(()=>validatePassword('A1'+'é'.repeat(36)));
    assert.doesNotThrow(()=>validatePassword('ValidPass123'));
    const Auth=load('services/UserServices/AuthUserService.ts').default;
    const password=await admin.checkPassword('StrongNew123')?'StrongNew123':'StrongOther123';
    const saved=process.env.NODE_ENV;
    try {
      process.env.NODE_ENV='production';
      const logged=await Auth({email:admin.email,password});
      assert.ok(logged.token);assert.equal(logged.serializedUser.id,admin.id);
      await assert.rejects(Auth({email:admin.email,password:'WrongPass123'}));
    } finally {process.env.NODE_ENV=saved;}
  });
  test('Casing de URL nao contorna autorizacao de recurso', async () => {
    assert.equal((await request.put(`/QuEuE/${q1.id}`).set(auth(agent)).send({name:'Ataque'})).status,403);
    assert.equal((await request.get('/DaShBoArD/ticketsDay').set(auth(agent))).status,403);
    assert.equal((await request.put(`/CoMpAnIeS/${c2.id}/schedules`).set(auth(admin)).send({schedules:[]})).status,403);
  });
  test('CSRF, headers, limites de abuso e configuracao insegura recusados', async () => {
    const {rateLimit}=load('middleware/securityHttp.ts');
    const limit=rateLimit(2,1000),req={ip:'127.0.0.1',body:{email:'a@example.invalid'}},res={setHeader(){}};
    limit(req,res,()=>{});limit(req,res,()=>{});assert.throws(()=>limit(req,res,()=>{}));
    assert.equal((await request.post('/auth/refresh_token').set('Cookie','jrt=sentinel').set('Origin','https://attacker.invalid').send({})).status,403);
    const response=await request.get('/public/legacy.pdf').set(auth(admin));
    assert.equal(response.headers['x-content-type-options'],'nosniff');
    const {requireSecret}=load('security/config.ts');
    const saved=process.env.JWT_SECRET;process.env.JWT_SECRET='mysecret';assert.throws(()=>requireSecret('JWT_SECRET'));process.env.JWT_SECRET=saved;
  });
  test('Streaming recebido: fronteira real de bytes, timeout e interrupcao nao deixam fluxo aberto', async () => {
    const {readLimitedStream}=load('security/readLimitedStream.ts');
    const {Readable,PassThrough}=require('stream');
    assert.equal((await readLimitedStream(Readable.from([Buffer.alloc(8)]),8,1000)).length,8);
    await assert.rejects(readLimitedStream(Readable.from([Buffer.alloc(9)]),8,1000));
    const pending=new PassThrough();await assert.rejects(readLimitedStream(pending,8,10));assert.ok(pending.destroyed);
  });
  test('Rotas reais de contas: criacao, signup fechado, login administrativo e cookies/refresh/logout', async () => {
    assert.equal((await request.post('/auth/signup').send({email:'attacker@example.invalid',password:'ValidPass123',profile:'admin'})).status,401);
    assert.equal((await request.post('/users').set(auth(agent)).send({name:'Novo',email:'new@example.invalid',password:'ValidPass123'})).status,403);
    const created=await request.post('/users').set(auth(admin)).send({name:'Novo atendente',email:'new@example.invalid',password:'ValidPass123'});
    assert.equal(created.status,200,JSON.stringify(created.body));assert.equal(created.body.profile,'user');assert.equal(created.body.companyId,c1.id);
    const fresh=await User.findByPk(created.body.id,{include:[Queue,Company]});
    const logged=await request.post('/auth/login').set('Origin',origin).send({email:fresh.email,password:'ValidPass123'});
    assert.equal(logged.status,200,JSON.stringify(logged.body));assert.ok(logged.headers['set-cookie'].every(c=>c.includes('HttpOnly')&&c.includes('SameSite=Strict')));
    const cookies=logged.headers['set-cookie'].map(c=>c.split(';')[0]);
    const renewed=await request.post('/auth/refresh_token').set('Origin',origin).set('Cookie',cookies).send({});
    assert.equal(renewed.status,200,JSON.stringify(renewed.body));assert.equal(renewed.body.user.passwordHash,undefined);assert.equal(renewed.body.user.resetTokenHash,undefined);
    const logout=await request.delete('/auth/logout').set({Authorization:`Bearer ${logged.body.token}`,Origin:origin}).set('Cookie',cookies);
    assert.equal(logout.status,200,JSON.stringify(logout.body));await assert.rejects(loadSession(logged.body.token));await assert.rejects(loadSession(cookies.find(c=>c.startsWith('jrt=')).slice(4),true));
    const Auth=load('services/UserServices/AuthUserService.ts').default;
    const password=await admin.checkPassword('StrongNew123')?'StrongNew123':'StrongOther123';
    const attempts=await Promise.allSettled([Auth({email:admin.email,password}),Auth({email:admin.email,password})]);
    assert.equal(attempts.filter(r=>r.status==='fulfilled').length,2);
    const old=token(fresh);await fresh.destroy();await assert.rejects(loadSession(old));
  });
  test('Relatorios SQL vinculam datas maliciosas e nao alteram usuarios', async()=>{
    const {TicketsAttendance}=load('services/ReportService/TicketsAttendance.ts');
    const before=await User.count();
    await assert.rejects(TicketsAttendance({companyId:c1.id,initialDate:"2026-01-01'; DELETE FROM Users;--",finalDate:'2026-10-21'}));
    assert.equal(await User.count(),before);
  });
  test('Exportacao em massa exige administrador e omite outra empresa; faturas sao isoladas', async()=>{
    assert.equal((await request.get('/contacts/export').set(auth(agent))).status,403);
    const exported=await request.get('/contacts/export').set(auth(admin));
    assert.equal(exported.status,200);assert.ok(exported.text.includes(contact.name));assert.ok(!exported.text.includes(contact2.name));
    const Invoices=load('models/Invoices.ts').default;
    const a=await Invoices.create({detail:'Fatura A',companyId:c1.id,status:'open',value:0});
    const b=await Invoices.create({detail:'Fatura B',companyId:c2.id,status:'open',value:0});
    const listed=await request.get('/invoices').set(auth(admin));assert.equal(listed.status,200,JSON.stringify(listed.body));
    assert.deepEqual(listed.body.invoices.map(i=>i.id),[a.id]);
    assert.equal((await request.put(`/invoices/${a.id}`).set(auth(admin)).send({id:b.id,status:'paid'})).status,403);
    assert.equal((await request.get(`/invoices/${b.id}`).set(auth(admin))).status,403);
  });
  test('Bloqueio e desbloqueio administrativos invalidam sessoes antigas sem restaurar tokens',async()=>{
    const current=await User.findByPk(agent.id,{include:[Queue,Company]});
    const old=token(current);
    assert.equal((await request.put(`/users/${agent.id}`).set(auth(agent)).send({blocked:true})).status,403);
    assert.equal((await request.put(`/users/${agent.id}`).set(auth(admin)).send({blocked:true})).status,200);
    await assert.rejects(loadSession(old));
    assert.equal((await request.put(`/users/${agent.id}`).set(auth(admin)).send({blocked:false})).status,200);
    await assert.rejects(loadSession(old));
  });
  test('Configuracao de producao recusa HTTP, segredos iguais e credenciais ausentes',()=>{
    const {validateRuntimeConfig}=load('security/config.ts');
    const saved={...process.env};
    try {
      process.env.NODE_ENV='production';
      assert.throws(()=>validateRuntimeConfig());
      process.env.FRONTEND_URL='https://panel.example.invalid';process.env.BACKEND_URL='https://api.example.invalid';
      delete process.env.DB_PASS;delete process.env.REDIS_PASSWORD;assert.throws(()=>validateRuntimeConfig());
      process.env.DB_PASS=crypto.randomBytes(32).toString('hex');process.env.REDIS_PASSWORD=crypto.randomBytes(32).toString('hex');
      assert.doesNotThrow(()=>validateRuntimeConfig());
      process.env.JWT_REFRESH_SECRET=process.env.JWT_SECRET;assert.throws(()=>validateRuntimeConfig());
    } finally { for(const key of Object.keys(process.env)) if(!(key in saved)) delete process.env[key];Object.assign(process.env,saved); }
  });
  test('Matriz de recursos: conexoes, integracoes, arquivos, campanhas, listas e anuncios em duas empresas',async()=>{
    for(const [modelName,resource,param,adminOnly] of [
      ['Whatsapp','whatsapp','whatsappId',true],['Prompt','prompt','promptId',true],
      ['QueueIntegrations','queueIntegration','integrationId',true],['Files','files','fileId',true],
      ['Campaign','campaigns','id',true],['ContactList','contact-lists','id',true],['Announcement','announcements','id',false]
    ]) {
      const Model=load(`models/${modelName}.ts`).default;
      const row=await Model.create({name:'Recurso ficticio',title:'Aviso ficticio',prompt:'Texto ficticio',voice:'text',companyId:c1.id});
      for(const actor of Object.values(actors)) {
        const req={path:`/${resource}/${row.id}`,route:{path:`/${resource}/:${param}`},baseUrl:'',method:'GET',body:{},query:{},params:{[param]:String(row.id)}};
        const allowed=actor.companyId===c1.id&&(!adminOnly||actor.profile==='admin');
        if(allowed) await authorizeRequest(req,actor); else await assert.rejects(authorizeRequest(req,actor));
      }
    }
  });
  test('Mensagens assincronas recusam colisao entre empresas e quotes legados cruzados; JSON preserva segredo interno',async()=>{
    const createMessage=load('services/MessageServices/CreateMessageService.ts').default;
    const listMessages=load('services/MessageServices/ListMessagesService.ts').default;
    await createMessage({companyId:c1.id,messageData:{id:'collision-test',ticketId:t1.id,body:'Somente A',contactId:contact.id}});
    await assert.rejects(createMessage({companyId:c2.id,messageData:{id:'collision-test',ticketId:t2.id,body:'Ataque B',contactId:contact2.id}}));
    assert.equal((await Message.findByPk('collision-test')).body,'Somente A');
    await Message.create({id:'foreign-quoted',ticketId:t2.id,companyId:c2.id,body:'Privado de B'});
    await Message.create({id:'legacy-cross-quote',ticketId:t1.id,companyId:c1.id,quotedMsgId:'foreign-quoted',body:'Mensagem de A'});
    const listed=await listMessages({ticketId:String(t1.id),companyId:c1.id});
    assert.equal(listed.messages.find(m=>m.id==='legacy-cross-quote').quotedMsg,null);
    const {redactOperational}=load('security/serializeOperational.ts');
    const internal={queue:{prompt:{apiKey:'secret-for-provider',prompt:'Texto permitido'}},contact:{whatsapp:{session:'session-secret'}}};
    const serialized=redactOperational(internal);assert.equal(serialized.queue.prompt,undefined);assert.equal(internal.queue.prompt.apiKey,'secret-for-provider');
    assert.equal(serialized.contact.whatsapp.session,undefined);
  });
  test('Bootstrap exige credencial explicita e permite login sem troca obrigatoria',async()=>{
    const seed=load('database/seeds/20200904070006-create-default-user.ts');
    const saved={...process.env};
    try {
      delete process.env.BOOTSTRAP_ADMIN_EMAIL;delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
      await assert.rejects(seed.up(database.getQueryInterface()));
      process.env.BOOTSTRAP_ADMIN_EMAIL='bootstrap@example.invalid';process.env.BOOTSTRAP_ADMIN_PASSWORD='TemporaryPass123';
      process.env.BOOTSTRAP_PLATFORM_ADMIN='false';
      await seed.up(database.getQueryInterface());
      const account=await User.findOne({where:{email:process.env.BOOTSTRAP_ADMIN_EMAIL}});
      assert.equal(account.mustChangePassword,false);assert.equal(account.super,false);
      const Auth=load('services/UserServices/AuthUserService.ts').default;
      const logged=await Auth({email:account.email,password:'TemporaryPass123'});
      assert.equal((await loadSession(logged.token)).id,account.id);
      // Legacy flags must not leave existing accounts unable to use their configured password.
      await account.update({mustChangePassword:true});
      const legacy=await Auth({email:account.email,password:'TemporaryPass123'});
      assert.equal((await loadSession(legacy.token)).id,account.id);
      await assert.rejects(Auth({email:account.email,password:'WrongPass123'}));
    }finally {for(const key of Object.keys(process.env)) if(!(key in saved)) delete process.env[key];Object.assign(process.env,saved);}
  });
  test('Transferencia de fila remove sala de socket anterior antes da proxima mensagem',async()=>{
    const fresh=await User.findByPk(agent.id,{include:[Queue,Company]});
    const socket=await connect(fresh);socket.emit('joinChatBox',String(t1.id));
    await new Promise(resolve=>setTimeout(resolve,50));
    const serverSocket=io.sockets.sockets.get(socket.id);assert.ok(serverSocket.rooms.has(String(t1.id)));
    await t1.update({queueId:qOther.id});
    assert.ok(!serverSocket.rooms.has(String(t1.id)));
    socket.disconnect();await t1.update({queueId:q1.id});
  });
  let failed=0;
  for(const {name,fn} of tests) {
    try { await fn(); console.log('PASS '+name); }
    catch(error) { failed++;console.error('FAIL '+name+'\n'+error.stack); }
  }
  console.log(`RESULT ${tests.length-failed}/${tests.length} passed; isolated PostgreSQL/WASM, SMTP mocked, no production services`);
  await migration.down(database.getQueryInterface());
  const remaining=await database.getQueryInterface().describeTable('Users');
  assert.equal(remaining.resetTokenHash,undefined);console.log('PASS migration down executed inside isolated PostgreSQL/WASM');
  process.exitCode=failed?1:0;
})().catch(error=>{ console.error(error.stack);process.exitCode=1; }).finally(async()=>{
  io?.disconnectSockets(true);
  if(io) await new Promise(resolve=>io.close(resolve));
  else if(server?.listening) await new Promise(resolve=>server.close(resolve));
  if(pg) await pg.close();
  // Only the verified fresh OS temp directory belongs to this harness.
  if(path.dirname(temp)===os.tmpdir()&&path.basename(temp).startsWith('ticket-security-')) fs.rmSync(temp,{recursive:true,force:true});
});

