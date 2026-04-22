/**
 * demo.js – Interactive Demo Orchestration
 * Manages the 5-step hybrid encryption demo
 */
'use strict';

// ─── State ───
const DemoState = {
  step: 1,
  inputMode: 'text', // 'text' | 'file'
  inputText: '',
  inputFile: null,
  inputBytes: null,
  // ECDH
  aliceECDH: null,
  bobECDH: null,
  ecdhSharedHex: null,
  ecdhSharedBytes: null,
  // LWE
  lweKeys: null,
  lweEncap: null,
  lweDecap: null,
  lweMatch: false,
  lweKeyBytes: null,
  lweKeyHex: null,
  // Hybrid
  hybridResult: null,
  aesKey: null,
  // Encrypted — store both JSON string and session object
  encryptedJSON: null,        // JSON string → downloaded as .hpqc
  encryptedSession: null,     // { ivBytes, cipherBytes } for in-memory decrypt
  // Noise control
  noiseBound: 1,
  // Filename
  originalFilename: 'message.txt'
};

// ─── Utility functions ───
function el(id) { return document.getElementById(id); }

function setVal(id, html, cls = '') {
  const e = el(id);
  if (!e) return;
  e.innerHTML = html;
  if (cls) e.className = e.className.replace(/\s*(empty|purple-val|green-val|error-val)/g, '') + ' ' + cls;
}

function shortHex(hex, pre = '0x') {
  if (!hex || hex.length <= 12) return pre + hex;
  return `${pre}${hex.slice(0, 8)}…${hex.slice(-6)}`;
}

function addLog(msg, type = 'info') {
  const log = el('computation-log');
  if (!log) return;
  const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `<span class="log-ts">[${ts}]</span><span class="log-msg ${type}">${msg}</span>`;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

function clearLog() {
  const log = el('computation-log');
  if (log) log.innerHTML = '';
}

// ─── Step Navigation ───
function gotoStep(step) {
  document.querySelectorAll('.step-view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.demo-step-item').forEach(item => {
    const n = parseInt(item.dataset.step);
    item.classList.remove('active');
    if (n < step) item.classList.add('done');
    else if (n === step) item.classList.add('active');
    else item.classList.remove('done');
  });
  document.querySelectorAll('.demo-connector').forEach(c => {
    const n = parseInt(c.dataset.after);
    c.classList.toggle('done', n < step);
  });

  const view = el(`step-${step}`);
  if (view) view.classList.add('active');
  DemoState.step = step;

  const titles = [
    '', 'Step 1: Choose Your Input',
    'Step 2: Hybrid Key Exchange',
    'Step 3: Encrypt with AES-256-GCM',
    'Step 4: Download Encrypted File',
    'Step 5: Decrypt & Verify'
  ];
  const headerEl = el('panel-title');
  if (headerEl) headerEl.textContent = titles[step] || '';

  const badgeEl = el('step-badge');
  if (badgeEl) badgeEl.textContent = `Step ${step} of 5`;
}

// ─── Step 1: Input ───
function initStep1() {
  document.querySelectorAll('.input-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.input-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      DemoState.inputMode = opt.dataset.mode;
      el('text-input-area').style.display = DemoState.inputMode === 'text' ? 'block' : 'none';
      el('file-input-area').style.display = DemoState.inputMode === 'file' ? 'block' : 'none';
    });
  });

  const textarea = el('demo-text-input');
  if (textarea) textarea.addEventListener('input', () => { DemoState.inputText = textarea.value; });

  const dropZone  = el('file-drop-zone');
  const fileInput = el('file-input');

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelected(file);
    });
    fileInput.addEventListener('change', e => {
      if (e.target.files[0]) handleFileSelected(e.target.files[0]);
    });
  }

  function handleFileSelected(file) {
    if (file.size > 5 * 1024 * 1024) {
      Toast.show('File too large. Please use a file under 5 MB.', 'error');
      return;
    }
    DemoState.inputFile = file;
    DemoState.originalFilename = file.name;
    el('file-info').style.display = 'flex';
    el('file-name-display').textContent = file.name;
    el('file-size-display').textContent = AESCrypto.formatSize(file.size);
  }

  el('btn-next-step1')?.addEventListener('click', async () => {
    if (DemoState.inputMode === 'text') {
      const text = el('demo-text-input')?.value || '';
      if (!text.trim()) { Toast.show('Please enter a message first.', 'error'); return; }
      DemoState.inputText  = text;
      DemoState.inputBytes = new TextEncoder().encode(text);
    } else {
      if (!DemoState.inputFile) { Toast.show('Please select a file first.', 'error'); return; }
      DemoState.inputBytes = await AESCrypto.readFile(DemoState.inputFile);
    }
    const sizeEl = el('input-size-info');
    if (sizeEl) sizeEl.textContent = `${DemoState.inputBytes.length} bytes ready`;
    gotoStep(2);
    clearLog();
    addLog('Input captured. Starting hybrid key exchange…', 'info');
  });
}

