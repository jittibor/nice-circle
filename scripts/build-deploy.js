/**
 * build-deploy.js
 *
 * Assembles a CLIENT-READY deployment package for Netlify drag-and-drop.
 *
 *   1. Creates a clean `dist/` directory at the project root
 *   2. Copies ONLY the files the client presentation needs:
 *        - presentation.html (also → index.html for root URL)
 *        - all referenced images + video + email mocks + variant HTMLs
 *        - a stripped-down netlify.toml (just the presentation redirects)
 *   3. Deliberately EXCLUDES operator.html, variants-gallery.html, join.html,
 *      and anything with internal pricing or admin UI
 *   4. Zips it all into `n1ce-circle-presentation.zip`
 *
 * Usage: node scripts/build-deploy.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const ZIP_NAME = 'n1ce-circle-presentation.zip';

// ─────────────────────────────────────────────────────────────
// Clean + create dist/
// ─────────────────────────────────────────────────────────────
function rmrf(target) {
  if (!fs.existsSync(target)) return;
  if (fs.statSync(target).isDirectory()) {
    for (const entry of fs.readdirSync(target)) rmrf(path.join(target, entry));
    fs.rmdirSync(target);
  } else {
    fs.unlinkSync(target);
  }
}

function cp(src, dst) {
  if (!fs.existsSync(src)) {
    console.warn('  ! missing (skipped):', src);
    return;
  }
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      cp(path.join(src, entry), path.join(dst, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

console.log('→ cleaning dist/');
rmrf(DIST);
fs.mkdirSync(DIST, { recursive: true });

// ─────────────────────────────────────────────────────────────
// Copy the client presentation + make it the root index.html
// ─────────────────────────────────────────────────────────────
console.log('→ copying presentation');
cp(path.join(ROOT, 'public', 'presentation.html'), path.join(DIST, 'presentation.html'));
cp(path.join(ROOT, 'public', 'presentation.html'), path.join(DIST, 'index.html'));

// ─────────────────────────────────────────────────────────────
// Copy all email mocks (Gmail wrappers)
// ─────────────────────────────────────────────────────────────
console.log('→ copying email mocks');
cp(path.join(ROOT, 'emails', 'mocks'), path.join(DIST, 'emails', 'mocks'));

// Copy variant emails (the mocks iframe these)
console.log('→ copying variant emails');
cp(path.join(ROOT, 'emails', 'variants'), path.join(DIST, 'emails', 'variants'));

// Copy the main Berry welcome (the Berry mock iframes this one, not variants/)
cp(path.join(ROOT, 'emails', 'welcome-email.html'), path.join(DIST, 'emails', 'welcome-email.html'));

// ─────────────────────────────────────────────────────────────
// Copy assets: images (banners, pouches, logo) + video
// ─────────────────────────────────────────────────────────────
console.log('→ copying images + video');
cp(path.join(ROOT, 'public', 'images', 'banners'), path.join(DIST, 'images', 'banners'));
cp(path.join(ROOT, 'public', 'images', 'pouches'), path.join(DIST, 'images', 'pouches'));
cp(path.join(ROOT, 'public', 'images', 'n1ce-logo-white.png'), path.join(DIST, 'images', 'n1ce-logo-white.png'));
cp(path.join(ROOT, 'public', 'images', 'n1ce-logo.svg'), path.join(DIST, 'images', 'n1ce-logo.svg'));
cp(path.join(ROOT, 'public', 'images', 'welcome-header-bg.svg'), path.join(DIST, 'images', 'welcome-header-bg.svg'));
cp(path.join(ROOT, 'public', 'videos', 'message-for-you.mp4'), path.join(DIST, 'videos', 'message-for-you.mp4'));

// ─────────────────────────────────────────────────────────────
// Stripped-down netlify.toml — only what the presentation needs
// ─────────────────────────────────────────────────────────────
console.log('→ writing minimal netlify.toml');
const netlifyToml = `# N1CE Circle · Client Presentation · Netlify config

[build]
  publish = "."

# Pretty URLs
[[redirects]]
  from = "/presentation"
  to = "/presentation.html"
  status = 200

[[redirects]]
  from = "/pitch"
  to = "/presentation.html"
  status = 200

# Cache static assets aggressively — they're content-addressable-safe
[[headers]]
  for = "/videos/*"
  [headers.values]
    Cache-Control = "public, max-age=604800, immutable"

[[headers]]
  for = "/images/*"
  [headers.values]
    Cache-Control = "public, max-age=604800"

[[headers]]
  for = "/emails/*"
  [headers.values]
    Cache-Control = "public, max-age=3600"
`;
fs.writeFileSync(path.join(DIST, 'netlify.toml'), netlifyToml);

// A helpful README for the recipient if anyone opens the zip
fs.writeFileSync(path.join(DIST, 'README.txt'),
`N1CE Circle · Client Presentation
==================================

How to deploy this to Netlify:

  Option 1 (drag-and-drop — 30 seconds)
    1. Zip this whole folder (or use the provided .zip)
    2. Go to https://app.netlify.com/drop
    3. Drop the zip onto the page
    4. Netlify gives you a live URL (e.g. https://xyz.netlify.app)
    5. That's the URL to send the client

  Option 2 (Netlify CLI)
    netlify deploy --prod --dir=.

The root URL (/) loads the presentation automatically.
Pretty alias: /presentation or /pitch.
`);

// ─────────────────────────────────────────────────────────────
// Report + zip
// ─────────────────────────────────────────────────────────────
function treeSize(dir) {
  let total = 0, files = 0;
  const walk = (d) => {
    for (const entry of fs.readdirSync(d)) {
      const full = path.join(d, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full);
      else { total += stat.size; files++; }
    }
  };
  walk(dir);
  return { bytes: total, files };
}

const info = treeSize(DIST);
console.log(`\n✓ dist/ assembled — ${info.files} files, ${(info.bytes / (1024 * 1024)).toFixed(1)} MB\n`);

// Zip it
console.log('→ creating zip...');
const zipPath = path.join(ROOT, ZIP_NAME);
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

try {
  // Prefer PowerShell's Compress-Archive on Windows (built-in, no deps)
  if (process.platform === 'win32') {
    execSync(
      `powershell -NoProfile -Command "Compress-Archive -Path '${DIST}\\*' -DestinationPath '${zipPath}' -Force"`,
      { stdio: 'inherit' }
    );
  } else {
    execSync(`cd "${DIST}" && zip -r "${zipPath}" .`, { stdio: 'inherit' });
  }

  const zipSize = fs.statSync(zipPath).size;
  console.log(`\n✓ ${ZIP_NAME} ready — ${(zipSize / (1024 * 1024)).toFixed(1)} MB`);
  console.log(`  Full path: ${zipPath}`);
  console.log(`\n→ Next step: drag it into https://app.netlify.com/drop`);
} catch (e) {
  console.error('\n✗ Could not auto-zip:', e.message);
  console.log(`\n  Manually zip the folder: ${DIST}`);
  console.log(`  Then drag the zip to https://app.netlify.com/drop`);
}
