/* Human acceptance entry point. Never run server.ts, workers, dotenv or real integrations. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const Module = require('node:module');
const net = require('node:net');
const ts = require('typescript');
const [major,minor]=process.versions.node.split('.').map(Number);
if (major !== 22 || minor < 19) throw Error('Use Node 22.19+');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ticket-panel-'));
// Discard inherited credentials; this process only accepts the fixed disposable endpoints below.
for (const key of Object.keys(process.env)) if (/^(DB_|REDIS|JWT_|MAIL_|MFA_|SENTRY|GERENCIANET|OPENAI|GEMINI|BOOTSTRAP|PLATFORM_|TEST_MEDIA)/.test(key)) delete process.env[key];
Object.assign(process.env, { NODE_ENV: 'test', TEST_MEDIA_ROOT: temp,
  FRONTEND_URL: 'http://homologacao.localhost:18081', BACKEND_URL: 'http://homologacao.localhost:18080',
  JWT_SECRET: crypto.randomBytes(48).toString('base64'), JWT_REFRESH_SECRET: crypto.randomBytes(48).toString('base64'),
  MAIL_HOST: 'smtp.invalid', MAIL_PORT: '587', MAIL_FROM: 'test@example.invalid', MAIL_USER: 'test', MAIL_PASS: 'fictitious',
  PLATFORM_MAINTENANCE_ENABLED: 'false' });
// Fail closed for outgoing connections, including HTTP/fetch/WebSocket SDKs.
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function(...args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  const options = typeof first === 'object' ? first : { port: first, host: typeof args[1] === 'string' ? args[1] : 'localhost' };
  if (!['127.0.0.1','localhost'].includes(options.host) || ![55441,56391].includes(Number(options.port))) {
    throw Object.assign(Error('HOMOLOGATION_OUTBOUND_BLOCKED'), { statusCode: 503 });
  }
  return connect.apply(this, args);
};
require('node:dgram').createSocket = () => { throw Error('HOMOLOGATION_UDP_BLOCKED'); };
for (const name of ['exec','execSync','execFile','execFileSync','spawn','spawnSync','fork']) require('node:child_process')[name] = () => { throw Error('HOMOLOGATION_PROCESS_BLOCKED'); };
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
    esModuleInterop: true, experimentalDecorators: true, emitDecoratorMetadata: true }
}).outputText, filename);
const source = path.resolve(__dirname, '../../src');
const load = name => require(path.join(source, name));
let database, server, frontend, io;
const mailbox = [];
const blocked = () => { throw Object.assign(Error('HOMOLOGATION_INTEGRATION_DISABLED'), { statusCode: 503 }); };
const disabled = new Proxy({ __esModule: true, default: blocked }, { get(target, key) { return key in target ? target[key] : blocked; } });
const originalLoad = Module._load;
Module._load = function(request, parent, ...rest) {
  if (request === 'dotenv') return { config: () => ({ parsed: {} }) };
  if (request === 'nodemailer') return { createTransport: () => ({ sendMail: async mail => { mailbox.push({ ...mail, at: new Date().toISOString() }); return { accepted: [mail.to] }; } }) };
  const resolved = Module._resolveFilename(request, parent);
  if (resolved === path.join(source, 'bootstrap.ts')) return {};
  if (resolved === path.join(source, 'database/index.ts')) return { __esModule: true, default: database };
  if (resolved === path.join(source, 'utils/logger.ts')) return { logger: Object.fromEntries(['info','error','warn','debug'].map(k => [k, value => console.log(JSON.stringify({ level: k, event: value?.event || 'application_event' }))])) };
  if (/[/\\]services[/\\](WbotServices|AIServices|BaileysServices)[/\\]/.test(resolved) ||
      /[/\\]helpers[/\\](authState|GetTicketWbot|UpdateDeletedUserOpenTicketsStatus)\.ts$/.test(resolved) ||
      resolved === path.join(source, 'libs/wbot.ts') || resolved === path.join(source, 'queues.ts')) return disabled;
  if (resolved === path.join(source, 'helpers/SetTicketMessagesAsRead.ts')) return { __esModule: true, default: async () => {} };
  return originalLoad.call(this, request, parent, ...rest);
};
const accounts = [];
const fixtures = [];
const password = 'Homologacao123'; // Fictitious, local-only accounts; never a production bootstrap.
async function main() {
  const { Sequelize } = require('sequelize-typescript');
  database = new Sequelize('security_panel','panel_test','disposable_panel_only', {
    dialect:'postgres', host:'127.0.0.1',port:55441,logging:false,pool:{max:5,min:0},retry:{max:0}
  });
  await database.authenticate();
  const [tables] = await database.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
  if (tables.length) throw Error('Refusing nonempty DB. Recreate ONLY panel-compose containers.');
  database.addModels(fs.readdirSync(path.join(source,'models')).filter(f=>f.endsWith('.ts')).map(f=>load('models/'+f).default));
  for (const f of fs.readdirSync(path.join(source,'database/migrations')).filter(f=>f.endsWith('.ts')).sort()) {
    await load('database/migrations/'+f).up(database.getQueryInterface(),require('sequelize'));
  }
  const model = name => load('models/'+name+'.ts').default;
  const Plan=model('Plan'),Company=model('Company'),Queue=model('Queue'),User=model('User'),Whatsapp=model('Whatsapp'),Contact=model('Contact'),Ticket=model('Ticket'),Message=model('Message');
  const plan=await Plan.create({name:'Plano fictício',users:20,connections:5,queues:10,value:0});
  for (const suffix of ['a','b']) {
    const company=await Company.create({name:'Empresa fictícia '+suffix.toUpperCase(),status:true,dueDate:'2099-12-31',planId:plan.id});
    const support=await Queue.create({name:'Suporte '+suffix.toUpperCase(),color:suffix==='a'?'#008800':'#880088',companyId:company.id});
    const finance=await Queue.create({name:'Financeiro '+suffix.toUpperCase(),color:suffix==='a'?'#008888':'#888800',companyId:company.id});
    const whatsapp=await Whatsapp.create({name:'Canal SIMULADO '+suffix,status:'DISCONNECTED',companyId:company.id,isDefault:true,session:'',qrcode:''});
    for (const [label,profile,queues,mustChangePassword] of [
      ['admin','admin',[support,finance],false],['supervisor','supervisor',[support],false],
      ['suporte','user',[support],false],['financeiro','user',[finance],false],['primeiro','user',[support],false]
    ]) {
      const email=`${label}.${suffix}@example.invalid`;
      const user=await User.create({name:`${label} ${suffix.toUpperCase()}`,email,password,profile,companyId:company.id,tokenVersion:0,blocked:false,mustChangePassword});
      await user.$set('queues',queues.map(q=>q.id));
      accounts.push({id:user.id,email,profile,company:company.name,queues:queues.map(q=>q.name),first:mustChangePassword});
    }
    for (const queue of [support,finance]) {
      const contact=await Contact.create({name:`Cliente fictício ${queue.name}`,number:`000${company.id}${queue.id}000000`,companyId:company.id,whatsappId:whatsapp.id,email:`cliente.${queue.id}@example.invalid`});
      const ticket=await Ticket.create({status:'pending',companyId:company.id,queueId:queue.id,contactId:contact.id,whatsappId:whatsapp.id,lastMessage:'Mensagem fictícia para homologação',unreadMessages:1});
      await Message.create({id:`fictitious-${ticket.id}`,body:'Mensagem fictícia para homologação. Nenhum WhatsApp está conectado.',ticketId:ticket.id,contactId:contact.id,companyId:company.id,fromMe:false,read:false,mediaType:'conversation'});
      const filename=`legacy-${ticket.id}.txt`;
      fs.writeFileSync(path.join(temp,filename),`Anexo fictício do ticket ${ticket.id}`);
      await Message.create({id:`fictitious-media-${ticket.id}`,body:filename,mediaUrl:filename,mediaType:'document',ticketId:ticket.id,contactId:contact.id,companyId:company.id,fromMe:false,read:true});
      fixtures.push({id:ticket.id,uuid:ticket.uuid,company:company.name,queue:queue.name,media:`http://homologacao.localhost:18080/public/${filename}`});
    }
  }
  const express=require('express');
  const host=express();
  host.use((req,res,next)=>{
    if (!['homologacao.localhost:18080','127.0.0.1:18080'].includes(req.headers.host)) return res.sendStatus(403);
    next();
  });
  host.get('/__homologacao/status', (req,res)=>res.json({isolated:true,node:process.version,companies:2,accounts:accounts.length,externalIntegrations:'blocked'}));
  // The local workbench intentionally exposes ONLY fictitious mailbox; never deploy this entry point.
  host.get('/__homologacao/data', (req,res)=>{
    if(req.headers.origin && req.headers.origin!==process.env.FRONTEND_URL) return res.sendStatus(403);
    res.setHeader('Access-Control-Allow-Origin',process.env.FRONTEND_URL);
    res.setHeader('Cache-Control','no-store');
    return res.json({accounts,password,fixtures,mailbox});
  });
  host.use((req,res,next)=>{
    if (/^\/(whatsappsession|subscription|subscribe|payments|webhook)/i.test(req.path)) return res.status(503).json({error:'HOMOLOGATION_INTEGRATION_DISABLED'});
    next();
  });
  host.use(load('app.ts').default);
  server=require('http').createServer(host);
  io=load('libs/socket.ts').initIO(server);
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(18080,'127.0.0.1',resolve);});
  const site=express();
  site.use((req,res,next)=>{
    if(!['homologacao.localhost:18081','127.0.0.1:18081'].includes(req.headers.host)) return res.sendStatus(403);
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: http://homologacao.localhost:18080; font-src 'self' data:; connect-src 'self' http://homologacao.localhost:18080 ws://homologacao.localhost:18080; media-src 'self' blob: http://homologacao.localhost:18080; frame-src 'none'; object-src 'none'");
    res.setHeader('Cache-Control','no-store');next();
  });
  const build=path.resolve(__dirname,'../../../../.security-work/panel/frontend');
  site.use(express.static(build,{index:false}));
  site.get('/__homologacao',(req,res)=>res.sendFile(path.join(__dirname,'workbench.html')));
  site.get('*',(req,res)=>res.sendFile(path.join(build,'index.html')));
  frontend=await new Promise((resolve,reject)=>{const s=site.listen(18081,'127.0.0.1',()=>resolve(s));s.once('error',reject);});
  console.log('PANEL_READY http://homologacao.localhost:18081/__homologacao');
  const stateDir=path.resolve(__dirname,'../../../../.security-work/panel');
  fs.mkdirSync(stateDir,{recursive:true});
  fs.writeFileSync(path.join(stateDir,'state.json'),JSON.stringify({pid:process.pid,temp}));
}
async function shutdown() {
  io?.disconnectSockets(true); if(io) await new Promise(r=>io.close(r));
  else if(server?.listening) await new Promise(r=>server.close(r));
  if(frontend) await new Promise(r=>frontend.close(r));
  if(database) await database.close();
  if(path.dirname(temp)===os.tmpdir()&&path.basename(temp).startsWith('ticket-panel-'))fs.rmSync(temp,{recursive:true,force:true});
}
process.on('SIGINT',()=>shutdown().finally(()=>process.exit()));
process.on('SIGTERM',()=>shutdown().finally(()=>process.exit()));
main().catch(async error=>{console.error(error.stack);await shutdown();process.exitCode=1;});
