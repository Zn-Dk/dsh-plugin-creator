# DSH 官方 Client UI 组件：优先复用，禁止重复造轮子

DSH Web client 插件的 UI 一律**优先复用官方 `@deepseek-ai/dsh-client-ui-*` 组件**，禁止重复造轮子。教训：dsh-session-explorer 的 Tooltip 迭代了多个版本，最后才用上官方 `@deepseek-ai/dsh-client-ui-primitives` 的 Tooltip——自造组件既难看又费时，还脱离宿主视觉语言。

## ① Client bundle 可直接 require 的官方种子包

Client bundle 只能 require **种子白名单**（共 7 词，权威证据：harness `packages/client/web/src/seed.ts` + `platform.ts`）：

| 种子词 | 性质 |
|---|---|
| `react` / `react/jsx-runtime` / `react-dom` / `react-dom/client` | React 运行时 |
| `@deepseek-ai/cordis` | 插件框架 |
| `@deepseek-ai/dsh-client-ui-slots` | **slot 注册纯核心**（B 类，非组件库） |
| `@deepseek-ai/dsh-client-ui-primitives` | **唯一可复用组件库**（A 类） |

- **preload 词**（非 require，走 inject 注入）：`@deepseek-ai/dsh-client-runtime/client`。
- **解析顺序**（bundle 里 require 一个词）：种子词 → 已物化记录 → boot 图行（有 dsh.client 声明的包）→ 已注册 factory → 否则 throw。种子词构建时标 external 即可，运行时必命中。
- ⚠️ **警示**：dsh-session-explorer 的 `scripts/build-client.mjs` EXTERNALS 含 `@deepseek-ai/dsh-client-web-react`、`@deepseek-ai/dsh-client-ui-attachment`、`@deepseek-ai/dsh-client-schema-form` 等**残留词**（实测其 src/client 从未 require 它们）——**不要照抄该列表**；这些词在种子表之外，标 external 会在运行时 require miss。

### A 类：@deepseek-ai/dsh-client-ui-primitives —— 唯一可复用组件库

纯 React 原子组件（零 cordis 依赖），全部样式走 `--dsw-*` token，自动贴合宿主主题。**写插件 UI 先来这里找组件。**

**控件类**

| 组件 | 关键 props | 用途 |
|---|---|---|
| `Button` | variant: 'primary'\|'ghost'\|'outline'\|'toolbar'（默认 ghost）、size、icon、className、原生 button 属性透传 | 按钮 |
| `Input` | icon、className、原生 input 属性透传 | 输入框/搜索框 |
| `Pill` | active、onClick、children、原生属性 | 小徽标/标签 |
| `Menu` | open、anchor、items: MenuEntry[]（MenuItem/Separator/Label）、selectedId(s)、onSelect、onClose、align、side、portal、footer | 浮层菜单（锚点定位） |
| `Modal` | open、onClose、title、description、children、footer、headless | 受控对话框（body portal，Escape/遮罩关闭；headless 可自定义结构） |
| `HoverCard` | anchor、content、openDelayMs=500、disabled、copyText、copyLabel、copiedLabel | 悬浮预览卡（可带复制按钮） |
| `Tooltip` | label（文本或解析器）、side: 'right'\|'bottom'\|'top'（默认 right）、delayMs=0、disabled、maxWidth、children（单个锚元素，ref 转发） | 悬浮提示——**最常被重复造轮子的组件** |
| `Toast` | text、icon、anchor、onDone | 顶部瞬时横幅（滑入→3s→淡出→onDone；重复消息需 remount） |
| `StateDot` | state: 'done'\|'warning'\|'ongoing'\|'error'、size、className | 状态点 |
| `ConnectionBanner` | reconnecting、label | 断线重连横幅 |
| `RiskConfirmation` | RiskConfirmationProps | 风险确认对话框 |
| `OnboardingSurface` | — | 首次运行全屏接管（body portal 遮罩） |

