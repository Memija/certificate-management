import forge from 'node-forge'

import { uint8ToBinaryString } from './x509-parser'

/**
 * Generates an RSA key pair asynchronously without blocking the main UI thread.
 * Uses hardware-accelerated native WebCrypto (`crypto.subtle.generateKey`) when available,
 * converting the exported PKCS#8 key into `node-forge` RSA key objects, and falls back
 * to `node-forge`'s async/WebWorker generator in non-secure contexts.
 */
export async function generateRsaKeyPairAsync(bits: number): Promise<forge.pki.rsa.KeyPair> {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    try {
      const cryptoKeyPair = await globalThis.crypto.subtle.generateKey(
        {
          name: 'RSASSA-PKCS1-v1_5',
          modulusLength: bits,
          publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
          hash: 'SHA-256',
        },
        true,
        ['sign', 'verify'],
      )

      const pkcs8Buffer = await globalThis.crypto.subtle.exportKey(
        'pkcs8',
        cryptoKeyPair.privateKey,
      )
      const derBytes = uint8ToBinaryString(new Uint8Array(pkcs8Buffer))
      const privateKey = forge.pki.privateKeyFromAsn1(
        forge.asn1.fromDer(derBytes),
      ) as forge.pki.rsa.PrivateKey
      const publicKey = forge.pki.setRsaPublicKey(privateKey.n, privateKey.e)

      return { privateKey, publicKey }
    } catch {
      // Fall through to node-forge async fallback
    }
  }

  return new Promise<forge.pki.rsa.KeyPair>((resolve, reject) => {
    forge.pki.rsa.generateKeyPair({ bits, workers: -1 }, (err, keypair) => {
      if (err) {
        reject(err)
      } else {
        resolve(keypair)
      }
    })
  })
}
