/**
 * lwe.js – Simplified LWE (Learning With Errors) Implementation
 * 
 * Parameters: n=4 (dimension), q=97 (modulus)
 * This is mathematically correct for demonstration purposes.
 * Real Kyber uses n=256, q=3329 with more sophisticated techniques.
 * 
 * Reference: Regev, O. (2005). "On Lattices, Learning with Errors, Random
 * Linear Codes, and Cryptography." STOC 2005.
 */

'use strict';

const LWE = (() => {

  // ─── Parameters ───
  const DEFAULT_N = 4;   // Lattice dimension
  const DEFAULT_Q = 97;  // Prime modulus (must be prime for security)
  const ERROR_BOUND = 1; // χ distribution bound for key gen

  // ─── Modular Arithmetic ───

  /** Reduce x modulo q into range [0, q-1] */
  function mod(x, q) {
    return ((x % q) + q) % q;
  }

  /** Modular inner product of two vectors */
  function dotMod(a, b, q) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
    return mod(sum, q);
  }

  /** Matrix-vector multiply: A (n×n) · v (n×1) mod q → result (n×1) */
  function matVecMulMod(A, v, q) {
    const n = A.length;
    const result = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        result[i] += A[i][j] * v[j];
      }
      result[i] = mod(result[i], q);
    }
    return result;
  }

  /** Transpose an n×n matrix */
  function transpose(A) {
    const n = A.length;
    return A[0].map((_, j) => A.map(row => row[j]));
  }

  /** Vector addition mod q */
  function vecAddMod(a, b, q) {
    return a.map((x, i) => mod(x + b[i], q));
  }

  // ─── Random Number Generation ───

  /** Cryptographically random integer in [0, q-1] */
  function randMod(q) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] % q;
  }

  /**
   * Sample from the error distribution χ (chi)
   * Models a discrete Gaussian centered at 0.
   * For demo: χ samples from {-bound, ..., bound} with
   * higher probability near 0.
   * @param {number} bound - maximum absolute value of error
   */
  function sampleError(bound = ERROR_BOUND) {
    // Simple centered binomial distribution B(2*bound, 0.5) - mean = bound
    let s = 0;
    for (let i = 0; i < 2 * bound; i++) {
      const arr = new Uint8Array(1);
      crypto.getRandomValues(arr);
      s += arr[0] & 1;
    }
    return s - bound; // Center at 0
  }

  /** Generate a random n×n matrix A mod q (public parameter) */
  function generateMatrix(n, q) {
    return Array.from({ length: n }, () =>
      Array.from({ length: n }, () => randMod(q))
    );
  }

  /** Generate a small secret vector (values in {0,1,2}) */
  function generateSecret(n, q) {
    return Array.from({ length: n }, () => mod(sampleError(2), q));
  }

  /** Generate an error vector from χ */
  function generateErrorVec(n, bound = ERROR_BOUND) {
    return Array.from({ length: n }, () => sampleError(bound));
  }

  // ─── LWE Key Generation ───

  /**
   * Generate an LWE key pair.
   * 
   * Public key: (A, b) where b = A·s + e mod q
   * Secret key: s
   * 
   * Security relies on: given A and b, finding s is hard (LWE assumption).
   * 
   * @param {number} n - dimension
   * @param {number} q - modulus
   * @returns {{ publicKey, secretKey, debug }}
   */
  function keyGen(n = DEFAULT_N, q = DEFAULT_Q) {
    // Public matrix A (random, public)
    const A = generateMatrix(n, q);

    // Secret vector s (small, kept private)
    const s = generateSecret(n, q);

    // Error vector e (small, from χ distribution)
    const e = generateErrorVec(n);

    // Compute b = A·s + e mod q  ← This is the "Learning With Errors" sample
    const As = matVecMulMod(A, s, q);
    const b = vecAddMod(As, e, q);

    return {
      publicKey: { A, b },
      secretKey: s,
      debug: { A, s, e, As, b }
    };
  }

  // ─── LWE Encapsulation (Sender side) ───

  /**
   * Encapsulate: Alice (sender) uses Bob's public key to derive a shared value.
   *
   * 1. Choose random r (small)
   * 2. Choose error vectors e1, e2 (small)
   * 3. Compute:
   *    u = A^T · r + e1  mod q   (ciphertext part 1)
   *    v = b^T · r + e2           (raw key material, simplified)
   *
   * Alice's view of shared secret: K_A = b^T · r mod q
   * 
   * @param {Object} publicKey - { A, b }
   * @param {number} noiseBound - error distribution bound (increase to demo failure)
   * @param {number} n
   * @param {number} q
   */
  function encapsulate(publicKey, noiseBound = ERROR_BOUND, n = DEFAULT_N, q = DEFAULT_Q) {
    const { A, b } = publicKey;

    // Random vector r (small, like a secret)
    const r = generateSecret(n, q);

    // Error vectors for encapsulation
    const e1 = generateErrorVec(n, noiseBound);
    const e2 = generateErrorVec(n, noiseBound);

    // Compute u = A^T · r + e1 mod q
    const AT = transpose(A);
    const ATr = matVecMulMod(AT, r, q);
    const u = vecAddMod(ATr, e1, q);

    // Alice's raw key: K_A = b^T · r = dotMod(b, r, q)
    const kAlice = dotMod(b, r, q);

    return {
      ciphertext: u,
      rawSecret: kAlice,
      debug: { r, e1, e2, AT, ATr, u, kAlice }
    };
  }

  // ─── LWE Decapsulation (Receiver side) ───

  /**
   * Decapsulate: Bob (receiver) uses his secret key to recover the shared value.
   *
   * Bob computes: K_B = s^T · u mod q
   *
   * Correctness argument:
   *   s^T · u = s^T · (A^T · r + e1)
   *           = (A·s)^T · r + s^T·e1
   *           = (b - e)^T · r + s^T·e1
   *           = b^T·r - e^T·r + s^T·e1
   *           ≈ b^T·r  (when errors e, e1 are small)
   *           = K_A
   *
   * So K_B ≈ K_A. For small parameters, they may not be exactly equal,
   * which is why real Kyber includes error reconciliation and rounding.
   *
   * @param {Array} secretKey - s vector
   * @param {Array} ciphertext - u vector
   * @param {number} q
   */
  function decapsulate(secretKey, ciphertext, q = DEFAULT_Q) {
    // K_B = s^T · u mod q
    const kBob = dotMod(secretKey, ciphertext, q);
    return kBob;
  }

  // ─── Derive Symmetric Key from LWE Output ───

  /**
   * Convert the scalar LWE output to a 32-byte key seed.
   * In real Kyber, this uses a hash function and error reconciliation.
   * Here, we treat the scalar as a seed for SHA-256.
   * 
   * @param {number} kAlice - sender's raw LWE value
   * @param {number} kBob   - receiver's raw LWE value
   * @param {number} q
   * @returns {{ match: boolean, difference: number, kAliceHex, kBobHex }}
   */
  async function deriveKeyBytes(kAlice, kBob, q = DEFAULT_Q) {
    // Check correctness bound: |K_A - K_B| < q/4 → rounding agree
    const diff = Math.min(Math.abs(kAlice - kBob), q - Math.abs(kAlice - kBob));
    const match = diff < Math.floor(q / 4);

    // Round both to nearest multiple of floor(q/4)
    const round = (k) => Math.round(k / Math.floor(q / 4)) * Math.floor(q / 4);
    const rounded = match ? round(kAlice) : kAlice; // use rounding for reconciliation

    // Hash the rounded value to get a 32-byte seed
    const buf = new TextEncoder().encode(`LWE_SECRET_${rounded}_q${q}`);
    const hashBuf = await crypto.subtle.digest('SHA-256', buf);

    return {
      match,
      difference: diff,
      bound: Math.floor(q / 4),
      keyBytes: new Uint8Array(hashBuf),
      kAlice,
      kBob,
      rounded
    };
  }

  // ─── Utility: Format vectors/matrices for display ───

  function fmtVec(v) {
    return '[' + v.map(x => x.toString().padStart(3)).join(', ') + ']';
  }

  function fmtMatrix(A) {
    return A.map(row => '[' + row.map(x => x.toString().padStart(3)).join(', ') + ']').join('\n');
  }

  function toHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ─── Public API ───
  return {
    DEFAULT_N,
    DEFAULT_Q,
    mod,
    generateMatrix,
    generateSecret,
    generateErrorVec,
    matVecMulMod,
    transpose,
    vecAddMod,
    dotMod,
    keyGen,
    encapsulate,
    decapsulate,
    deriveKeyBytes,
    fmtVec,
    fmtMatrix,
    toHex
  };

})();

// Make available globally
window.LWE = LWE;
