# dsh-minimal-plugin（示例）

本目录是 dsh-plugin-creator 的**最小可运行示例**，演示「纯 Host settings → Web client 读写 → 测试」的完整链路。

## 边界说明

- 这是**结构示例**，不替代真实插件的完整功能；client 侧的模块加载器包装见 templates/client.js.template。
- `src/client.tsx` 仅为占位说明：真正交给 DSH 的 `lib/client.js` 必须是 `window.__ModuleLoader__.load` 格式，不能是普通 ES module。
- **client 侧读写走 `ctx.remote.settings` / `ctx.remote.credentials`**（api-gateway 自动暴露），**不需要**自己注册 RPC 通道。自建通道（`connection.rpc.handle`）在 0.1.5 已废弃，症状是每个调用 HTTP 405，详见 reference/CLIENT_BUNDLE.md 的事故记录。

## 结构

- `src/settings.ts` —— 纯逻辑（schema 默认值 + 纯函数），100% 可测
- `src/index.ts` —— Host 装配层（settings.register；GUI 侧用 `ctx.remote.*`，见注释）
- `src/client.tsx` —— client bundle 契约占位说明（真实实现照 templates/client.js.template）
- `test/settings.test.ts` —— 纯逻辑与 describe 形状投影的精确断言

## client 侧正确姿势（速查）

```js
const inject = ["slots", "connection", "locale", "remote", "remote.settings", "remote.credentials"]

function apply(ctx) {
  const remote = ctx.remote
  if (!remote || !remote.settings) return
  // 读：value 是 { namespaces: [...] } 包装对象，按 ns 找自己那一条
  const res = await remote.settings.describe()
  const hit = res.ok ? (res.value.namespaces ?? []).find(n => n.ns === NAMESPACE) : undefined
  // 写：位置参数 (ns, ops, revision)，返回 {ok, value|error}
  await remote.settings.mutate(NAMESPACE, [{ op: "set", path: ["greeting"], value: "Hi" }], hit?.revision ?? 0)
}
```

⚠️ 失效写法：`ctx.get('connection').api.settings`、`connection.rpc.handle(...)` / `connection.rpc.call(...)` 自建通道——`ctx.connection` 没有 `.api` 字段，且自建通道在 0.1.5 下每个调用都会 HTTP 405。

## 验证

```sh
pnpm install
pnpm test
```

按 SKILL.md 第 6 步做安装验收：`pnpm pack` 后用 `dsh plugin --profile web add ./dsh-minimal-plugin-0.1.0.tgz`，不要用 `link:`。