**内容渲染类（工具结果卡片）**

| 组件 | 用途 |
|---|---|
| `MarkdownText` | GFM + TeX（KaTeX）、增量流式解析、安全外链 |
| `MessageText` | 用户内容字面文本原语 |
| `CodeBlock` | fenced code（shiki 高亮、语言横幅、复制） |
| `JsonBlock` / `JsonTree` | JSON 代码块 / 只读 JSON 树检查器 |
| `TerminalBlock` | shell 命令终端面（ANSI、状态 pill、head/tail 折叠） |
| `ReadBlock` | 文件读取窗口（行号 + shiki 高亮） |
| `DiffBlock` | 文件 diff 面（-/+ 行、多 hunk、页脚统计） |
| `SearchBlock` | grep/glob 搜索结果（可折叠分组、复制全文） |
| `WebBlock` | web 检索结果卡（引用列表、截断提示） |
| `extractMarkdownPlainText` | 去除 markdown 标记取纯文本 |

**品牌/图标**

- `FishLogo`、`BrandWordmark`：官方品牌元素。
- `Icon*`（共 70 个命名导出，数量以 d.ts 为准、升级 harness 时复查）：如 IconNewChatOutline16 / IconSearchOutline16 / IconSettingsOutline14/16 / IconPanelLeftOutline16 / IconEllipsisOutline16 / IconPlusOutline16 / IconCheckOutline16/14 / IconChevronDown/Left/Right/UpOutline14 / IconCloseOutline16 / IconCopyOutline16 / IconRefreshOutline16/14 / IconLike/DislikeOutline16 / IconShareOutline16 / IconEditOutline16 / IconTrashOutline16 / IconWarningOutline16 / IconSendOutline16/14 / IconStopFill16 / IconPaperclipOutline16 / IconLoadingOutline16 / IconDownloadOutline16 / IconPlay/PauseOutline16 等；props `{size, className}`，fill=currentColor。**要图标先查 Icon\*，别自画 SVG/emoji。**

**Hooks / 工具**

- `useAnchoredMaxHeight` / `useAnchoredPosition`：浮层定位（resize/scroll 重测/clamp）
- `useDismissOnOutsidePointer`：外部指针点击关闭
- `writeClipboard`：剪贴板写入助手

**用法示例**（TSX import 风格；ModuleLoader factory 内用 `require('@deepseek-ai/dsh-client-ui-primitives').Tooltip` 等价，见下）

```tsx
import { Tooltip, Button, Modal, IconSearchOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'

// Tooltip：锚元素 ref 会被转发，不会切断 owner 的 ref
<Tooltip label="新建会话" side="right" delayMs={200}>
  <button onClick={...}><IconNewChatOutline16 /></button>
</Tooltip>

// Modal：受控全视口对话框
<Modal open={open} onClose={close} title="创建工作区" footer={<Button variant="primary">创建</Button>}>
  ...
</Modal>
```

```ts
// bundle-entry.ts（ModuleLoader factory 内）——真实代码形态，参考 dsh-session-explorer
const Tooltip = (require('@deepseek-ai/dsh-client-ui-primitives') as { Tooltip?: unknown })?.Tooltip
```

### B 类：@deepseek-ai/dsh-client-ui-slots —— slot 注册核心（非组件库）

不是组件库，是 **slot 注册表纯核心**（约 70 个导出：类型/接口为主 + 4 个值）。**值导出只有 4 个**：`SlotCore`（register 为组件贡献主 API）、`resolveSlotLabel`、`StaleAuthorizationError`、`SlotOwnershipError`；store 相关（`DefineStore` 等）仅是类型，`createSnapshotStore` 属于 dsh-client-runtime、`shallowEqual` 不在本包——**不要凭名字猜值导出**，以 d.ts 为准。注册自定义槽位/工具行/视图用：

