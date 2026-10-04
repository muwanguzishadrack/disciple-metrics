// The DB and the app deploy separately, so a page can load before its RPC
// exists. These helpers let pages tell "not deployed yet" apart from real
// failures and show a friendly message instead of crashing.

interface ErrorLike {
  code?: unknown
  message?: unknown
  details?: unknown
  hint?: unknown
}

function asErrorLike(error: unknown): ErrorLike {
  return typeof error === 'object' && error !== null ? (error as ErrorLike) : {}
}

/**
 * True when PostgREST can't find the function (PGRST202), or Postgres reports
 * an undefined function/table (42883 / 42P01) — i.e. the DB side hasn't shipped.
 */
export function isMissingRpcError(error: unknown): boolean {
  const { code, message } = asErrorLike(error)
  if (code === 'PGRST202' || code === '42883' || code === '42P01') return true
  return (
    typeof message === 'string' &&
    /could not find the function|function .* does not exist/i.test(message)
  )
}

/** True when the RPC's own admin check (or a permission grant) rejected us */
export function isPermissionError(error: unknown): boolean {
  const { code, message } = asErrorLike(error)
  if (code === '42501') return true
  return typeof message === 'string' && /not authori[sz]ed|permission denied|admins? only|requires? admin|must be (an )?admin/i.test(message)
}

/** User-facing description of an RPC failure */
export function describeRpcError(error: unknown, feature = 'This report'): string {
  if (isMissingRpcError(error)) {
    return `${feature} isn't available yet — the database update it needs hasn't been deployed. Please check back soon.`
  }
  if (isPermissionError(error)) {
    return `You don't have permission to view this.`
  }
  const { message } = asErrorLike(error)
  return typeof message === 'string' && message
    ? message
    : 'Something went wrong while loading this data.'
}

/** React Query retry policy: never retry a missing RPC or a permission error */
export function shouldRetryRpc(failureCount: number, error: unknown): boolean {
  if (isMissingRpcError(error) || isPermissionError(error)) return false
  return failureCount < 2
}
