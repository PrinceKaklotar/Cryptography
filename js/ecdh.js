/**
 * ecdh.js – Elliptic Curve Diffie-Hellman using Web Crypto API
 *
 * Uses ECDH with P-256 (secp256r1) curve — a NIST-standard curve.
 * This is REAL cryptography, not simulated.
 *
 * Protocol:
 *   1. Alice generates (privateKey_A, publicKey_A)
 *   2. Bob generates (privateKey_B, publicKey_B)
 *   3. Alice computes sharedSecret = ECDH(privateKey_A, publicKey_B)
 *   4. Bob computes sharedSecret = ECDH(privateKey_B, publicKey_A)
 *   5. Both arrive at the same sharedSecret (this is the DH magic)
 *
 * Security: based on ECDLP (Elliptic Curve Discrete Logarithm Problem).
 * Vulnerable to Shor's algorithm on a quantum computer!
 * That's why we combine it with LWE in the hybrid scheme.
 */

'use strict';

const ECDH = (() => {

  const CURVE = 'P-256';

  // ─── Key Generation ───

  /**
   * Generate an ECDH key pair for one party.
   * @returns {{ privateKey: CryptoKey, publicKey: CryptoKey, publicKeyHex: string }}
   */
  async function generateKeyPair() {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: CURVE },
      true,  // extractable (so we can export for display)
      ['deriveKey', 'deriveBits']
    );

    // Export public key as raw bytes (65 bytes: 0x04 || x || y for uncompressed)
    const rawPub = await crypto.subtle.exportKey('raw', keyPair.publicKey);
    const pubHex = bufToHex(rawPub);

    // Export private key for display (not normally done in production!)
    const jwkPriv = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

    return {
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
      publicKeyRaw: rawPub,
      publicKeyHex: pubHex,
      // Display-only excerpts
      publicKeyShort: pubHex.slice(0, 16) + '...' + pubHex.slice(-8),
      privateKeyD: jwkPriv.d // base64url private scalar (display only!)
    };
  }

  // ─── Shared Secret Derivation ───

  /**
   * Derive the ECDH shared secret.
   * Both parties compute the same 32-byte value from their private key
   * and the other party's public key.
   *
   * @param {CryptoKey} myPrivateKey
   * @param {CryptoKey} theirPublicKey
   * @returns {{ sharedSecret: Uint8Array, sharedSecretHex: string }}
   */
  async function deriveSharedSecret(myPrivateKey, theirPublicKey) {
    // deriveBits extracts the raw shared secret (x-coordinate of the EC point)
    const bits = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: theirPublicKey },
      myPrivateKey,
      256  // 256 bits = 32 bytes from P-256
    );

    const sharedSecret = new Uint8Array(bits);
    const sharedSecretHex = bufToHex(sharedSecret.buffer);

    return {
      sharedSecret,
      sharedSecretHex,
      sharedSecretShort: '0x' + sharedSecretHex.slice(0, 16) + '...' + sharedSecretHex.slice(-8)
    };
  }

  // ─── Full ECDH Exchange ───

  /**
   * Perform a complete ECDH key exchange between Alice and Bob.
   * Returns both parties' secrets (they should be equal).
   *
   * @returns {{ alice, bob, verified, sharedSecretHex }}
   */
  async function performExchange() {
    // Generate key pairs for both parties
    const alice = await generateKeyPair();
    const bob   = await generateKeyPair();

    // Each derives the shared secret
    const aliceShared = await deriveSharedSecret(alice.privateKey, bob.publicKey);
    const bobShared   = await deriveSharedSecret(bob.privateKey, alice.publicKey);

    // Verify they match (should always be true with correct ECDH)
    const match = aliceShared.sharedSecretHex === bobShared.sharedSecretHex;

    return {
      alice: {
        ...alice,
        sharedSecret: aliceShared.sharedSecret,
        sharedSecretHex: aliceShared.sharedSecretHex,
        sharedSecretShort: aliceShared.sharedSecretShort
      },
      bob: {
        ...bob,
        sharedSecret: bobShared.sharedSecret,
        sharedSecretHex: bobShared.sharedSecretHex
      },
      verified: match,
      sharedSecretHex: aliceShared.sharedSecretHex,
      sharedSecretBytes: aliceShared.sharedSecret
    };
  }

  // ─── Utilities ───

  function bufToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2)
      bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    return bytes;
  }

  // ─── Public API ───
  return {
    CURVE,
    generateKeyPair,
    deriveSharedSecret,
    performExchange,
    bufToHex,
    hexToBytes
  };

})();

window.ECDH = ECDH;