```ts
// 声明合并扩展 SlotMap
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap { 'your.slot': { ... } }
}
// 注册组件（参考 dsh-client-ui-tool 的 bash toolview）
ctx.slots.inject('tool.call.toolview', () =>
  ctx.slots.register({ name: 'tool.call.toolview', key: 'bash', locale: NS }, BashRow))
```

## ② 官方 dsh-client-* 包总览（A/B/C/D 四类）

| 包名 | 类别 | 用途 | 可 require？ |
|---|---|---|---|
| `@deepseek-ai/dsh-client-ui-primitives` | **A 组件库** | 纯 React 原子组件（控件/内容渲染/图标/品牌/hooks） | ✅ 种子词 |
| `@deepseek-ai/dsh-client-ui-slots` | **B slot 核心** | slot 注册表（SlotMap/register/defineStore） | ✅ 种子词 |
| `@deepseek-ai/dsh-client-web-react` | ⚠️ 非种子 | React 绑定（SessionProvider/useInvoke 等） | ❌ 勿 require（不在种子表，会 miss） |
| `@deepseek-ai/dsh-client-schema-form` | ⚠️ 非种子 | schema/draft 模型层（rehydrateSchema 等） | ❌ 勿 require（不在种子表，会 miss） |
| 其余 `dsh-client-ui-*`（33 个） | **C 宿主功能插件** | 官方 shell 自带界面（apply() 入口） | ❌ 不可 require，仅作用法参考 |
| `dsh-client-connection/runtime/locale/modules/hmr/web` | **D 基础设施** | 浏览器核心服务/壳层 | 不在此文档；runtime/connection/locale 是 inject 注入词 |

**C 类完整列表**（宿主内部功能插件包，全部是 apply() 入口、不可 require；了解官方有哪些界面、作为实现参照，但要复用组件一律回 A 类找）：

| 包名 | 一句话用途 |
|---|---|
| dsh-client-ui-agent-preset | Agent-preset 界面：默认/当前 seat、composition 编辑器 |
| dsh-client-ui-attachment | 附件动态展示：conversation input 与 message-image 槽 |
| dsh-client-ui-brand-official | 官方品牌占位（sidebar/Hero 槽） |
| dsh-client-ui-commands | 命令面：'/' 源、三种命令 UI、popupSelect 注册表 |
| dsh-client-ui-conversation | 对话域：骨架、有序 chat 流、composer |
| dsh-client-ui-cordis | cordis 动态插件定义卡片（工具行+运行开关） |
| dsh-client-ui-deliverables | 产出文件 turn 尾部 + 可点击文件引用 |
| dsh-client-ui-directory-picker-browse | 目录浏览面（workspace directory-flow owner） |
| dsh-client-ui-directory-picker-native | 原生目录选择面（renderless） |
| dsh-client-ui-goal | GoalBar（composer 上方） |
| dsh-client-ui-input-trigger | 输入触发器管线：'/' 与 '@' 检测、候选菜单 |
| dsh-client-ui-jobs | session 头后台任务列表 |
| dsh-client-ui-layout | 三栏 AppFrame（拖拽把手）+ ctx.layout 服务 |
| dsh-client-ui-message-feedback | 消息反馈控件（assistant 消息操作条） |
| dsh-client-ui-model-selection | /model popupSelect |
| dsh-client-ui-permission-presets | 权限面：General 设置默认 + /permission popup |
| dsh-client-ui-plan | Plan 模式 composer 控件 |
| dsh-client-ui-reference | 统一 @file / @session 引用源 |
| dsh-client-ui-renderer | 浏览器 UI 渲染器：React slot 绑定、应用根组装 |
| dsh-client-ui-settings | 设置域基座：settings-namespace scope 服务、slot 契约 |
| dsh-client-ui-settings-general | 设置 General 段 + 引导 |
| dsh-client-ui-settings-models | Models 设置 + 产品引导对话框 |
| dsh-client-ui-settings-plugin-inventory | Web Plugins 设置里的只读 Loader 清单 tab |
| dsh-client-ui-settings-plugins | Plugins 设置段（feature-owned tabs + 插件卡片） |
| dsh-client-ui-sidebar | 侧栏：会话多级树、搜索、分组、状态点 |
| dsh-client-ui-skill | Web skill 引用 + 专用 skill 工具行 |
| dsh-client-ui-subagent | Subagent 会话目录、延续路由 UI、'@' 引用源 |
| dsh-client-ui-theme | 主题：--dsw-* token 样式、light/dark/system |
| dsh-client-ui-tool | 工具调用树渲染 + keyed per-tool 展示槽（tool.call.toolview） |
| dsh-client-ui-trajectory | 轨迹事件账本 + 交互式时间轴（纯 consumer） |
| dsh-client-ui-user-questions | ask_user_question Web 特性 |
| dsh-client-ui-workflow-run | workflow-run Conversation Node |
| dsh-client-ui-workspace | 工作区选择器（sidebar + empty-state 槽） |

