/**
 * 服务管理纯逻辑模块 —— 不依赖 electron，可被 node --test 直接测试。
 *
 * 职责：
 *   1. 找一个空闲端口（从 preferred 起步向上探测）
 *   2. 等一个 HTTP 地址就绪（轮询 GET，超时即抛错）
 *   3. 组装子进程启动参数：复用 Electron 自带的 Node（ELECTRON_RUN_AS_NODE），
 *      这样打包后的应用不需要用户机器上装有 Node
 *   4. 校验 interview-mate 的位置
 */

'use strict';

const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');

const READY_TIMEOUT_MS = Number(process.env.IMD_READY_TIMEOUT || 20000);
const READY_INTERVAL_MS = 150;

function findFreePort(preferred, attempts = 25) {
  return new Promise((resolve, reject) => {
    let port = Number(preferred) || 3971;
    let tried = 0;
    const tryNext = () => {
      const server = net.createServer();
      server.unref();
      server.on('error', () => {
        tried += 1;
        port += 1;
        if (tried >= attempts) {
          reject(new Error(`连续 ${attempts} 个端口都被占用（${port - tried} 起）`));
          return;
        }
        tryNext();
      });
      server.listen(port, '127.0.0.1', () => {
        const found = server.address().port;
        server.close(() => resolve(found));
      });
    };
    tryNext();
  });
}

function waitForReady(url, { timeout = READY_TIMEOUT_MS, interval = READY_INTERVAL_MS } = {}) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, { timeout: 2000 }, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve({ statusCode: res.statusCode, elapsed: Date.now() - started });
          return;
        }
        retry();
      });
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', retry);
    };
    const retry = () => {
      if (Date.now() - started >= timeout) {
        reject(new Error(`等待 ${url} 就绪超时（${timeout}ms）`));
        return;
      }
      setTimeout(attempt, interval);
    };
    attempt();
  });
}

function buildSpawnPlan({ electronBinary, serverPath, port, host = '127.0.0.1' }) {
  // ELECTRON_RUN_AS_NODE：把 Electron 二进制当纯 Node 用 —— 打包后的机器
  // 不需要装 Node 也能跑服务子进程。
  const useElectronNode = Boolean(electronBinary);
  return {
    command: useElectronNode ? electronBinary : process.execPath,
    args: useElectronNode ? [serverPath] : [serverPath],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: String(port),
      HOST: host,
      // 告诉 interview-mate 它跑在桌面壳里（服务端横幅与日志用它区分）
      INTERVIEW_MATE_DESKTOP: '1',
    },
  };
}

function resolveServerPath(baseDir) {
  const serverPath = path.join(baseDir, 'interview-mate', 'server.js');
  if (!fs.existsSync(serverPath)) {
    throw new Error(
      `找不到 interview-mate 子模块（${serverPath}）。\n` +
      '请用 `git clone --recurse-submodules` 克隆本仓库，或执行：\n' +
      '  git submodule update --init --recursive'
    );
  }
  return serverPath;
}

module.exports = { findFreePort, waitForReady, buildSpawnPlan, resolveServerPath, READY_TIMEOUT_MS };
