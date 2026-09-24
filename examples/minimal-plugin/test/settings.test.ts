import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { clampCount, DEFAULTS, NAMESPACE } from '../src/settings.js'

describe('pure logic', () => {
  it('clamps count into [0, 100]', () => {
    assert.equal(clampCount(-1), 0)
    assert.equal(clampCount(50), 50)
    assert.equal(clampCount(101), 100)
  })

  it('defaults are safe', () => {
    assert.equal(DEFAULTS.count, 0)
    assert.equal(DEFAULTS.greeting, 'Hello')
  })

  // 形状契约回归（2026-09-24 实测教训）：client 侧读 settings.describe() 时，
  // value 是 { namespaces: [...] } 包装对象；若按裸数组 .find() 会直接抛
  // "descriptors.find is not a function"。这个纯函数就是卡片里的投影逻辑。
  it('projects the describe answer onto this namespace', () => {
    const answer = { writable: true, hasDocument: true, namespaces: [{ ns: NAMESPACE, value: DEFAULTS, revision: 3 }] }
    const namespaces = Array.isArray(answer.namespaces) ? answer.namespaces : []
    const hit = namespaces.find((n) => n.ns === NAMESPACE)
    assert.equal(hit?.revision, 3)
    assert.deepEqual(hit?.value, DEFAULTS)
  })

  it('treats a non-array namespaces field as absent (no crash)', () => {
    const answer = { namespaces: undefined }
    const namespaces = Array.isArray(answer.namespaces) ? answer.namespaces : []
    assert.deepEqual(namespaces.find((n) => n.ns === NAMESPACE), undefined)
  })
})
