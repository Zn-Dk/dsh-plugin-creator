# DSH Agent 事件模型（全局 vs per-agent）

本参考记录 DSH agent 事件挂载与生命周期管理中最容易出现的错误。

## 事件分类表

| 事件名 | 挂载位置 | 触发时机 |
|---|---|---|
| `agent/created` | `ctx.on`（全局） | 任意 agent（root 或子）被创建 |
| `agent/turn-stopping` | `agent.ctx.on`（per-agent） | 该 agent 的一轮对话即将结束 |
| `agent/status` | `agent.ctx.on`（per-agent） | 该 agent 状态变化（idle/running 等） |
| `agent/pre-step` | `agent.ctx.on`（per-agent） | 该 agent 下一步即将执行前 |
| `settings/updated` | `ctx.on`（全局） | 任意 settings namespace 提交变更；第一个参数是 namespace 名，需要自己 if 过滤 |

**没有 `agent/disposed` 事件。** 不要设计任何依赖它的清理逻辑。

## 正确写法

```js
// 全局：监听 agent 创建，只对 root agent 生效
const stopCreated = ctx.on('agent/created', ({ agent }) => {
  if (!ctx.agents.roots().includes(agent)) return
  attach(agent)
})

// 已存在的 root agent 要在 apply() 里补挂一次
// （否则插件热重载/晚加载时会漏掉已经存在的 agent）
for (const agent of ctx.agents.roots()) attach(agent)

function attach(agent) {
  if (attached.has(agent)) return
  // per-agent 事件包进 agent.ctx.effect：agent 销毁时 cordis 自动调用 cleanup
  const cleanup = agent.ctx.effect(() => {
    const stopTurn = agent.ctx.on('agent/turn-stopping', () => {
      // ... 你的逻辑
    })
    return () => {
      stopTurn()
      attached.delete(agent) // 从追踪 Map 里移除自己，避免无限增长
    }
  }, 'my-plugin.turn()')
  attached.set(agent, cleanup)
}
```

插件卸载时的完整清理：

```js
return async () => {
  stopping = true
  stopCreated()
  for (const cleanup of [...attached.values()]) cleanup()
  attached.clear()
  if (inFlightWork) await inFlightWork.catch(() => {})
}
```

## 常见反模式

- ❌ `ctx.on('agent/turn-stopping', ...)`（全局监听一个 per-agent 事件——永远不会触发，因为它只在 agent 自己的 ctx 上派发）
- ❌ 用一个不清理的数组/Map 存 per-agent 的 disposer（长期运行会内存泄漏）
- ❌ 假设有 `agent/disposed` 可以订阅做清理（不存在）
- ❌ 只在 `agent/created` 里挂载，不处理插件加载时已经存在的 root agent（漏挂）

## settings/updated 的正确过滤

```js
const stopWatch = ctx.on('settings/updated', (namespace) => {
  if (namespace !== 'my-plugin-namespace') return
  rebuild() // 重新读取 settingsScope.get()，重建依赖它的运行时状态
})
```

## 外部存储适配器的 scope 陷阱

如果插件依赖提供 `storageScope`、`dataDir` 或 `cliPath` 的外部适配器，应明确区分全局存储与自定义存储：只有用户显式配置自定义目录时才选择 custom scope；否则保留 global scope 并让上游解析默认位置。不要无条件覆盖 scope 或硬编码开发机路径，否则可能导致数据库不可见或启动失败。
