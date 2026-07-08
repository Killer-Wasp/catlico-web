const LOGIN_PATH = '/login'

function browserOrigin() {
  return typeof window === 'undefined'
    ? 'http://localhost'
    : window.location.origin
}

export function sanitizeReturnUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) return '/'

  try {
    const url = new URL(value, browserOrigin())
    if (url.origin !== browserOrigin()) return '/'
    if (url.pathname === LOGIN_PATH) return '/'
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return '/'
  }
}

export function currentReturnUrl(): string {
  if (typeof window === 'undefined') return '/'
  return sanitizeReturnUrl(
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
  )
}

export function loginHref(returnUrl: unknown = currentReturnUrl()): string {
  const safeReturnUrl = sanitizeReturnUrl(returnUrl)
  const search = new URLSearchParams({ returnUrl: safeReturnUrl })
  return `${LOGIN_PATH}?${search.toString()}`
}

export function redirectToLogin(returnUrl: unknown = currentReturnUrl()): void {
  if (typeof window === 'undefined') return
  if (window.location.pathname === LOGIN_PATH) return
  window.location.assign(loginHref(returnUrl))
}