// ─── Step 2: Key Exchange ───
async function runKeyExchange() {
  const btn = el('btn-run-exchange');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Computing…'; }

  clearLog();
  addLog('🔑 Starting ECDH key generation (P-256)…', 'info');

  try {
    // ── ECDH ──
    const ecdhResult = await ECDH.performExchange();
    DemoState.aliceECDH      = ecdhResult.alice;
    DemoState.bobECDH        = ecdhResult.bob;
    DemoState.ecdhSharedHex  = ecdhResult.sharedSecretHex;
    DemoState.ecdhSharedBytes = ecdhResult.sharedSecretBytes;

    setVal('alice-pub-key', shortHex(ecdhResult.alice.publicKeyHex));
    setVal('bob-pub-key',   shortHex(ecdhResult.bob.publicKeyHex), 'purple-val');
    setVal('ecdh-shared',   shortHex(ecdhResult.sharedSecretHex), 'green-val');

    addLog(`✓ ECDH: Alice pubkey = ${shortHex(ecdhResult.alice.publicKeyHex)}`, 'key');
    addLog(`✓ ECDH: Bob pubkey   = ${shortHex(ecdhResult.bob.publicKeyHex)}`, 'key');
    addLog(`✓ ECDH shared secret = ${shortHex(ecdhResult.sharedSecretHex)}`, 'success');
    addLog(`  Verified: both parties agree? ${ecdhResult.verified ? '✓ YES' : '✗ NO'}`, 'info');

    await delay(200);

    // ── LWE ──
    addLog('🔐 Starting LWE key exchange (n=4, q=97)…', 'lwe');

    const noiseBound = DemoState.noiseBound;
    const lweKeys    = LWE.keyGen();
    DemoState.lweKeys = lweKeys;

    const { A, s, e, b } = lweKeys.debug;

    addLog(`LWE: Generated random matrix A (4×4 mod 97)`, 'lwe');
    addLog(`LWE: Secret s = ${LWE.fmtVec(s)}`, 'lwe');
    addLog(`LWE: Error e  = ${LWE.fmtVec(e)} (small, from χ)`, 'lwe');
    addLog(`LWE: b = A·s + e = ${LWE.fmtVec(b)} (public)`, 'lwe');

    // Render matrix
    if (window.LatticeCanvas) {
      LatticeCanvas.renderMatrix('lwe-matrix-A', A, { color: 'var(--cyan-light)', label: 'A' });
      LatticeCanvas.renderVector('lwe-vec-s', s, { color: 'var(--purple-light)', label: 's' });
      LatticeCanvas.renderVector('lwe-vec-e', e, { color: 'var(--red)', label: 'e' });
      LatticeCanvas.renderVector('lwe-vec-b', b, { color: 'var(--green)', label: 'b' });
    }

    setVal('lwe-matrix-display', formatMatrix4x4(A));
    setVal('lwe-secret-display', LWE.fmtVec(s));
    setVal('lwe-error-display',  LWE.fmtVec(e));
    setVal('lwe-b-display',      LWE.fmtVec(b));

    await delay(200);

    // Encapsulation
    const encap = LWE.encapsulate(lweKeys.publicKey, noiseBound);
    DemoState.lweEncap = encap;
    addLog(`LWE: Sender computes u = Aᵀ·r + e₁ = ${LWE.fmtVec(encap.ciphertext)}`, 'lwe');
    addLog(`LWE: Sender's raw secret K_Alice = b·r = ${encap.rawSecret}`, 'lwe');

    // Decapsulation
    const kBob = LWE.decapsulate(lweKeys.secretKey, encap.ciphertext);
    DemoState.lweDecap = kBob;
    addLog(`LWE: Receiver computes K_Bob = s·u = ${kBob}`, 'lwe');

    // Derive key bytes
    const lweKeyResult = await LWE.deriveKeyBytes(encap.rawSecret, kBob);
    DemoState.lweMatch    = lweKeyResult.match;
    DemoState.lweKeyBytes = lweKeyResult.keyBytes;
    DemoState.lweKeyHex   = LWE.toHex(lweKeyResult.keyBytes);

    if (lweKeyResult.match) {
      addLog(`✓ LWE correctness: |K_Alice - K_Bob| = ${lweKeyResult.difference} < q/4 = ${lweKeyResult.bound} ✓`, 'success');
      addLog(`✓ LWE shared key  = ${shortHex(DemoState.lweKeyHex)}`, 'success');
      setVal('lwe-shared', shortHex(DemoState.lweKeyHex), 'green-val');
    } else {
      addLog(`✗ LWE FAILURE: |K_Alice - K_Bob| = ${lweKeyResult.difference} ≥ q/4 = ${lweKeyResult.bound}`, 'error');
      addLog(`  This is the "decryption failure" that motivates error reconciliation in real Kyber!`, 'error');
      setVal('lwe-shared', '⚠ Decryption failure! Noise too high.', 'error-val');
      el('lwe-failure-msg')?.classList.add('show');
    }

    setVal('alice-ciphertext', LWE.fmtVec(encap.ciphertext));
    setVal('bob-lwe-decap', `K_Bob = ${kBob}`);

    await delay(200);

    // ── Hybrid key derivation ──
    addLog('🔀 Deriving hybrid key via SHA-256(ECDH || LWE)…', 'info');
    const hybrid = await HybridKDF.deriveHybridKey(DemoState.ecdhSharedBytes, DemoState.lweKeyBytes);
    DemoState.hybridResult = hybrid;
    DemoState.aesKey       = hybrid.aesKey;

    addLog(`✓ Hybrid key = SHA-256(ECDH_secret || LWE_secret || "HybridPQC-v1")`, 'success');
    addLog(`✓ Hybrid key = ${shortHex(hybrid.hybridKeyHex)}`, 'success');

    setVal('hybrid-key-display', formatHybridKey(hybrid.hybridKeyHex));

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '↻ Re-run Exchange';
      btn.classList.add('btn-success');
    }

    el('btn-next-step2')?.removeAttribute('disabled');
    Toast.show('Key exchange complete!', 'success');

  } catch (err) {
    console.error(err);
    addLog(`✗ Error: ${err.message}`, 'error');
    Toast.show('Key exchange failed. See log.', 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = 'Run Key Exchange'; }
  }
}

