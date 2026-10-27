// Exercise the real save handlers with rejected HTTP requests, without a browser or live data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../src');
const handlers = {
  UserModal: ['handleSaveUser', 'userId'],
  ModalUsers: ['handleSaveUser', 'userId'],
  QueueModal: ['handleSaveQueue', 'queueId'],
  AnnouncementModal: ['handleSaveAnnouncement', 'announcementId'],
  ContactListDialog: ['handleSaveContactList', 'contactListId'],
  QuickMessageDialog: ['handleSaveQuickeMessage', 'quickemessageId'],
  TagModal: ['handleSaveTag', 'tagId'],
  ScheduleModal: ['handleSaveSchedule', 'scheduleId'],
  FileModal: ['handleSaveFileList', 'fileListId']
};
const initializer = (file, name) => {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  let found;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) found = node.initializer.getText(source);
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(found, name);
  return found;
};
(async () => {
  let checks = 0;
  for (const [component, [name, idField]] of Object.entries(handlers)) {
    for (const editing of [false, true]) for (const failure of [true, false]) {
      const events = [];
      const write = async () => {
        if (failure) throw { response: { status: 400, data: { error: 'ERR_PASSWORD_POLICY' } } };
        return { data: { id: 1, options: [] } };
      };
      const scope = {
        api: { post: write, put: write }, toastError: () => events.push('error'),
        toast: { success: () => events.push('success') }, i18n: { t: key => key },
        handleClose: () => events.push('close'), reload: () => {},
        user: { id: 1 }, loggedInUser: { id: 1, profile: 'admin' },
        companyId: 1, selectedQueueIds: [2], whatsappId: null,
        schedules: [], selectedPrompt: null, attachment: null, kanban: 0,
        contactId: null, setCurrentContact: () => events.push('reset'),
        initialContact: {}, setSchedule: () => events.push('reset'), initialState: {},
        FormData, setFiles: () => {}, [idField]: editing ? 1 : undefined
      };
      const save = vm.runInNewContext(`(${initializer(path.join(root, 'components', component, 'index.js'), name)})`, scope);
      const values = { name: 'Dados preservados', password: 'weak', email: 'test@example.invalid', options: [] };
      await save(values);
      assert.equal(events.includes('close'), !failure, `${component}: close after failure=${failure}`);
      assert.equal(events.includes('success'), !failure, component);
      assert.equal(events.includes('error'), failure, component);
      if (failure) assert.equal(events.includes('reset'), false, component);
      assert.equal(values.name, 'Dados preservados');
      checks++;
    }
  }
  // A failed upload must propagate through the FileModal save, retaining the form and files.
  const events = [];
  let rejectUpload;
  const saveFile = vm.runInNewContext(`(${initializer(path.join(root, 'components/FileModal/index.js'), 'handleSaveFileList')})`, {
    user: { id: 1 }, fileListId: 1, FormData,
    api: { put: async () => ({ data: { options: [{ name: 'Anexo', id: 2 }] } }),
      post: () => new Promise((resolve, reject) => { rejectUpload = reject; }) },
    toast: { success: () => events.push('success') }, toastError: () => events.push('error'),
    handleClose: () => events.push('close'), setFiles: () => events.push('reset'),
    i18n: { t: key => key }
  });
  const saving = saveFile({ options: [{ file: new Blob(['data']) }] });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(events, []);
  rejectUpload(new Error('Upload failed'));
  await saving;
  assert.deepEqual(events, ['error']);
  checks++;
  const source = fs.readFileSync(path.join(root, 'utils/passwordSchema.ts'), 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, TextEncoder, require: name => name === 'yup' ? require('yup') : { i18n: { t: key => key } }
  });
  const schema = exports.passwordSchema;
  for (const value of ['12345', 'abcdefgh', 'abcdefgh1', 'ABCDEFGH1', 'Abcdefgh', 'Aa1' + 'é'.repeat(35)]) {
    assert.equal(await schema.isValid(value), false, value);
    checks++;
  }
  for (const value of ['', 'Abcdefg1', 'Aa1' + 'é'.repeat(34), 'Aa1' + 'x'.repeat(69)]) {
    assert.equal(await schema.isValid(value), true);
    checks++;
  }
  console.log(`PASS ${checks} checks: save recovery, awaited upload and password policy`);
})().catch(error => { console.error(error); process.exitCode = 1; });
