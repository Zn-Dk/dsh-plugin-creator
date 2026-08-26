# dsh-minimal-plugin（示例）

本目录是 dsh-plugin-creator 的**最小可运行示例**，演示「纯 Host settings → settings RPC 通道 → 测试」的完整链路。

## 边界说明

- 这是**结构示例**，不替代真实插件的完整功能；client 侧的模块加载器包装见 templates/client.js.template。
- \`src/client.tsx\` 仅为占位说明：真正交给 DSH 的 \`lib/client.js\` 必须是 \`window.__ModuleLoader__.load\` 格式，不能是普通 ES module。

## 结构

- \`src/settings.ts\` —— 纯逻辑（schema 默认值 + 纯函数），100% 可测
- \`src/settings-rpc.ts\` —— 纯 RPC handler 工厂，用 fake settings 单测
- \`src/index.ts\` —— Host 装配层（settings.register + connection.rpc.handle）
- \`test/settings.test.ts\` —— 纯逻辑与 handler 的精确断言

## 验证

\`\`\`sh
pnpm install
pnpm test
\`\`\`

按 SKILL.md 第 6 步做安装验收：\`pnpm pack\` 后用 \`dsh plugin --profile web add ./dsh-minimal-plugin-0.1.0.tgz\`，不要用 \`link:\`。
