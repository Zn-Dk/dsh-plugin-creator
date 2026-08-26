import { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { MinimalSettings, NAMESPACE, DEFAULTS } from './settings.js'

export function apply(ctx: Context) {
  // 1) Host-side persistence + hot reload - 无 GUI 也能用的最小核心。
  //    真实签名：register(ns, schema: schemastery, options)。
  //    ns 必须是 lowercase kebab-case，用 settingsNamespace() 工厂打品牌。
  ctx.settings.register(settingsNamespace(NAMESPACE), MinimalSettings, { base: DEFAULTS, applies: 'live' })

  // 2) （可选，只有加 GUI 才需要）把 settings 暴露给 Web client：
  //    需要 devDependency @deepseek-ai/dsh-client-connection（仅编译用，
  //    运行时由宿主 profile hoist），并 import type {} 激活 ctx.connection 类型。
  //    完整代码见 reference/CLIENT_BUNDLE.md。
  //
  //   ctx.inject(['connection'], (webContext) => {
  //     if (webContext.connection === undefined) return
  //     webContext.connection.rpc.handle(
  //       '/minimal-settings',
  //       createSettingsRpcHandler(ctx.settings, settingsNamespace(NAMESPACE)),
  //       { authority: 'loopback' },
  //     )
  //   })
}
