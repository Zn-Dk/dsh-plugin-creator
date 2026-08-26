#!/usr/bin/env node
/**
 * check-checkout.mjs — 在干净 checkout 中实测测试命令（对应必查清单第 7 条）。
 * 用法（在插件目录根，且已执行 pnpm install）：node <path-to>/scripts/check-checkout.mjs
 * 退出码：0=通过；非零=失败。
 */
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

let pkg
try {
  pkg = JSON.parse(readFileSync('package.json', 'utf8'))
} catch {
  console.error('check-checkout: package.json missing or invalid')
  process.exit(1)
}
const testCmd = pkg.scripts && pkg.scripts.test
if (!testCmd) {
  console.error('check-checkout: package.json has no scripts.test')
  process.exit(1)
}
console.log('check-checkout: scripts.test = ' + testCmd)

const pmProbe = spawnSync('pnpm', ['--version'], { encoding: 'utf8' })
const runner = pmProbe.status === 0 ? 'pnpm' : 'npm'
const r = spawnSync(runner, ['test'], { stdio: 'inherit' })
if (r.status !== 0) {
  console.error('check-checkout: ' + runner + ' test failed (exit ' + r.status + ')')
  process.exit(r.status == null ? 1 : r.status)
}
console.log('check-checkout: OK — test command runs on a clean checkout')
