// Pure RPC handler factory — unit-testable without a real DSH host context.
// Mirrors the real @deepseek-ai/dsh-settings provider surface:
//   settings.get(ns) -> resolved value
//   settings.mutate(ns, ops, expectedRevision) -> Promise<void>
//   settings.writable -> boolean
export type RpcEnvelope = { ok: true; value: unknown } | { ok: false; error: { message: string } }

export function success(value: unknown): RpcEnvelope {
  return { ok: true, value }
}

export function failure(message: string): RpcEnvelope {
  return { ok: false, error: { message } }
}

const MUTABLE_FIELDS = new Set(['greeting', 'count'])

export function createSettingsRpcHandler(settings: {
  get(ns: string): unknown
  writable: boolean
  mutate(ns: string, ops: unknown, expectedRevision?: number): Promise<void>
}, namespace: string) {
  return async (endpoint: string, rawPayload: unknown): Promise<RpcEnvelope> => {
    try {
      if (endpoint === 'get') return success(settings.get(namespace))
      if (endpoint !== 'mutate') return failure('unknown endpoint: ' + endpoint)
      const payload = (rawPayload ?? {}) as { ops?: Array<{ op: string; path: string[]; value?: unknown }>; expectedRevision?: number }
      if (!settings.writable) return failure('read-only')
      const ops = (payload.ops ?? []).map((op) => {
        if (op.op !== 'set' && op.op !== 'unset') throw new Error('unsupported op: ' + op.op)
        if (!MUTABLE_FIELDS.has(op.path[0] ?? '')) throw new Error('unsupported field: ' + op.path[0])
        return op
      })
      await settings.mutate(namespace, ops, payload.expectedRevision)
      return success(settings.get(namespace))
    } catch (error) {
      return failure(error instanceof Error ? error.message : String(error))
    }
  }
}
