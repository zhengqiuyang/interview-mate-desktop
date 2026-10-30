/** server-manager 纯逻辑测试：node --test 直跑，不需要 Electron. */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const {
  findFreePort,
  waitForReady,
  buildSpawnPlan,
  resolveServerPath,
} = require('../server-manager');

test('findFreePort 返回可绑定的空闲端口', async () => {
  const port = await findFreePort(3971);
  assert.ok(Number.isInteger(port) && port > 0);
  // 拿到后必须真能绑
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.close(resolve);
    });
  });
});

test('findFreePort 遇占用自动上移', async () => {
  const blocker = net.createServer();
  await new Promise((resolve) => blocker.listen(0, '127.0.0.1', resolve));
  const busy = blocker.address().port;
  const port = await findFreePort(busy, 3);
  assert.notStrictEqual(port, busy);
  blocker.close();
});

test('waitForReady 对真实 HTTP 服务返回状态码', async () => {
  const server = net.createServer((socket) => {
    socket.end('HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const result = await waitForReady(`http://127.0.0.1:${port}`, { timeout: 3000 });
  assert.strictEqual(result.statusCode, 200);
  server.close();
});

test('waitForReady 超时抛错（不可连接端口）', async () => {
  // 占住一个端口但立刻拒绝连接：关掉 server 后端口通常立即释放，
  // 所以这里直接连一个几乎必然拒绝的端口（1）。
  await assert.rejects(
    waitForReady('http://127.0.0.1:1', { timeout: 1500, interval: 100 })
  );
});

test('buildSpawnPlan 注入 PORT/HOST 与 ELECTRON_RUN_AS_NODE', () => {
  const plan = buildSpawnPlan({
    electronBinary: '/fake/electron',
    serverPath: '/fake/server.js',
    port: 4123,
    host: '127.0.0.1',
  });
  assert.strictEqual(plan.command, '/fake/electron');
  assert.deepStrictEqual(plan.args, ['/fake/server.js']);
  assert.strictEqual(plan.env.ELECTRON_RUN_AS_NODE, '1');
  assert.strictEqual(plan.env.PORT, '4123');
  assert.strictEqual(plan.env.HOST, '127.0.0.1');
  assert.strictEqual(plan.env.INTERVIEW_MATE_DESKTOP, '1');
});

test('buildSpawnPlan 无 electronBinary 时用系统 node', () => {
  const plan = buildSpawnPlan({ serverPath: '/x/server.js', port: 1 });
  assert.strictEqual(plan.command, process.execPath);
});

const REPO_ROOT = path.join(__dirname, '..');
const hasSubmodule = fs.existsSync(path.join(REPO_ROOT, 'interview-mate', 'server.js'));

test('resolveServerPath 接受仓库根', () => {
  if (!hasSubmodule) return; // 未拉子模块的环境跳过
  const serverPath = resolveServerPath(REPO_ROOT);
  assert.ok(fs.existsSync(serverPath));
});

test('resolveServerPath 对缺失目录给出可操作报错', () => {
  assert.throws(() => resolveServerPath(path.join(REPO_ROOT, 'no-such-dir')), /submodule update/);
});

test('端到端：真实拉起 interview-mate 并等待就绪', async function () {
  if (!hasSubmodule) this.skip();
  const serverPath = resolveServerPath(REPO_ROOT);
  const port = await findFreePort(3971);
  const plan = buildSpawnPlan({ electronBinary: null, serverPath, port });
  const child = spawn(plan.command, plan.args, {
    env: plan.env,
    stdio: 'ignore',
    windowsHide: true,
  });
  try {
    const ready = await waitForReady(`http://127.0.0.1:${port}`, { timeout: 20000 });
    assert.strictEqual(ready.statusCode, 200);
  } finally {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
    } else {
      child.kill('SIGTERM');
    }
  }
});
