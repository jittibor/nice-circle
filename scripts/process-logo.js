/**
 * process-logo.js
 * Takes the user-supplied black-on-white logo PNG and:
 *   1. Removes the white background (flood-fill from corners)
 *   2. Converts the black logo pixels to pure white
 *   3. Saves a transparent PNG for use on dark backgrounds
 */

const { Jimp } = require('jimp');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../public/images/3216d355-50c0-41c0-9316-2a857ca63840.png');
const OUT_WHITE = path.join(__dirname, '../public/images/n1ce-logo-white.png');
const OUT_BLACK = path.join(__dirname, '../public/images/n1ce-logo-black.png');

async function main() {
  console.log('→ Reading logo:', path.basename(SRC));
  const img = await Jimp.read(SRC);
  const { width, height } = img.bitmap;
  console.log('  source:', width, '×', height);

  // Flood-fill from all four corners to mark background pixels
  const visited = new Uint8Array(width * height);
  const stack = [];
  const WHITE_THRESHOLD = 235;

  function isWhite(idx4) {
    const r = img.bitmap.data[idx4];
    const g = img.bitmap.data[idx4 + 1];
    const b = img.bitmap.data[idx4 + 2];
    return r > WHITE_THRESHOLD && g > WHITE_THRESHOLD && b > WHITE_THRESHOLD;
  }

  function seed(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const flat = y * width + x;
    if (visited[flat]) return;
    if (!isWhite(flat * 4)) return;
    visited[flat] = 1;
    stack.push(x, y);
  }

  for (let x = 0; x < width; x++) { seed(x, 0); seed(x, height - 1); }
  for (let y = 0; y < height; y++) { seed(0, y); seed(width - 1, y); }

  let si = 0;
  while (si < stack.length) {
    const x = stack[si++], y = stack[si++];
    seed(x + 1, y); seed(x - 1, y); seed(x, y + 1); seed(x, y - 1);
  }

  // Also find bbox so we can crop tight
  let minX = width, minY = height, maxX = 0, maxY = 0;

  // Build WHITE-on-transparent version (for dark email headers).
  // Very tight thresholds — only genuinely dark pixels are the logo;
  // narrow anti-alias band so there's no soft halo bleeding out.
  const DARK  = 30;    // lum <=30 → fully opaque
  const LIGHT = 80;    // lum >=80 → fully transparent

  img.scan(0, 0, width, height, function(x, y, idx4) {
    const flat = y * width + x;
    if (visited[flat]) {
      this.bitmap.data[idx4 + 3] = 0;
      return;
    }
    const r = this.bitmap.data[idx4];
    const g = this.bitmap.data[idx4 + 1];
    const b = this.bitmap.data[idx4 + 2];
    const lum = (r + g + b) / 3;

    let alpha;
    if (lum <= DARK)        alpha = 255;
    else if (lum >= LIGHT)  alpha = 0;
    else                    alpha = Math.round(255 * (1 - (lum - DARK) / (LIGHT - DARK)));

    this.bitmap.data[idx4]     = 255;
    this.bitmap.data[idx4 + 1] = 255;
    this.bitmap.data[idx4 + 2] = 255;
    this.bitmap.data[idx4 + 3] = alpha;

    if (alpha > 80) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  });

  // Crop to foreground bbox with small padding
  const PAD = 12;
  const cx = Math.max(0, minX - PAD);
  const cy = Math.max(0, minY - PAD);
  const cw = Math.min(width  - cx, (maxX - minX + 1) + PAD * 2);
  const ch = Math.min(height - cy, (maxY - minY + 1) + PAD * 2);
  console.log(`  bbox: ${minX},${minY} → ${maxX},${maxY}`);
  console.log(`  crop: ${cx},${cy} ${cw}×${ch}`);

  const whiteImg = img.clone();
  whiteImg.crop({ x: cx, y: cy, w: cw, h: ch });
  await whiteImg.write(OUT_WHITE);
  console.log('  ✓ saved (white):', OUT_WHITE);

  // Build BLACK-on-transparent version from the same bbox
  // (just reuse alpha channel, set RGB=black)
  const blackImg = img.clone();
  blackImg.scan(0, 0, width, height, function(x, y, idx4) {
    // RGB = 0 (black), keep alpha from previous pass
    this.bitmap.data[idx4]     = 0;
    this.bitmap.data[idx4 + 1] = 0;
    this.bitmap.data[idx4 + 2] = 0;
    // alpha is already set from the first pass
  });
  blackImg.crop({ x: cx, y: cy, w: cw, h: ch });
  await blackImg.write(OUT_BLACK);
  console.log('  ✓ saved (black):', OUT_BLACK);
}

main().catch(console.error);
