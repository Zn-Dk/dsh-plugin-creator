# LLM Provider 插件：注册 provider 路由与适配器

本参考面向**给 DSH 增加一个模型 provider** 的插件（如接入某家 OpenAI 兼容 API）。权威参照实现：`dsh-llm-tencent-intranet`（结构）与 harness `packages/llm/llm/src/`（契约）。

## 何时用

用户要求：在 DSH 里接入某个模型厂商 / 自定义 provider / OpenAI 兼容端点 / 某模型的 API key 与设置卡片。

## Host 侧：三段式注册

`apply(ctx, config)` 里必须做三件事，缺一不可：

```js
export const inject = ["llm"]

export function apply(ctx, config) {
  // 1) 声明 provider 可配置（出现在 Models 设置页的 provider 目录里）
  ctx.llm.registerConfigurableProviders([{
    provider: PROVIDER,          // 路由 id，如 "stepfun"
    displayName: "StepFun",      // 设置页显示名
    settingsNs: NS,              // 对应的 settings namespace
    settingsPath: [],
  }])

  // 2) 注册适配器实例（返回句柄，可用于 replace）
  const registration = ctx.llm.registerAdapter([PROVIDER], adapter)

  // 3) 注册连通性/模型发现探针（设置页「测试连接」/模型发现用）
  ctx.llm.registerModelDiscovery(NS, async (request) => {
    await probeOnce(request.baseURL, request.apiKey, request.signal)
    return options().models.map(m => ({ id: m.id, name: m.name }))
  })
}
```

`LlmAdapter` 子类必须实现的方法（签名以已安装的 `@deepseek-ai/dsh-llm` 的 `lib/types/*.d.ts` 为准）：

| 方法 | 返回 | 要点 |
|---|---|---|
| `providerInfo(provider)` | `{ id, name }` | 显示名 |
| `providerRetryPolicy(provider)` | `ResolvedRetryPolicy \| undefined` | 直接返回 `resolveRetryPolicy(config.retryPolicy, path)` 的结果，**不要**返回裸 config（类型不符） |
| `listModels(provider)` | `Promise<readonly LlmModelInfo[]>` | `inputModalities` 必须是 `readonly ModelModality[]`（`"text" \| "image"`），用 `as const` 或显式标注 |
| `resolveModel(provider, model, signal?)` | `Promise<LlmResolvedModelInfo>` | 含 `context.contextWindow`、`defaultMaxTokens?`、`reasoning.efforts/defaultEffort` |
| `async *stream(options)` | `AsyncIterable<StreamChunk>` | `options` 是 `GenerateOptions`（不是自定义接口） |

`StreamChunk` 事件词汇（`block-start` / `text-delta` / `reasoning-delta` / `tool-call-delta` / `block-end` / `usage` / `finish`）由 harness 定义，**不要自创**；`blockType` 是 `ContentBlockType`（`'text' | 'reasoning' | 'tool-call' | ...`），字符串字面量需要断言。

## 踩坑 1（最严重）：attachments 服务必须注入，不能传 `undefined`

**症状**：纯文本对话正常，**一发图就失败**，错误是 `attachments service is unavailable; cannot read image bytes`。

**根因**：序列化图片需要读 host 存储的字节，而服务是从 host context 取的；如果写死 `undefined` 传下去，`collectImageUrls` 里那句守卫就会抛错——**所有带图请求必挂**。

```js
// ✅ 惰性读取：闭包快照在并发装配下可能捕获到 undefined，必须调用时再 ctx.get
const attachments = () => ctx.get("attachments")

const adapter = new MyAdapter({ options, resolveApiKey, attachments })

// 序列化时
const body = await serializeRequest(options, models, this.config.attachments(), defaults)
```

**连带坑**：`readImage` 必须收到**完整的 `ImageAttachmentRef`**（`{ attachmentId, mediaType, bytes, width, height }`），host 存储层要用它**校验字节与引用一致**。只传 `{ attachmentId }` 会导致校验失败或被跳过：

```js
// ✅ 传整块 ref
const stored = await attachments.readImage(ref)          // ref = block.attachment
const url = "data:" + ref.mediaType + ";base64," + Buffer.from(stored.data).toString("base64")
```

