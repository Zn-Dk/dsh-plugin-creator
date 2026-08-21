# 发布流程：pnpm pack + tgz 直链安装 + CHANGELOG

本参考提供可复现的打包、安装与版本发布流程。

## 为什么不用 `link:` 安装作为最终交付方式

`dsh plugin --profile web add "link:/path/to/plugin"` 只是把插件目录软链进 profile 的 node_modules，**不会**自动把插件自己的 `dependencies`/`peerDependencies` 装进去。本地开发时凑合能跑（因为你手动 `pnpm install` 过），但作为交付方式会让下游用户直接遇到 `ERR_MODULE_NOT_FOUND`。

## 推荐流程

```sh
cd my-plugin
pnpm install          # 本地开发环境依赖齐全
npm test              # 先确认测试绿，再打包
pnpm pack             # 生成 my-plugin-<version>.tgz，Tarball Contents 会打印出实际打进去的文件
```

打包前检查 `package.json` 的 `files` 数组，确保包含：`lib`、`cordis.patch.yml`、`README.md`、`CHANGELOG.md`。

### 分发方式（任选）

```sh
# 本地文件安装
dsh plugin --profile web add ./my-plugin-0.1.0.tgz

# 或先提交 tgz 到仓库某个 tag/分支，再使用仓库 raw URL 安装
dsh plugin --profile web add https://<host>/<org>/<repo>/raw/<tag>/<name>-<version>.tgz
```

已安装旧版本时，用同一条 `add` 命令装新 tarball即覆盖更新，不需要先卸载。

### .gitignore 与 tgz 的关系

日常开发不要把 `*.tgz` 提交进仓库（加进 `.gitignore`）。只有在**正式发布一个版本**时，才 `git add -f` 那一个版本的 tgz 附带随 commit/tag 一起提交，供直链下载。

## CHANGELOG 格式（Keep a Changelog + SemVer）

```markdown
# Changelog

本项目的所有显著变更都记录在此文件。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.0] - 2026-08-21

### 新增
- ...

### 修复
- ...

### 变更
- ...

### 已知限制
- ...
```

**分级约定**：
- `新增`（features）：新能力、新配置项、新 UI。
- `修复`（fixes）：行为纠正，不改变对外契约。
- `变更`（breaking/chore）：配置项迁移、枚举值变化、依赖升级——如果旧配置需要迁移，在条目里写清楚旧值如何映射到新值（例如枚举值迁移时，应写清旧值到新值的映射方式）。

**版本号递增时机**：只在**发布/验收节点**切版本，不要为「同一个功能内部的 code review 修复」单独开小版本——那些修复应该合并进同一个版本条目，或者在还没发布前直接改写未发布版本的 CHANGELOG 条目。

## 首个 MVP 版本的特殊处理

第一个可验收版本可以直接是 `0.1.0`（不是 `0.0.1`），把这一整轮开发做的全部 feature 列进同一个条目——不需要为「引擎」「适配层」「装配层」「GUI」这些开发阶段分别开版本号；CHANGELOG 只记录**面向用户可见的能力**。
