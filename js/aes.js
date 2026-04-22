/**
 * aes.js – AES-256-GCM Encryption & Decryption
 *
 * Uses the browser's native Web Crypto API.
 * This is REAL, production-grade cryptography.
 *
 * AES-256-GCM provides:
 *   - Confidentiality: XOR with keystream derived from AES
 *   - Authenticity:    GCM authentication tag (128-bit MAC)
 *   - Integrity:       Tag verification on decryption
 *
 * File format (.hpqc): JSON containing Base64-encoded fields.
 * This ensures the file downloads and uploads correctly across
 * all browsers and operating systems, with no binary handling issues.
 *
 *   {
 *     "format":       "HybridPQC-v1",
 *     "algorithm":    "AES-256-GCM",
 *     "iv":           "<base64>",       // 12-byte random nonce
 *     "ciphertext":   "<base64>",       // encrypted data + 128-bit GCM tag
 *     "originalSize": <number>,         // original plaintext byte length
 *     "timestamp":    "<ISO string>"
 *   }
 */

'use strict';

const AESCrypto = (() => {

  const FORMAT   = 'HybridPQC-v1';
  const IV_LENGTH = 12;   // 96-bit nonce (recommended for AES-GCM)
  const TAG_BITS  = 128;  // GCM authentication tag length

  // ─── Helpers ───

  function bufToBase64(buf) {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  }

  function base64ToBuf(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function bufToHex(buf) {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  // ─── Encryption ───

  /**
   * Encrypt data using AES-256-GCM.
   * Returns a JSON-serialisable package (Base64 encoded inside).
   *
   * @param {CryptoKey}  aesKey  - AES-256-GCM key (from HybridKDF)
   * @param {Uint8Array} data    - plaintext bytes
   * @param {Uint8Array} [aad]   - additional authenticated data (optional)
   */
  async function encrypt(aesKey, data, aad) {
    // Generate a fresh random 96-bit IV — never reuse with the same key!
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    const encryptParams = {
      name: 'AES-GCM',
      iv,
      tagLength: TAG_BITS,
      ...(aad && { additionalData: aad })
    };

    // Encrypt → ciphertext bytes include the 16-byte GCM tag at the end
    const cipherBuf   = await crypto.subtle.encrypt(encryptParams, aesKey, data);
    const cipherBytes = new Uint8Array(cipherBuf);

    // Build the JSON package
    const pkg = {
      format:       FORMAT,
      algorithm:    'AES-256-GCM',
      iv:           bufToBase64(iv),
      ciphertext:   bufToBase64(cipherBytes),
      originalSize: data.length,
      timestamp:    new Date().toISOString()
    };

    const jsonString  = JSON.stringify(pkg, null, 2);
    const jsonBytes   = new TextEncoder().encode(jsonString);

    return {
      pkg,
      jsonString,
      jsonBytes,
      // For legacy internal use (session decrypt without file round-trip)
      ivBytes:        iv,
      cipherBytes,
      // Display helpers
      ivHex:          bufToHex(iv),
      ciphertextFull: bufToHex(cipherBytes),
      byteLength:     cipherBytes.length,
      originalLength: data.length
    };
  }

  // ─── Decryption ───

  /**
   * Decrypt data.
   * Accepts EITHER:
   *   A) A Uint8Array containing the JSON .hpqc file bytes  (new format)
   *   B) A raw { ivBytes, cipherBytes } object              (in-memory, session use)
   *
   * @param {CryptoKey}         aesKey
   * @param {Uint8Array|Object} input   - file bytes or {ivBytes, cipherBytes}
   * @param {Uint8Array}        [aad]
   */
  async function decrypt(aesKey, input, aad) {
    try {
      let iv, cipherBytes;

      // ── Detect input type ──
      if (input instanceof Uint8Array || input instanceof ArrayBuffer) {
        // Try to parse as JSON first
        const raw = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
        const text = new TextDecoder().decode(raw);

        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch {
          return { ok: false, error: 'Invalid file: could not parse .hpqc file. Make sure you uploaded the correct encrypted file.' };
        }

        if (!parsed.format || !parsed.format.startsWith('HybridPQC')) {
          return { ok: false, error: `Invalid file format: expected "HybridPQC-v1", got "${parsed.format || 'unknown'}"` };
        }
        if (!parsed.iv || !parsed.ciphertext) {
          return { ok: false, error: 'Invalid .hpqc file: missing iv or ciphertext fields.' };
        }

        iv          = base64ToBuf(parsed.iv);
        cipherBytes = base64ToBuf(parsed.ciphertext);

      } else if (input && input.ivBytes && input.cipherBytes) {
        // In-memory session object (from DemoState)
        iv          = input.ivBytes;
        cipherBytes = input.cipherBytes;
      } else {
        return { ok: false, error: 'Invalid input: pass a .hpqc file (Uint8Array) or session object {ivBytes, cipherBytes}.' };
      }

      const decryptParams = {
        name: 'AES-GCM',
        iv,
        tagLength: TAG_BITS,
        ...(aad && { additionalData: aad })
      };

      // Decrypt & verify authentication tag (throws OperationError if tag invalid)
      const plainBuf  = await crypto.subtle.decrypt(decryptParams, aesKey, cipherBytes);
      const plaintext = new Uint8Array(plainBuf);

      let plaintextText;
      try {
        plaintextText = new TextDecoder().decode(plaintext);
      } catch {
        plaintextText = `[Binary data: ${plaintext.length} bytes]`;
      }

      return { ok: true, plaintext, plaintextText };

    } catch (err) {
      if (err.name === 'OperationError') {
        return {
          ok: false,
          error: 'Decryption failed: Authentication tag mismatch. Wrong key or tampered/corrupted file.'
        };
      }
      return { ok: false, error: `Decryption error: ${err.message}` };
    }
  }

  // ─── Key Import ───

  /**
   * Import raw AES-256-GCM key bytes as a CryptoKey.
   * @param {Uint8Array} keyBytes - 32 bytes
   */
  async function importKey(keyBytes) {
    return crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // ─── Download ───

  /**
   * Download the encrypted package as a .hpqc file.
   * The file content is UTF-8 JSON (Base64-encoded ciphertext inside).
   * This works reliably across all browsers — no binary blob issues.
   *
   * @param {string} jsonString  - JSON string from encrypt()
   * @param {string} filename    - suggested filename (e.g. "message.hpqc")
   */
  function downloadJSON(jsonString, filename = 'encrypted.hpqc') {
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // ─── Read File ───

  /**
   * Read a File object as Uint8Array.
   * Works for both binary files and text files.
   * @param {File} file
   * @returns {Promise<Uint8Array>}
   */
  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = e => resolve(new Uint8Array(e.target.result));
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Read a File as text string (for JSON files).
   * @param {File} file
   * @returns {Promise<string>}
   */
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file, 'utf-8');
    });
  }

  // ─── Public API ───
  return {
    encrypt,
    decrypt,
    importKey,
    downloadJSON,
    // Keep downloadBlob as alias for compatibility
    downloadBlob: (_, filename) => {
      console.warn('downloadBlob is deprecated, use downloadJSON');
    },
    readFile,
    readFileAsText,
    bufToHex,
    bufToBase64,
    base64ToBuf,
    formatSize,
    FORMAT
  };

})();

window.AESCrypto = AESCrypto;
