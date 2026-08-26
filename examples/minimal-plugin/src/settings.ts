// Pure settings schema — schemastery schema + pure defaults, unit-testable.
// NOTE: schemastery infers output types via the global Schemastery.TypeT helper,
// NOT z.infer (zod). Default export z = Schema from '@deepseek-ai/schemastery'.
import z from '@deepseek-ai/schemastery'

export const NAMESPACE = 'minimal'

export const MinimalSettings = z.object({
  greeting: z.string().default('Hello'),
  count: z.number().min(0).max(100).default(0),
})

export type MinimalSettings = Schemastery.TypeT<typeof MinimalSettings>

export const DEFAULTS: MinimalSettings = {
  greeting: 'Hello',
  count: 0,
}

export function clampCount(n: number): number {
  return Math.max(0, Math.min(100, Math.trunc(n)))
}