function formatMatrix4x4(A) {
  return `<table style="font-family:var(--font-mono);font-size:0.8rem;border-collapse:separate;border-spacing:8px 4px">` +
    A.map(row => `<tr>${row.map(v => `<td style="color:var(--cyan-light);text-align:right;min-width:26px">${v}</td>`).join('')}</tr>`).join('') +
    `</table>`;
}

function formatHybridKey(fullHex) {
  const half1 = fullHex.slice(0, 32);
  const half2 = fullHex.slice(32);
  return `<span class="k-cyan">${half1}</span><span class="k-purple">${half2}</span>`;
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Step 3: Encrypt ───
async function runEncryption() {
  if (!DemoState.aesKey) { Toast.show('Please complete the key exchange first.', 'error'); return; }

  const btn = el('btn-encrypt');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Encrypting…'; }

  addLog('🔒 Starting AES-256-GCM encryption…', 'info');

  try {
    const aad    = new TextEncoder().encode('HybridPQC-Demo-v1');
    const result = await AESCrypto.encrypt(DemoState.aesKey, DemoState.inputBytes, aad);

    // Store both JSON (for file download) and session object (for in-memory decrypt)
    DemoState.encryptedJSON    = result.jsonString;
    DemoState.encryptedSession = { ivBytes: result.ivBytes, cipherBytes: result.cipherBytes };

    addLog(`✓ IV (nonce) = ${result.ivHex}`, 'key');
    addLog(`✓ Ciphertext = ${result.ciphertextFull.slice(0, 32)}… (${result.byteLength} bytes total)`, 'success');
    addLog(`✓ AES-256-GCM authentication tag appended`, 'success');
    addLog(`  Original: ${result.originalLength} bytes → Encrypted: ${result.byteLength} bytes`, 'info');
    addLog(`  Saved as JSON+Base64 (.hpqc) — works in all browsers`, 'info');

    setVal('enc-iv-display',     result.ivHex);
    setVal('enc-cipher-display', result.ciphertextFull);
    setVal('enc-size-display',   `${result.originalLength} B → ${result.byteLength} B (+ JSON wrapper)`);
    el('cipher-preview-text').textContent = result.ciphertextFull;

    if (btn) { btn.disabled = false; btn.innerHTML = '✓ Encrypted'; }
    el('btn-next-step3')?.removeAttribute('disabled');
    Toast.show('File encrypted successfully!', 'success');

  } catch (err) {
    addLog(`✗ Encryption error: ${err.message}`, 'error');
    Toast.show('Encryption failed.', 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '🔒 Encrypt'; }
  }
}

// ─── Step 4: Download ───
function setupDownload() {
  el('btn-download')?.addEventListener('click', () => {
    if (!DemoState.encryptedJSON) { Toast.show('No encrypted file yet.', 'error'); return; }
    const base = DemoState.originalFilename.replace(/\.[^.]+$/, '');
    const fname = `${base}_encrypted.hpqc`;
    AESCrypto.downloadJSON(DemoState.encryptedJSON, fname);
    addLog(`⬇ Downloaded: ${fname} (JSON+Base64 format)`, 'success');
    Toast.show('Encrypted file downloaded! Upload it in Step 5 to decrypt.', 'success', 5000);
    el('btn-next-step4')?.removeAttribute('disabled');
  });

  el('btn-next-step4')?.addEventListener('click', () => gotoStep(5));
}

// ─── Step 5: Decrypt ───
function initStep5() {
  const dropZone  = el('decrypt-drop-zone');
  const fileInput = el('decrypt-file-input');
  let decryptInput = null; // will be Uint8Array (file) or session object

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) handleDecryptFile(file);
    });
    fileInput.addEventListener('change', e => {
      if (e.target.files[0]) handleDecryptFile(e.target.files[0]);
    });
  }

  async function handleDecryptFile(file) {
    // Read as bytes (works for .hpqc / .json alike)
    const bytes = await AESCrypto.readFile(file);
    decryptInput = bytes;
    el('decrypt-file-name').textContent = `${file.name} (${AESCrypto.formatSize(file.size)})`;
    el('decrypt-file-info').style.display = 'flex';
    addLog(`📁 Loaded: ${file.name} (${AESCrypto.formatSize(bytes.length)})`, 'info');
    Toast.show('File loaded. Click Decrypt.', 'info');
  }

  // Use current session (bypass file round-trip entirely)
  el('btn-use-current')?.addEventListener('click', () => {
    if (!DemoState.encryptedSession) { Toast.show('Encrypt a file first in Step 3.', 'error'); return; }
    decryptInput = DemoState.encryptedSession; // pass session object directly
    el('decrypt-file-name').textContent = 'current session (in-memory)';
    el('decrypt-file-info').style.display = 'flex';
    addLog('Using encrypted data from current session (no file needed).', 'info');
    Toast.show('Session data loaded. Click Decrypt.', 'success');
  });

  el('btn-decrypt')?.addEventListener('click', async () => {
    if (!decryptInput) { Toast.show('Load an encrypted file or use the current session first.', 'error'); return; }
    if (!DemoState.aesKey) { Toast.show('No key available. Complete the key exchange first.', 'error'); return; }

    const btn = el('btn-decrypt');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Decrypting…';

    addLog('🔓 Starting decryption with hybrid key…', 'info');

    try {
      const aad    = new TextEncoder().encode('HybridPQC-Demo-v1');
      const result = await AESCrypto.decrypt(DemoState.aesKey, decryptInput, aad);

      if (result.ok) {
        el('decrypt-result-content').textContent = result.plaintextText;
        el('decrypt-result-content').className   = 'decrypt-result-content success';
        el('decrypt-success-badge').style.display = 'flex';
        el('decrypt-fail-badge').style.display    = 'none';
        addLog(`✓ Decryption successful! Recovered ${result.plaintext.length} bytes`, 'success');
        addLog(`  GCM authentication tag verified — data not tampered with`, 'success');
        Toast.show('Decrypted successfully! ✓', 'success');
      } else {
        el('decrypt-result-content').textContent = result.error;
        el('decrypt-result-content').className   = 'decrypt-result-content error';
        el('decrypt-success-badge').style.display = 'none';
        el('decrypt-fail-badge').style.display    = 'flex';
        addLog(`✗ ${result.error}`, 'error');
        Toast.show('Decryption failed. See result.', 'error');
      }
    } catch (err) {
      addLog(`✗ ${err.message}`, 'error');
    }

    btn.disabled = false; btn.innerHTML = '🔓 Decrypt';
  });
}

