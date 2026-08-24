---
name: dsh-plugin-creator
description: Scaffold and iterate a DSH (DeepSeek Harness) out-of-tree Web plugin — host half, client bundle, settings namespace, GUI card, tests, and release workflow. Use when the user wants to create, extend, or debug a DSH plugin (cordis-based), especially one with a Web UI settings card.
---

# DSH Plugin Creator

创建/迭代一个 DSH out-of-tree Web 插件的完整流程，把通用工程实践与已验证的踩坑点固化为清单，避免重复犯错。

## 何时用

用户要求：新建 DSH 插件、给现有插件加设置页/GUI、插件排版不对、插件装了但没反应、插件依赖报 `ERR_MODULE_NOT_FOUND`、准备发布/迭代版本号。

## 核心心智模型：两个半区

DSH 插件永远是 **Host 半区**（`lib/index.js`，Node，cordis 插件）+ **Client 半区**（`lib/client.js`，浏览器 bundle，可选）。两者通过 **RPC 通道**通信，不共享内存、不能互相 import。

- 只做后台逻辑（工具/命令/定时任务）→ 只需 Host 半区。
- 要加 GUI（侧栏徽标、设置页卡片）→ 两个半区都要，且要在 `package.json` 声明 `dsh.client`。

## 语言与构建约定（默认强制）

- 新插件及后续插件代码**首选 TypeScript**：Host、纯逻辑层、测试辅助代码，以及 Client bundle 的源文件默认使用 `.ts` / `.tsx`。
- DSH 运行时仍加载编译后的 JavaScript：TypeScript 源码放在 `src/`，通过 `tsc` 输出 `lib/`，`package.json` 的 `main` / `exports` 继续指向 `lib/*.js`；不要把未编译的 `.ts` 直接交给 DSH。
- 只有用户明确指定 JavaScript（例如「用 JS」「降级为 JavaScript」）时，才使用 `.js` 源文件或本 skill 中的 JavaScript fallback 模板。未明确指定时，不得因为示例、历史插件或个人习惯默认回退 JS。
- 选择 JavaScript fallback 时，必须在实现说明中注明是用户明确指定的例外；不得把 fallback 模板反向当成默认脚手架。
- TypeScript 不是把类型随意补在 JS 上：先确定 `tsconfig.json`、源码目录、构建产物目录和 `build`/`prepack` 脚本，再开始写实现；提交/打包前确认 `pnpm build` 能从干净安装产出所有 `lib/*.js`。
- **模块范式（Host 半区强制 ESM）**：`package.json` 必须带 `"type": "module"`，Host 侧 `lib/*.js`（无论 TS 编译产物还是 JS 降级源码）一律使用 `import`/`export`，**禁止**顶层 `require(...)` 与 `module.exports`。`require is not defined` 与 `'import'/'export' cannot be used outside module code` 这两条报错都来自 Host 文件 CJS/ESM 范式错配——前者是 ESM 文件里用了 `require`，后者是 `import/export` 被 Node 当成 CJS 加载（缺 `type:module` 或扩展名不对）。**唯一允许 `require` 的地方**是 Client bundle 的 `window.__ModuleLoader__.load({ factory: (require) => {...} })` 参数作用域，那是宿主注入的运行时，`require` 只在该闭包内有效，不能泄漏到 Host 文件。

## 国际化（i18n）约定（默认强制，P1 TODO）

- **默认只做中英双语**（zh-CN + en）。不引入更多语言，除非用户明确要求。
- **时机**：MVP 版本之后，在迭代中做。首版 MVP 可单语言（中文优先），但 **P1 TODO（重要但不紧急）**——在迭代 backlog 中保留 i18n 条目，不要拖到发布后才想起来。
- **GUI 文案语言来源**：跟随 DSH Web UI 当前语言（检测 `navigator.language` / `document.documentElement.lang`，宿主英文→英文，中文→中文），**不做手动语言设置项**（零配置，符合直觉）。除非用户明确要求设置项。
- **范围**：用户可见文案全覆盖——GUI（Client bundle 的按钮/标题/对话框/提示）、README（双语）、CHANGELOG（双语或按版本语言）。Host 侧错误消息/工具描述/Skill 正文建议直接英文（面向 agent 与开发者，天然中英通用）。
- **实现方式**：Client bundle 内置 `zh`/`en` 两个文案表（`const I18N = { zh: {...}, en: {...} }`），运行时按当前语言取表；不要在 JSX 里散落中文字符串字面量。

## 工作流

```
规划进度:
- [ ] 第 1 步：确定范围（纯 Host？还是要 GUI？）
- [ ] 第 2 步：脚手架 package.json + tsconfig.json + cordis.patch.yml（见 templates/；默认 TS）
- [ ] 第 3 步：TDD 写纯逻辑层（引擎/适配层/编排层），装配层最后写
- [ ] 第 4 步：Host 侧装配（事件监听、工具、命令、settings namespace）
- [ ] 第 5 步：（如需 GUI）Client 侧装配（settings RPC 通道 + settings.section 卡片）
- [ ] 第 6 步：安装验证（pnpm install → pnpm build → pnpm pack + tgz 安装，不用 link:）
- [ ] 第 7 步：code review（至少 2 轮，见「必查清单」）
- [ ] 第 8 步：CHANGELOG + 版本号 + commit
- [ ] 第 9 步（可选）：发布后收录（主渠道 awesome-dsh-plugin，可选追加两个社区 awesome 列表；见 reference/AWESOME_LISTING.md）
```

