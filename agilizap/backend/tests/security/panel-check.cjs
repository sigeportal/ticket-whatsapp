/* HTTP acceptance against the fixed disposable panel, never an environment-supplied URL. */
const assert=require('node:assert/strict');
const base='http://127.0.0.1:18080',origin='http://homologacao.localhost:18081';
const results=[];
async function request(route,{token,method='GET',body}={}) {
  return new Promise((resolve,reject)=>{
    // Separate loopback client from the human browser; do not disable or bypass the real limiter.
    const req=require('node:http').request(base+route,{method,localAddress:'127.0.0.2',headers:{Origin:origin,...(token?{Authorization:`Bearer ${token}`}:{}) ,...(body?{'Content-Type':'application/json'}:{})}},response=>{
      let text='';response.setEncoding('utf8');response.on('data',chunk=>text+=chunk);response.on('end',()=>{let data;try{data=JSON.parse(text);}catch{data=text;}resolve({status:response.statusCode,data});});
    });
    req.setTimeout(15000,()=>req.destroy(Error('Test request timeout')));req.on('error',reject);req.end(body?JSON.stringify(body):undefined);
  });
}
async function test(name,fn){await fn();results.push(name);console.log('PASS '+name);}
async function login(email,extra={}){return request('/auth/login',{method:'POST',body:{email,password:'Homologacao123',...extra}});}
(async()=>{
  const status=await request('/__homologacao/status');assert.equal(status.data.isolated,true);assert.match(status.data.node,/^v22\./);
  const info=(await request('/__homologacao/data')).data;
  const own=info.fixtures.find(t=>t.queue==='Suporte A'),finance=info.fixtures.find(t=>t.queue==='Financeiro A'),other=info.fixtures.find(t=>t.queue==='Suporte B');
  const adminInfo=info.accounts.find(a=>a.email==='admin.a@example.invalid');
  await test('Senha incorreta negada para atendente e administrador',async()=>{
    assert.equal((await login('suporte.a@example.invalid',{password:'InvalidPass123'})).status,401);
    assert.equal((await login(adminInfo.email,{password:'InvalidPass123'})).status,401);
  });
  const admin=await login(adminInfo.email);assert.equal(admin.status,200);
  const adminToken=admin.data.token;
  const agent=await login('suporte.a@example.invalid');assert.equal(agent.status,200);const token=agent.data.token;
  await test('Administrador entra somente com email e senha',async()=>{
    assert.equal(admin.data.user.profile,'admin');assert.ok(adminToken);
  });
  await test('Leitura real por ID/UUID respeita empresa e fila',async()=>{
    assert.equal((await request('/tickets/'+own.id,{token})).status,200);
    for(const ticket of [finance,other]){
      assert.equal((await request('/tickets/'+ticket.id,{token})).status,403);
      assert.equal((await request('/tickets/u/'+ticket.uuid,{token})).status,403);
    }
  });
  await test('Lista real de tickets não contém fila ou empresa alheia',async()=>{
    const response=await request('/tickets?showAll=true&queueIds='+encodeURIComponent(JSON.stringify(agent.data.user.queues.map(q=>q.id))),{token});assert.equal(response.status,200);
    assert.ok(response.data.tickets.length);assert.ok(response.data.tickets.every(t=>t.id===own.id));
  });
  await test('Mídia legada fictícia exige sessão e vínculo autorizado',async()=>{
    const media=new URL(own.media).pathname;
    assert.equal((await request(media)).status,401);
    assert.equal((await request(media,{token})).status,200);
    assert.equal((await request(new URL(other.media).pathname,{token})).status,403);
  });
  await test('Atendente não promove conta nem acessa exportação em massa',async()=>{
    const id=info.accounts.find(a=>a.email==='suporte.a@example.invalid').id;
    assert.equal((await request('/users/'+id,{token,method:'PUT',body:{profile:'admin'}})).status,403);
    assert.equal((await request('/contacts/export',{token})).status,403);
    const csv=await request('/contacts/export',{token:adminToken});assert.equal(csv.status,200);assert.ok(!csv.data.includes('Suporte B'));
  });
  await test('Conta inicial permite acesso sem solicitar nova senha',async()=>{
    const first=await login('primeiro.a@example.invalid');assert.equal(first.status,200);assert.ok(first.data.token);
  });
  await test('Recuperação entrega somente à caixa simulada e responde genericamente',async()=>{
    const a=await request('/forgetpassword',{method:'POST',body:{email:'primeiro.b@example.invalid'}});
    const b=await request('/forgetpassword',{method:'POST',body:{email:'absent@example.invalid'}});
    assert.equal(a.status,202);assert.deepEqual(a,b);
    const mailbox=(await request('/__homologacao/data')).data.mailbox;
    const mail=mailbox.findLast(m=>m.to==='primeiro.b@example.invalid');assert.ok(mail);
    const resetToken=mail.text.match(/\b[a-f0-9]{64}\b/)[0];
    const reset={email:mail.to,token:resetToken,password:'ChangedTest123'};
    assert.equal((await request('/resetpasswords',{method:'POST',body:reset})).status,200);
    assert.equal((await request('/resetpasswords',{method:'POST',body:reset})).status,400);
    assert.equal((await login(mail.to,{password:'ChangedTest123'})).status,200);
  });
  const financeAccount=info.accounts.find(a=>a.email==='financeiro.a@example.invalid');
  await test('Bloqueio/desbloqueio revoga sessão sem restaurar token antigo',async()=>{
    const old=await login(financeAccount.email);assert.equal(old.status,200);
    try {
      assert.equal((await request('/users/'+financeAccount.id,{token:adminToken,method:'PUT',body:{blocked:true}})).status,200);
      assert.equal((await request('/tickets/'+finance.id,{token:old.data.token})).status,401);
      assert.equal((await login(financeAccount.email)).status,401);
    } finally {
      assert.equal((await request('/users/'+financeAccount.id,{token:adminToken,method:'PUT',body:{blocked:false}})).status,200);
    }
    assert.equal((await request('/tickets/'+finance.id,{token:old.data.token})).status,401);
  });
  await test('Transferência pelo controller revoga acesso à fila anterior',async()=>{
    const current=(await request('/tickets/'+own.id,{token:adminToken})).data;
    try {
      const destination=(await request('/tickets/'+finance.id,{token:adminToken})).data;
      assert.equal((await request('/tickets/'+own.id,{token:adminToken,method:'PUT',body:{queueId:destination.queueId,userId:null}})).status,200);
      assert.equal((await request('/tickets/'+own.id,{token})).status,403);
    } finally {
      assert.equal((await request('/tickets/'+own.id,{token:adminToken,method:'PUT',body:{queueId:current.queueId,userId:null,status:'pending'}})).status,200);
    }
  });
  await test('WhatsApp e pagamentos não podem ser ativados no ensaio',async()=>{
    assert.equal((await request('/whatsappsession/1',{token:adminToken,method:'POST',body:{}})).status,503);
    assert.equal((await request('/subscription',{token:adminToken,method:'POST',body:{}})).status,503);
  });
  await test('Logout real revoga token e impede reutilização',async()=>{
    assert.equal((await request('/auth/logout',{token,method:'DELETE'})).status,200);
    assert.equal((await request('/tickets/'+own.id,{token})).status,401);
  });
  console.log(`RESULT ${results.length}/${results.length} HTTP groups passed; PostgreSQL real, Node 22, integrations blocked`);
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
