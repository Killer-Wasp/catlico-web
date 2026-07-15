/**
 * WebAuthn (passkey) wire-format helpers. The API speaks base64url over JSON:
 * `PublicKeyCredentialRequestOptions` arrive with `challenge` and each
 * `allowCredentials[].id` as base64url strings that the browser's
 * `navigator.credentials.get` needs as `BufferSource`s, and the assertion the
 * authenticator returns must be re-serialized to the standard WebAuthn-JSON
 * shape (base64url again) for the verify POST. These converters are the only
 * place that translation lives.
 */

/** Decode a base64url string (no padding) into raw bytes. */
export function base64urlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Encode an ArrayBuffer as a base64url string (URL-safe alphabet, unpadded). */
export function bytesToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * The JSON form of `PublicKeyCredentialRequestOptions` the API returns from
 * `POST /auth/mfa/passkey/auth/options`: `challenge` and each credential `id`
 * are base64url strings; everything else passes straight through to the
 * browser.
 */
export type PublicKeyRequestOptionsJSON = {
  challenge: string
  timeout?: number
  rpId?: string
  userVerification?: UserVerificationRequirement
  allowCredentials?: Array<{
    id: string
    type: 'public-key'
    transports?: AuthenticatorTransport[]
  }>
}

/** Turn the API's base64url options JSON into the browser's `BufferSource` form. */
export function decodeRequestOptions(
  json: PublicKeyRequestOptionsJSON,
): PublicKeyCredentialRequestOptions {
  return {
    ...json,
    challenge: base64urlToBytes(json.challenge) as BufferSource,
    allowCredentials: json.allowCredentials?.map((cred) => ({
      ...cred,
      id: base64urlToBytes(cred.id) as BufferSource,
    })),
  }
}

/** The assertion serialized the standard WebAuthn-JSON way for the verify POST. */
export type SerializedAssertion = {
  id: string
  rawId: string
  type: string
  response: {
    authenticatorData: string
    clientDataJSON: string
    signature: string
    userHandle: string | null
  }
}

/** Serialize a `navigator.credentials.get` assertion to base64url WebAuthn-JSON. */
export function serializeAssertion(
  credential: PublicKeyCredential,
): SerializedAssertion {
  const response = credential.response as AuthenticatorAssertionResponse
  return {
    id: credential.id,
    rawId: bytesToBase64url(credential.rawId),
    type: credential.type,
    response: {
      authenticatorData: bytesToBase64url(response.authenticatorData),
      clientDataJSON: bytesToBase64url(response.clientDataJSON),
      signature: bytesToBase64url(response.signature),
      userHandle: response.userHandle
        ? bytesToBase64url(response.userHandle)
        : null,
    },
  }
}
