/**
 * build-ps3-svg.js
 * Builds welcome-header-bg.svg with:
 *   - PS3-style flowing wave ribbons
 *   - Smaller, better-centred pouch
 *   - Dreamy atmospheric glows & bokeh
 */

const fs = require('fs');
const path = require('path');

const pngPath = path.join(__dirname, '../public/images/nice-pouch.png');
const svgPath = path.join(__dirname, '../public/images/welcome-header-bg.svg');

const b64 = 'data:image/png;base64,' + fs.readFileSync(pngPath).toString('base64');
console.log('Base64 size:', (b64.length/1024).toFixed(0), 'KB');

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice">
  <defs>

    <!-- ============================================================
         PS3-STYLE BERRY-PURPLE BACKGROUND
         Layered gradients + flowing wave ribbons for that dreamy
         PlayStation 3 XMB aesthetic.
         ============================================================ -->

    <linearGradient id="bgBase" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="#9D1780"/>
      <stop offset="35%"  stop-color="#6B0E55"/>
      <stop offset="70%"  stop-color="#3D0532"/>
      <stop offset="100%" stop-color="#1A0014"/>
    </linearGradient>

    <radialGradient id="ambient" cx="65%" cy="40%" r="70%">
      <stop offset="0%"   stop-color="#D040A8" stop-opacity="0.28"/>
      <stop offset="50%"  stop-color="#8C1470" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#1A0014" stop-opacity="0.55"/>
    </radialGradient>

    <radialGradient id="bokehLeft" cx="22%" cy="28%" r="38%">
      <stop offset="0%"   stop-color="#FF7AC7" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#8C1470" stop-opacity="0"/>
    </radialGradient>

    <!-- PS3 wave gradients — smooth, horizontal, fade-out at edges -->
    <linearGradient id="wave1" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="#FF7AC7" stop-opacity="0"/>
      <stop offset="35%"  stop-color="#FF7AC7" stop-opacity="0.32"/>
      <stop offset="65%"  stop-color="#FFC8E6" stop-opacity="0.38"/>
      <stop offset="100%" stop-color="#FF7AC7" stop-opacity="0"/>
    </linearGradient>

    <linearGradient id="wave2" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="#E050C0" stop-opacity="0"/>
      <stop offset="40%"  stop-color="#E050C0" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#E050C0" stop-opacity="0"/>
    </linearGradient>

    <linearGradient id="wave3" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="#C820A0" stop-opacity="0"/>
      <stop offset="50%"  stop-color="#FF9AD0" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#C820A0" stop-opacity="0"/>
    </linearGradient>

    <linearGradient id="wave4" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="#6B0E55" stop-opacity="0"/>
      <stop offset="50%"  stop-color="#9D1780" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#6B0E55" stop-opacity="0"/>
    </linearGradient>

    <filter id="waveBlur" x="-10%" y="-50%" width="120%" height="200%">
      <feGaussianBlur stdDeviation="6"/>
    </filter>

    <filter id="atmosBlur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="30"/>
    </filter>

    <radialGradient id="pouchGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="#FF7AC7" stop-opacity="0.38"/>
      <stop offset="60%"  stop-color="#8C1470" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#1A0014" stop-opacity="0"/>
    </radialGradient>

    <linearGradient id="pageFade" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="#1A0014" stop-opacity="0"/>
      <stop offset="100%" stop-color="#1A0014" stop-opacity="1"/>
    </linearGradient>

    <linearGradient id="leftVig" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="#1A0014" stop-opacity="0.75"/>
      <stop offset="50%"  stop-color="#1A0014" stop-opacity="0.20"/>
      <stop offset="100%" stop-color="#1A0014" stop-opacity="0"/>
    </linearGradient>

    <filter id="groundShadow">
      <feGaussianBlur stdDeviation="14"/>
    </filter>

  </defs>

  <!-- BASE LAYER -->
  <rect width="1200" height="600" fill="url(#bgBase)"/>
  <rect width="1200" height="600" fill="url(#ambient)"/>

  <!-- Bokeh glow upper-left -->
  <ellipse cx="150" cy="120" rx="220" ry="180" fill="url(#bokehLeft)" filter="url(#atmosBlur)"/>

  <!-- ════════ PS3 WAVE RIBBONS ════════ -->

  <!-- Wave 4 — deepest, lowest -->
  <path d="M -50 440
           C 200 400, 450 480, 700 430
           S 1050 380, 1250 410
           L 1250 510
           C 1050 490, 700 540, 400 510
           S 100 530, -50 510 Z"
        fill="url(#wave4)" opacity="0.7" filter="url(#waveBlur)"/>

  <!-- Wave 3 — mid-low -->
  <path d="M -50 380
           C 250 320, 500 400, 800 360
           S 1150 320, 1250 350
           L 1250 440
           C 1050 420, 750 460, 450 430
           S 100 450, -50 450 Z"
        fill="url(#wave3)" opacity="0.85" filter="url(#waveBlur)"/>

  <!-- Wave 2 — mid -->
  <path d="M -50 290
           C 300 240, 600 310, 900 270
           S 1200 240, 1250 260
           L 1250 330
           C 1000 300, 700 350, 400 320
           S 100 340, -50 330 Z"
        fill="url(#wave2)" opacity="0.85" filter="url(#waveBlur)"/>

  <!-- Wave 1 — upper, brightest pink -->
  <path d="M -50 180
           C 250 130, 550 200, 850 160
           S 1150 140, 1250 150
           L 1250 220
           C 1050 195, 750 240, 450 215
           S 150 230, -50 220 Z"
        fill="url(#wave1)" opacity="0.9" filter="url(#waveBlur)"/>

  <!-- Thin accent lines — PS3 signature -->
  <path d="M -50 175 C 300 120, 600 190, 900 155 S 1200 135, 1250 145"
        fill="none" stroke="#FFCCE8" stroke-width="1" opacity="0.45" filter="url(#waveBlur)"/>
  <path d="M -50 285 C 350 235, 650 300, 950 265 S 1220 245, 1250 255"
        fill="none" stroke="#FFAAD8" stroke-width="0.8" opacity="0.38" filter="url(#waveBlur)"/>

  <!-- Floating bokeh particles -->
  <circle cx="220"  cy="180" r="3"   fill="#FFCCE8" opacity="0.85"/>
  <circle cx="320"  cy="260" r="2"   fill="#FFAAD8" opacity="0.55"/>
  <circle cx="480"  cy="140" r="2.5" fill="#FFCCE8" opacity="0.70"/>
  <circle cx="150"  cy="340" r="1.8" fill="#FF9AD0" opacity="0.60"/>
  <circle cx="400"  cy="420" r="2"   fill="#FFCCE8" opacity="0.50"/>
  <circle cx="1050" cy="200" r="2.5" fill="#FFCCE8" opacity="0.65"/>
  <circle cx="1120" cy="340" r="2"   fill="#FF9AD0" opacity="0.55"/>
  <circle cx="600"  cy="110" r="1.6" fill="#FFCCE8" opacity="0.50"/>
  <circle cx="880"  cy="460" r="2.2" fill="#FFAAD8" opacity="0.45"/>

  <!-- ════════ POUCH GLOW ════════ -->
  <ellipse cx="800" cy="320" rx="250" ry="220" fill="url(#pouchGlow)"/>

  <!-- ════════ GROUND SHADOW ════════ -->
  <ellipse cx="805" cy="490" rx="140" ry="13"
           fill="#000000" opacity="0.45" filter="url(#groundShadow)"/>

  <!-- ════════ THE POUCH — pulled left + slightly smaller so it doesn't
         touch the right border of the email frame ════════ -->
  <image
    href="${b64}"
    x="645"
    y="165"
    width="295"
    height="316"
    preserveAspectRatio="xMidYMid meet"
  />

  <!-- Bottom fade to cream body -->
  <rect x="0" y="410" width="1200" height="190" fill="url(#pageFade)"/>

  <!-- Left vignette -->
  <rect x="0" y="0" width="680" height="600" fill="url(#leftVig)"/>

</svg>`;

fs.writeFileSync(svgPath, svg);
console.log('✓ SVG written:', (svg.length/1024).toFixed(0), 'KB');
