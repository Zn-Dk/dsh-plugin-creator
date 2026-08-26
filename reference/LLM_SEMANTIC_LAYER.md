# 插件内的 LLM 语义判定层（semantic judgment via subagent）

本参考说明如何把无法可靠写成确定性规则的**语义判断**交给 LLM 子代理。

## 什么时候需要这一层

规则能判定「数据新鲜度」（创建时间/引用次数/数值阈值），但判定不了「内容是否正确、是否被新事实取代」。当插件需要**语义正确性判断**时，用 LLM 子代理；否则用纯规则。判断标准：你能否把判定写成确定性的 if-else？能 → 规则；不能 → LLM。

## 三层结构（务必拆开，才能 TDD）

\`\`\`
初筛（rule-based，零 LLM 成本）→ prompt 构建 → LLM 检测 → 结果解析
   ↑ 纯函数可测         ↑ 纯函数可测      ↑ 装配层注入   ↑ 纯函数可测
\`\`\`

- **初筛**：先用确定性规则把候选从「全量」缩到「值得送检」。本例：同 category 的旧→新记忆对；免疫候选（importance>=4 或 access_count>=3）不参与。没有初筛，每次巡检都要把整个库喂给 LLM，成本不可控。
- **prompt 构建**：纯函数，把候选对渲染成文本。注意把「判定标准」写清楚，尤其是**反例**（「久未访问不是取代理由」）——LLM 容易滑向时间衰减判断。
- **LLM 检测**：装配层注入 `detectFn({ pairs, prompt }) => structured`。生产实现用 DSH \`ctx.subagents.start\`（见下），测试用 fake 注入。
- **结果解析**：纯函数，把 LLM 结构化输出映射回内部模型（本例：\`{olderId, superseded, byId, reason}\`）。必须容忍 LLM 输出损坏（非 JSON、缺字段）→ 降级为「未检测」而不是抛错。

## 生产实现：DSH subagents 调用

\`\`\`js
async function detectFn({ pairs, prompt }) {
  const providers = ctx.subagents.list()
  const provider = providers.includes('spawn') ? 'spawn' : providers[0]
  if (provider === undefined) { logger.warn('no subagent provider'); return { results: [] } }
  const agent = ctx.agents.roots()[0]
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60000)
  try {
    const run = await ctx.subagents.start(provider, {
      label: 'semantic judgment',
      prompt: [{ type: 'text', text: prompt + '\\n\\n请直接返回 JSON：{"results":[...]}' }],
      parent: agent,
      signal: controller.signal,
      maxDepth: 1,
      toolFilter: { deny: ['destructive_write_tool', 'cleanup_tool'] },  // 防止检测子代理自己触发破坏性操作
      persona: '你是记忆治理审计员。只判断旧记忆是否被新记忆取代，不调用记忆写入工具。',
    })
    const result = await run.result
    await run.dispose()
    const text = (result.output ?? []).map(p => p?.text ?? '').join('')
    return JSON.parse(text.match(/\\{[\\s\\S]*\\}/)?.[0] ?? '{}')
  } catch (e) { logger.warn('detection failed'); return { results: [] } }
  finally { clearTimeout(timeout) }
}
\`\`\`

**要点**：
- 让 LLM 直接返回纯文本 JSON；单次判断不必引入复杂的多步结构化工具机制。
- `toolFilter.deny` 把删除/写入工具从检测子代理里移除——**检测子代理绝不能自己触发破坏性操作**。
- 失败降级为「无检测结果」而非抛错：检测失败不应让巡检整体失败。
- 60s 超时 + AbortController 兜底。

## 验证结论

语义判定能力可靠（真实 LLM 验证过「路径变更→superseded=true」「无关事实→false」两类代表例）。关键是：初筛保证送检量可控、prompt 里写清反例（「久未访问不是取代理由」）。
