/**
 * 无 Electron 的冒烟测试：用 server-manager 拉起真实的 interview-mate
 * 服务子进程，等就绪、验首页、收割。CI 与本地 `npm run smoke:server` 共用。
 *
 * exit 0 = 通过；1 = 失败。不依赖任何第三方包。
 */

'use strict';

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const {
  findFreePort,
  waitForReady,
  buildSpawnPlan,
  resolveServerPath,
} = require('../server-manager');

function get(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ statusCode: res.statusCode, body }));
      })
      .on('error', reject);
  });
}

async function main() {
  const repoRoot = path.join(__dirname, '..');
  const serverPath = resolveServerPath(repoRoot);
  const port = await findFreePort(3971);
  const plan = buildSpawnPlan({ electronBinary: null, serverPath, port });
  const child = spawn(plan.command, plan.args, {
    env: plan.env,
    stdio: 'ignore',
    windowsHide: true,
  });

  const cleanup = () => {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
      } else {
        child.kill('SIGTERM');
      }
    } catch {
      /* ignore */
    }
  };
  process.on('exit', cleanup);

  const base = `http://127.0.0.1:${port}`;
  try {
    const ready = await waitForReady(base, { timeout: 20000 });
    const page = await get(base);
    if (page.statusCode !== 200 || !/<!doctype html>/i.test(page.body)) {
      throw new Error(`首页异常：HTTP ${page.statusCode}`);
    }
    console.log(
      `SMOKE OK port=${port} ready=${ready.elapsed}ms bytes=${page.body.length}`
    );
    cleanup();
    process.exit(0);
  } catch (err) {
    console.error('SMOKE FAIL:', err.message);
    cleanup();
    process.exit(1);
  }
}

main();
