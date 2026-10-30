# InterviewMate Desktop

**把 [interview-mate](https://github.com/zhengqiuyang/interview-mate) 装进一个真正的桌面应用——双击图标，不是开终端敲 `npm start`。**

English | [简体中文](README.zh-CN.md)

> Electron 壳 · 子进程服务 · 零第三方运行时依赖 · 壳只做壳

[![CI](https://github.com/zhengqiuyang/interview-mate-desktop/actions/workflows/ci.yml/badge.svg)](https://github.com/zhengqiuyang/interview-mate-desktop/actions/workflows/ci.yml)
[![License: MIT](https://github.com/zhengqiuyang/interview-mate-desktop/blob/main/LICENSE)](LICENSE)
![Node](https://img.shields.io/badge/Node-18%2B-green)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

---

## Why a shell, not a rewrite

InterviewMate 已经是一个完整的本地 AI 面试陪练：智能体教练、模拟面试评分、
间隔重复、岗位雷达、简历工坊、技能市场——`server.js` + 纯静态前端，
**零第三方依赖**，数据全部落在本地文件夹。

它缺的只有一件事：一个双击就能打开的入口。

这个仓库就是那件事。**壳不复制、不改任何业务逻辑**：interview-mate 以
git submodule 随仓库分发，升级永远是 `git submodule update --remote`。

## How it works

```text
双击图标
   │
Electron 主进程
   ├─ 单实例锁（二次双击 → 聚焦已有窗口）
   ├─ 校验 interview-mate 子模块
   ├─ findFreePort(3971)          ← 端口冲突自动上移
   ├─ spawn(Electron 自带 Node, server.js)   ← ELECTRON_RUN_AS_NODE
   ├─ waitForReady(http://127.0.0.1:port)    ← 轮询就绪
   └─ BrowserWindow → loadURL
用户关闭窗口
   └─ 按进程树收割服务子进程（Windows taskkill /T /F）
```

关键设计：**服务子进程跑在 Electron 自带的 Node 上**（`ELECTRON_RUN_AS_NODE=1`
+ `process.execPath`）。打包后的机器不需要装 Node——桌面应用就该如此。

## Quick start

```bash
git clone --recurse-submodules https://github.com/zhengqiuyang/interview-mate-desktop
cd interview-mate-desktop
npm install
npm start
```

没有 Node 的机器？装完 Node 18+ 只需要上面四行；应用跑起来之后的事
（面试、题库、Agent、LLM 配置）全部在 interview-mate 主仓库的页面里完成。

## Verification

壳的每一条承诺都有自动化验证：

| 承诺 | 验证 |
|---|---|
| 端口探测与冲突上移 | `node --test`（占用 3971 → 断言拿到别的端口） |
| 就绪轮询与超时 | 对真实 HTTP 服务 + 对必拒端口各一条用例 |
| 启动计划（端口/HOST/RUN_AS_NODE 注入） | 纯函数断言 |
| 真实子进程能起来 | 端到端用例：spawn → 就绪 → 收割 |
| 整条链路 | `npm run smoke:server`（无 Electron）：真实拉起 interview-mate，实测 `ready=174ms` |
| 桌面壳整条链路 | `npm run smoke`（真 Electron 窗口）：`SMOKE OK port=3971`，退出码 0 |

CI 在 ubuntu / windows / macOS × Node 20 / 22 上跑全部（CI 里跳过 Electron
二进制下载，用 `smoke:server` 验证服务链路）。

## Configuration

| 环境变量 | 默认 | 说明 |
|---|---|---|
| `IMD_PORT` | `3971` | 服务首选端口（被占用自动 +1） |
| `IMD_READY_TIMEOUT` | `20000` | 就绪等待超时（毫秒） |

LLM 配置（API Key / Base URL / 模型）在应用页面的「设置」里填，属于
interview-mate 主仓库的职责，壳不碰。

## Packaging

```bash
npm run dist   # electron-builder → nsis / dmg / AppImage（配置见 electron-builder.yml）
```

打包配置已就位；签名与自动更新发布流程尚未接通（见路线图）。当前
`npm start` 源码运行是一等公民。

## Roadmap

- [ ] 系统托盘：常驻 + 快速回窗
- [ ] electron-builder 产物进 CI Release（签名待定）
- [ ] whisper.cpp sidecar：口语回答本地转写进复盘
- [ ] 面试季模式：菜单栏 D-Day 倒计时

## Contributing

壳的纪律（壳只做壳 / 服务管理逻辑必须可测 / 零第三方运行时依赖）见
[CONTRIBUTING.md](CONTRIBUTING.md)。

## License

[MIT](LICENSE) · interview-mate 子模块归其主仓库许可约束
