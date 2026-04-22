/**
 * hybrid.js – Hybrid Key Derivation
 *
 * Combines ECDH and LWE shared secrets into a single 256-bit symmetric key.
 *
 * Hybrid construction:
 *   hybridKey = KDF(ECDH_secret || LWE_secret)
 *
 * Where KDF = SHA-256 (a cryptographic hash function used as a KDF here).
 * In production, HKDF (RFC 5869) would be used instead.
 *
 * Security property:
 *   - If ECDH is broken (e.g., by Shor's algorithm on a QC), LWE still protects.
 *   - If LWE is broken (e.g., by a future lattice attack), ECDH still protects.
 *   - An attacker must break BOTH to recover the key. Defense in depth!
 *
 * This is the core idea behind NIST's recommendation for hybrid PQC:
 * https://csrc.nist.gov/pubs/fips/203/final (ML-KEM / Kyber)
 */

'use strict';

const HybridKDF = (() => {

  /**
   * Concatenate two byte arrays.
   * @param {Uint8Array} a
   * @param {Uint8Array} b
   * @returns {Uint8Array}
   */
  function concat(a, b) {
    const out = new Uint8Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    return out;
  }

  /**
   * Derive the hybrid key from ECDH and LWE secrets.
   *
   * hybridKey = SHA-256(ECDH_secret || LWE_secret || "HybridPQC-v1")
   *
   * The domain string "HybridPQC-v1" is a context label to prevent
   * cross-protocol attacks and misuse of the key material.
   *
   * @param {Uint8Array} ecdhSecret - 32-byte ECDH shared secret
   * @param {Uint8Array} lweSecret  - 32-byte LWE-derived key bytes
   * @returns {{ hybridKeyBytes: Uint8Array, hybridKeyHex: string }}
   */
  async function deriveHybridKey(ecdhSecret, lweSecret) {
    // Domain separation label (prevents protocol confusion attacks)
    const label = new TextEncoder().encode('HybridPQC-v1:ECDH+LWE');

    // Concatenate: ECDH_secret || LWE_secret || label
    const material = concat(concat(ecdhSecret, lweSecret), label);

    // Hash to produce a uniform 256-bit key
    const hashBuf = await crypto.subtle.digest('SHA-256', material);
    const hybridKeyBytes = new Uint8Array(hashBuf);

    // Import as AES-GCM key for direct use
    const aesKey = await crypto.subtle.importKey(
      'raw',
      hybridKeyBytes,
      { name: 'AES-GCM' },
      false,    // not extractable (security best practice)
      ['encrypt', 'decrypt']
    );

    return {
      hybridKeyBytes,
      hybridKeyHex: bufToHex(hybridKeyBytes),
      aesKey,
      material_hex: bufToHex(material)
    };
  }

  /**
   * Visualize the hybrid combination for display.
   * Shows how the two secrets are combined.
   *
   * @param {string} ecdhHex - hex string of ECDH secret
   * @param {string} lweHex  - hex string of LWE secret bytes
   * @returns {{ step1, step2, step3 }}
   */
  function explainCombination(ecdhHex, lweHex) {
    return {
      step1: `ECDH secret:  ${ecdhHex.slice(0, 32)}...`,
      step2: `LWE secret:   ${lweHex.slice(0, 32)}...`,
      step3: `SHA-256(ECDH || LWE || "HybridPQC-v1") → 256-bit symmetric key`
    };
  }

  function bufToHex(buf) {
    return Array.from(new Uint8Array(buf instanceof ArrayBuffer ? buf : buf.buffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  }

  return {
    deriveHybridKey,
    explainCombination,
    concat,
    bufToHex
  };

})();

window.HybridKDF = HybridKDF;
