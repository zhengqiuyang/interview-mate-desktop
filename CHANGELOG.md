# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- 系统托盘（常驻 + 快速回到窗口）
- electron-builder 打包产物（nsis / dmg / AppImage）与自动更新
- 本地转写（whisper.cpp sidecar）：口语回答自动落文字进复盘
- 面试季模式：菜单栏倒计时

## [0.1.0] — 2026-10-31

### Added

- Electron 桌面壳：单实例锁、1280×840 主窗口、中文菜单（打开数据文件夹 /
  GitHub / 视图缩放）、外链走系统浏览器。
- 服务子进程管理：自动探测空闲端口（3971 起）、就绪轮询、
  `ELECTRON_RUN_AS_NODE` 复用 Electron 自带 Node（用户机器无需装 Node）、
  退出时按进程树收割（Windows taskkill /T）。
- `--smoke` 冒烟通道：拉起服务→就绪→验首页→退出码 0/1。
- `server-manager` 纯逻辑模块：`node --test` 可测的端口探测 / 就绪等待 /
  启动计划组装；含真实子进程端到端用例。
- CI：ubuntu / windows / macOS × Node 20 / 22，子模块 checkout，
  单元 + 集成 + 真实服务冒烟。
- git submodule 打包 interview-mate（版本随主仓库 tag 演进）。

### Design notes

- 壳只做壳：不复制、不改 interview-mate 的任何业务逻辑；升级 =
  `git submodule update --remote`。
- 打包后的机器零额外依赖：服务子进程跑在 Electron 自带 Node 上。
