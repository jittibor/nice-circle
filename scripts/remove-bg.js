/**
 * remove-bg.js
 * Removes the white background from the N1CE pouch product photo.
 * Uses flood-fill from corners + threshold to handle soft edges/shadows.
 */

const { Jimp } = require('jimp');
const path = require('path');

const INPUT  = path.join(__dirname, '../public/images/download.png');
const OUTPUT = path.join(__dirname, '../public/images/n1ce-pouch-nobg.png');

// Tolerance: how close to white a pixel must be to be erased (0-255)
const THRESHOLD = 30;

function isNearWhite(r, g, b) {
  return r > (255 - THRESHOLD) && g > (255 - THRESHOLD) && b > (255 - THRESHOLD);
}

async function removeBg() {
  console.log('Reading image...');
  const img = await Jimp.read(INPUT);
  const { width, height } = img.bitmap;

  // Step 1: flood-fill from all 4 corners to mark background pixels
  const visited = new Uint8Array(width * height);
  const queue = [];

  function enqueue(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    const pidx = idx * 4;
    const r = img.bitmap.data[pidx];
    const g = img.bitmap.data[pidx + 1];
    const b = img.bitmap.data[pidx + 2];
    if (!isNearWhite(r, g, b)) return;
    visited[idx] = 1;
    queue.push(x, y);
  }

  // Seed from all edges
  for (let x = 0; x < width; x++) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  // BFS flood fill
  let i = 0;
  while (i < queue.length) {
    const x = queue[i++];
    const y = queue[i++];
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }

  // Step 2: apply transparency to all visited (background) pixels
  // Also feather edges: pixels neighbouring the can get partial alpha
  img.scan(0, 0, width, height, function(x, y, idx4) {
    const flat = y * width + x;
    if (visited[flat]) {
      // Pure background — fully transparent
      this.bitmap.data[idx4 + 3] = 0;
    } else {
      // Check if any neighbour is background — if so, feather this pixel
      const neighbours = [
        (y - 1) * width + x,
        (y + 1) * width + x,
        y * width + (x - 1),
        y * width + (x + 1),
      ];
      const bgNeighbours = neighbours.filter(n => n >= 0 && n < width * height && visited[n]).length;
      if (bgNeighbours > 0) {
        // Soft edge — reduce alpha proportionally
        const current = this.bitmap.data[idx4 + 3];
        this.bitmap.data[idx4 + 3] = Math.round(current * (1 - bgNeighbours * 0.25));
      }
    }
  });

  await img.write(OUTPUT);
  console.log(`✓ Saved: ${OUTPUT}`);
}

removeBg().catch(console.error);