## 第 2 步：package.json / cordis.patch.yml 骨架

见 [templates/package.json.template](templates/package.json.template)、[templates/tsconfig.json.template](templates/tsconfig.json.template) 和 [templates/cordis.patch.yml.template](templates/cordis.patch.yml.template)。默认采用 `src/*.ts` / `src/*.tsx`，编译到 `lib/*.js`；只有用户明确指定 JavaScript 时，才改用 [templates/client.js.template](templates/client.js.template) 等 JS fallback 模板。

关键点：

- `exports["."]` 指向编译产物 `lib/index.js`（host），`exports["./client"]` 指向编译产物 `lib/client.js`（仅当有 GUI 时才加）。
- `dsh.bundle.patch` 永远指向 `./cordis.patch.yml`。
- `dsh.client`（仅 GUI 插件才需要）：`{ inject: [...], platform: "web" }`，inject 至少含 `@deepseek-ai/dsh-client-runtime`。
- 依赖其他插件提供的公共 API 时用 `peerDependencies`，不要 `dependencies`——宿主 profile 会统一装好，重复声明会造成版本冲突或体积膨胀。
- 若插件运行时 `import` 了 `schemastery`/`zod` 等库而它们不是自己代码的运行时唯一来源（比如宿主已经装了同版本），也走 `peerDependencies`。

## 第 3-4 步：Host 侧装配 —— 高频踩坑

**完整细节见 [reference/EVENT_MODEL.md](reference/EVENT_MODEL.md)。** 这是本 skill 最容易踩坑的部分，务必先读。

一句话摘要：
- `agent/created` 是**全局**事件（`ctx.on`）；`agent/turn-stopping` / `agent/status` / `agent/pre-step` 是**per-agent**事件，必须在 `agent.ctx.on` 上监听，不是全局 `ctx.on`。
- per-agent 监听器要包在 `agent.ctx.effect(() => { ...; return cleanup })` 里，这样 agent 销毁时自动清理——**没有 `agent/disposed` 事件**，别指望订阅它做清理。
- `ctx.settings.register(namespace, schema, {base, applies})` 对任何插件开放，不需要特殊权限；`base` 来自 `cordis.patch.yml` 的 `config`，`user` 层来自 `~/.dsh/settings.yaml` 的同名 section。这是「无 GUI 也能持久化配置+热更新」的最省事路径——**先用这个，GUI 是锦上添花，不是必需前提**。

## 第 5 步：GUI 设置卡片 —— 高频踩坑

**完整细节见 [reference/CLIENT_BUNDLE.md](reference/CLIENT_BUNDLE.md)。**

一句话摘要：
- `ctx.settings.register` 只解决 Host 侧持久化，**不会**自动出现在 Web 设置页；要有 GUI 卡片，必须额外：① Host 侧注册一个自定义 RPC 通道（`connection.rpc.handle(CHANNEL, handler)`）把 settings 的 get/mutate 包装成 client 可调用的接口；② Client 侧写 bundle 用 `ctx.slots.inject("settings.section", ...)` 注册卡片，卡片内部走这个 RPC 通道读写。
- Client bundle 是 `window.__ModuleLoader__.load({ id, factory: require => {...} })` 格式，**只能 require 白名单种子**：`react`、`react/jsx-runtime`、`@deepseek-ai/dsh-client-ui-primitives`。不能 import 任意 npm 包。
- slot 注册要传**组件函数本身**，不要用 `() => jsx(Component, null)` 包一层——那样面板会空白或崩溃。
- **排版不要凭感觉写 inline style**——应检查当前 DSH Web 宿主已有设置卡片的编译产物，提取其 CSS class 与 `page/section/sectionHeading/字段网格` 间距规范，逐项对齐。优先复用宿主视觉语言，而不是凭感觉调数值。

## 第 6 步：安装验证 —— 高频踩坑

- **不要用 `link:` 方式验收最终安装**。`dsh plugin --profile web add "link:..."` 不会把插件自己的 `dependencies`/`peerDependencies` 自动装进 profile，容易报 `ERR_MODULE_NOT_FOUND`，且掩盖真实的依赖缺口。
- **推荐方式**：`pnpm pack` 产出 `<name>-<version>.tgz`，再 `dsh plugin --profile web add ./<name>-<version>.tgz` 或直链安装，详见 [reference/RELEASE_WORKFLOW.md](reference/RELEASE_WORKFLOW.md)。
- 装完后必须**重启 `dsh web`**（client bundle、host 插件树都是启动时组装的，不支持插件级热插拔）。
- 出树插件目录本身要先 `pnpm install` 过一次（哪怕最终用 tgz 分发），否则本地测试都跑不起来。

