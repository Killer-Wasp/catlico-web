import { describe, expect, it } from 'vitest'
import {
  base64urlToBytes,
  bytesToBase64url,
  decodeCreationOptions,
  decodeRequestOptions,
  serializeAssertion,
  serializeAttestation,
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

describe('decodeCreationOptions', () => {
  it('decodes challenge, user.id and excludeCredentials ids into byte buffers', () => {
    const challengeBytes = new Uint8Array([1, 2, 3, 4])
    const userIdBytes = new Uint8Array([200, 100, 50])
    const excludeBytes = new Uint8Array([7, 7])

    const options = decodeCreationOptions({
      challenge: bytesToBase64url(challengeBytes.buffer),
      rp: { id: 'example.com', name: 'Catlico' },
      user: {
        id: bytesToBase64url(userIdBytes.buffer),
        name: 'admin@example.com',
        displayName: 'Admin',
      },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      timeout: 60000,
      excludeCredentials: [
        {
          id: bytesToBase64url(excludeBytes.buffer),
          type: 'public-key',
          transports: ['internal'],
        },
      ],
      authenticatorSelection: { userVerification: 'preferred' },
      attestation: 'none',
    })

    expect(new Uint8Array(options.challenge as ArrayBuffer)).toEqual(
      challengeBytes,
    )
    expect(new Uint8Array(options.user.id as ArrayBuffer)).toEqual(userIdBytes)
    expect(options.user.name).toBe('admin@example.com')
    expect(options.rp.name).toBe('Catlico')
    expect(options.timeout).toBe(60000)
    expect(
      new Uint8Array(options.excludeCredentials![0].id as ArrayBuffer),
    ).toEqual(excludeBytes)
    expect(options.excludeCredentials![0].transports).toEqual(['internal'])
    expect(options.attestation).toBe('none')
  })

  it('tolerates missing excludeCredentials', () => {
    const options = decodeCreationOptions({
      challenge: bytesToBase64url(new Uint8Array([1]).buffer),
      rp: { name: 'Catlico' },
      user: {
        id: bytesToBase64url(new Uint8Array([2]).buffer),
        name: 'a@b.com',
        displayName: 'A',
      },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
    })
    expect(options.excludeCredentials).toBeUndefined()
  })
})

describe('serializeAttestation', () => {
  it('serializes a creation credential to the WebAuthn-JSON registration shape', () => {
    const rawId = new Uint8Array([1, 2, 3, 4])
    const attestationObject = new Uint8Array([11, 22, 33])
    const clientData = new Uint8Array([44, 55])

    const credential = {
      id: 'new-cred-id',
      rawId: rawId.buffer,
      type: 'public-key',
      response: {
        attestationObject: attestationObject.buffer,
        clientDataJSON: clientData.buffer,
        getTransports: () => ['internal', 'hybrid'],
      },
    } as unknown as PublicKeyCredential

    expect(serializeAttestation(credential)).toEqual({
      id: 'new-cred-id',
      rawId: bytesToBase64url(rawId.buffer),
      type: 'public-key',
      response: {
        attestationObject: bytesToBase64url(attestationObject.buffer),
        clientDataJSON: bytesToBase64url(clientData.buffer),
        transports: ['internal', 'hybrid'],
      },
    })
  })

  it('defaults transports to an empty array when getTransports is unavailable', () => {
    const credential = {
      id: 'x',
      rawId: new Uint8Array([1]).buffer,
      type: 'public-key',
      response: {
        attestationObject: new Uint8Array([1]).buffer,
        clientDataJSON: new Uint8Array([1]).buffer,
      },
    } as unknown as PublicKeyCredential

    expect(serializeAttestation(credential).response.transports).toEqual([])
  })
})
