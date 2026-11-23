const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const file = path.resolve(__dirname, '../../src/services/AIServices/AIService.ts');
const exportsObject = {};
let systemPrompt;
class Gemini {
  getGenerativeModel(options) {
    systemPrompt = options.systemInstruction;
    return { startChat: () => ({ sendMessage: async () => ({ response: { text: () => 'Olá! Como posso ajudar?' } }) }) };
  }
}
class OpenAI {
  chat = { completions: { create: async options => {
    systemPrompt = options.messages[0].content;
    return { choices: [{ message: { content: 'Olá! Como posso ajudar?' } }] };
  } } };
}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
}).outputText, {
  exports: exportsObject, process: { env: {} },
  setTimeout: (callback, delay) => { const timer = setTimeout(callback, delay); timer.unref(); return timer; },
  require: name => {
    if (name === '@google/generative-ai') return { GoogleGenerativeAI: Gemini };
    if (name === 'openai') return OpenAI;
    if (name === 'fs' || name === 'path') return require(name);
    if (name.endsWith('/Queue')) return { findAll: async () => [] };
    if (name.endsWith('/logger')) return { logger: { warn() {}, info() {}, error() {} } };
    if (name === './AIBudgetService') return { checkCompanyAIBudget: async () => ({ allowed: true }), recordAIUsage: async () => {} };
    if (name === './AIAudioValidator') return { validateAudioForAI: async () => ({ valid: true }) };
    if (name === './AISanitizer') return { sanitizeAIResponse: text => ({ clientText: text, transferAction: { detected: false } }) };
    throw Error('Unexpected import: ' + name);
  }
});

(async () => {
  let checks = 0;
  for (const provider of ['gemini', 'openai']) for (const returning of [false, true]) {
    for (const name of ['14325236262626', '1 Cliente', '  9 Nome', '+5567999999999', '', '   ', null, undefined]) {
      const contact = { id: 2, name };
      const result = await exportsObject.generateAIResponse({
        prompt: { provider, apiKey: 'mock-key', prompt: 'Faça a triagem.', queueId: 9 },
        ticket: { id: 7, companyId: 1 }, contact, userMessage: 'Preciso de ajuda',
        historyMessages: returning ? [{ fromMe: true, body: 'Olá!', mediaType: 'chat', createdAt: new Date() }] : []
      });
      assert.equal(result.isFallback, undefined);
      assert.match(systemPrompt, /sem (?:usar|mencionar) (?:o )?nome/i);
      assert.ok(!systemPrompt.includes('O nome do cliente é'), 'Unknown contact must not be presented as a named person');
      if (name?.trim()) assert.ok(!systemPrompt.includes(name.trim()), 'Invalid identifier must not be included as the name');
      assert.equal(contact.name, name, 'Stored contact remains unchanged');
      checks++;
    }
    for (const name of ['Maria Silva', '  Ana Souza']) {
      await exportsObject.generateAIResponse({
        prompt: { provider, apiKey: 'mock-key', prompt: 'Faça a triagem.', queueId: 9 },
        ticket: { id: 7, companyId: 1 }, contact: { name }, userMessage: 'Olá'
      });
      assert.ok(systemPrompt.includes(`O nome do cliente é ${name.trim().split(' ')[0]}.`));
      checks++;
    }
  }
  console.log(`PASS ${checks} client-name checks: invalid identifiers omitted, neutral greeting and valid names preserved for both providers`);
})().catch(error => { console.error(error); process.exitCode = 1; });
