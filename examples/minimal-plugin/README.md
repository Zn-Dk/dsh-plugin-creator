# dsh-minimal-plugin（示例）

本目录是 dsh-plugin-creator 的**最小可运行示例**，演示「纯 Host settings → Web client 读写 → 测试」的完整链路。

## 边界说明

- 这是**结构示例**，不替代真实插件的完整功能；client 侧的模块加载器包装见 templates/client.js.template。
- `src/client.tsx` 仅为占位说明：真正交给 DSH 的 `lib/client.js` 必须是 `window.__ModuleLoader__.load` 格式，不能是普通 ES module。
- **client 侧读写走 `ctx.remote.settings` / `ctx.remote.credentials`**（api-gateway 自动暴露），**不需要**自己注册 RPC 通道。`src/settings-rpc.ts` 仅作为「纯函数可单测」的写法示例保留，不是当前推荐的 Host↔Client 通路。

## 结构

- `src/settings.ts` —— 纯逻辑（schema 默认值 + 纯函数），100% 可测
- `src/settings-rpc.ts` —— 纯 handler 工厂的写法示例，用 fake settings 单测
- `src/index.ts` —— Host 装配层（settings.register；GUI 侧用 `ctx.remote.*`，见注释）
- `test/settings.test.ts` —— 纯逻辑与 handler 的精确断言

## client 侧正确姿势（速查）

```js
const inject = ["slots", "connection", "remote", "remote.settings", "remote.credentials"]

function apply(ctx) {
  const remote = ctx.remote
  if (!remote || !remote.settings) return
  // 读：{ok, value:{namespaces:[{ns, value, revision}]}}
  const res = await remote.settings.describe()
  // 写：位置参数，返回 {ok, value|error}
  await remote.settings.mutate(NAMESPACE, [{ op: "set", path: ["greeting"], value: "Hi" }], revision)
}
```

⚠️ 失效写法：`ctx.get('connection').api.settings`、`connection.rpc.handle(...)` —— `ctx.connection` 没有 `.api` 字段。

## 验证

```sh
pnpm install
pnpm test
```

按 SKILL.md 第 6 步做安装验收：`pnpm pack` 后用 `dsh plugin --profile web add ./dsh-minimal-plugin-0.1.0.tgz`，不要用 `link:`。
