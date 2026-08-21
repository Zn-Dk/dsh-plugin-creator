# Client Bundle：格式、Settings RPC 桥接、GUI 排版

本参考聚焦从无 GUI 到有 GUI 的实现路径，以及设置卡片排版的通用教训。

## 为什么 settings namespace 不够

`ctx.settings.register(ns, schema, {base, applies:'live'})` 只解决 **Host 侧**持久化+热更新（配置进 `~/.dsh/settings.yaml`）。它**不会**自动在 Web 设置页出现任何 UI——那是完全独立的另一层，需要显式打通：

```
Host settings namespace  (ctx.settings.register)
        ↑↓ 你要自己接一根管子
Host settings RPC 通道    (connection.rpc.handle)
        ↑↓ WebSocket/RPC
Client 设置卡片           (ctx.slots.register 'settings.section')
```

## Host 侧：注册 settings RPC 通道

```js
// lib/settings-rpc.js —— 纯函数，可单测，不依赖 DSH 具体类型
export function createSettingsRpcHandler(settings) {
  return async (endpoint, rawPayload) => {
    try {
      if (endpoint === 'get') return success(descriptor(settings))
      if (endpoint !== 'mutate') return badRequest(...)
      if (!settings.writable) return failure(new Error('read-only'))
      const ops = payload.ops.map(op => {
        if (!mutablePath(op.path)) throw new Error('unsupported field') // 白名单校验
        return { op: op.op, path: op.path, value: op.value }
      })
      await settings.mutate(NAMESPACE, ops, payload.expectedRevision)
      return success(descriptor(settings))
    } catch (error) { return failure(error) }
  }
}

// lib/index.js —— apply() 里注册通道，只在 Web 连接可用时
ctx.inject(['connection'], (webContext) => {
  if (webContext.connection === undefined) return
  webContext.connection.rpc.handle('/my-plugin-settings', createSettingsRpcHandler(ctx.settings), { authority: 'loopback' })
})
```

**字段白名单是必须的**：mutate 接口不能让 client 任意写 settings 的任何字段，只放行插件自己声明的配置项。

## Client Bundle 格式契约

`lib/client.js` **不是普通 ES module**，是宿主注入的模块加载器格式：

```js
window.__ModuleLoader__.load({
  id: "my-plugin",
  factory: (require) => {
    const bundleModule = { exports: {} }
    Object.defineProperty(bundleModule.exports, Symbol.toStringTag, { value: "Module" })
    const react = require("react")                              // ✅ 允许
    const jsx = require("react/jsx-runtime").jsx                 // ✅ 允许
    const primitives = require("@deepseek-ai/dsh-client-ui-primitives") // ✅ 允许
    // require("lodash") 之类任意第三方包 —— ❌ 不允许，构建时不会打包进去

    function SettingsCard({ connection }) { /* React 组件 */ }

    function apply(ctx) {
      ctx.slots.inject("settings.section", () => ctx.slots.register({
        name: "settings.section",
        id: "my-plugin",
        order: 20.5, // 决定在设置页侧边栏的排序位置，参考其他插件的 order 避免撞车
        label: () => "我的插件",
        inject: () => ({ connection: ctx.connection }),
      }, SettingsCard)) // ⚠️ 直接传函数本身，不要用 () => jsx(SettingsCard, null) 包一层
    }

    bundleModule.exports.apply = apply
    bundleModule.exports.inject = ["slots", "connection"] // 声明需要的 client-side service
    return bundleModule.exports
  },
})
```

**踩坑记录**：slot 注册若写成 `register({...}, () => jsx(Component, null))`，面板会渲染空白甚至崩溃——必须直接传组件函数：`register({...}, Component)`。

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
