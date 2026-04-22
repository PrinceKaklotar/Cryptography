/**
 * lattice-canvas.js – Canvas-based visualizations
 * Lattice grid, LWE diagram, SVP arrow, ECDH curve
 */
'use strict';

// ─── 1. Lattice Point Canvas ───
function drawLatticeCanvas(canvasId, opts = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const W = canvas.width  = canvas.offsetWidth  || 500;
  const H = canvas.height = canvas.offsetHeight || 350;

  const {
    spacing = 50,
    origin = { x: W / 2, y: H / 2 },
    glowPoint = null, // { x, y } grid coords of highlighted point
    svpArrow = true,
    showErrors = false,  // highlight LWE error points
    errorPoints = [],    // array of {gx, gy} grid coords
    basis1 = { x: spacing, y: 0 },
    basis2 = { x: spacing * 0.3, y: -spacing }
  } = opts;

  // Background
  ctx.fillStyle = '#061020';
  ctx.fillRect(0, 0, W, H);

  // Grid coordinates to canvas coords
  function toCanvas(gx, gy) {
    return {
      x: origin.x + gx * basis1.x + gy * basis2.x,
      y: origin.y + gx * basis1.y + gy * basis2.y
    };
  }

  const range = 6;

  // Draw lattice lines
  ctx.strokeStyle = 'rgba(6,182,212,0.08)';
  ctx.lineWidth = 0.5;

  for (let i = -range; i <= range; i++) {
    // Lines in basis1 direction
    const p1s = toCanvas(-range, i);
    const p1e = toCanvas(range, i);
    ctx.beginPath();
    ctx.moveTo(p1s.x, p1s.y);
    ctx.lineTo(p1e.x, p1e.y);
    ctx.stroke();

    // Lines in basis2 direction
    const p2s = toCanvas(i, -range);
    const p2e = toCanvas(i, range);
    ctx.beginPath();
    ctx.moveTo(p2s.x, p2s.y);
    ctx.lineTo(p2e.x, p2e.y);
    ctx.stroke();
  }

  // Draw basis vectors
  const b1end = toCanvas(1, 0);
  const b2end = toCanvas(0, 1);

  // Basis vector 1 (cyan)
  drawArrow(ctx, origin.x, origin.y, b1end.x, b1end.y, 'rgba(6,182,212,0.7)', 2);
  ctx.fillStyle = 'rgba(6,182,212,0.9)';
  ctx.font = '12px JetBrains Mono, monospace';
  ctx.fillText('b₁', b1end.x + 5, b1end.y - 5);

  // Basis vector 2 (purple)
  drawArrow(ctx, origin.x, origin.y, b2end.x, b2end.y, 'rgba(139,92,246,0.7)', 2);
  ctx.fillStyle = 'rgba(139,92,246,0.9)';
  ctx.fillText('b₂', b2end.x + 5, b2end.y - 5);

  // Draw lattice points
  for (let gx = -range; gx <= range; gx++) {
    for (let gy = -range; gy <= range; gy++) {
      const { x, y } = toCanvas(gx, gy);
      if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;

      const isOrigin = gx === 0 && gy === 0;
      const isGlow   = glowPoint && gx === glowPoint.x && gy === glowPoint.y;
      const isError  = showErrors && errorPoints.some(p => p.gx === gx && p.gy === gy);

      let color = 'rgba(6,182,212,0.4)';
      let radius = 3;
      let glow = false;

      if (isOrigin) { color = 'rgba(6,182,212,0.9)'; radius = 5; glow = true; }
      if (isGlow)   { color = '#f59e0b'; radius = 6; glow = true; }
      if (isError)  { color = 'rgba(239,68,68,0.8)'; radius = 5; glow = true; }

      if (glow) {
        const grad = ctx.createRadialGradient(x, y, 0, x, y, radius * 3);
        grad.addColorStop(0, color.replace('0.4', '0.3').replace('0.9', '0.3'));
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, radius * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // SVP: draw arrow to shortest non-zero vector
  if (svpArrow) {
    const svpEnd = toCanvas(1, 0); // Shortest vector = basis1
    drawArrow(ctx, origin.x, origin.y, svpEnd.x, svpEnd.y, '#f59e0b', 2.5);

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillText('SVP', svpEnd.x + 8, svpEnd.y + 4);
  }

  // Origin label
  ctx.fillStyle = 'rgba(6,182,212,0.9)';
  ctx.font = '11px JetBrains Mono, monospace';
  ctx.fillText('O', origin.x + 6, origin.y - 6);
}

function drawArrow(ctx, x1, y1, x2, y2, color, width = 1.5) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = 10;

  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

// ─── 2. LWE Visualization (b = As + e) ───
function drawLWECanvas(canvasId, lweSample) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !lweSample) return;
  const ctx = canvas.getContext('2d');

  const W = canvas.width  = canvas.offsetWidth  || 600;
  const H = canvas.height = 200;

  ctx.fillStyle = '#061020';
  ctx.fillRect(0, 0, W, H);

  const { A, s, e, b } = lweSample;
  const n = s.length;

  // Show b[0] = A[0]·s + e[0] on a number line
  const lineY  = H / 2;
  const q    = LWE.DEFAULT_Q;
  const scale  = (W - 80) / q;
  const oX     = 40;

  // Number line
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(oX, lineY); ctx.lineTo(W - oX, lineY); ctx.stroke();

  // Tick marks
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  for (let i = 0; i <= q; i += 10) {
    const x = oX + i * scale;
    ctx.fillRect(x, lineY - 3, 1, 6);
    if (i % 20 === 0) {
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillText(i, x - 6, lineY + 14);
    }
  }

  // As (without error)
  const As0 = LWE.mod(A[0].reduce((sum, a, j) => sum + a * s[j], 0), q);
  const bVal = b[0];
  const eVal = e[0];

  // As marker (cyan)
  const asX = oX + As0 * scale;
  ctx.strokeStyle = 'rgba(6,182,212,0.6)';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(asX, lineY - 30); ctx.lineTo(asX, lineY + 8); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#06b6d4';
  ctx.font = 'bold 10px Inter, sans-serif';
  ctx.fillText('A·s', asX - 10, lineY - 35);

  // b marker (amber, shifted by e)
  const bX = oX + bVal * scale;
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath(); ctx.arc(bX, lineY, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillText(`b = A·s+e = ${bVal}`, bX - 30, lineY - 15);

  // Arrow showing error e
  drawArrow(ctx, asX, lineY, bX, lineY, 'rgba(239,68,68,0.8)', 2);
  const midX = (asX + bX) / 2;
  ctx.fillStyle = '#ef4444';
  ctx.font = '10px JetBrains Mono, monospace';
  ctx.fillText(`e=${eVal}`, midX - 10, lineY + 28);

  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '10px Inter, sans-serif';
  ctx.fillText(`0`, oX - 5, lineY - 8);
  ctx.fillText(`q=${q}`, W - oX - 20, lineY - 8);
}

// ─── 3. Demo LWE Matrix Renderer ───
function renderMatrix(containerId, matrix, opts = {}) {
  const el = document.getElementById(containerId);
  if (!el || !matrix) return;

  const { color = 'var(--cyan-light)', label = 'A' } = opts;
  const n = matrix.length;
  const cols = matrix[0].length;

  let html = `<div class="matrix-wrap">`;
  if (label) html += `<span class="matrix-label" style="color:${color}">${label} =</span>`;
  html += `<div class="demo-matrix">`;

  // Left bracket
  html += `<div class="demo-matrix-bracket left">`;
  for (let i = 0; i < n; i++) html += `<span></span>`;
  html += `</div>`;

  // Cells
  html += `<div class="demo-matrix-cells" style="grid-template-columns: repeat(${cols}, 1fr)">`;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < cols; j++) {
      html += `<div class="demo-matrix-cell" style="color:${color}">${matrix[i][j]}</div>`;
    }
  }
  html += `</div>`;

  // Right bracket
  html += `<div class="demo-matrix-bracket right">`;
  for (let i = 0; i < n; i++) html += `<span></span>`;
  html += `</div>`;

  html += `</div></div>`;
  el.innerHTML = html;
}

