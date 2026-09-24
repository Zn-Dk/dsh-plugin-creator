# Client Bundle：格式、Host 服务访问、GUI 排版

本参考聚焦从无 GUI 到有 GUI 的实现路径，以及设置卡片排版的通用教训。

## 为什么 settings namespace 不够

`ctx.settings.register(ns, schema, {base, applies:'live'})` 只解决 **Host 侧**持久化+热更新（配置进 `~/.dsh/settings.yaml`）。它**不会**自动在 Web 设置页出现任何 UI——那是完全独立的另一层，需要显式打通：

```
Host settings namespace  (ctx.settings.register)
        ↑↓ 由 api-gateway 自动暴露（/api 单通道）
Client 设置卡片           (ctx.slots.register 'settings.plugin.item' | 'settings.section')
        ↑↓ 直接调 ctx.remote.settings / ctx.remote.credentials
```

**关键**：读写走 **`ctx.remote.*`**（api-gateway 生成并注入的 Remote 命名空间），**不要自己接 RPC 管子**。见下一节。

## Client 侧读写 Host 服务：用 `ctx.remote.*`（强制）

**这是最容易踩的坑。** 老写法 `ctx.get('connection').api.credentials` / `ctx.connection.api.*` **已经失效**——`ctx.connection` 的真实形状只有 `isLoopback` / `generation` / `state` / `rpc` / `reconnect` / `registerGenerationSource` / `start`，**没有 `.api` 字段**。照抄会直接报：

```
Uncaught TypeError: Cannot read properties of undefined (reading 'credentials')
```

正确姿势（权威参照：harness `packages/client/ui-settings-models/src/client/operations.ts` 与 `index.ts`）：

```js
// 1) inject 必须显式声明每一个用到的命名空间，否则 cordis 解析成 undefined
const inject = ["slots", "connection", "remote", "remote.credentials", "remote.settings", "remote.llm"]

function apply(ctx) {
  // 2) inject 声明的服务在 apply() 运行前已解析，直接访问即可（无需 ctx.get）
  const remote = ctx.remote
  if (!remote || !remote.credentials || !remote.settings) return   // 防御性守卫
  const api = { credentials: remote.credentials, settings: remote.settings, llm: remote.llm }
  // ...注册 slot
}
```

### Remote 调用签名与返回值（实测）

```js
await ctx.remote.credentials.describe([ref])          // → { ok, value: { [ref]: {configured, writable, source?} } }
await ctx.remote.credentials.set(ref, value)          // 位置参数！不是 set({ref, value})
await ctx.remote.credentials.unset(ref)
await ctx.remote.settings.describe()                  // → { ok, value: { writable, hasDocument, namespaces: [{ns, value, revision, ...}] } }
await ctx.remote.settings.mutate(ns, ops, expectedRevision)  // 位置参数！不是 mutate({ns, ops, ...})
await ctx.remote.llm.listProviders()                  // → LlmProviderInfo[] = {id, name}[]（**没有 active 字段**）
await ctx.remote.llm.listConfigurableProviders()
await ctx.remote.llm.discoverModels(settingsNs, request)
```

**返回值统一是 `{ ok: true, value } | { ok: false, error }`**，不是 `res.result.ok`（那是更老的包装，已不存在）：

```js
const res = await api.credentials.set(KEY_REF, value)
if (res && res.ok) { /* 成功 */ } else { setMsg(res?.error?.message || "failed") }
```

### 推送式失效通知

用 `ctx.remote.$on(...)` 订阅，配合 `ctx.effect` 统一清理：

```js
ctx.effect(() => {
  const disposers = [
    remote.$on("credentials/reference-updated", refresh),
    remote.$on("settings/document-updated", refresh),
    remote.$on("llm/adapters-updated", refresh),
    ctx.on("connection/reset", refresh),
  ]
  return () => { for (const d of disposers) if (typeof d === "function") d() }
}, "my-plugin: pushed invalidations")
```

### 没有的能力不要假装有

DSH **没有**通用的「打开文件夹」Remote。`settings` 命名空间只有 `openSettingsDocument` / `openAgentPresetDirectory` 这类专用方法。想做「打开日志目录」只能退化为**显示路径 + 点击复制到剪贴板**，不要留一个永远点不动的按钮（假功能）。

