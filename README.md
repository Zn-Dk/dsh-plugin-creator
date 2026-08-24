# dsh-plugin-creator

一个用于**创建和迭代 DSH（DeepSeek Harness）out-of-tree Web 插件**的 Agent skill。

它把经过实践验证的插件开发流程、运行时边界与常见踩坑固化成一份可执行清单，覆盖从脚手架、Host/Client 装配、GUI 设置卡片、TDD 到发布验收的完整路径。

## 这个 skill 能帮你做什么

- **规划插件范围**：判断只要 Host 半区（后台逻辑/工具/命令/定时任务），还是需要 GUI（设置卡片/侧栏徽标）。
- **生成脚手架**：package.json、tsconfig.json、cordis.patch.yml，默认使用 TypeScript。
- **装配 Host 半区**：事件监听、工具、命令、settings namespace，并规避事件模型与生命周期泄漏等高频错误。
- **装配 Client 半区**：通过 settings RPC 桥接把 Host 配置暴露到 Web 设置页，并复用宿主视觉规范。
- **测试与发布**：TDD seam 划分、构建产物校验、pnpm pack + tgz 安装、CHANGELOG 演进。
- **收录**：发布后进 awesome-dsh-plugin 的门槛与 PR 流程（见 reference/AWESOME_LISTING.md）。

## 快速开始

1. 把本仓库放到 Agent 可识别的 skills 目录（例如 ~/.agents/skills/dsh-plugin-creator）。
2. 在对话中要求「创建一个 DSH 插件 / 给插件加设置页 / 排查插件问题」，Agent 会加载 SKILL.md。
3. 按工作流逐条推进：范围 -> 脚手架 -> 纯逻辑层 -> Host 装配 ->（可选）GUI -> 安装验证 -> code review -> CHANGELOG。

## 目录结构

```
dsh-plugin-creator/
├── SKILL.md                      # 主流程与必查清单
├── templates/                   # package.json / tsconfig.json / cordis.patch.yml / client.js 骨架
└── reference/                   # 各专题深度参考
    ├── EVENT_MODEL.md           # DSH agent 事件模型：全局 vs per-agent、effect 生命周期
    ├── CLIENT_BUNDLE.md         # client bundle 格式、settings RPC 桥接、GUI 排版规范
    ├── RELEASE_WORKFLOW.md      # pnpm pack + tgz 安装、CHANGELOG 模板
    ├── TDD_SEAMS.md             # 插件的 TDD seam 划分方式
    └── LLM_SEMANTIC_LAYER.md    # 插件内嵌 LLM 语义判定（初筛->prompt->子代理->解析）
```

## 语言与构建约定

- 新插件代码**首选 TypeScript**：源码放在 src/，通过 tsc 输出 lib/，DSH 运行时加载编译后的 lib/*.js。
- 只有明确要求使用 JavaScript 时，才改用 templates/client.js.template 等 JS 模板。

## 国际化（i18n）约定

- 默认只做**中英双语**（zh-CN + en），MVP 之后在迭代中作为 **P1 TODO** 完成。
- GUI 文案语言**读 Host locale 服务**（`ctx.get('locale')` → `register`/`bind`/`subscribe`，跟随 `locale.preference`），**不是 `navigator.language`**（浏览器语言不跟随 DSH Web UI 切换）；locale 不可用时兜底浏览器检测。
- 零配置，不做手动设置项。响应切换用 `React.useSyncExternalStore` 订阅。
- Client bundle 内置 zh/en 文案表（`I18N = { zh: {...}, en: {...} }`），JSX 不散落中文字符串；标点/分隔符也 i18n 化。

## 适用对象

面向 DSH cordis 插件开发者，尤其是需要 Web UI 设置卡片的插件。使用前建议先阅读 SKILL.md，并在需要细节时跳转 reference/ 对应专题。

## 许可证

[MIT](./LICENSE)
