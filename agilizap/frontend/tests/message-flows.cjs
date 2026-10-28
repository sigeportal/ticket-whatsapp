const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../src/components');
const handler = (component, name, scope) => {
  const file = path.join(root, component, 'index.js');
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  let code;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) code = node.initializer.getText(source);
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(code, `${component}/${name}`);
  return vm.runInNewContext(`(${code})`, scope);
};
(async () => {
  let checks = 0;
  for (const failure of [false, true]) for (const signMessage of [false, true]) {
    const updates = [], requests = [];
    const scope = {
      inputMessage: '  Olá!  ', ticketId: 7, signMessage, user: { name: 'Admin' },
      replyingMessage: { id: 'quote-1', body: 'Conteúdo não confiável', mediaUrl: 'ignored' },
      setInputMessage: value => updates.push(['draft', value]), setLoading: value => updates.push(['loading', value]),
      setShowEmoji: () => {}, setReplyingMessage: value => updates.push(['quote', value]),
      toastError: () => updates.push(['error']),
      api: { post: async (url, data) => {
        requests.push(data); assert.equal(url, '/messages/7');
        assert.equal('mediaUrl' in data, false);
        assert.deepEqual(Object.keys(data.quotedMsg), ['id']);
        if (failure) throw Error('HTTP 403');
      } }
    };
    await handler('MessageInputCustom', 'handleSendMessage', scope)();
    assert.equal(requests[0].body, signMessage ? '*Admin:*\nOlá!' : 'Olá!');
    assert.equal(updates.some(([key]) => key === 'draft'), !failure);
    assert.equal(updates.some(([key]) => key === 'quote'), !failure);
    assert.equal(updates.at(-1)[1], false);
    checks++;
  }
  for (const failure of [false, true]) {
    const events = [];
    await handler('EditMessageModal', 'handleSave', {
      message: { id: 'msg-1' }, onClose: () => events.push('close'), toastError: () => events.push('error'),
      api: { post: async (url, data) => { assert.equal(url, '/messages/edit/msg-1'); assert.equal('mediaUrl' in data, false); if (failure) throw Error('HTTP 403'); } }
    })('Mensagem editada');
    assert.deepEqual(events, [failure ? 'error' : 'close']); checks++;
  }
  let greeting;
  await handler('TicketListItemCustom', 'handleSendMessage', {
    user: { name: 'Admin' }, toastError: error => { throw error; },
    api: { post: async (url, data) => { greeting = data; assert.equal(url, '/messages/7'); } }
  })(7);
  assert.equal('mediaUrl' in greeting, false); checks++;
  for (const failCompression of [false, true]) {
    const events = [], callbacks = [];
    const first = new File(['image'], 'image.png', { type: 'image/png' });
    const second = new File(['audio'], 'audio.mp3', { type: 'audio/mpeg' });
    const saving = handler('MessageInputCustom', 'handleUploadMedia', {
      medias: [first, second], FormData, ticketId: 7,
      Compressor: class { constructor(file, options) { callbacks.push(options); } },
      setLoading: value => events.push(['loading', value]), setPercentLoading: () => {},
      setMedias: () => events.push(['clear']), toastError: () => events.push(['error']),
      api: { post: async (url, data) => { assert.equal(data.getAll('medias').length, 2); assert.deepEqual(data.getAll('medias').map(f => f.name), ['image.png','audio.mp3']); events.push(['sent']); } }
    })({ preventDefault() {} });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(events.some(([key]) => key === 'sent'), false);
    if (failCompression) callbacks[0].error(Error('Compression failed')); else callbacks[0].success(first);
    await saving;
    assert.equal(events.some(([key]) => key === 'clear'), !failCompression);
    assert.equal(events.some(([key]) => key === 'sent'), !failCompression); checks++;
  }
  for (const stage of ['download', 'send', 'success']) {
    let cleared = false;
    await handler('MessageInputCustom','handleQuickAnswersClick',{
      api: { get: async () => { if(stage==='download')throw Error('HTTP 403');return {data:new Blob(['image'])}; } },
      handleUploadQuickMessageMedia: async () => stage === 'success',
      setInputMessage: () => { cleared=true; }, toastError: () => {}
    })({mediaPath:'/public/test.png',value:'Resposta'});
    assert.equal(cleared, stage==='success'); checks++;
  }
  const audio = new Blob([Buffer.alloc(10001)], { type: 'audio/mpeg' });
  let sentAudio = false;
  await handler('MessageInputCustom','handleUploadAudio',{
    ticketId:7, FormData, Mp3Recorder:{stop:()=>({getMp3:async()=>[[],audio]})},
    setLoading:()=>{},setRecording:()=>{},toastError:error=>{throw error;},
    api:{post:async(url,data)=>{assert.equal(url,'/messages/7');assert.equal(data.getAll('medias').length,1);assert.equal(data.has('mediaUrl'),false);sentAudio=true;}}
  })();
  assert.equal(sentAudio,true);checks++;
  for (const [component, name, idKey] of [
    ['AnnouncementModal','handleSaveAnnouncement','announcementId'],
    ['ScheduleModal','handleSaveSchedule','scheduleId'],
    ['CampaignModal','handleSaveCampaign','campaignId']
  ]) {
    let payload;
    const initialState = handler(component,'initialState',{companyId:1,moment:require('moment'),DEFAULT_CONFIRMATION_MESSAGE:'Aviso'});
    await handler(component,name,{
      [idKey]:1,initialState,attachment:null,user:{id:1},contactId:null,
      api:{put:async(url,data)=>{payload=data;}},toast:{success(){}},i18n:{t:key=>key},
      handleClose(){},setSchedule(){},setCurrentContact(){},initialContact:{},
      toastError:error=>{throw error;}
    })({...initialState,mediaPath:'stored.png',mediaUrl:'/public/stored.png',createdAt:'2026-01-01',id:1});
    for (const key of ['mediaPath','mediaUrl','createdAt','id']) assert.equal(key in payload,false,`${component}/${key}`);
    checks++;
  }
  console.log(`PASS ${checks} checks: text, quotes, editing, greeting, media, quick replies and audio`);
})().catch(error=>{console.error(error);process.exitCode=1;});
