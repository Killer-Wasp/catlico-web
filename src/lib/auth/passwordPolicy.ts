/**
 * Password policy mirrored from the backend (`app.core.security.MIN_PASSWORD_LENGTH`).
 * The server is the source of truth; this is only for instant UI feedback. Keep
 * the value in sync with the API.
 */
export const MIN_PASSWORD_LENGTH = 12

export function passwordMeetsPolicy(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH
}