// ─── Noise slider ───
function initNoiseControl() {
  const slider  = el('noise-slider');
  const display = el('noise-value-display');
  if (!slider) return;

  slider.addEventListener('input', () => {
    const val = parseInt(slider.value);
    DemoState.noiseBound = val;
    if (display) display.textContent = val;
    el('noise-warning')?.classList.toggle('show', val > 3);
    const pct = ((val - 1) / 9) * 100;
    slider.style.background = `linear-gradient(to right, var(--cyan) 0%, var(--red) ${pct}%, var(--bg-elevated) ${pct}%)`;
  });
}

// ─── Quick Demo (one-click) ───
async function runQuickDemo() {
  const btn = el('btn-quick-demo');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Running full demo…'; }

  try {
    DemoState.inputMode  = 'text';
    DemoState.inputText  = 'Hello, Post-Quantum World! This message is protected by hybrid ECDH+LWE encryption.';
    DemoState.inputBytes = new TextEncoder().encode(DemoState.inputText);

    gotoStep(2);
    await runKeyExchange();
    if (!DemoState.hybridResult) throw new Error('Key exchange failed');
    await delay(300);
    gotoStep(3);
    await runEncryption();
    if (!DemoState.encryptedJSON) throw new Error('Encryption failed');
    await delay(300);
    gotoStep(4);

    Toast.show('Full demo complete! Download the .hpqc file or go to Step 5 to decrypt in-session.', 'success', 6000);
    if (btn) { btn.disabled = false; btn.innerHTML = '⚡ One-Click Demo'; }
  } catch (err) {
    Toast.show(`Demo error: ${err.message}`, 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '⚡ One-Click Demo'; }
  }
}

