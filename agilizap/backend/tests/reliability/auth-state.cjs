/* Isolated reliability tests for atomic authState persistence, backup recovery, lock cleanup, and legacy migration. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

process.env.NODE_ENV = 'test';
const sessionsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ticket-auth-state-'));
process.env.SESSIONS_DIR = sessionsRoot;

require('reflect-metadata');
require.extensions['.ts'] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
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

const source = path.resolve(__dirname, '../../src');
const originalLoad = Module._load;
Module._load = function (request, parent, ...rest) {
  let resolved;
  try {
    resolved = Module._resolveFilename(request, parent);
  } catch (_) {
    return originalLoad.call(this, request, parent, ...rest);
  }
  if (resolved === path.join(source, 'utils/logger.ts')) {
    const noop = () => {};
    return { logger: { info: noop, error: noop, warn: noop, debug: noop } };
  }
  if (resolved === path.join(source, 'models/Whatsapp.ts')) {
    return { __esModule: true, default: class Whatsapp {} };
  }
  return originalLoad.call(this, request, parent, ...rest);
};

const { default: authState, deleteSessionFiles, getSessionDir, getActiveAuthLockCount } = require(path.join(source, 'helpers/authState.ts'));
const { BufferJSON, initAuthCreds } = require('@whiskeysockets/baileys');

(async () => {
  // 1. Roundtrip of creds (with Buffers) and keys (including app-state-sync-key) without leftover .tmp files
  const wapp1 = { id: 101, session: '', update: async patch => Object.assign(wapp1, patch) };
  const s1 = await authState(wapp1);
  s1.state.creds.me = { id: '5567999990001@s.whatsapp.net', name: 'Suporte' };
  const expectedRegId = s1.state.creds.registrationId;
  await s1.saveState();

  const rawKeyData = Buffer.from('sync-key-secret');
  await s1.state.keys.set({
    'pre-key': { '1': { public: Buffer.from('pub-1'), private: Buffer.from('priv-1') } },
    'app-state-sync-key': { 'k:1': { keyData: rawKeyData } }
  });

  const dir1 = getSessionDir(101);
  const leftoverTmp = fs.readdirSync(dir1).filter(f => f.endsWith('.tmp'));
  assert.deepEqual(leftoverTmp, [], 'Atomic writes must not leave .tmp files behind');

  const s1Reload = await authState(wapp1);
  assert.equal(s1Reload.state.creds.registrationId, expectedRegId);
  assert.equal(s1Reload.state.creds.me.name, 'Suporte');
  assert.ok(Buffer.isBuffer(s1Reload.state.creds.noiseKey.public), 'noiseKey.public must revive as Buffer');
  const loadedKeys = await s1Reload.state.keys.get('app-state-sync-key', ['k:1']);
  assert.ok(loadedKeys['k:1']);
  assert.equal(Buffer.from(loadedKeys['k:1'].keyData).toString(), 'sync-key-secret');
  console.log('PASS 1. Atomic roundtrip preserves Buffers, app-state-sync-key, and leaves zero .tmp files');

  // 2. 20 concurrent writes serialize cleanly, produce valid JSON, and leak zero locks
  const writes = [];
  for (let i = 1; i <= 20; i++) {
    s1Reload.state.creds.accountSyncCounter = i;
    writes.push(s1Reload.saveState());
    writes.push(
      s1Reload.state.keys.set({
        session: { '5567988880001.0': Buffer.from(`session-state-${i}`) }
      })
    );
  }
  await Promise.all(writes);
  assert.equal(getActiveAuthLockCount(), 0, 'All file lock entries must be cleaned up after completion');
  const parsedCreds = JSON.parse(fs.readFileSync(path.join(dir1, 'creds.json'), 'utf8'), BufferJSON.reviver);
  assert.equal(parsedCreds.accountSyncCounter, 20);
  console.log('PASS 2. 20 concurrent writes produce valid JSON and zero leaked locks');

  // 3. Corrupted creds.json recovers automatically from creds.json.bak
  const credsPath = path.join(dir1, 'creds.json');
  assert.equal(fs.existsSync(`${credsPath}.bak`), true, 'creds.json.bak must exist after creds updates');
  fs.writeFileSync(credsPath, '{"corrupted":', 'utf8');
  const s1Recovered = await authState(wapp1);
  assert.equal(s1Recovered.state.creds.registrationId, expectedRegId, 'Should recover registrationId from creds.json.bak');
  assert.ok(Buffer.isBuffer(s1Recovered.state.creds.noiseKey.public));
  console.log('PASS 3. Corrupted creds.json recovers automatically from creds.json.bak');

  // 4. Key deletion (null) and deleteSessionFiles cleanup
  await s1Recovered.state.keys.set({ 'pre-key': { '1': null } });
  const deletedKeyResult = await s1Recovered.state.keys.get('pre-key', ['1']);
  assert.equal(deletedKeyResult['1'], null);
  assert.equal(fs.existsSync(path.join(dir1, 'pre-key-1.json')), false);

  await deleteSessionFiles(101);
  assert.equal(fs.existsSync(dir1), false, 'deleteSessionFiles must remove session directory');
  console.log('PASS 4. Key deletion and deleteSessionFiles clean up files cleanly');

  // 5. Legacy database session migration writes creds.json atomically and updates column
  const legacyCreds = initAuthCreds();
  const wappLegacy = {
    id: 202,
    session: JSON.stringify({ creds: legacyCreds }, BufferJSON.replacer),
    update: async patch => Object.assign(wappLegacy, patch)
  };
  const sLegacy = await authState(wappLegacy);
  assert.equal(wappLegacy.session, 'file_session');
  assert.equal(sLegacy.state.creds.registrationId, legacyCreds.registrationId);
  assert.equal(fs.existsSync(path.join(getSessionDir(202), 'creds.json')), true);
  assert.equal(getActiveAuthLockCount(), 0);
  console.log('PASS 5. Legacy DB session migrates atomically to creds.json');

  console.log('RESULT 5/5 passed; zero leaked locks');
})()
  .catch(err => {
    console.error('FAIL in auth-state test:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    fs.rmSync(sessionsRoot, { recursive: true, force: true });
  });
