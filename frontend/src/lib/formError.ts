/**
 * TanStack Form surfaces validation errors as whatever the validator produced.
 * With a Standard Schema validator (Zod, here) those are issue objects; a
 * plain function validator may return strings. Normalise to the message.
 */
export function firstErrorMessage(errors: readonly unknown[]): string | undefined {
  const first = errors.find((error) => error != null)
  if (first == null) return undefined
  if (typeof first === 'string') return first
  if (typeof first === 'object' && 'message' in first) {
    const { message } = first as { message: unknown }
    return typeof message === 'string' ? message : undefined
  }
  return undefined
}