function renderVector(containerId, vec, opts = {}) {
  const el = document.getElementById(containerId);
  if (!el || !vec) return;
  const matrix = vec.map(v => [v]);
  renderMatrix(containerId, matrix, { ...opts, cols: 1 });
}

// ─── 4. ECDH Elliptic Curve Canvas ─── (decorative)
function drawEllipticCurve(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const W = canvas.width  = canvas.offsetWidth  || 500;
  const H = canvas.height = canvas.offsetHeight || 300;

  ctx.fillStyle = '#061020';
  ctx.fillRect(0, 0, W, H);

  // Draw y² = x³ - 3x + 4 (a nice-looking curve, not P-256)
  const scale = 40;
  const oX = W * 0.4;
  const oY = H * 0.5;

  // Axes
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, oY); ctx.lineTo(W, oY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(oX, 0); ctx.lineTo(oX, H); ctx.stroke();

  // Curve
  ctx.strokeStyle = 'rgba(6,182,212,0.7)';
  ctx.lineWidth = 2;

  for (let branch = -1; branch <= 1; branch += 2) {
    let started = false;
    ctx.beginPath();
    for (let px = 0; px < W; px++) {
      const x = (px - oX) / scale;
      const ySquared = x * x * x - 3 * x + 4;
      if (ySquared < 0) { started = false; continue; }
      const y = branch * Math.sqrt(ySquared);
      const py = oY - y * scale;
      if (py < 0 || py > H) { started = false; continue; }
      if (!started) { ctx.moveTo(px, py); started = true; }
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // Points P and Q on the curve
  function curvePoint(x) {
    const ySquared = x * x * x - 3 * x + 4;
    return ySquared >= 0 ? Math.sqrt(ySquared) : null;
  }

  const pX = -1;
  const pY = curvePoint(pX);
  if (pY !== null) {
    const px = oX + pX * scale;
    const py = oY - pY * scale;

    // Glow
    const g1 = ctx.createRadialGradient(px, py, 0, px, py, 15);
    g1.addColorStop(0, 'rgba(6,182,212,0.4)');
    g1.addColorStop(1, 'transparent');
    ctx.fillStyle = g1;
    ctx.fillRect(px - 15, py - 15, 30, 30);

    ctx.fillStyle = '#06b6d4';
    ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(6,182,212,0.9)';
    ctx.font = 'bold 12px Inter';
    ctx.fillText('G (generator)', px + 8, py - 8);
  }

  const qX = 2;
  const qY = curvePoint(qX);
  if (qY !== null) {
    const px = oX + qX * scale;
    const py = oY - qY * scale;

    const g2 = ctx.createRadialGradient(px, py, 0, px, py, 15);
    g2.addColorStop(0, 'rgba(139,92,246,0.4)');
    g2.addColorStop(1, 'transparent');
    ctx.fillStyle = g2;
    ctx.fillRect(px - 15, py - 15, 30, 30);

    ctx.fillStyle = '#8b5cf6';
    ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(139,92,246,0.9)';
    ctx.font = 'bold 12px Inter';
    ctx.fillText('kG = Public Key', px + 8, py - 8);
  }

  // Label
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.font = '11px JetBrains Mono';
  ctx.fillText('y² = x³ + ax + b (mod p)', 10, H - 12);
}

// ─── Export ───
window.LatticeCanvas = {
  drawLatticeCanvas,
  drawLWECanvas,
  renderMatrix,
  renderVector,
  drawEllipticCurve,
  drawArrow
};

// Auto-init canvases on page load
window.addEventListener('load', () => {
  const latticeEl = document.getElementById('lattice-canvas');
  if (latticeEl) {
    drawLatticeCanvas('lattice-canvas', {
      svpArrow: true,
      glowPoint: { x: 2, y: 1 }
    });
  }

  const ecdhEl = document.getElementById('ecdh-canvas');
  if (ecdhEl) drawEllipticCurve('ecdh-canvas');
});

// Redraw on resize
window.addEventListener('resize', () => {
  const latticeEl = document.getElementById('lattice-canvas');
  if (latticeEl) drawLatticeCanvas('lattice-canvas', { svpArrow: true });

  const ecdhEl = document.getElementById('ecdh-canvas');
  if (ecdhEl) drawEllipticCurve('ecdh-canvas');
});
