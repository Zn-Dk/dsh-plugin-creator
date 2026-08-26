# DSH Client 可注入 Slot 清单（GUI 交互分区）

本参考回答第 1 步必须问的问题：**「GUI 落在哪个交互分区？」**。选错 slot 是返工的主要来源——先确认交互分区，再动手写 client bundle。

## 决策铁律

- **先确认、后动手**：第 1 步规划阶段就向用户确认 GUI 落在哪个分区（侧栏工具区 / 设置卡片 / shell 覆盖 / conversation 视图 tab / 其他），得到确认后再进入第 5 步。
- **首选增量，而非替换**：`kind: 'single'` 的槽是「一人独占」，抢占它会顶掉官方实现（例如替换整个会话体 / 会话头）；想加东西先找 `list` / `keyed` / `chain` 槽。
- **验证方式**：slot 名、`kind`、`scope` 以 harness 源码 `packages/client/**/src/**/contract/slots.ts` 的 SlotMap 声明合并为准；本表是快照，升级 harness 时复查（参见 UI_COMPONENTS.md §④）。

## 注册形态（真实签名）

```js
ctx.slots.inject('settings.section', () => ctx.slots.register({
  name: 'settings.section',
  id: '<plugin-name>',   // 有 id 的槽：路由/排序用
  order: 20.5,           // 有 order 的槽：决定顺序，参考官方插件避免撞车
  label: () => '<显示名>', // label 是函数：locale 变化时重注册刷新
  inject: () => ({ connection: ctx.connection }),
}, SettingsCard))        // ⚠️ 直接传组件函数本身
```

- `keyed` 槽用 `key` 字段（如 `tool.call.toolview` 的 `key: 'bash'`）分发到对应工具名/命令名。
- `chain` 槽支持 selector 路由替换（如 `conversation.composer`）。

## 通用 GUI 场景 → 首选 slot

| 你要做的 GUI | 首选 slot | kind/scope | 备注 |
|---|---|---|---|
| 插件设置卡片（最常用） | `settings.section` | list / root | 本 skill 第 5 步的默认路径 |
| Plugins 设置页里加一个 tab | `settings.plugins.tab` | list / root | 插件清单类 UI 用它 |
| General 设置项 | `settings.general.item` | list / root | 由 locale 包声明类型 |
| 会话头部加操作按钮 | `conversation.session.header.actions` | list / session | 增量添加，不替换头部 |
| 会话头部右侧工具区 | `conversation.session.header.utilities` | list / session | 同上 |
| 给某个工具调用定制视图行 | `tool.call.toolview` | keyed / session | `key` = wire tool name |
| 工具详情面板整体替换 | `conversation.details.tool` | single / session | 抢占式，慎用 |
| 会话体新增一个视图 tab | `conversation.view` | list / session | 每个 tab 自带 chrome |
| 替换整个会话体（大改） | `conversation.session` | single / session | 抢占式，会接管 view ring + draft |
| 输入框上方/内部注入 | `conversation.input.dock` | list / session | GoalBar 等挂这里 |
| 输入框左右扩展 | `conversation.input.left` / `conversation.input.right` | list / session | 附件/触发控件 |
| 侧栏品牌位 / 工作区 / 设置入口 | `sidebar.brand.mark` / `sidebar.workspaces` / `sidebar.settings` | single / root | 全抢占式 |
| 悬浮覆盖层（弹窗/命令面） | `conversation.input.overlay` | list / session | popupSelect shell 用它 |

## 完整 slot 快照（来源：contract/slots.ts SlotMap）

### settings 域（ui-settings/src/client/contract/slots.ts）

| slot | kind | scope |
|---|---|---|
| `settings.trigger` | single | root |
| `settings.header` | single | root |
| `settings.action` | list | root |
| `settings.close` | single | root |
| `settings.section` | list | root |
| `settings.plugins.tab` | list | root |
| `settings.onboarding` | list | root |
| `settings.general.item` | list | root |

### conversation 域（ui-conversation/src/client/contract/slots.ts，含合并声明）

| slot | kind | scope |
|---|---|---|
| `conversation.session` | single | session |
| `conversation.session.header` | single | session |
| `conversation.session.header.lineage` | single | session |
| `conversation.session.header.actions` | list | session |
| `conversation.session.header.utilities` | list | session |
| `conversation.view` | list | session |
| `conversation.chat.node` | keyed | session |
| `conversation.message.images` | single | session |
| `conversation.chat.commandview` | keyed | session |
| `conversation.chat.turnTail` | chain | session |
| `conversation.chat.assistant-actions` | list | session |
| `conversation.details.tool` | single | session |
| `conversation.composer` | chain | session |
| `conversation.hero.workspace` | single | root |
| `conversation.hero.brand.mark` | single | root |
| `conversation.hero.agentPreset` | single | root |
| `conversation.input.overlay` | list | session |
| `conversation.input.dock` | list | session |
| `conversation.composer.dock` | list | session |
| `conversation.input.left` | list | session |
| `conversation.input.right` | list | session |
| `conversation.composer.bar` | single | session-maybe |
| `conversation.input.attachments` | single | session-maybe |
| `conversation.input.plan` | single | session |
| `conversation.input.model` | single | session |

### tool 域（ui-tool/src/client/contract/slots.ts）

| slot | kind | scope |
|---|---|---|
| `tool.call.toolview` | keyed | session |

### sidebar 域（ui-sidebar/src/client/contract/slots.ts）

| slot | kind | scope |
|---|---|---|
| `sidebar.brand.mark` | single | root |
| `sidebar.brand.name` | single | root |
| `sidebar.workspaces` | single | root |
| `sidebar.settings` | single | root |
| `sidebar.footer.action` | list | root |

### workspace 域（ui-workspace/src/client/contract/slots.ts）

| slot | kind | scope |
|---|---|---|
| `conversation.hero.workspace.directoryFlow` | single | root |
| `sidebar.workspaces.directoryFlow` | single | root |

> ⚠️ `settings.plugin.item` 在测试里作为 keyed slot 出现，但 SlotMap 类型声明归属插件 inventory/配置域，使用前以对应包 d.ts 为准。`t.host` 是运行时测试用的 slot，不是插件注入目标，勿用。
