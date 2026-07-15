import { describe, expect, it } from 'vitest'
import {
  base64urlToBytes,
  bytesToBase64url,
  decodeRequestOptions,
  serializeAssertion,
} from './webauthn'

describe('base64url helpers', () => {
  it('round-trips arbitrary bytes (including 0xFF/0x00 and unpadded lengths)', () => {
    const original = new Uint8Array([0, 1, 2, 250, 255, 128, 64, 63, 62])
    const encoded = bytesToBase64url(original.buffer)
    // URL-safe alphabet, no padding.
    expect(encoded).not.toMatch(/[+/=]/)
    expect(new Uint8Array(base64urlToBytes(encoded))).toEqual(original)
  })

  it('decodes a known base64url string the server would send', () => {
    // "hello" -> aGVsbG8
    expect(new TextDecoder().decode(base64urlToBytes('aGVsbG8'))).toBe('hello')
  })
})

describe('decodeRequestOptions', () => {
  it('decodes the base64url challenge and allowCredentials ids into byte buffers', () => {
    const challengeBytes = new Uint8Array([9, 8, 7, 6])
    const credBytes = new Uint8Array([1, 2, 3])
    const options = decodeRequestOptions({
      challenge: bytesToBase64url(challengeBytes.buffer),
      timeout: 60000,
      rpId: 'example.com',
      userVerification: 'preferred',
      allowCredentials: [
        {
          id: bytesToBase64url(credBytes.buffer),
          type: 'public-key',
          transports: ['internal'],
        },
      ],
    })

    expect(new Uint8Array(options.challenge as ArrayBuffer)).toEqual(
      challengeBytes,
    )
    expect(options.timeout).toBe(60000)
    expect(options.rpId).toBe('example.com')
    expect(
      new Uint8Array(options.allowCredentials![0].id as ArrayBuffer),
    ).toEqual(credBytes)
    expect(options.allowCredentials![0].transports).toEqual(['internal'])
  })

  it('tolerates missing allowCredentials', () => {
    const options = decodeRequestOptions({
      challenge: bytesToBase64url(new Uint8Array([1]).buffer),
    })
    expect(options.allowCredentials).toBeUndefined()
  })
})

describe('serializeAssertion', () => {
  it('serializes an assertion to the WebAuthn-JSON shape (base64url buffers)', () => {
    const rawId = new Uint8Array([1, 2, 3, 4])
    const authData = new Uint8Array([10, 20, 30])
    const clientData = new Uint8Array([40, 50])
    const signature = new Uint8Array([60, 70, 80])
    const userHandle = new Uint8Array([99])

    const credential = {
      id: 'cred-id',
      rawId: rawId.buffer,
      type: 'public-key',
      response: {
        authenticatorData: authData.buffer,
        clientDataJSON: clientData.buffer,
        signature: signature.buffer,
        userHandle: userHandle.buffer,
      },
    } as unknown as PublicKeyCredential

    const serialized = serializeAssertion(credential)

    expect(serialized).toEqual({
      id: 'cred-id',
      rawId: bytesToBase64url(rawId.buffer),
      type: 'public-key',
      response: {
        authenticatorData: bytesToBase64url(authData.buffer),
        clientDataJSON: bytesToBase64url(clientData.buffer),
        signature: bytesToBase64url(signature.buffer),
        userHandle: bytesToBase64url(userHandle.buffer),
      },
    })
  })

  it('sets userHandle to null when the authenticator omits it', () => {
    const credential = {
      id: 'x',
      rawId: new Uint8Array([1]).buffer,
      type: 'public-key',
      response: {
        authenticatorData: new Uint8Array([1]).buffer,
        clientDataJSON: new Uint8Array([1]).buffer,
        signature: new Uint8Array([1]).buffer,
        userHandle: null,
      },
    } as unknown as PublicKeyCredential

    expect(serializeAssertion(credential).response.userHandle).toBeNull()
  })
})