// ─── Initialization ───
window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.demo-step-item').forEach(item => {
    item.addEventListener('click', () => {
      const step = parseInt(item.dataset.step);
      if (step <= DemoState.step) gotoStep(step);
    });
  });

  initStep1();
  initNoiseControl();
  setupDownload();
  initStep5();

  el('btn-run-exchange')?.addEventListener('click', runKeyExchange);
  el('btn-next-step2')?.addEventListener('click',  () => gotoStep(3));
  el('btn-encrypt')?.addEventListener('click',     runEncryption);
  el('btn-next-step3')?.addEventListener('click',  () => gotoStep(4));
  el('btn-quick-demo')?.addEventListener('click',  runQuickDemo);

  el('btn-back-step2')?.addEventListener('click', () => gotoStep(1));
  el('btn-back-step3')?.addEventListener('click', () => gotoStep(2));
  el('btn-back-step4')?.addEventListener('click', () => gotoStep(3));
  el('btn-back-step5')?.addEventListener('click', () => gotoStep(4));

  // Sync hybrid key to step 3 display when navigating there
  el('btn-next-step2')?.addEventListener('click', () => {
    const hkEl = el('hybrid-key-display');
    const encEl = el('enc-hybrid-key-val');
    if (hkEl && encEl) encEl.innerHTML = hkEl.innerHTML;
  });

  const lweVals = el('lwe-vals');
  el('btn-run-exchange')?.addEventListener('click', () => {
    if (lweVals) setTimeout(() => { lweVals.style.display = 'block'; }, 1500);
  });

  gotoStep(1);
  addLog('HybridPQC Demo ready. File format: JSON+Base64 (.hpqc) — works in all browsers.', 'info');
  addLog('LWE parameters: n=4, q=97, χ = centered binomial B(2,0.5)-1', 'info');
  addLog('ECDH: P-256 (secp256r1) via Web Crypto API — real cryptography!', 'info');
  addLog('AES-256-GCM: Web Crypto API — authenticated encryption.', 'info');
  addLog('Ready. Select your input and click Continue.', 'success');
});
