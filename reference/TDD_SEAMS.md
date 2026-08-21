# TDD Seam 划分：插件的哪些部分该测、怎么测

本参考给出 DSH 插件中各类 seam 的测试边界，优先覆盖纯逻辑与可注入编排层。

## 划分原则

一个 DSH 插件典型可以切成这几层，从「最该测」到「不该测」：

```
纯逻辑层（引擎/分级/校验）        ← 100% 测，零 IO，零依赖
  ↓
适配层（解析外部 CLI/API 输出）  ← 100% 测，输入输出都是纯数据
  ↓
编排层（组合前两层 + 一个注入的 runner/client） ← 测，用 fake/mock runner 注入
  ↓
装配层（cordis apply()：事件监听、settings 注册、slot 注册） ← 不写自动化单测
```

## 编排层的 fake 注入模式

不要 mock 真实的外部 CLI 调用，注入一个符合接口形状的 fake 对象：

```js
function fakeRunner({ gcPayloads = [], forgetResults = [] } = {}) {
  const calls = { gc: [], forget: [] }
  const runner = {
    async runJson(args) {
      if (args[0] === 'gc') { calls.gc.push(args); return gcPayloads[calls.gc.length - 1] }
      if (args[0] === 'forget') {
        const ok = forgetResults.shift() ?? true
        calls.forget.push({ args, ok })
        if (!ok) throw new Error('forget failed')
        return { status: 'deleted' }
      }
    },
  }
  return { runner, calls }
}
```

断言要**精确**，不要用宽松的 `includes`：

```js
// ❌ 太宽松：顺序错了也能通过
assert.ok(gcArgs.includes('--readonly'))

// ✅ 精确：完整数组比较
assert.deepEqual(gcArgs, ['gc', '--readonly', '--threshold', '0.5', '--limit', '500'])
```

## 为什么装配层不写自动化单测

装配层依赖真实的 DSH host context（`ctx.agents`、`ctx.settings`、`ctx.slots`、`connection.rpc`）——这些没有官方测试替身，mock 出来的假 context 测试价值有限（容易「测出你自己以为的行为，而不是真实行为」）。

**替代验证方式**：
1. 单元测试覆盖装配层调用的所有纯函数/编排函数（间接覆盖了大部分逻辑分支）。
2. 手动集成验证：装插件、重启 `dsh web`、在真实浏览器里点一遍。
3. 让一个独立 subagent 做静态 code review，重点核对本 skill「必查清单」里列的几类问题（事件模型、生命周期、错误契约、自动化路径安全性）——在缺少官方测试替身时，这通常比伪造完整 host context 更容易命中结构性问题。

## 何时值得多轮 code review

装配层改动之后，至少安排 2 轮独立 review：
- 第一轮：找出结构性问题（本 skill 必查清单前 5 条）。
- 修复后第二轮：只验证第一轮的修复是否到位，同时扫一遍是否引入新问题——**不要让同一个 agent 自己审自己刚写的代码**，用一个新的 subagent 上下文。
