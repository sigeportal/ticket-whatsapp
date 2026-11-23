// Exercise the actual incoming-message handlers without WhatsApp, downloads or paid AI calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const file = path.resolve(__dirname, '../../src/services/WbotServices/wbotMessageListener.ts');
const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
const functions = new Map();
const visit = node => {
  if (ts.isVariableDeclaration(node) && node.initializer) functions.set(node.name.getText(source), node.initializer.getText(source));
  ts.forEachChild(node, visit);
};
visit(source);
const extractContent = message => message?.documentWithCaptionMessage?.message || message?.viewOnceMessage?.message || message?.ephemeralMessage?.message || message;

function harness({ voice = 'texto', aiError = false, userId = null } = {}) {
  const calls = { ai: [], sent: [], persisted: [], summaries: [], transfers: [], provider: 0, errors: [] };
  const prompt = { id: 3, queueId: 9, companyId: 1, voice };
  const contact = { id: 2, name: 'Cliente', number: '5500000000000' };
  const ticket = { id: 7, companyId: 1, queueId: null, queue: null, userId, status: 'pending', contact,
    update: async data => Object.assign(ticket, data), reload: async () => ticket };
  const context = vm.createContext({
    path, fs, __dirname: path.dirname(file), randomUUID: () => 'summary-id',
    isNil: value => value == null,
    getTypeMessage: msg => Object.keys(msg.message || {})[0], extractMessageContent: extractContent,
    getBodyButton: () => undefined, msgLocation: () => undefined,
    MessageUtils: { getReactionMessage: msg => msg.message?.reactionMessage?.text },
    Sentry: { captureException: error => calls.errors.push(error), setExtra() {} },
    logger: { error: error => calls.errors.push(error), warn() {}, info() {} },
    Message: { findAll: async () => [], findOne: async () => null },
    Queue: { findByPk: async () => ({ id: 9, name: 'Suporte' }) },
    ShowWhatsAppService: async () => ({ id: 1, prompt, promptId: 3, queues: [] }),
    ShowPromptService: async () => prompt,
    generateAIResponse: async options => {
      calls.ai.push(options);
      if (aiError) throw Error('Provider unavailable');
      return { text: 'Como posso ajudar?', transferQueue: false };
    },
    verifyMessage: async msg => calls.persisted.push(msg),
    verifyMediaMessage: async msg => { calls.persisted.push(msg); return { mediaUrl: '/public/test.pdf' }; },
    UpdateTicketService: async ({ ticketData }) => { calls.transfers.push(ticketData.queueId); Object.assign(ticket, ticketData); },
    getRecipientJid: () => '5500000000000@s.whatsapp.net',
    CreateMessageService: async data => calls.summaries.push(data),
    isValidMsg: () => true, Setting: { findOne: async () => null },
    getContactMessage: async () => ({ id: 'contact-jid', name: 'Cliente' }),
    verifyContact: async () => contact,
    cacheLayer: { get: async () => '0', set: async () => {} },
    FindOrCreateTicketService: async () => ticket,
    FindOrCreateATicketTrakingService: async () => ({}), verifyRating: () => false,
    provider: async () => calls.provider++, VerifyCurrentSchedule: async () => null,
    console
  });
  for (const name of ['getBodyMessage', 'transferQueue', 'handleOpenAi', 'handleMessage']) {
    assert.ok(functions.has(name), name);
    context[name] = vm.runInContext(ts.transpileModule(`(${functions.get(name)})`, {
      compilerOptions: { target: ts.ScriptTarget.ES2020 }
    }).outputText, context);
  }
  const wbot = { id: 1, sendMessage: async (jid, payload) => {
    calls.sent.push({ jid, payload });
    return { key: { id: `out-${calls.sent.length}`, remoteJid: jid }, message: { conversation: payload.text } };
  } };
  const message = content => ({ key: { id: 'incoming', fromMe: false, remoteJid: '5500000000000@s.whatsapp.net' }, message: content });
  return { calls, context, ticket, wbot, contact, message };
}