**D 类一句话**：`dsh-client-connection` / `dsh-client-runtime` / `dsh-client-locale` / `dsh-client-modules` / `dsh-client-hmr` / `dsh-client-web` 是浏览器核心服务与壳层，组件开发不直接碰；runtime/connection/locale 等以 **`dsh.client.inject` 服务注入词**身份在 package.json 里声明，由宿主注入 client-side service（见 [../SKILL.md](../SKILL.md) 第 5 步与 [CLIENT_BUNDLE.md](CLIENT_BUNDLE.md)），不是 require 目标。注意 `dsh-client-ui-slots` 是**种子词可 require**（见 §① B 类），不属于 inject 注入词。

## ③ 「优先用官方组件」决策规则

要以下 UI 元素时，**先查本表找官方组件；找不到才允许自写 CSS，且自写时必须记录理由**（代码注释或 review 说明）：

| 需要 | ✅ 官方组件 |
|---|---|
| 悬浮提示 | `Tooltip`（primitives） |
| 对话框/弹窗 | `Modal`（headless 可自定义结构） |
| 按钮 | `Button`（4 种 variant） |
| 输入框/搜索框 | `Input` |
| 图标 | `Icon*`（70 个，以 d.ts 为准） |
| 下拉菜单 | `Menu`（锚点定位+portal） |
| 顶部提示条 | `Toast` |
| 状态点/徽标 | `StateDot` / `Pill` |
| 悬浮预览卡 | `HoverCard` |
| 工具结果卡片 | `TerminalBlock` / `ReadBlock` / `DiffBlock` / `SearchBlock` / `WebBlock` / `CodeBlock` / `JsonBlock` / `JsonTree` / `MarkdownText` |
| 注册自定义工具行/视图槽 | `ctx.slots.register` + SlotMap 声明合并（ui-slots） |
| 多语言 | `ctx.slots.register(..., {locale})` + Translate 类型（ui-slots LocaleNamespaceMap） |

## ④ 如何自己继续发现

- **读 d.ts**：`/root/.dsh/profiles/node_modules/@deepseek-ai/<pkg>/` 下（profile 安装副本自带 `src/index.ts` 与 `lib/types/*.d.ts`，多数包还带 README）——以真实 d.ts/源码为准，**不要凭 README 猜**；不确定的标注「待确认」。
- **官方插件参照**：`/root/.dsh/profiles/web/node_modules/@linxin666/dsh-client-ui-*/src/client/`——官方插件自己的 client 代码就是最佳用法证据（如 dsh-client-ui-git-graph 的 BranchPopover.tsx 只 import primitives 的 Icon* + ui-slots 的 Translate 类型）。
- **种子表复查**：`/root/proj/deepseek-harness/packages/client/web/src/seed.ts` + `platform.ts`（种子清单可能随版本变化，升级 harness 时复查一次）。
