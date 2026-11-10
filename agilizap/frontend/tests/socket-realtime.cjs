const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const { once } = require('node:events');
const { createRequire } = require('node:module');
const ts = require('typescript');
const backendRequire = createRequire(path.resolve(__dirname, '../../backend/package.json'));
const { Server } = backendRequire('socket.io');
const source = path.resolve(__dirname, '../src/context/Socket/SocketContext.js');
const event = 'company-1-appMessage';

const waitFor = (socket, event) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { socket.off(event, done); reject(Error(`Timeout: ${event}`)); }, 3000);
  function done(...args) { clearTimeout(timer); resolve(args); }
  socket.once(event, done);
});

(async () => {
  const server = http.createServer();
  const io = new Server(server);
  io.on('connection', socket => {
    socket.on('joinChatBox', id => socket.join(String(id)));
    socket.on('leaveChatBox', id => socket.leave(String(id)));
    socket.on('joinTickets', status => socket.join(`tickets-${status}`));
    socket.on('leaveTickets', status => socket.leave(`tickets-${status}`));
    socket.on('joinNotification', () => socket.join('notification'));
    socket.on('leaveNotification', () => socket.leave('notification'));
    socket.on('barrier', callback => callback());
    socket.emit('ready');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const exports = {};
  const storage = new Map([['userId', '1']]);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(source, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
  }).outputText, {
    exports, require: name => {
      if (name.includes('sessionToken')) return { getSessionToken: () => 'test-token' };
      if (name === 'react-jwt') return { isExpired: () => false };
      return require(name);
    },
    localStorage: { getItem: key => storage.get(key) },
    process: { env: { REACT_APP_BACKEND_URL: `http://127.0.0.1:${server.address().port}` } },
    window: { location: { reload() { throw Error('Unexpected page reload'); } } },
    console: { log() {}, warn() {}, debug() {} }, setTimeout
  });
  const manager = exports.SocketManager;
  const barrier = () => new Promise((resolve, reject) => manager.currentSocket.timeout(3000).emit('barrier', error => error ? reject(error) : resolve()));
  const rooms = () => io.sockets.sockets.get(manager.currentSocket.id).rooms;
  const publish = async room => {
    const received = waitFor(manager.currentSocket, event);
    io.to(room).emit(event, { action: 'create', message: { id: 'incoming', ticketId: 7 } });
    await received;
  };
  try {
    const ticket = manager.getSocket('1');
    const ready = waitFor(manager.currentSocket, 'ready');
    const messages = manager.getSocket('1');
    ticket.on('ready', () => ticket.emit('joinChatBox', '7'));
    messages.on('ready', () => messages.emit('joinChatBox', '7'));
    messages.emit('joinTickets', 'open');
    let deliveries = 0;
    messages.on(event, () => deliveries++);
    await ready;
    await barrier();
    await publish('7');
    assert.equal(deliveries, 1, 'Initial incoming message reaches the mounted view');

    ticket.disconnect();
    await barrier();
    assert.ok(rooms().has('7'), 'Unmounting Ticket must preserve MessagesList subscription');
    await publish('7');
    assert.equal(deliveries, 2);

    for (let attempt = 0; attempt < 2; attempt++) {
      const reconnected = waitFor(manager.currentSocket, 'ready');
      manager.currentSocket.io.engine.close();
      await reconnected;
      await barrier();
      assert.ok(rooms().has('7'), 'Conversation room restored after transport reconnect');
      assert.ok(rooms().has('tickets-open'), 'Ticket list room restored after transport reconnect');
      await publish('7');
      assert.equal(deliveries, 3 + attempt, 'Exactly one delivery after reconnect');
    }

    const serverReconnect = waitFor(manager.currentSocket, 'ready');
    io.sockets.sockets.get(manager.currentSocket.id).disconnect(true);
    await serverReconnect;
    await barrier();
    assert.ok(rooms().has('7') && rooms().has('tickets-open'), 'Rooms restored after server-triggered reconnect');
    await publish('7');
    assert.equal(deliveries, 5);

    const notifications = manager.getSocket('1');
    notifications.on('ready', () => notifications.emit('joinNotification'));
    await barrier();
    assert.ok(rooms().has('notification'), 'Late subscribers join immediately');
    messages.disconnect();
    notifications.disconnect();
    await barrier();
    assert.ok(!rooms().has('7') && !rooms().has('tickets-open') && !rooms().has('notification'), 'Last subscriber leaves each room');
    assert.equal(manager.currentSocket.listeners(event).length, 0, 'Unmount removes event listeners');
    assert.equal(manager.currentSocket.listeners('ready').length, 1, 'Unmount preserves only the manager ready listener');
    assert.equal(manager.currentSocket.listeners('connect').length, 1, 'Managed wrappers do not leak connect listeners');

    const pending = manager.getSocket('1');
    manager.currentSocket.io.engine.close();
    let staleCallbacks = 0;
    pending.on('ready', () => staleCallbacks++);
    pending.disconnect();
    await waitFor(manager.currentSocket, 'ready');
    assert.equal(staleCallbacks, 0, 'Unmount removes pending ready callbacks');

    storage.set('userId', '2');
    const nextUser = manager.getSocket('1');
    let nextReady = false;
    nextUser.on('ready', () => { nextReady = true; });
    assert.equal(nextReady, false, 'Readiness resets when switching users');
    await waitFor(manager.currentSocket, 'ready');
    assert.equal(nextReady, true);
    nextUser.disconnect();
    console.log('PASS realtime: incoming delivery, shared rooms, repeated reconnects, cleanup and user switch');
  } finally {
    manager.currentSocket?.disconnect();
    await new Promise(resolve => io.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
