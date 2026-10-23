/* Fixed disposable endpoints only; never imports app/bootstrap or reads .env. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { Sequelize } = require('sequelize');
const Redis = require('ioredis');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true }
}).outputText, filename);
assert.ok(process.argv.includes('--container'), 'Run only inside the isolated Compose network');
const db = new Sequelize('security_homolog', 'security_test', 'disposable_test_only', {
  dialect: 'postgres', host: 'postgres', port: 5432, logging: false, pool: { max: 3 }
});
const redis = new Redis({ host: 'redis', port: 6379, password: 'disposable_test_only',
  lazyConnect: true, retryStrategy: () => null, connectTimeout: 5000 });
(async () => {
  await db.authenticate();
  const [tables] = await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
  assert.equal(tables.length, 0, 'Refusing a nonempty database: recreate disposable containers');
  await redis.connect();
  assert.equal(await redis.ping(), 'PONG');
  assert.equal(await redis.dbsize(), 0, 'Refusing Redis containing existing keys');
  await redis.set('security:probe', 'fictitious', 'EX', 10);
  assert.equal(await redis.get('security:probe'), 'fictitious');
  await redis.del('security:probe');
  console.log('PASS real Redis authentication and isolated expiring key');
  const dir = path.resolve(__dirname, '../../src/database/migrations');
  const migrations = fs.readdirSync(dir).filter(f => f.endsWith('.ts')).sort();
  for (const file of migrations) {
    if (file === '20261021000000-security-access.ts') {
      await db.query(`INSERT INTO "Users" (name,email,"passwordHash","createdAt","updatedAt","tokenVersion","resetPassword")
        VALUES ('Fictitious legacy','legacy@example.invalid','not-a-login-hash',now(),now(),7,'legacy-reset')`);
    }
    try { await require(path.join(dir, file)).up(db.getQueryInterface(), require('sequelize')); }
    catch (error) { throw new Error(`Historical migration failed: ${file}: ${error.message}`); }
    console.log('PASS migration ' + file);
  }
  const [constraints] = await db.query("SELECT count(*)::int AS count FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace");
  assert.ok(constraints[0].count > 0);
  console.log(`PASS complete historical chain: ${migrations.length} migrations, ${constraints[0].count} foreign keys`);
  const [users] = await db.query('SELECT * FROM "Users" WHERE email=\'legacy@example.invalid\'');
  assert.equal(users[0].tokenVersion, 8);
  assert.equal(users[0].resetPassword, null);
  assert.equal(users[0].blocked, false);
  console.log('PASS upgrade retains fictitious legacy user and invalidates legacy token/session');
  await assert.rejects(db.query('UPDATE "Users" SET "companyId"=2147483647 WHERE id=:id', { replacements: { id: users[0].id } }), /foreign key/);
  console.log('PASS historical company foreign key rejects nonexistent company');
  // Two separately acquired physical connections race the same conditional reset UPDATE.
  const a = await db.connectionManager.getConnection();
  const b = await db.connectionManager.getConnection();
  try {
    assert.notEqual(a.processID, b.processID);
    await db.query(`UPDATE "Users" SET "resetTokenHash"=repeat('a',64), "resetTokenExpiresAt"=now()+interval '30 minutes' WHERE id=:id`, { replacements: { id: users[0].id } });
    const sql = `UPDATE "Users" SET "resetTokenHash"=NULL,"resetTokenExpiresAt"=NULL,"tokenVersion"="tokenVersion"+1
      WHERE id=$1 AND "resetTokenHash"=repeat('a',64) AND "resetTokenExpiresAt">now() RETURNING id`;
    const results = await Promise.all([a.query(sql, [users[0].id]), b.query(sql, [users[0].id])]);
    assert.deepEqual(results.map(r => r.rowCount).sort(), [0, 1]);
    console.log('PASS single-use reset conditional SQL across two physical PostgreSQL connections');
  } finally {
    await db.connectionManager.releaseConnection(a);
    await db.connectionManager.releaseConnection(b);
  }
  const security = require(path.join(dir, '20261021000000-security-access.ts'));
  await security.down(db.getQueryInterface());
  const [afterDown] = await db.query('SELECT "tokenVersion","resetPassword" FROM "Users"');
  assert.equal(afterDown[0].tokenVersion, 9);
  assert.equal(afterDown[0].resetPassword, null);
  await security.up(db.getQueryInterface());
  console.log('PASS security down/up preserves user and does not resurrect revoked credentials');
})().catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(async () => { redis.disconnect(); await db.close(); });
