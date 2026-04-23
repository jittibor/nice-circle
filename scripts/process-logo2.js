/**
 * process-logo2.js
 * Takes the new user-supplied pre-keyed WHITE logo PNG, finds the
 * bbox of non-transparent pixels, and saves a tight crop.
 */

const { Jimp } = require('jimp');
const path = require('path');

const SRC = path.join(__dirname, '../public/images/9a406516-cf4d-4424-bcb3-010b175e4026.png');
const OUT = path.join(__dirname, '../public/images/n1ce-logo-white.png');

async function main() {
  console.log('→ Reading:', path.basename(SRC));
  const img = await Jimp.read(SRC);
  const { width, height } = img.bitmap;
  console.log('  source:', width, '×', height);

  // Find bbox of opaque pixels
  let minX = width, minY = height, maxX = 0, maxY = 0;
  const ALPHA_THRESHOLD = 30;

  img.scan(0, 0, width, height, function(x, y, idx4) {
    const a = this.bitmap.data[idx4 + 3];
    if (a > ALPHA_THRESHOLD) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  });

  console.log(`  bbox: ${minX},${minY} → ${maxX},${maxY}`);

  const PAD = 20;
  const cx = Math.max(0, minX - PAD);
  const cy = Math.max(0, minY - PAD);
  const cw = Math.min(width  - cx, (maxX - minX + 1) + PAD * 2);
  const ch = Math.min(height - cy, (maxY - minY + 1) + PAD * 2);
  console.log(`  crop: ${cx},${cy} ${cw}×${ch}`);

  img.crop({ x: cx, y: cy, w: cw, h: ch });
  await img.write(OUT);
  console.log('  ✓ saved:', OUT);
  console.log('  final:', img.bitmap.width, '×', img.bitmap.height);
}

main().catch(console.error);
