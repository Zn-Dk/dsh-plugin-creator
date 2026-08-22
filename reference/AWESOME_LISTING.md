# Awesome DSH Plugin 收录：门槛、PR 格式与 CI 判定

插件发布后想进入 https://github.com/awesome-dsh-plugin/awesome-dsh-plugin（DSH 插件市场 dshmarket 的数据源），需要提一个 PR。本文固化公开稳定的收录协议，不含任何一次性案例数字。

## 什么时候收录

插件已完成：npm publish（或 GitHub 可安装）、本地 dsh plugin add 验收通过、CHANGELOG 就绪、README 说明清楚。收录是「发布」之后的可选步骤，不是发布前置。

## 门槛清单（CI 硬性检查）

提交 PR 前逐条自检：

1. **dsh.bundle manifest**：仓库根 package.json 需声明
   json: dsh.bundle.patch = ./cordis.patch.yml
   且根目录有对应的 cordis.patch.yml。只声明 dsh.client 不行（最常见的被拒原因）。

2. **仓库年龄 >= 1 天（精确 24 小时，不是跨天）**：
   CI 算法是 ageDays = (Date.now() - repo.created_at) / 86400000，要求 >= 1。
   repo.created_at 取 GitHub API 的 ISO 时间（UTC）。本地换算时只做一次时区偏移，别双重偏移。

3. **commit 数 >= 10**：CI 走 GitHub API 数真实 commit（不含 merge 空提交）。

4. **真实代码**：非占位、非 README-only、非 name-squat。

5. **活跃维护**：定期扫描会移除消失/归档/长期停更的仓库。

6. **dsh-plugin topic**：给仓库加上这个 GitHub topic。

7. **描述准确、无营销词**：维护者会对着源码逐字核对描述里的数字、命令、API 名。夸大是"本来不错但被打回"的头号原因。

8. **category 贴切**：按功能选（ui/usage/theme/model/identity/session/memory/tools 等），选不准维护者会直接改，不会打回。

9. **单 PR <= 3 个 entry**：一次最多加 3 个插件条目；monorepo 多个子包也受此限。

10. **PR 只动自己的 entry**：不要顺带改其他插件的描述（CI 有 stale-fork / 无关改动检查）。

## PR 文件格式

- 数据源：data/plugins/<owner>__<repo>.yml（一个插件一个文件，monorepo 子包用 <owner>__<repo>--<subpath>.yml）
- 内容示例：
  url: https://github.com/owner/repo
  name: owner/repo
  category: session
  description.en 必填，description.zh 可选（维护者可补）。
  描述含冒号+空格必须加引号，否则 YAML 当嵌套键解析失败。

- README 是生成的：禁止手改 README.md / README.zh.md。提交前在 awesome 仓库跑 npm ci 和 node scripts/generate-readme.mjs，提交 yml + 两个生成的 README。

## CI 双 workflow 机制

- PR check（pull_request，fork-safe，无 token）：只查 README 与 data 一致性、awesome-lint、locale 对齐。不查 age/commit。
- Submission gate（workflow_run，base 仓库上下文，有 token）：才查 dsh.bundle、age、commit。PR 提交后要等这个 gate 给出 verdict，别看到 PR check 绿了就以为通过。

## 被拒后的补救

- age 不足 / commit 不足：resubmit 无任何影响，把功能做完、等够时间，重新 push 即可。规则是"不是先来后到，是谁更好"——fork 只要能证明维护得更好或真的做了新东西，也能收录。
- 描述夸大：改描述，别改代码去硬凑描述数字。
- 只声明 dsh.client：补 dsh.bundle。

## 与 dsh-plugin-creator 的分层边界

- 本文档：通用协议（跨仓库、跨机器、跨运行时都成立）。
- Mnemon 本地记忆：某个具体仓库的 age 时刻、commit 数、token 位置等一次性事实。不要把案例数字写进这里。
