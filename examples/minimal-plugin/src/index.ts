import { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { MinimalSettings, NAMESPACE, DEFAULTS } from './settings.js'

export function apply(ctx: Context) {
  // 1) Host-side persistence + hot reload - 无 GUI 也能用的最小核心。
  //    真实签名：register(ns, schema: schemastery, options)。
  //    ns 必须是 lowercase kebab-case，用 settingsNamespace() 工厂打品牌。
  ctx.settings.register(settingsNamespace(NAMESPACE), MinimalSettings, { base: DEFAULTS, applies: 'live' })

  // 2) （可选，只有加 GUI 才需要）让 Web client 能读写这个 namespace：
  //    **不需要自己注册 RPC 通道**。api-gateway 已经把 settings 暴露成
  //    `ctx.remote.settings`（以及 `ctx.remote.credentials`），client 侧
  //    直接调用即可：
  //
  //      const res = await ctx.remote.settings.describe()          // → {ok, value:{namespaces:[...]}}
  //      await ctx.remote.settings.mutate(NAMESPACE, ops, revision)
  //
  //    前提是在 client 插件的 inject 里显式声明 remote 命名空间，例如：
  //      inject = ['slots', 'connection', 'remote', 'remote.settings', 'remote.credentials']
  //    漏声明 → ctx.remote.settings 是 undefined → 一交互就崩。
  //    完整代码见 reference/CLIENT_BUNDLE.md。
  //
  //    ⚠️ 旧写法 `ctx.get('connection').api.settings` / `connection.rpc.handle(...)`
  //    已失效：ctx.connection 没有 .api 字段。
}
