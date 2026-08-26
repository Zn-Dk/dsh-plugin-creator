import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { clampCount, DEFAULTS, NAMESPACE } from '../src/settings.js'
import { createSettingsRpcHandler, success } from '../src/settings-rpc.js'

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
})

describe('settings rpc', () => {
  function fakeSettings(overrides = {}) {
    const calls = { mutate: [] as unknown[] }
    return {
      calls,
      settings: {
        writable: true,
        get: () => ({ greeting: 'Hi', count: 1 }),
        mutate: async (ns, ops, expectedRevision) => { calls.mutate.push({ ns, ops, expectedRevision }) },
        ...overrides,
      },
    }
  }

  it('get returns the resolved value', async () => {
    const { settings } = fakeSettings()
    const handler = createSettingsRpcHandler(settings, NAMESPACE)
    assert.deepEqual(await handler('get', {}), success({ greeting: 'Hi', count: 1 }))
  })

  it('mutate validates the field whitelist and returns the new value', async () => {
    const { settings, calls } = fakeSettings()
    const handler = createSettingsRpcHandler(settings, NAMESPACE)
    const res = await handler('mutate', { ops: [{ op: 'set', path: ['greeting'], value: 'Yo' }] })
    assert.deepEqual(res, success({ greeting: 'Hi', count: 1 }))
    assert.deepEqual(calls.mutate, [{ ns: NAMESPACE, ops: [{ op: 'set', path: ['greeting'], value: 'Yo' }], expectedRevision: undefined }])
  })

  it('rejects unknown fields (whitelist)', async () => {
    const { settings } = fakeSettings()
    const handler = createSettingsRpcHandler(settings, NAMESPACE)
    const res = await handler('mutate', { ops: [{ op: 'set', path: ['nope'], value: 1 }] })
    assert.equal(res.ok, false)
    if (!res.ok) assert.match(res.error.message, /unsupported field/)
  })

  it('rejects unknown endpoint', async () => {
    const { settings } = fakeSettings()
    const handler = createSettingsRpcHandler(settings, NAMESPACE)
    const res = await handler('bogus', {})
    assert.equal(res.ok, false)
  })
})
