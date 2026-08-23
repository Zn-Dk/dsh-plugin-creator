# 插件收录渠道：awesome-dsh-plugin 主渠道 + 社区 awesome 列表

插件「发布」与「收录」是两件事：发布 = npm publish / GitHub 可安装；收录 = 提 PR 进某个目录列表，让下游发现。本文固化三个收录渠道的边界、门槛与 PR 流程，不含任何一次性案例数字。

## 渠道概览与默认策略

| 渠道 | 定位 | 收录方式 | 默认做？ |
|---|---|---|---|
| `awesome-dsh-plugin/awesome-dsh-plugin` | dshmarket 数据源，精选市场 | PR 加 `data/plugins/*.yml` | ✅ 默认主渠道 |
| `0xsline/awesome-deepseek-harness` | 手选精选目录（awesome-list 风格） | PR 改 README 双语 | ⚠️ 可选加分 |
| `AdamPlatin123/awesome-dsh-plugins` | 自动发现 + 证据验证的生态雷达 | 打 topic 自动收录 / PR 加速登记 | ⚠️ 可选加分 |

**默认策略**：完成发布验收后，先做 `awesome-dsh-plugin`（主渠道）。另两个渠道是「可选加分」，不是发布前置；只有当插件已发布、README/CHANGELOG 就绪、且愿意维护多处描述同步时再追加。三个渠道互相独立、互不冲突，可以都提。

**决策信号**：插件越通用、越面向终端用户，越值得多渠道曝光；越实验性/个人化，越优先只进主渠道，避免给精选目录维护者增加筛选成本。

## 主渠道：awesome-dsh-plugin/awesome-dsh-plugin

插件发布后想进入 https://github.com/awesome-dsh-plugin/awesome-dsh-plugin（DSH 插件市场 dshmarket 的数据源），需要提一个 PR。

### 什么时候收录

插件已完成：npm publish（或 GitHub 可安装）、本地 dsh plugin add 验收通过、CHANGELOG 就绪、README 说明清楚。收录是「发布」之后的可选步骤，不是发布前置。

### 门槛清单（CI 硬性检查）

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

### PR 文件格式

- 数据源：data/plugins/<owner>__<repo>.yml（一个插件一个文件，monorepo 子包用 <owner>__<repo>--<subpath>.yml）
- 内容示例：
  url: https://github.com/owner/repo
  name: owner/repo
  category: session
  description.en 必填，description.zh 可选（维护者可补）。
  描述含冒号+空格必须加引号，否则 YAML 当嵌套键解析失败。

- README 是生成的：禁止手改 README.md / README.zh.md。提交前在 awesome 仓库跑 npm ci 和 node scripts/generate-readme.mjs，提交 yml + 两个生成的 README。

### CI 双 workflow 机制

- PR check（pull_request，fork-safe，无 token）：只查 README 与 data 一致性、awesome-lint、locale 对齐。不查 age/commit。
- Submission gate（workflow_run，base 仓库上下文，有 token）：才查 dsh.bundle、age、commit。PR 提交后要等这个 gate 给出 verdict，别看到 PR check 绿了就以为通过。

### 被拒后的补救

- age 不足 / commit 不足：resubmit 无任何影响，把功能做完、等够时间，重新 push 即可。规则是"不是先来后到，是谁更好"——fork 只要能证明维护得更好或真的做了新东西，也能收录。
- 描述夸大：改描述，别改代码去硬凑描述数字。
- 只声明 dsh.client：补 dsh.bundle。

## 可选渠道 A：0xsline/awesome-deepseek-harness

- 定位：hand-curated 精选列表；完整索引在 `dsh-external/hub`（`catalog.json`）与自动生成的 `CATALOG.md`。
- 收录标准（contributing.md）：① 真实仓库，无死链、无占位；② 一句话描述——写功能事实，不写营销词；③ 仓库链接。条目不带 badge、不带截图、不带长文案。
- 分类：按 section 选（`Runtime & Operations` / `Dashboards & Session UX` / `Tools & Utilities` 等），选最贴切的一个；不确定时在 PR 里说明，让维护者改。
- PR 流程：
  1. fork → 切分支 `add-<repo-name>`。
  2. 在 `README.md` 与 `README.zh-CN.md` 的**同一 section** 各加一行（同一 entry，双语翻译）。排序不强制，建议放在语义相近条目附近。
  3. 一行格式：`- [owner/repo](url) - 一句话描述`。描述只写功能事实，避免「最强/第一」等词。
  4. PR 标题 `docs: add <owner/repo>`；正文列 checklist（真实仓库 / 事实描述 / 双语同改 / 分类贴切 / 只动自己 entry）。
  5. 无需跑测试（markdown only）。