> 自查：Harness 源码的 `packages/api/*/src/*.ts` 是 Remote 命名空间的权威来源（`super(ctx, 'xxx', { namespace: 'yyy' })` + `@Remote` 标注的方法）；客户端用法看 `packages/client/ui-*/src/client/`。

## Client Bundle 格式契约

`lib/client.js` **不是普通 ES module**，是宿主注入的模块加载器格式：

**只能 require 种子白名单（共 7 词）**：`react`、`react/jsx-runtime`、`react-dom`、`react-dom/client`、`@deepseek-ai/cordis`、`@deepseek-ai/dsh-client-ui-slots`、`@deepseek-ai/dsh-client-ui-primitives`；另有 preload 词 `@deepseek-ai/dsh-client-runtime/client`（走 inject 注入，不是 require）。其余 npm 包一律不能 require。⚠️ 不要照抄 dsh-session-explorer build-client.mjs 的 EXTERNALS（含 `@deepseek-ai/dsh-client-web-react`、`@deepseek-ai/dsh-client-ui-attachment`、`@deepseek-ai/dsh-client-schema-form` 等残留词，非种子词，运行时 require 会 miss）。各种子包的重点导出、primitives 组件清单与用法见 [UI_COMPONENTS.md](UI_COMPONENTS.md)。

```js
window.__ModuleLoader__.load({
  id: "my-plugin",
  factory: (require) => {
    const bundleModule = { exports: {} }
    Object.defineProperty(bundleModule.exports, Symbol.toStringTag, { value: "Module" })
    const react = require("react")                              // ✅ 种子词
    const jsx = require("react/jsx-runtime").jsx                 // ✅ 种子词
    const reactDomClient = require("react-dom/client")           // ✅ 种子词
    const { Tooltip } = require("@deepseek-ai/dsh-client-ui-primitives") // ✅ 种子词（官方组件库）
    // require("lodash") / require("@deepseek-ai/dsh-client-web-react") 等 —— ❌ 不允许（非种子词，构建时不会打包进去）

    function SettingsCard() {
      // 卡片组件自己读服务：用模块级 ctx 引用（settings.plugin.item 的 owner
      // props 是空的，tab 不注入任何值），或在 apply 里闭包 api 后用 inject 传。
      const remote = getCtx().remote
      // ...用 remote.credentials / remote.settings
    }

    function apply(ctx) {
      ctxRef = ctx
      const remote = ctx.remote
      if (!remote || !remote.credentials || !remote.settings) return

      // 首选：编辑自己 namespace 的插件卡片 → configurable-plugins tab
      ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
        name: "settings.plugin.item",
        id: "my-plugin",
        key: "<settings-namespace>",   // keyed：tab 按它和 Host namespace 配对
        order: 30,                     // 决定 tab 内排序，参考其他插件避免撞车
        locale: "<locale-ns>",         // 可选：卡片文案的 locale 命名空间
      }, SettingsCard))                // ⚠️ 直接传函数本身，不要 () => jsx(SettingsCard, null) 包一层

      // 备选：想要一个完整设置分区页（官方 models 卡仍在用）
      // ctx.slots.inject("settings.section", () => ctx.slots.register({
      //   name: "settings.section",
      //   id: "my-plugin",
      //   order: 20.5,
      //   label: () => "我的插件",
      //   inject: () => ({ api }),    // 只传组件真正需要的值
      // }, SettingsSection))
    }

    bundleModule.exports.apply = apply
    // 每个用到的 remote 命名空间都要显式声明，否则解析为 undefined
    bundleModule.exports.inject = ["slots", "connection", "remote", "remote.credentials", "remote.settings", "remote.llm"]
    return bundleModule.exports
  },
})
```

**踩坑记录**：
- slot 注册若写成 `register({...}, () => jsx(Component, null))`，面板会渲染空白甚至崩溃——必须直接传组件函数：`register({...}, Component)`。
- `inject` 数组漏声明 `remote.*` 时，`ctx.remote.credentials` 是 `undefined`，组件一渲染/一点击就抛 `Cannot read properties of undefined`。**症状是「装了插件但一交互就崩」**。
- 形状契约（2026-09-24 实测，曾在此栽过）：`settings.describe()` 的 value 是 **`{ namespaces: [...] }` 包装对象**，`credentials.describe()` 的 value 是 **按引用键控的 map**（`value[ref]`）——**都不是裸数组**，别把 `.find()` / `[0]` 直接使上去。

## ⚠️ 自建 RPC 通道已在 0.1.5 废弃（真实事故）

