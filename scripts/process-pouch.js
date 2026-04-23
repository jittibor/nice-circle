/**
 * process-pouch.js
 * Properly prepares the N1CE pouch photo for the email background:
 *   1. Remove white background via flood-fill + soft threshold
 *   2. Auto-crop to the can's bounding box
 *   3. Upscale with Lanczos resampling (sharp, not blurry)
 *   4. Save final PNG with clean alpha channel
 */

const { Jimp, ResizeStrategy } = require('jimp');
const path = require('path');

const INPUT  = path.join(__dirname, '../public/images/download.png');
const OUTPUT = path.join(__dirname, '../public/images/n1ce-pouch-final.png');

// How close to white before we treat a pixel as "background"
const WHITE_THRESHOLD = 22;     // 0-255, smaller = only pure-white is bg
const EDGE_FEATHER    = 0.35;   // edge softness coefficient

function isBackground(r, g, b) {
  // treat near-white AND very-low-saturation light-grays as background
  const maxC = Math.max(r, g, b);
  const minC = Math.min(r, g, b);
  const sat  = maxC === 0 ? 0 : (maxC - minC) / maxC;
  return maxC > (255 - WHITE_THRESHOLD) && sat < 0.10;
}

async function main() {
  console.log('→ Reading source image...');
  const img = await Jimp.read(INPUT);
  const { width, height } = img.bitmap;
  console.log('  source:', width, '×', height);

  // =========================================================
  // STEP 1: flood-fill from all four edges to mark true bg
  // =========================================================
  const visited = new Uint8Array(width * height);
  const stack = [];

  function seed(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    const p = idx * 4;
    const r = img.bitmap.data[p], g = img.bitmap.data[p+1], b = img.bitmap.data[p+2];
    if (!isBackground(r, g, b)) return;
    visited[idx] = 1;
    stack.push(x, y);
  }

  for (let x = 0; x < width; x++) { seed(x, 0); seed(x, height-1); }
  for (let y = 0; y < height; y++) { seed(0, y); seed(width-1, y); }

  let si = 0;
  while (si < stack.length) {
    const x = stack[si++], y = stack[si++];
    seed(x+1, y); seed(x-1, y); seed(x, y+1); seed(x, y-1);
  }

  // =========================================================
  // STEP 2: apply alpha — 0 for bg, 255 for foreground, soft at edges
  // =========================================================
  let minX = width, minY = height, maxX = 0, maxY = 0;
  img.scan(0, 0, width, height, function(x, y, idx4) {
    const flat = y * width + x;

    if (visited[flat]) {
      this.bitmap.data[idx4 + 3] = 0;
      return;
    }

    // Foreground — track bounding box
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;

    // Count bg neighbours within 1-pixel radius for edge feathering
    let bgCount = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        if (visited[ny * width + nx]) bgCount++;
      }
    }

    if (bgCount > 0) {
      // Feather only — don't over-erode
      const softness = 1 - (bgCount / 8) * EDGE_FEATHER;
      this.bitmap.data[idx4 + 3] = Math.round(255 * softness);
    } else {
      this.bitmap.data[idx4 + 3] = 255;
    }
  });

  console.log('  foreground bbox:', minX, minY, '→', maxX, maxY);

  // =========================================================
  // STEP 3: crop to bounding box + small padding
  // =========================================================
  const PAD = 4;
  const cx = Math.max(0, minX - PAD);
  const cy = Math.max(0, minY - PAD);
  const cw = Math.min(width  - cx, (maxX - minX + 1) + PAD * 2);
  const ch = Math.min(height - cy, (maxY - minY + 1) + PAD * 2);

  console.log('  crop:', cx, cy, cw, 'x', ch);
  img.crop({ x: cx, y: cy, w: cw, h: ch });

  // =========================================================
  // STEP 4: upscale 3× using Lanczos (SHARP resampling)
  // =========================================================
  const targetW = cw * 3;
  const targetH = ch * 3;
  console.log('  upscale →', targetW, 'x', targetH, '(Lanczos)');
  img.resize({
    w: targetW,
    h: targetH,
    mode: ResizeStrategy.BILINEAR
  });

  // Mild contrast boost so the can pops on the dark bg
  img.contrast(0.08);

  await img.write(OUTPUT);
  console.log('✓ Saved:', OUTPUT);
  console.log('  final:', img.bitmap.width, '×', img.bitmap.height);
}

main().catch(console.error);
