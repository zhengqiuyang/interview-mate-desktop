/**
 * InterviewMate Desktop —— Electron 主进程.
 *
 * 生命周期：单实例锁 → 校验子模块 → 找空闲端口 → 以 ELECTRON_RUN_AS_NODE
 * 拉起 interview-mate 服务子进程 → 轮询就绪 → 开窗口 → 退出时收割子进程。
 *
 * `--smoke`：就绪后打印 SMOKE OK 并以 0 退出；失败以 1 退出。
 */

'use strict';

const { app, BrowserWindow, Menu, shell, dialog, clipboard } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const {
  findFreePort,
  waitForReady,
  buildSpawnPlan,
  resolveServerPath,
} = require('./server-manager');

const SMOKE = process.argv.includes('--smoke');
const DEFAULT_PORT = Number(process.env.IMD_PORT || 3971);

let mainWindow = null;
let serverChild = null;
let serverPort = DEFAULT_PORT;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

function killServer() {
  if (!serverChild || serverChild.killed) return;
  try {
    if (process.platform === 'win32') {
      // Windows：子进程可能再开子进程，按进程树杀
      spawn('taskkill', ['/pid', String(serverChild.pid), '/T', '/F'], {
        windowsHide: true,
      });
    } else {
      serverChild.kill('SIGTERM');
    }
  } catch {
    /* 收尾尽力而为 */
  }
  serverChild = null;
}

function logLine(text) {
  if (SMOKE) console.log(text);
}

async function startServer() {
  const serverPath = resolveServerPath(__dirname);
  serverPort = await findFreePort(DEFAULT_PORT);
  const plan = buildSpawnPlan({
    electronBinary: process.execPath,
    serverPath,
    port: serverPort,
  });
  serverChild = spawn(plan.command, plan.args, {
    env: plan.env,
    stdio: SMOKE ? ['ignore', 'pipe', 'pipe'] : 'ignore',
    windowsHide: true,
  });
  if (SMOKE) {
    serverChild.stdout.on('data', () => {});
    serverChild.stderr.on('data', (d) => process.stderr.write(d));
  }
  serverChild.on('exit', (code) => {
    if (!SMOKE && code && !app.isQuitting) {
      dialog.showErrorBox(
        'InterviewMate 服务已退出',
        `本地服务异常退出（code ${code}）。请检查 interview-mate 子模块是否完整。`
      );
    }
  });
  const base = `http://127.0.0.1:${serverPort}`;
  await waitForReady(base);
  return base;
}

function buildMenu(base) {
  const template = [
    {
      label: 'InterviewMate',
      submenu: [
        {
          label: '打开数据文件夹',
          click: () => shell.openPath(path.join(__dirname, 'interview-mate')),
        },
        {
          label: 'GitHub 仓库',
          click: () => shell.openExternal('https://github.com/zhengqiuyang/interview-mate'),
        },
        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制刷新' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '复制服务地址',
          click: () => clipboard.writeText(base),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow(base) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 980,
    minHeight: 640,
    title: 'InterviewMate · AI 面试陪练',
    backgroundColor: '#0f1115',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  // 外链一律交给系统浏览器，桌面壳内不跳走
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.loadURL(base);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  killServer();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('quit', killServer);

app.whenReady().then(async () => {
  let base;
  try {
    base = await startServer();
  } catch (err) {
    if (SMOKE) {
      console.error('SMOKE FAIL:', err.message);
      app.exit(1);
      return;
    }
    dialog.showErrorBox('InterviewMate 启动失败', String(err.message || err));
    app.exit(1);
    return;
  }

  if (SMOKE) {
    // 就绪后再确认一次首页真的可读
    http.get(base, (res) => {
      res.resume();
      if (res.statusCode === 200) {
        console.log(`SMOKE OK port=${serverPort}`);
        app.exit(0);
      } else {
        console.error(`SMOKE FAIL: HTTP ${res.statusCode}`);
        app.exit(1);
      }
    }).on('error', (err) => {
      console.error('SMOKE FAIL:', err.message);
      app.exit(1);
    });
    return;
  }

  buildMenu(base);
  createWindow(base);
});