**不要**再写「Host 侧 `connection.rpc.handle(channel, ...)` + Client 侧 `connection.rpc.call(channel, ...)`」的自建通道。rc.1 起：

- 官方 client 插件已全部迁到 `ctx.remote.*` + `/api` 单通道；`connection.rpc.handle` 只剩网关内部使用。
- 自建通道的症状极具误导性：**插件树加载正常、GUI 不报 import 错，但每个调用落到静态 fallback 返回 HTTP 405**（`transport failure for /<channel>/<endpoint>: HTTP 405`）。
- 根因是静默的：注册内部依赖 `owner.webServer`，而插件 ctx 未声明该服务时 cordis 的 reflect proxy 直接抛错，异常被 effect runner 吞掉、无任何日志。
- 判断法则：**看到自定义 channel 的 405，不要修通道，把 client 半重写成 `ctx.remote.*`**——重构比修复快（用户原话）。参照实现：`dsh-llm-stepfun` 的 `src/client.ts`（与 harness `packages/client/ui-settings-models/src/client/` 同构）。

## GUI 排版：不要凭感觉写 inline style

这是最容易反复返工的环节。教训：

1. **第一轮失败**：所有字段用 inline style 手写 `gap`，字段之间距离肉眼看着不对，但说不清哪里错。
2. **第二轮失败**：调大调小 gap 数值，视觉上「勉强能看」但依然不是宿主的视觉语言（字号、圆角、灰度都对不上）。
3. **推荐做法**：读取一个真实宿主设置卡片的编译产物，提取其内联 CSS 字符串、类名和数值，逐项对齐。

**正确做法**：

```bash
# 找到一个真实设置卡片的编译产物
grep -oE '\.[a-zA-Z0-9_-]+[a-zA-Z0-9_-]*_[a-zA-Z]+' /path/to/host-plugin/lib/client.js | sort -u
# 挑几个关键类名逐个提取完整规则
grep -oE '\.[a-zA-Z0-9_-]*page\{[^}]+\}' /path/to/host-plugin/lib/client.js
grep -oE '\.[a-zA-Z0-9_-]*sectionHeading h2\{[^}]+\}' /path/to/host-plugin/lib/client.js
```

标准层级规范（从宿主设置卡片提取，可直接复用）：

| 层级 | 规则 |
|---|---|
| 页面容器 | `max-width:720px; gap:28px; padding-bottom:28px; display:flex; flex-direction:column` |
| 页头 | `h1{font-size:16px;font-weight:500;line-height:24px;margin:0}` + `p{font-size:14px;line-height:22px;margin:8px 0 0;color:label-tertiary}` |
| 分区（section） | `gap:12px; display:flex; flex-direction:column`，每个分区自带标题行 |
| 分区标题行 | `h2{font-size:14px;font-weight:500;line-height:22px;margin:0}` + `p{font-size:12px;line-height:18px;margin:1px 0 0}` |
| 字段网格 | `display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px`（单列字段用 `minmax(0,1fr)`） |
| 单字段 label | `display:flex; flex-direction:column; gap:4px; font-size:10px; line-height:16px; color:label-secondary` |
| input | `height:36px; border-radius:9px; padding:0 10px; font-size:12px` |

样式注入用 `<style>` 标签 + `data-plugin-css` 幂等标记，不要用 CSS-in-JS 库（bundle 不能 require 任意包）：

```js
if (typeof document !== "undefined") {
  const tagId = "my-plugin/src/client.css"
  if (document.querySelector('style[data-plugin-css="' + tagId + '"]') === null) {
    const tag = document.createElement("style")
    tag.dataset.pluginCss = tagId
    tag.textContent = css
    document.head.appendChild(tag)
  }
}
```

## 输入框：不要每次按键就发 RPC

第一版实现里 `onChange` 直接触发 `saveField`，导致每敲一个字符就打一次 mutate RPC。改为本地 draft state，`onBlur`/Enter 才提交：

```js
function FieldInput({ field, value, onCommit }) {
  const [draft, setDraft] = react.useState(String(value ?? ""))
  react.useEffect(() => { setDraft(String(value ?? "")) }, [value])
  const commit = () => { if (draft !== String(value ?? "")) onCommit(field.key, draft) }
  return jsx("input", { value: draft, onChange: e => setDraft(e.target.value), onBlur: commit, onKeyDown: e => { if (e.key === "Enter") commit() } })
}
```
