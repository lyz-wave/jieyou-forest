# 解忧森林 · 应用骨架

对应 [../docs/jieyou-forest-architecture.md](../docs/jieyou-forest-architecture.md) 第 6 节的目录结构。术语见 [../CONTEXT.md](../CONTEXT.md)。

## 安装就一步

```bash
pnpm install
pnpm dev
```

三条已验证的结论，别被网上的旧教程带偏：

1. **better-sqlite3 不需要为 Electron 重编译。** v13 是 N-API 模块（预编译包里 `napi_` 符号 60 个、V8 符号 0 个），同一份 `prebuilds/darwin-arm64.node` 在 Node 和 Electron 里都能加载。`electron-rebuild` / `install-app-deps` 都是多余的，唯一保留的 `rebuild:native` 脚本只是备用。
2. **Electron 二进制是首次运行时惰性下载的。** Electron 44 的 npm 包里已经没有 install 脚本（`scripts` 是空的），所以没有"装完还要再跑一步"这回事。
3. **pnpm 默认拦截构建脚本。** [pnpm-workspace.yaml](./pnpm-workspace.yaml) 里的 `allowBuilds` 已经放行 better-sqlite3 / esbuild / electron-winstaller，删掉它依赖会装不完整。
4. **别在 Electron 应用内置的终端里跑 `pnpm dev`。** 这类终端会带 `ELECTRON_RUN_AS_NODE=1`，Electron 会以纯 Node 启动，症状是 `TypeError: Cannot read properties of undefined (reading 'whenReady')`。用系统 Terminal / iTerm 就行，或 `env -u ELECTRON_RUN_AS_NODE pnpm dev`。

## 常用命令

| 命令 | 作用 |
| :--- | :--- |
| `pnpm dev` | 起 Electron 开发窗口 |
| `pnpm typecheck` | 类型检查 |
| `pnpm test` | 跑闸门、存储层、会话状态机的测试（不需要 Electron，0.3 秒） |
| `pnpm build` | 只构建，不打包 |
| `pnpm dist` | 打出 .app，产物在 release/ |

## 代码放哪

- `src/shared/ipc.ts` —— **主进程与渲染进程之间的唯一契约**。通道名只在这里写一次，两侧都引用它；改一个通道名会让 `main/ipc.ts` 与 `preload/index.ts` 同时编译报错。
- `src/main/` —— 闸门、编排、存储。渲染进程不发网络请求、不碰数据库、不做安全判断。
- `src/renderer/scenes/` —— 四幕各一个组件；`cards/` 是两张休息卡；`tree/` 是常驻的树。状态与动作集中在 `useSession.ts`，场景组件只负责画。

## 现在就能验证的事

模型是可选出站的（架构文档 §1）。`src/main/model/client.ts` 在没有 `FOREST_API_KEY` / `DEEPSEEK_API_KEY` 时整体禁用，此时：

- **承接层**走 `src/main/fallback/seed.ts` 的内置示例稿，并在同一屏强制显示横幅；
- **思考层**如实返回「未完成」，绝不填充示例稿。

也就是说，**默认状态就是架构文档 §5 失败矩阵里那两行**，不用断网就能演示。配上 key 之后：

```bash
FOREST_API_KEY=sk-xxx pnpm dev
```

## 测试覆盖了什么

| 文件 | 钉住的约定 |
| :--- | :--- |
| `src/main/gate/gate.test.ts` | 关键词独立判定、模型只能升级不能降级、更正永不解锁思考 |
| `src/main/gate/scenes.test.ts` | 6 个合成场景的期望判定（PRD §12.2） |
| `src/main/store/store.test.ts` | 保存幂等、行动年轮必填、删除可验证、清空可校验 |
| `src/main/orchestrate/session.test.ts` | 没有同意记录就没有认知挑战、未保存不落库 |
| `src/main/orchestrate/reflection.test.ts` | 引用必须逐字命中、思考层不兜底 |
| `src/shared/ipc.test.ts` | 通道名不重复、不跨 invoke/send 撞名、命名形状统一 |
| `src/renderer/App.test.tsx` | 四幕逐幕走查：休息路径全程、同意门槛、未完成不填兜底、L1 只出危机支持 |

其中 `App.test.tsx` 用 happy-dom 跑，配一个只实现契约、不碰 Electron 的假 API，所以它和主进程测试一样快（整个套件 0.5 秒）。
