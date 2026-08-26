# 语言与构建约定（详细）

本参考承载 SKILL.md「语言与构建约定」的完整细则。入口只保留判定性摘要，写实现前需要边界细节时读这里。

## TypeScript 默认

- 新插件及后续插件代码**首选 TypeScript**：Host、纯逻辑层、测试辅助代码，以及 Client bundle 的源文件默认使用 `.ts` / `.tsx`。
- DSH 运行时仍加载编译后的 JavaScript：TypeScript 源码放在 `src/`，通过 `tsc` 输出 `lib/`，`package.json` 的 `main` / `exports` 继续指向 `lib/*.js`；不要把未编译的 `.ts` 直接交给 DSH。
- 只有用户明确指定 JavaScript（例如「用 JS」「降级为 JavaScript」）时，才使用 `.js` 源文件或本 skill 中的 JavaScript fallback 模板。未明确指定时，不得因为示例、历史插件或个人习惯默认回退 JS。
- 选择 JavaScript fallback 时，必须在实现说明中注明是用户明确指定的例外；不得把 fallback 模板反向当成默认脚手架。
- TypeScript 不是把类型随意补在 JS 上：先确定 `tsconfig.json`、源码目录、构建产物目录和 `build`/`prepack` 脚本，再开始写实现；提交/打包前确认 `pnpm build` 能从干净安装产出所有 `lib/*.js`。

## 模块范式：Host 半区强制 ESM

- `package.json` 必须带 `"type": "module"`，Host 侧 `lib/*.js`（无论 TS 编译产物还是 JS 降级源码）一律使用 `import`/`export`，**禁止**顶层 `require(...)` 与 `module.exports`。
- 两条报错的根因判定（确定性，不猜）：
  - `ReferenceError: require is not defined` → ESM 文件里用了 `require`。
  - `'import'/'export' cannot be used outside module code` → `import/export` 被 Node 当成 CJS 加载（缺 `type:module` 或扩展名不对）。
  - 一见这两条，**先对齐 `type` 与语法，不要去改业务逻辑**。
- **唯一允许 `require` 的地方**是 Client bundle 的 `window.__ModuleLoader__.load({ factory: (require) => {...} })` 参数作用域，那是宿主注入的运行时；`require` 只在该闭包内有效，不能泄漏到 Host 文件。
- 若用户明确走 JS 降级，仍遵守 ESM 约束（用 `.js` + `type:module`，不是 `.cjs`/`module.exports`）。

## 确定性自检

- 提交/打包前跑 `scripts/check-esm.mjs`（见 scripts/ 目录）：扫描 Host 侧 `.js`/`.ts` 源码，断言无顶层 `require(` / `module.exports`，且 `require(` 只出现在 `factory` 闭包内。

## 依赖分层（实测）

- `@deepseek-ai/*` 内部包（cordis / schemastery / dsh-settings / dsh-client-* 等）**编译类型一律放 `devDependencies`**（仅 tsc 用），运行时由宿主 profile hoist；公共 npm 镜像装不到这些内部包，放 `dependencies` 会让下游 `npm install` 直接 E404。
- 依赖其他插件的公共 API 用 `peerDependencies`；宿主 profile 统一装好，重复声明会造成版本冲突。
- `schemastery` 若确实是自己代码的运行时唯一来源，可放 `dependencies`（参考 dsh-mnemon）。

## settings 注册签名（实测）

- `ctx.settings.register(ns, schema, { base, applies })`：`ns` 用 `settingsNamespace('kebab-case')` 工厂（`@deepseek-ai/dsh-settings`）；`schema` 必须是 schemastery（`z.object({...})`）。
- 类型推断用 `Schemastery.TypeT<typeof schema>`，**不是 zod 的 `z.infer`**（schemastery 没有 `z.infer`，会报 `'z' only refers to a type`）。
- `settings.get(ns)` 返回 resolved value；`settings.mutate(ns, ops: {op:'set'|'unset', path:string[]}[], expectedRevision?)` 返回 `Promise<void>`；`settings.writable` 是布尔。
- `ctx.connection` 类型由 `import type {} from '@deepseek-ai/dsh-client-connection'` 激活（仅 host 侧 GUI 桥接需要，编译期生效，运行时宿主注入）。