(async () => {
  const tests = [
    ['PDFs and images without context receive a reply and reach the configured human queue', async () => {
      for (const voice of ['texto', 'pt-BR-FabioNeural']) for (const content of [
        { documentMessage: { mimetype: 'application/pdf', fileName: 'pedido.pdf' } },
        { documentMessage: { mimetype: 'application/pdf', title: 'pedido.pdf' } },
        { documentWithCaptionMessage: { message: { documentMessage: { mimetype: 'application/pdf', fileName: 'pedido.pdf', caption: '   ' } } } },
        { imageMessage: { mimetype: 'image/jpeg' } },
        { imageMessage: { mimetype: 'image/png', caption: '   ' } },
        { viewOnceMessage: { message: { imageMessage: { mimetype: 'image/jpeg' } } } }
      ]) {
        const h = harness({ voice });
        await h.context.handleMessage(h.message(content), h.wbot, 1);
        assert.ok(h.calls.sent.length > 0, 'Attachment-only message must not be silently ignored');
        assert.deepEqual(h.calls.transfers, [9]);
        assert.equal(h.calls.ai.length, 0, 'Do not pretend to read a document through a text-only AI request');
        assert.equal(h.calls.persisted.length, 3, 'Attachment, acknowledgment and transfer notice are persisted');
        assert.equal(h.ticket.useIntegration, false);
        assert.equal(h.ticket.promptId, null);
        assert.equal(h.calls.summaries.length, 1);
        assert.equal(h.calls.errors.length, 0);
      }
    }],
    ['Document caption is used for AI triage instead of the file name', async () => {
      for (const wrap of [false, true]) {
        const documentMessage = { mimetype: 'application/pdf', fileName: 'pedido.pdf', title: 'pedido.pdf', caption: 'Preciso corrigir uma nota fiscal' };
        const h = harness();
        const content = wrap ? { documentWithCaptionMessage: { message: { documentMessage } } } : { documentMessage };
        await h.context.handleMessage(h.message(content), h.wbot, 1);
        assert.equal(h.calls.ai.length, 1);
        assert.equal(h.calls.ai[0].userMessage, documentMessage.caption);
        assert.equal(h.calls.errors.length, 0);
      }
    }],
    ['Images with a caption use that context for AI triage', async () => {
      const h = harness();
      await h.context.handleMessage(h.message({ imageMessage: { caption: 'Erro ao emitir a nota fiscal', mimetype: 'image/png' } }), h.wbot, 1);
      assert.equal(h.calls.ai.length, 1);
      assert.equal(h.calls.ai[0].userMessage, 'Erro ao emitir a nota fiscal');
      assert.equal(h.calls.errors.length, 0);
    }],
    ['Reactions and reaction removal are persisted without triggering automation', async () => {
      for (const text of ['👍', '']) {
        const h = harness();
        await h.context.handleMessage(h.message({ reactionMessage: { key: { id: 'previous' }, text } }), h.wbot, 1);
        assert.equal(h.calls.persisted.length, 1);
        assert.equal(h.calls.ai.length, 0);
        assert.equal(h.calls.provider, 0);
        assert.equal(h.calls.sent.length, 0);
        assert.equal(h.calls.errors.length, 0);
      }
    }],
    ['Attachments in a human-owned ticket do not restart AI or change the queue', async () => {
      const h = harness({ userId: 12 });
      await h.context.handleMessage(h.message({ imageMessage: { mimetype: 'image/jpeg' } }), h.wbot, 1);
      assert.equal(h.calls.persisted.length, 1);
      assert.equal(h.calls.ai.length, 0);
      assert.equal(h.calls.transfers.length, 0);
      assert.equal(h.calls.sent.length, 0);
      assert.equal(h.calls.errors.length, 0);
    }],
    ['Text and audio continue through the normal AI flow', async () => {
      for (const content of [{ conversation: 'Preciso de ajuda' }, { audioMessage: { mimetype: 'audio/ogg' } }]) {
        const h = harness();
        await h.context.handleMessage(h.message(content), h.wbot, 1);
        assert.equal(h.calls.ai.length, 1);
        assert.equal(h.calls.sent.length, 1);
        assert.equal(h.calls.errors.length, 0);
      }
    }]
  ];
  let failed = 0;
  for (const [name, run] of tests) {
    try { await run(); console.log('PASS ' + name); }
    catch (error) { failed++; console.error('FAIL ' + name, error); }
  }
  process.exitCode = failed ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 1; });