**测试陷阱（为什么单测没抓到）**：单测里用 `NO_ATTACHMENTS = undefined` 当默认值，恰好和 bug 的行为一致 → 全绿但功能是坏的。**必须补两条测试**：
1. 传一个真 fake（`readImage(ref) => ({ ref, data })`），断言生成的 data URL 正确；
2. 断言「服务缺失时必须 loud fail」（`assert.rejects(..., /attachments service is unavailable/)`）——把契约钉住。

## 踩坑 2：错误分类与可诊断性

- **`TRANSPORT` 是兜底码，别让它吞掉原因**。`stream()` 的 catch 里若把非 `LlmError` 一律包成 `TRANSPORT`，用户只会看到一句无信息的 `... stream from <url> failed`。做法：把 `error.message` 拼进消息 + 写入调试日志 + 保留 `{ cause }`。
- **先判超时再判取消**：`timeoutOf(watchdog.signal, "LLM_STREAM_IDLE_TIMEOUT")` 要在通用包装**之前**判，否则空闲超时会被误报成 `TRANSPORT`（应为 `TIMEOUT`）。
- **HTTP 错误体不一定是 JSON**：有的厂商 429/5xx 返回 `text/plain`。只 `JSON.parse` 会抛错被 catch 吞掉，错误信息退化成裸 `HTTP 429`。做法：先试 JSON，失败则用纯文本体当前 400 字符。
- **`RATE_LIMIT` / `TRANSPORT` / `SERVER` / `TIMEOUT` / `EMPTY_RESPONSE` 都在 DSH 默认可重试集合里**（`packages/llm/llm/src/retry-policy.ts`）。厂商限流时 DSH 会自动重试并放大限流；错误信息里给用户「稍后重试 / 换模型」的指引比静默重试有用。
- **参数校验要在发出去之前**：模型不接受的 `reasoning_effort` 档位（如某模型只收 low/high）要**从 options 里剥掉**再序列化，否则上游 400。注意校验结果必须真正作用到请求体——只改「默认值」而序列化器优先读 `options.x` 的话，守卫是 no-op。

## 踩坑 3：模型目录的取舍

- **文档没写的数字不要编**。官方未公布最大输出 token 时，省略 `maxTokens`（多数 OpenAI 兼容端点默认 INF、由模型自决），比编一个数字安全。
- **`modalities` 之类的模型特有字段**按模型条件添加（例：某语音对话模型必须 `modalities: ["text"]`），用 `requiresTextModality(modelId)` 这种纯函数判断并单测。
- **探针模型选便宜快的**（flash 档），别用旗舰：探针要快且便宜，且旗舰模型更容易撞限流，会把「健康的 key」误报成失效。
- **模型目录顺序 = 选择器顺序**，与 README 列举顺序保持一致；测试里断言完整 id 数组（别用 `includes`）。

## 调试日志（推荐内置）

与 tencent-intranet 同构：`$DSH_HOME/logs/<plugin>/requests-YYYY-MM-DD.log`，三档 `off | summary | full`：
- `summary`：只记结构（model、消息数按角色、字符数、图片数、工具数、effort、maxTokens、payloadBytes），**不含对话正文**；
- `full`：完整请求体（敏感，UI 提示里要写明）；
- 错误路径额外记 `httpStatus` / `providerError` / 截断的原始响应体。

`logDir` 作为**只读展示字段**进 settings schema（`default: debugLogDir()`，由 `DSH_HOME` 或 `~/.dsh` 推导，**禁止硬编码开发机路径**），client 从 `settings.describe()` 的 ns view 里读出来展示。

## 自检清单（LLM provider 插件专属）

- [ ] `inject = ["llm"]`；三段式注册齐全（configurableProviders / registerAdapter / registerModelDiscovery）
- [ ] attachments 惰性注入且传完整 ref；有「缺失即 loud fail」的回归测试
- [ ] 错误码分类正确：超时判在通用包装前；HTTP 体兼容 text/plain
- [ ] 不支持的 `reasoningEffort` 被真正剥离（不是只改默认值）
- [ ] `inputModalities` / `blockType` 等联合类型已显式标注，`tsc` 无 TS2742
- [ ] 模型目录顺序与 README 一致；测试断言完整数组
- [ ] 调试日志 summary 档不含对话正文；`logDir` 默认值由环境推导
- [ ] 探针用便宜模型；错误信息给「换模型/稍后重试」的可行指引