## 第 7 步：必查清单（至少 2 轮 code review）

以下是高频问题类别，写代码时主动规避、review 时主动核对：

1. **硬编码开发机路径**：cliPath / dataDir / 任何绝对路径配置项，缺省值绝不能是开发机上的具体路径；应该是「留空 = 交给上游/环境解析」。
2. **事件模型误用**：全局 `ctx.on` 监听了本该 per-agent 的事件；反之亦然。
3. **生命周期泄漏**：per-agent 状态存进一个永不清理的 Map/数组；正确做法是 `agent.ctx.effect` 的 cleanup 里删除自己。
4. **错误吞掉当假成功**：内部函数 catch 了错误却返回一个「看起来正常但是空」的结果，导致上层调用方以为成功。约定：巡检类只读操作失败要 `throw`，让调用方决定日志/报错/降级；批量操作里单条失败可以吞、但要在结果里报告失败计数。
5. **自动化路径悄悄具备破坏性**：任何事件驱动/定时触发的自动路径，只要有「万一失控就会删数据」的分支（比如 autoPurge 开关），默认必须关闭且要在 review 里明确问「这个自动路径能不能被动词『删除/清理/覆盖』描述」。
6. **测试断言过宽**：只断言 `includes('--readonly')` 而不断言完整参数数组，会让「参数顺序错了但凭空包含了关键字」的 bug 溜过去。断言精确的完整数组/对象，别用宽松的 `includes`/`some`。
7. **测试命令本身跑不起来**：`package.json` 里 `scripts.test` 写的 glob/路径要在干净 checkout 里实测一次，不要只信任本地缓存状态。
8. **模块范式错配**：`package.json` 必须 `"type": "module"`；Host 侧 `lib/*.js` 用 `import`/`export`，不得有顶层 `require`/`module.exports`；Client bundle 的 `require` 只允许出现在 `window.__ModuleLoader__.load` 的 `factory` 闭包内。一见 `ReferenceError: require is not defined` 或 `'import'/'export' cannot be used outside module code` 即判定为 Host 文件 CJS/ESM 错配，不要去改逻辑、先对齐 `type` 与语法。若用户明确走 JS 降级，仍遵守 ESM 约束（用 `.js` + `type:module`，不是 `.cjs`/`module.exports`）。

## 第 8 步：CHANGELOG + 版本

- 格式：[Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) + [SemVer](https://semver.org/lang/zh-CN/)。
- 每次面向用户的变更分级记录：`新增`（feature）/`修复`（fix）/`变更`（breaking/chore），同步递增 `package.json` 的 `version`。
- 首个 MVP 版本可以是 `0.1.0`，把这一轮做的全部 feature 列进同一个版本条目，不用为内部迭代（比如 code review 修复）单独开版本号——只有**发布/验收节点**才切版本。
- `package.json` 的 `files` 数组要包含 `CHANGELOG.md`。
- 发布验收通过后按渠道策略收录：主渠道 awesome-dsh-plugin，可选追加 0xsline/awesome-deepseek-harness 与 AdamPlatin123/awesome-dsh-plugins；完整门槛、PR 格式与多仓库一致性见 [reference/AWESOME_LISTING.md](reference/AWESOME_LISTING.md)。

## 参考文件

- [reference/EVENT_MODEL.md](reference/EVENT_MODEL.md) —— DSH agent 事件模型完整细节（全局 vs per-agent，effect 生命周期）
- [reference/CLIENT_BUNDLE.md](reference/CLIENT_BUNDLE.md) —— client bundle 格式、settings RPC 桥接、GUI 排版规范提取方法
- [reference/RELEASE_WORKFLOW.md](reference/RELEASE_WORKFLOW.md) —— pnpm pack + tgz 直链安装、CHANGELOG 模板
- [reference/TDD_SEAMS.md](reference/TDD_SEAMS.md) —— 插件适用的 TDD seam 划分方式（引擎/适配层/编排层 vs 装配层）
- [reference/LLM_SEMANTIC_LAYER.md](reference/LLM_SEMANTIC_LAYER.md) —— 插件内嵌 LLM 语义判定（初筛→prompt→子代理→解析）
- [reference/AWESOME_LISTING.md](reference/AWESOME_LISTING.md) —— 发布后收录：awesome-dsh-plugin 主渠道 + 两个社区 awesome 列表的边界、门槛、PR 格式与 CI 判定
- [templates/](templates/) —— package.json / tsconfig.json / cordis.patch.yml 骨架（默认 TypeScript）；client.js.template 仅供用户明确指定 JavaScript 时使用

## 设计目标

- 将 Host、Client、RPC、settings、测试与发布步骤组织成可执行清单。
- 保持运行时边界清晰，优先使用可验证的纯逻辑 seam。
- 让默认脚手架直接适配公开仓库协作与可复现安装。