- 注意：`CATALOG.md` 是自动生成的，**不要手改**。仓库打 `dsh-plugin` topic 后是否进 catalog 由生成脚本决定，PR 只负责 README 精选条目。

## 可选渠道 B：AdamPlatin123/awesome-dsh-plugins

- 定位：自动发现 + 证据验证的生态雷达（数千仓库级），提供运行级证据（可用 / 不兼容 / 待定）。README 首页与 `PLUGINS-ALL.md` 由管线自动渲染，**不要手改自动块**。
- 收录方式（双轨，可只做其一）：
  1. **自动收录（零操作）**：仓库打 `dsh-plugin` topic → 每日全量扫描自动进入索引。这一步已足够让插件被雷达发现。
  2. **PR 登记（加速/人工精选）**：在 `PLUGINS.md` 对应分类表格追加一行并提 PR，合并后立即进入目录。
- 最低收录条件（README「给插件开发者」）：公开仓库 + `dsh-plugin` topic；根 `package.json` 有 `name` 与 `main`/`exports`/dsh 入口；README 说明做什么/安装/卸载/最小示例；运行时依赖显式声明；声明支持的 DSH 版本；有许可证；不泄密。
- PR 流程：
  1. 跑预归类器：`python3 scripts/classify.py "<插件名>" "<一句话描述>"` → 拿「建议分类」。
  2. fork → 切分支；在 `PLUGINS.md` 合适分类表格追加一行：
     `| 插件名 | [owner/repo](url) | 一句话说明 | 待测 |`（运行级列填「待测」，**不要自封 ✅**，由雷达判定）。
  3. PR 标题 `docs: 登记 <插件名>`；按 `.github/PULL_REQUEST_TEMPLATE.md` 填插件信息 + 自检清单 + 改动内容。
  4. 自检三步要在 PR 里贴真实结果：最新 dsh + 加载插件 + 无报错（或贴报错）。**先真实跑一遍再写**；说「加载成功」之前必须有实测输出。
  5. 勾选 Allow edits from maintainers。
- 同名冲突：目录按插件名展示，但仓库是完整 `owner/name`；若已存在同名不同源的插件，在 PR 备注里明确「同名不同源，请勿合并」。
- 分类规则按声明顺序首个命中者胜；描述里出现「面板/panel」等词会命中「🔌 Web UI 增强」，但纯运行级修复工具可能更贴「🛠 基建部署」。用 `classify.py` 输出做起点，拿不准就在 PR 里说明，维护者会改。

## 跨渠道一致性

- 三个渠道共用同一份事实基线：repo URL、一句话描述、category 语义、npm 包名。描述可按各仓库行文风格微调，但**不能出现互相矛盾的数字/命令/API 名**。
- 插件大版本变化（改名 / 改 install 命令 / 改 category）时，各处 PR 描述都要同步更新——这是多收录的持续维护成本，也是「是否追加渠道」的决策依据之一。

## 提 PR 的机械执行注意

- 用 GitHub PAT（本机凭证文件）走 GitHub API fork 仓库、创建分支与 PR；git commit/push 可在工作区 clone 里完成。
- git push 用 `https://x-access-token:<PAT>@github.com/...`，push 完成后立刻把 remote 改回干净 URL；token 不打印、不进 commit message。
- `unable to get credential storage lock` 是只读文件系统噪声：以 remote 分支是否真正出现来判定 push 成功，别被吓停。
- `dsh plugin --profile web add <pkg>` 会写 `~/.dsh/profiles/web`；在只读沙箱里会报 EROFS，验收安装要换用可写 `~/.dsh` 的宿主上下文执行，并显式给 HOME 与 pnpm 的绝对路径。装完核对 `dsh plugin list` 里是否从 `link:` 变成具体版本号，才算真正从 registry 安装验收通过。
- 提交前核对：只动自己的 entry；生成文件（README/CATALOG/PLUGINS-ALL）不手改；描述与源码逐字一致。

## 与 dsh-plugin-creator 的分层边界

- 本文档：通用协议（跨仓库、跨机器、跨运行时都成立）。
- Mnemon 本地记忆：某个具体仓库的 PR 号、年龄时刻、token 位置等一次性事实。不要把案例数字写进这里。
