/**
 * process-pouch2.js
 * The new PNG already has alpha channel set correctly.
 * Just auto-crop to content bbox, then we're done.
 */

const { Jimp } = require('jimp');
const path = require('path');

const INPUT  = path.join(__dirname, '../public/images/e691cb42-d1b8-4ad6-adfc-e682d6937f57.png');
const OUTPUT = path.join(__dirname, '../public/images/nice-pouch-hires.png');

async function main() {
  console.log('→ Reading source image...');
  const img = await Jimp.read(INPUT);
  const { width, height } = img.bitmap;
  console.log('  source:', width, '×', height);

  // Find bounding box of non-transparent pixels (alpha > threshold)
  let minX = width, minY = height, maxX = 0, maxY = 0;
  const ALPHA_THRESHOLD = 10;

  img.scan(0, 0, width, height, function(x, y, idx4) {
    const a = this.bitmap.data[idx4 + 3];
    if (a > ALPHA_THRESHOLD) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  });

  console.log('  foreground bbox:', minX, minY, '→', maxX, maxY);

  // Crop to bbox with small padding
  const PAD = 8;
  const cx = Math.max(0, minX - PAD);
  const cy = Math.max(0, minY - PAD);
  const cw = Math.min(width  - cx, (maxX - minX + 1) + PAD * 2);
  const ch = Math.min(height - cy, (maxY - minY + 1) + PAD * 2);

  console.log('  cropping to:', cx, cy, cw, 'x', ch);
  img.crop({ x: cx, y: cy, w: cw, h: ch });

  await img.write(OUTPUT);
  console.log('✓ Saved:', OUTPUT);
  console.log('  final:', img.bitmap.width, '×', img.bitmap.height);
}

main().catch(console.error);
