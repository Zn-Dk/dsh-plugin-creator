#!/usr/bin/env node
/**
 * check-esm.mjs — 校验 Host 侧 ESM 范式（确定性自检）。
 * 用法（在插件目录根）：node <path-to>/scripts/check-esm.mjs [dir ...]
 * 缺省扫描 src 与 lib（存在才扫）。
 * 退出码：0=通过；1=违规。
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const dirs = process.argv.slice(2)
if (dirs.length === 0) dirs.push('src', 'lib')

const problems = []

function walk(dir) {
  if (!existsSync(dir)) return []
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walk(p))
    else if (['.js', '.ts', '.tsx'].includes(extname(p)) && !name.endsWith('.d.ts')) out.push(p)
  }
  return out
}

const files = []
for (const d of dirs) files.push(...walk(d))

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const lines = src.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if (/^require\s*\(/.test(t)) problems.push('[' + file + ':' + (i + 1) + '] top-level require( — ESM forbids it in Host')
    if (/^module\.exports/.test(t)) problems.push('[' + file + ':' + (i + 1) + '] top-level module.exports — ESM forbids it in Host')
  }

  // require( 只允许出现在 factory: (require) => {...} 闭包内
  const factorySpans = []
  const factoryRe = /factory\s*:\s*\(?\s*require\s*\)?\s*=>/g
  let f
  while ((f = factoryRe.exec(src)) !== null) {
    const brace = src.indexOf('{', f.index + f[0].length)
    factorySpans.push([f.index, brace === -1 ? src.length : src.length])
  }
  const requireRe = /\brequire\s*\(/g
  let r
  while ((r = requireRe.exec(src)) !== null) {
    const inFactory = factorySpans.some(([a, b]) => r.index >= a && r.index <= b)
    if (!inFactory) {
      problems.push('[' + file + '] require( outside factory closure (offset ' + r.index + ')')
    }
  }
}

if (problems.length) {
  console.error('check-esm: problems found')
  for (const p of problems) console.error('  - ' + p)
  process.exit(1)
} else {
  console.log('check-esm: OK (' + files.length + ' files scanned, no top-level require/module.exports)')
}
