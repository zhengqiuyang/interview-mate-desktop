# Contributing to interview-mate-desktop

壳的纪律：**壳只做壳**。

## 三条边界

1. **不改业务**。面试、题库、评分、Agent 全部住在
   [interview-mate](https://github.com/zhengqiuyang/interview-mate) 主仓库。
   壳的 PR 不碰 `interview-mate/` 子模块内容（升级除外：
   `git submodule update --remote` + 版本号提交）。
2. **服务管理逻辑必须可测**。`server-manager.js` 保持纯 Node——不
   `require('electron')`，新功能先写 `node --test` 用例再接进 main.js。
3. **零第三方运行时依赖**。devDependencies 里只有 electron；主进程代码
   只用 Node 标准库 + Electron API。

## 本地开发

```bash
git clone --recurse-submodules https://github.com/zhengqiuyang/interview-mate-desktop
cd interview-mate-desktop
npm install
npm test            # node --test：端口探测 / 就绪等待 / 真实子进程端到端
npm run smoke:server # 无 Electron 的真实服务冒烟
npm start           # 打开桌面应用
npm run smoke       # Electron 冒烟：就绪后自动退出
```

## 打包

```bash
npm run dist   # electron-builder，配置见 electron-builder.yml
```

打包产物尚未进 CI（签名与发布流程待定），当前以源码运行 + `npm start`
为一等公民。

## 报 bug

附上：操作系统、Node 版本、`npm run smoke:server` 的输出。壳的问题看
主进程日志；页面功能问题请去主仓库。
