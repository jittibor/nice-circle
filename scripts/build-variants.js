/**
 * build-variants.js
 *
 * Generates 7 new flavour banner variants of the welcome email, plus a
 * gallery page to preview all 8. Uses the existing N1CE pouch reference
 * images and crops each individual pouch.
 *
 * Output:
 *   public/images/pouches/{flavor}.png     (cropped individual pouch)
 *   public/images/banners/banner-{flavor}.svg
 *   emails/variants/welcome-{flavor}.html
 *   emails/variants-gallery.html
 */

const { Jimp, ResizeStrategy } = require('jimp');
const fs = require('fs');
const path = require('path');

const IMG  = p => path.join(__dirname, '../public/images', p);
const DEST_POUCH  = p => path.join(__dirname, '../public/images/pouches', p);
const DEST_BANNER = p => path.join(__dirname, '../public/images/banners', p);
const DEST_EMAIL  = p => path.join(__dirname, '../emails/variants', p);

// Individual pouch PNGs (pre-keyed transparent bg). Actual product photos.
// ═══════════════════════════════════════════════════════════════════
//  FLAVOUR CONFIG
//  sourceFile points to the individual pouch image for that flavor.
//
//  Berry has outputBanner='welcome-header-bg.svg' + skipEmailGen=true,
//  because the main welcome-email.html already exists and just needs
//  its banner regenerated with the new Purple Punch pouch.
// ═══════════════════════════════════════════════════════════════════
const FLAVOURS = [
  {
    id: 'berry', name: 'Purple Punch',
    sourceFile: IMG('SplitImg.com_2 (1).png'),
    outputBanner: 'welcome-header-bg.svg',
    skipEmailGen: true,
    theme: {
      primary: '#8C1470', deep: '#2E0428', light: '#D040A8',
      darkest: '#1A0014', accent: '#FFDD00', accentHot: '#FF5600',
      body: '#8B1468', canBg: '#8C1470'
    }
  },
  {
    id: 'peach', name: 'Peach Flame',
    sourceFile: IMG('SplitImg.com_1 (1).png'),
    theme: {
      primary: '#FF7550', deep: '#8B2410', light: '#FFAE8A',
      darkest: '#2A0A04', accent: '#FFCC33', accentHot: '#FF3820',
      body: '#D84820', canBg: '#FF8A60'
    }
  },
  {
    id: 'wintergreen', name: 'Wintergreen Malla',
    sourceFile: IMG('SplitImg.com_3 (1).png'),
    theme: {
      primary: '#4D9A3F', deep: '#153815', light: '#8BC878',
      darkest: '#0A1E0A', accent: '#FFE040', accentHot: '#FF5600',
      body: '#2E6B28', canBg: '#4DAA3F'
    }
  },
  {
    id: 'melon', name: 'Melon Blaze',
    sourceFile: IMG('SplitImg.com_4 (1).png'),
    theme: {
      primary: '#E05030', deep: '#5A0A0A', light: '#FF9070',
      darkest: '#200505', accent: '#FFE040', accentHot: '#FFB020',
      body: '#A82820', canBg: '#E84830'
    }
  },
  {
    id: 'mango', name: 'Mango Rush',
    sourceFile: IMG('SplitImg.com_1.png'),
    theme: {
      primary: '#FFA41F', deep: '#8A4A00', light: '#FFD070',
      darkest: '#2A1400', accent: '#FFEE50', accentHot: '#FF3820',
      body: '#B86D00', canBg: '#FFAE1F'
    }
  },
  {
    id: 'mint', name: 'Jalapeño Glow',
    sourceFile: IMG('SplitImg.com_2.png'),
    theme: {
      primary: '#1D9E6F', deep: '#0A3524', light: '#4DD5A0',
      darkest: '#051810', accent: '#E8FCF0', accentHot: '#FFDD00',
      body: '#117048', canBg: '#1DAE6F'
    }
  },
  {
    id: 'cafe', name: 'Smooth Cappuccino',
    sourceFile: IMG('SplitImg.com_3.png'),
    theme: {
      primary: '#8C6850', deep: '#2A180C', light: '#C8A485',
      darkest: '#14090A', accent: '#E8D5B0', accentHot: '#FFA45A',
      body: '#5D3D2A', canBg: '#8C7050'
    }
  },
  {
    id: 'blue', name: 'Mint Freeze',
    sourceFile: IMG('SplitImg.com_4.png'),
    theme: {
      primary: '#1E8FF0', deep: '#0A2850', light: '#6FC0FF',
      darkest: '#050F28', accent: '#FFDD00', accentHot: '#FF5600',
      body: '#0858B8', canBg: '#1E99F0'
    }
  }
];

// ═══════════════════════════════════════════════════════════════════
//  STEP 1: crop individual pouches from the reference images
// ═══════════════════════════════════════════════════════════════════
async function cropPouches() {
  console.log('\n═══ STEP 1: READING + BBOX-CROPPING POUCHES ═══');
  for (const flavor of FLAVOURS) {
    console.log(`  ${flavor.id} ←`, path.basename(flavor.sourceFile));
    const img = await Jimp.read(flavor.sourceFile);
    const { width, height } = img.bitmap;

    // Find bbox of non-transparent content
    let minX = width, minY = height, maxX = 0, maxY = 0;
    img.scan(0, 0, width, height, function(x, y, idx4) {
      const a = this.bitmap.data[idx4 + 3];
      if (a > 20) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    });

    // Crop to bbox with small padding
    const PAD = 4;
    const cx = Math.max(0, minX - PAD);
    const cy = Math.max(0, minY - PAD);
    const cw = Math.min(width  - cx, (maxX - minX + 1) + PAD * 2);
    const ch = Math.min(height - cy, (maxY - minY + 1) + PAD * 2);
    img.crop({ x: cx, y: cy, w: cw, h: ch });

    // Resize down to max 400 wide for file-size efficiency
    if (img.bitmap.width > 400) {
      const scale = 400 / img.bitmap.width;
      img.resize({
        w: 400,
        h: Math.round(img.bitmap.height * scale),
        mode: ResizeStrategy.BILINEAR
      });
    }
    await img.write(DEST_POUCH(`${flavor.id}.png`));
    console.log(`     ✓ cropped to ${img.bitmap.width}×${img.bitmap.height}`);
  }
  console.log('  ✓ pouches saved');
}

// ═══════════════════════════════════════════════════════════════════
//  STEP 2: build banner SVG for each flavor
// ═══════════════════════════════════════════════════════════════════
function buildBannerSVG(flavor) {
  const pouchB64 = 'data:image/png;base64,' +
    fs.readFileSync(DEST_POUCH(`${flavor.id}.png`)).toString('base64');

  const t = flavor.theme;
  // Compute accent wave colours — use lighter version of primary for pink/light
  const waveColor = t.light;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="bgBase" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="${t.primary}"/>
      <stop offset="35%"  stop-color="${t.body}"/>
      <stop offset="70%"  stop-color="${t.deep}"/>
      <stop offset="100%" stop-color="${t.darkest}"/>
    </linearGradient>
    <radialGradient id="ambient" cx="65%" cy="40%" r="70%">
      <stop offset="0%"   stop-color="${t.light}" stop-opacity="0.28"/>
      <stop offset="50%"  stop-color="${t.primary}" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="${t.darkest}" stop-opacity="0.55"/>
    </radialGradient>
    <radialGradient id="bokehLeft" cx="22%" cy="28%" r="38%">
      <stop offset="0%"   stop-color="${t.light}" stop-opacity="0.20"/>
      <stop offset="100%" stop-color="${t.primary}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="wave1" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="${waveColor}" stop-opacity="0"/>
      <stop offset="35%"  stop-color="${waveColor}" stop-opacity="0.32"/>
      <stop offset="65%"  stop-color="${waveColor}" stop-opacity="0.38"/>
      <stop offset="100%" stop-color="${waveColor}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="wave2" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="${t.primary}" stop-opacity="0"/>
      <stop offset="40%"  stop-color="${t.primary}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="${t.primary}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="wave3" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="${t.deep}" stop-opacity="0"/>
      <stop offset="50%"  stop-color="${t.light}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${t.deep}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="wave4" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="${t.deep}" stop-opacity="0"/>
      <stop offset="50%"  stop-color="${t.primary}" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="${t.deep}" stop-opacity="0"/>
    </linearGradient>
    <filter id="waveBlur" x="-10%" y="-50%" width="120%" height="200%">
      <feGaussianBlur stdDeviation="6"/>
    </filter>
    <filter id="atmosBlur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="30"/>
    </filter>
    <radialGradient id="pouchGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="${t.light}" stop-opacity="0.38"/>
      <stop offset="60%"  stop-color="${t.primary}" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="${t.darkest}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="pageFade" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="${t.darkest}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${t.darkest}" stop-opacity="1"/>
    </linearGradient>
    <linearGradient id="leftVig" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="${t.darkest}" stop-opacity="0.80"/>
      <stop offset="50%"  stop-color="${t.darkest}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${t.darkest}" stop-opacity="0"/>
    </linearGradient>
    <filter id="groundShadow">
      <feGaussianBlur stdDeviation="14"/>
    </filter>
  </defs>

  <rect width="1200" height="600" fill="url(#bgBase)"/>
  <rect width="1200" height="600" fill="url(#ambient)"/>
  <ellipse cx="150" cy="120" rx="220" ry="180" fill="url(#bokehLeft)" filter="url(#atmosBlur)"/>

  <!-- PS3-style wave ribbons -->
  <path d="M -50 440 C 200 400, 450 480, 700 430 S 1050 380, 1250 410 L 1250 510 C 1050 490, 700 540, 400 510 S 100 530, -50 510 Z"
        fill="url(#wave4)" opacity="0.7" filter="url(#waveBlur)"/>
  <path d="M -50 380 C 250 320, 500 400, 800 360 S 1150 320, 1250 350 L 1250 440 C 1050 420, 750 460, 450 430 S 100 450, -50 450 Z"
        fill="url(#wave3)" opacity="0.85" filter="url(#waveBlur)"/>
  <path d="M -50 290 C 300 240, 600 310, 900 270 S 1200 240, 1250 260 L 1250 330 C 1000 300, 700 350, 400 320 S 100 340, -50 330 Z"
        fill="url(#wave2)" opacity="0.85" filter="url(#waveBlur)"/>
  <path d="M -50 180 C 250 130, 550 200, 850 160 S 1150 140, 1250 150 L 1250 220 C 1050 195, 750 240, 450 215 S 150 230, -50 220 Z"
        fill="url(#wave1)" opacity="0.9" filter="url(#waveBlur)"/>
  <path d="M -50 175 C 300 120, 600 190, 900 155 S 1200 135, 1250 145" fill="none" stroke="${t.light}" stroke-width="1" opacity="0.45" filter="url(#waveBlur)"/>
  <path d="M -50 285 C 350 235, 650 300, 950 265 S 1220 245, 1250 255" fill="none" stroke="${t.light}" stroke-width="0.8" opacity="0.38" filter="url(#waveBlur)"/>

  <!-- Bokeh particles -->
  <circle cx="220"  cy="180" r="3"   fill="${t.light}" opacity="0.85"/>
  <circle cx="320"  cy="260" r="2"   fill="${t.light}" opacity="0.55"/>
  <circle cx="480"  cy="140" r="2.5" fill="${t.light}" opacity="0.70"/>
  <circle cx="150"  cy="340" r="1.8" fill="${t.primary}" opacity="0.60"/>
  <circle cx="400"  cy="420" r="2"   fill="${t.light}" opacity="0.50"/>
  <circle cx="1050" cy="200" r="2.5" fill="${t.light}" opacity="0.65"/>
  <circle cx="1120" cy="340" r="2"   fill="${t.primary}" opacity="0.55"/>
  <circle cx="600"  cy="110" r="1.6" fill="${t.light}" opacity="0.50"/>
  <circle cx="880"  cy="460" r="2.2" fill="${t.light}" opacity="0.45"/>

  <ellipse cx="800" cy="320" rx="250" ry="220" fill="url(#pouchGlow)"/>
  <ellipse cx="805" cy="490" rx="140" ry="13" fill="#000000" opacity="0.45" filter="url(#groundShadow)"/>

  <!-- The pouch image -->
  <image href="${pouchB64}" x="645" y="165" width="295" height="316" preserveAspectRatio="xMidYMid meet"/>

  <rect x="0" y="410" width="1200" height="190" fill="url(#pageFade)"/>
  <rect x="0" y="0" width="680" height="600" fill="url(#leftVig)"/>
</svg>`;
}

// ═══════════════════════════════════════════════════════════════════
//  STEP 3: build the email HTML for each flavor
// ═══════════════════════════════════════════════════════════════════
function buildEmailHTML(flavor) {
  const t = flavor.theme;
  // Helper: build a gradient fade row (dark → cream or cream → dark)
  const fadeDown = `linear-gradient(180deg, ${t.darkest} 0%, ${mix(t.darkest, t.primary, 0.5)} 25%, ${mix(t.primary, '#FAF7F2', 0.55)} 55%, ${mix(t.light, '#FAF7F2', 0.75)} 80%, #FAF7F2 100%)`;
  const fadeUp   = `linear-gradient(180deg, #FAF7F2 0%, ${mix(t.light, '#FAF7F2', 0.75)} 25%, ${mix(t.primary, '#FAF7F2', 0.55)} 55%, ${mix(t.darkest, t.primary, 0.5)} 85%, ${t.darkest} 100%)`;
  const referralBg = `linear-gradient(160deg, ${t.darkest} 0%, ${t.primary} 55%, ${t.body} 100%)`;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <title>Welcome to N1CE Circle · ${flavor.name}</title>
  <link href="https://fonts.googleapis.com/css2?family=Anton&family=Oswald:wght@500;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; display: block; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #FAF7F2; }
    a { color: ${t.accentHot}; text-decoration: none; }
    .heading { font-family: 'Anton', 'Arial Black', sans-serif; }
    .accent { font-family: 'Oswald', 'Arial', sans-serif; }
    .body-font { font-family: 'JetBrains Mono', 'Courier New', monospace; }
    @media screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .h1 { font-size: 56px !important; line-height: 0.95 !important; }
      .padding { padding: 36px 24px !important; }
      .video-frame { height: 200px !important; }
      .play-icon { width: 56px !important; height: 56px !important; }
      .header-pad { padding: 60px 24px !important; }
      .logo-img { width: 120px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#FAF7F2;">
  <div style="display:none; font-size:1px; color:#FAF7F2; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
    {{firstName}}, you're in. A personal message from Justin Gaethje + your member link inside.
  </div>

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#FAF7F2;">
    <tr>
      <td align="center" style="padding:0;">
        <table role="presentation" class="container" cellspacing="0" cellpadding="0" border="0" width="600" style="width:600px; max-width:600px; background-color:#FAF7F2;">

          <!-- HERO with flavour banner -->
          <tr>
            <td class="header-pad"
                background="/images/banners/banner-${flavor.id}.svg"
                bgcolor="${t.primary}"
                valign="middle"
                align="left"
                style="background-color:${t.primary}; background-image:url('/images/banners/banner-${flavor.id}.svg'); background-size:cover; background-position:center top; background-repeat:no-repeat; padding:80px 48px 90px;">

              <img src="/images/n1ce-logo-white.png" width="140" alt="N1CE" class="logo-img" style="display:block; width:140px; max-width:140px; margin:0 0 40px 0; opacity:0.95;"/>

              <p class="accent" style="margin:0 0 16px; font-family:'Oswald','Arial',sans-serif; font-size:11px; letter-spacing:0.35em; text-transform:uppercase; color:${t.accent}; font-weight:700;">Circle / ${flavor.name}</p>

              <h1 class="heading h1" style="margin:0 0 22px; font-family:'Anton','Arial Black',sans-serif; font-size:72px; line-height:0.92; letter-spacing:-0.02em; color:#FFFFFF; text-transform:uppercase; text-shadow:0 4px 24px rgba(0,0,0,0.55);">Welcome,<br/><span style="color:${t.light};">{{firstName}}<span style="color:${t.accentHot};">.</span></span></h1>

              <p class="body-font" style="margin:0; font-family:'JetBrains Mono','Courier New',monospace; font-size:14px; color:#FAF7F2; line-height:1.7; max-width:380px; text-shadow:0 2px 10px rgba(0,0,0,0.5);">Thanks for joining the N1CE Circle.</p>
            </td>
          </tr>

          <!-- Gradient fade down to cream -->
          <tr>
            <td style="height:60px; line-height:60px; font-size:0; background:${fadeDown};">&nbsp;</td>
          </tr>

          <!-- Video section -->
          <tr>
            <td class="padding" style="background-color:#FAF7F2; padding:40px 48px 36px;">
              <p class="accent" style="margin:0 0 14px; font-family:'Oswald','Arial',sans-serif; font-size:11px; letter-spacing:0.3em; color:${t.accentHot}; text-transform:uppercase; font-weight:700;">A message for you</p>
              <h2 class="heading" style="margin:0 0 28px; font-family:'Anton','Arial Black',sans-serif; font-size:46px; line-height:1; color:#0A0A0A; text-transform:uppercase; letter-spacing:-0.01em;">From <span style="color:${t.primary};">Justin.</span></h2>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="padding:3px; background-color:${t.accentHot};">
                    <a href="{{videoUrl}}" style="text-decoration:none; color:inherit;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#0A0A0A;">
                        <tr>
                          <td class="video-frame" align="center" valign="middle" height="300" style="height:300px; background-color:#0A0A0A; background-image:url('{{videoThumbnailUrl}}'); background-size:cover; background-position:center;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                              <tr>
                                <td class="play-icon" align="center" valign="middle" width="80" height="80" style="width:80px; height:80px; background-color:${t.accentHot}; border-radius:50%; border:3px solid #FFFFFF;">
                                  <span style="font-family:'Arial',sans-serif; font-size:32px; color:#FFFFFF; line-height:1; padding-left:6px;">&#9654;</span>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td style="background-color:#0A0A0A; padding:14px 18px;" align="left">
                            <span class="accent" style="font-family:'Oswald','Arial',sans-serif; font-size:11px; letter-spacing:0.25em; color:${t.accent}; text-transform:uppercase;">&#9654; Personalized for {{firstName}} / Tap to play</span>
                          </td>
                        </tr>
                      </table>
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Gradient fade up to coloured referral section -->
          <tr>
            <td style="height:60px; line-height:60px; font-size:0; background:${fadeUp};">&nbsp;</td>
          </tr>

          <!-- Referral section -->
          <tr>
            <td class="padding" valign="middle" style="background-color:${t.darkest}; background:${referralBg}; padding:48px 48px 56px;">

              <p class="accent" style="margin:0 0 14px; font-family:'Oswald','Arial',sans-serif; font-size:11px; letter-spacing:0.3em; color:${t.accent}; text-transform:uppercase; font-weight:700;">Your Member Link</p>

              <h2 class="heading" style="margin:0 0 18px; font-family:'Anton','Arial Black',sans-serif; font-size:52px; line-height:0.95; color:#FFFFFF; text-transform:uppercase; letter-spacing:-0.02em;">Bring a<br/><span style="color:${t.light};">friend.</span></h2>

              <p class="body-font" style="margin:0 0 28px; font-family:'JetBrains Mono','Courier New',monospace; font-size:14px; color:#FAF7F2; line-height:1.65; max-width:440px; opacity:0.88;">Share your link. Anyone who joins through it goes into the draw too.</p>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="background-color:#0A0A0A; border-left:4px solid ${t.accentHot}; padding:22px 24px;" align="left">
                    <p class="accent" style="margin:0 0 10px; font-family:'Oswald','Arial',sans-serif; font-size:10px; letter-spacing:0.3em; color:${t.accent}; text-transform:uppercase; font-weight:700;">Your link</p>
                    <div class="body-font" style="font-family:'JetBrains Mono','Courier New',monospace; font-size:15px; color:#FFFFFF; word-break:break-all; font-weight:700;">n1ce.com/r/{{referralCode}}</div>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px;">
                <tr>
                  <td style="background-color:${t.accentHot};" align="center">
                    <a href="https://n1ce.com/r/{{referralCode}}" style="display:inline-block; padding:16px 36px; font-family:'Anton','Arial Black',sans-serif; font-size:17px; letter-spacing:0.1em; color:#FFFFFF; text-decoration:none; text-transform:uppercase; font-weight:700;">Share My Link &rarr;</a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#0A0A0A; padding:36px 32px;" align="center">
              <img src="/images/n1ce-logo-white.png" width="80" alt="N1CE" style="display:block; width:80px; max-width:80px; margin:0 auto 18px auto; opacity:0.95;"/>
              <p class="accent" style="margin:0 0 14px; font-family:'Oswald','Arial',sans-serif; font-size:11px; letter-spacing:0.3em; color:${t.light}; text-transform:uppercase; font-weight:700;">
                <a href="#" style="color:${t.light}; text-decoration:none;">Instagram</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;<a href="#" style="color:${t.accentHot}; text-decoration:none;">TikTok</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;<a href="#" style="color:${t.accent}; text-decoration:none;">Contact</a>
              </p>
              <p style="margin:0 0 6px; font-family:'JetBrains Mono','Courier New',monospace; font-size:11px; color:#FAF7F2; opacity:0.55;">N1CE / Stockholm, Sweden</p>
              <p style="margin:0; font-family:'JetBrains Mono','Courier New',monospace; font-size:10px; color:#FAF7F2; opacity:0.45;">© 2026 N1CE &middot; <a href="#" style="color:#FAF7F2; text-decoration:underline;">Unsubscribe</a> &middot; Must be 21+</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

  <!-- ════════════════════════════════════════════════════════════════
       PREVIEW-ONLY CLIENT-SIDE ENHANCEMENT (Netlify-compatible)
       Runs in browser only. Email clients strip <script>, so the
       original merge-tag based email is untouched when sent. -->
  <script>
  (function(){
    var qs = new URLSearchParams(location.search);
    var name = (qs.get('name') || '').trim();

    function replaceInTextNodes(token, replacement) {
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      var matches = [], n;
      while (n = walker.nextNode()) {
        if (n.nodeValue.indexOf(token) !== -1) matches.push(n);
      }
      matches.forEach(function(m){ m.nodeValue = m.nodeValue.split(token).join(replacement); });
    }

    // Resolve {{videoUrl}} in attributes + clear the thumbnail merge tag
    var VIDEO_URL = '/videos/message-for-you.mp4';
    document.querySelectorAll('[href],[src]').forEach(function(el){
      ['href','src'].forEach(function(attr){
        var v = el.getAttribute(attr);
        if (v && v.indexOf('{{videoUrl}}') !== -1) {
          el.setAttribute(attr, v.replace(/\\{\\{videoUrl\\}\\}/g, VIDEO_URL));
        }
      });
    });
    document.querySelectorAll('[style]').forEach(function(el){
      var s = el.getAttribute('style');
      if (s && s.indexOf('{{videoThumbnailUrl}}') !== -1) {
        el.setAttribute('style', s.replace(/\\{\\{videoThumbnailUrl\\}\\}/g, ''));
      }
    });

    if (name) replaceInTextNodes('{{firstName}}', name);

    // Swap the video-card's thumbnail cell with an inline <video>, preserving
    // the outer coloured border AND the "Personalized for X / Tap to play"
    // caption row. Explicit dimensions prevent collapse before metadata loads.
    document.querySelectorAll('a[href*="/videos/"]').forEach(function(a){
      var videoSrc = a.getAttribute('href');
      var frameCell = a.querySelector('.video-frame') || a.querySelector('td');
      if (frameCell) {
        frameCell.innerHTML = '';
        frameCell.style.backgroundImage = 'none';
        frameCell.style.padding = '0';
        if (!frameCell.getAttribute('height')) frameCell.setAttribute('height', '300');
        frameCell.style.height = '300px';

        var video = document.createElement('video');
        video.src = videoSrc;
        video.controls = true;
        video.preload = 'metadata';
        video.playsInline = true;
        video.setAttribute('width', '100%');
        video.setAttribute('height', '300');
        video.style.cssText = 'width:100%;height:300px;display:block;background:#0A0A0A;object-fit:contain;';
        frameCell.appendChild(video);
      }
      // Unwrap the anchor — keep the inner table (with its caption row) intact
      while (a.firstChild) a.parentNode.insertBefore(a.firstChild, a);
      if (a.parentNode) a.parentNode.removeChild(a);
    });
  })();
  </script>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════
//  STEP 4: gallery HTML listing all 8 variants
// ═══════════════════════════════════════════════════════════════════
function buildGalleryHTML(flavours) {
  // Netlify-compatible static links (no Express routing required).
  //   emailOnly → direct link to the email HTML file
  //   preview   → static Gmail mock HTML file
  const all = flavours.map(f => ({
    id: f.id,
    name: f.name,
    preview: `/emails/mocks/gmail-welcome-${f.id}.html`,
    emailOnly: f.skipEmailGen ? '/emails/welcome-email.html' : `/emails/variants/welcome-${f.id}.html`,
    theme: f.theme
  }));

  const MOCK_NAMES = ['Minou', 'Stefan', 'Durim', 'Micheal'];

  const cards = all.map((v, i) => `
    <div class="card" style="--accent:${v.theme.primary}; --accent-light:${v.theme.light || v.theme.primary};">
      <div class="card-chip" style="background:${v.theme.primary};">${v.name}</div>
      <iframe src="${v.emailOnly}" class="card-frame" title="${v.name} preview" loading="lazy"></iframe>
      <div class="card-actions">
        <a class="card-btn" href="${v.emailOnly}" target="_blank">Open email</a>
        <div class="gmail-dropdown">
          <button class="card-btn secondary gmail-btn" type="button" onclick="toggleDropdown(event, this)">Gmail mock ▾</button>
          <div class="gmail-menu" role="menu">
            ${MOCK_NAMES.map(n => `<a class="gmail-menu-item" href="${v.preview}?name=${encodeURIComponent(n)}" target="_blank">${n}</a>`).join('')}
            <div class="gmail-menu-divider"></div>
            <a class="gmail-menu-item subtle" href="${v.preview}" target="_blank">No name (default)</a>
          </div>
        </div>
      </div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>N1CE Circle · Email Variants Gallery</title>
  <link href="https://fonts.googleapis.com/css2?family=Anton&family=Oswald:wght@500;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #0A0A0A; color: #FAF7F2; font-family: 'Oswald', Arial, sans-serif; min-height: 100vh; }
    .header { padding: 48px 32px 24px; max-width: 1600px; margin: 0 auto; }
    .kicker { font-size: 11px; letter-spacing: 0.35em; text-transform: uppercase; color: #FFDD00; margin: 0 0 8px; font-weight: 700; }
    .title { font-family: 'Anton', Arial Black, sans-serif; font-size: 72px; line-height: 0.95; margin: 0 0 16px; letter-spacing: -0.02em; }
    .subtitle { font-family: 'JetBrains Mono', monospace; font-size: 14px; line-height: 1.5; color: #FAF7F2; opacity: 0.72; max-width: 680px; margin: 0 0 8px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(440px, 1fr)); gap: 24px; padding: 24px 32px 64px; max-width: 1600px; margin: 0 auto; }
    .card { background: #1A0014; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; overflow: hidden; transition: transform 0.2s, box-shadow 0.2s; position: relative; }
    .card:hover { transform: translateY(-4px); box-shadow: 0 16px 48px rgba(var(--accent), 0.25); border-color: var(--accent); }
    .card-chip { display: inline-block; color: #FFFFFF; font-family: 'Anton', sans-serif; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; padding: 6px 14px; position: absolute; top: 12px; left: 12px; z-index: 2; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
    .card-frame { width: 100%; height: 640px; border: 0; background: #FAF7F2; display: block; }
    .card-actions { display: flex; gap: 8px; padding: 14px; background: #0A0A0A; border-top: 1px solid rgba(255,255,255,0.08); }
    .card-btn { flex: 1; text-align: center; padding: 10px 16px; border-radius: 6px; background: var(--accent); color: #FFFFFF; text-decoration: none; font-family: 'Anton', sans-serif; font-size: 14px; letter-spacing: 0.08em; text-transform: uppercase; transition: background 0.15s; }
    .card-btn:hover { background: var(--accent-light); }
    .card-btn.secondary { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #FAF7F2; }
    .card-btn.secondary:hover { background: rgba(255,255,255,0.08); }

    /* Gmail-mock dropdown */
    .gmail-dropdown { position: relative; flex: 1; }
    .gmail-dropdown .gmail-btn { width: 100%; cursor: pointer; font-family: inherit; font-size: 14px; letter-spacing: 0.08em; text-transform: uppercase; }
    .gmail-menu {
      position: absolute; bottom: calc(100% + 6px); left: 0; right: 0;
      background: #1A0014; border: 1px solid rgba(255,255,255,0.14); border-radius: 8px;
      padding: 6px; box-shadow: 0 12px 32px rgba(0,0,0,0.6);
      display: none; flex-direction: column; z-index: 10;
    }
    .gmail-dropdown.open .gmail-menu { display: flex; }
    .gmail-menu-item {
      display: block; padding: 10px 14px; color: #FAF7F2; text-decoration: none;
      border-radius: 6px; font-family: 'Anton', sans-serif; font-size: 14px;
      letter-spacing: 0.08em; text-transform: uppercase; transition: background 0.12s;
    }
    .gmail-menu-item:hover { background: var(--accent); color: #FFFFFF; }
    .gmail-menu-item.subtle { color: rgba(255,255,255,0.6); font-size: 12px; letter-spacing: 0.1em; }
    .gmail-menu-item.subtle:hover { background: rgba(255,255,255,0.08); color: #FFFFFF; }
    .gmail-menu-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 6px 8px; }
  </style>
</head>
<body>
  <div class="header">
    <p class="kicker">N1CE Circle · Email Variants</p>
    <h1 class="title">8 Flavour<br/>Welcome Variants.</h1>
    <p class="subtitle">Each variant inherits the same hero layout (pouch on the right, PS3-style flowing ribbons, typography system) but drops a different N1CE flavour into the banner with a matching colour palette through the whole email.</p>
    <p class="subtitle">Click any card to open the full email preview.</p>
  </div>
  <div class="grid">${cards}</div>

  <script>
    // Close any open dropdown when clicking outside
    document.addEventListener('click', function(e) {
      document.querySelectorAll('.gmail-dropdown.open').forEach(function(dd) {
        if (!dd.contains(e.target)) dd.classList.remove('open');
      });
    });
    function toggleDropdown(event, btn) {
      event.stopPropagation();
      var dd = btn.closest('.gmail-dropdown');
      // Close all other dropdowns first
      document.querySelectorAll('.gmail-dropdown.open').forEach(function(other) {
        if (other !== dd) other.classList.remove('open');
      });
      dd.classList.toggle('open');
    }
  </script>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════
//  STEP 5: static Gmail mock HTML files (one per flavor, Netlify-ready)
//  Iframes the email file + includes a name-selector dropdown.
// ═══════════════════════════════════════════════════════════════════
function buildGmailMockStatic(flavor) {
  const MOCK_NAMES = ['Minou', 'Stefan', 'Durim', 'Micheal'];
  const emailPath = flavor.skipEmailGen
    ? '/emails/welcome-email.html'
    : `/emails/variants/welcome-${flavor.id}.html`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Gmail · N1CE Circle · ${flavor.name}</title>
  <style>
    *{box-sizing:border-box;}
    html,body{margin:0;padding:0;height:100%;background:#f6f8fc;font-family:'Google Sans','Roboto',Arial,sans-serif;color:#202124;}
    .gnav{display:flex;align-items:center;height:64px;padding:0 16px;background:#f6f8fc;border-bottom:1px solid #e8eaed;}
    .gnav-logo-text{font-size:22px;color:#5f6368;margin-right:24px;margin-left:12px;}
    .gnav-search{flex:1;max-width:720px;background:#eaf1fb;border-radius:8px;height:48px;padding:0 16px;display:flex;align-items:center;color:#5f6368;}
    .gnav-avatar{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#E2003F,#FF5600);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;margin-left:auto;margin-right:16px;}
    .shell{display:flex;height:calc(100vh - 64px);}
    .sidebar{width:256px;padding:16px;}
    .folder{padding:10px 18px;border-radius:0 16px 16px 0;font-size:14px;color:#202124;cursor:pointer;}
    .folder.active{background:#d3e3fd;font-weight:700;}
    .mailview{flex:1;background:#fff;border-radius:16px 0 0 0;margin:0 8px 8px 0;overflow-y:auto;}
    .mtoolbar{padding:12px 16px;border-bottom:1px solid #e8eaed;color:#5f6368;font-size:13px;display:flex;align-items:center;gap:12px;}
    .name-picker{margin-left:auto;display:flex;align-items:center;gap:8px;font-size:12px;color:#5f6368;}
    .name-picker label{font-weight:500;letter-spacing:0.05em;text-transform:uppercase;}
    .name-picker select{appearance:none;-webkit-appearance:none;background:#f1f3f4;border:1px solid #dadce0;border-radius:18px;padding:6px 30px 6px 14px;font-size:13px;color:#202124;cursor:pointer;outline:none;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 14 14'><path fill='%235f6368' d='M3 5l4 4 4-4z'/></svg>");background-repeat:no-repeat;background-position:right 10px center;}
    .name-picker select:hover{background-color:#e8eaed;}
    .subject-row{padding:24px 48px 0;font-size:22px;}
    .sender-row{padding:16px 48px 20px;border-bottom:1px solid #f1f3f4;color:#5f6368;font-size:12px;}
    .sender-row strong{color:#202124;font-size:14px;}
    .email-body{padding:0;}
    .email-body iframe{width:100%;max-width:620px;height:2400px;border:0;display:block;margin:0 auto;}
  </style>
</head>
<body>
  <div class="gnav">
    <div class="gnav-logo-text">Gmail</div>
    <div class="gnav-search">&#128269; Search mail</div>
    <div class="gnav-avatar">T</div>
  </div>
  <div class="shell">
    <aside class="sidebar">
      <div class="folder active">&#128229; Inbox</div>
      <div class="folder">&#9733; Starred</div>
      <div class="folder">&#10148; Sent</div>
      <div class="folder">&#128196; Drafts</div>
    </aside>
    <main class="mailview">
      <div class="mtoolbar">
        <span id="mail-pager">&larr; &nbsp; 1 of 2,841</span>
        <div class="name-picker">
          <label for="name-select">Send as</label>
          <select id="name-select" onchange="swapName(this.value)">
            <option value="">{{firstName}} (default)</option>
            ${MOCK_NAMES.map(n => `<option value="${n}">${n}</option>`).join('\n            ')}
          </select>
        </div>
      </div>
      <div class="subject-row" id="subject">Welcome to N1CE Circle. <span style="font-size:11px;background:#e8f0fe;color:#1967d2;padding:2px 8px;border-radius:4px;margin-left:8px;">Inbox</span></div>
      <div class="sender-row"><strong>N1CE</strong> &lt;hello@n1ce.com&gt; &middot; to <span id="recipient">me</span> &middot; 2:41 PM</div>
      <div class="email-body"><iframe id="email-iframe" src="${emailPath}" title="Welcome email"></iframe></div>
    </main>
  </div>
  <script>
    var EMAIL = '${emailPath}';
    // Initial name from URL
    var params = new URLSearchParams(location.search);
    var name = (params.get('name') || '').trim();
    if (name) {
      document.getElementById('name-select').value = name;
      document.getElementById('subject').firstChild.nodeValue = 'Welcome to N1CE Circle, ' + name + '. ';
      document.getElementById('recipient').textContent = name;
      document.getElementById('email-iframe').src = EMAIL + '?name=' + encodeURIComponent(name);
    }
    function swapName(val) {
      var url = val ? (location.pathname + '?name=' + encodeURIComponent(val)) : location.pathname;
      location.href = url;
    }
  </script>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════
//  UTIL: simple color mix (hex, hex, ratio 0-1)
// ═══════════════════════════════════════════════════════════════════
function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 0xFF, ag = (pa >> 8) & 0xFF, ab = pa & 0xFF;
  const br = (pb >> 16) & 0xFF, bg = (pb >> 8) & 0xFF, bb = pb & 0xFF;
  const rr = Math.round(ar + (br - ar) * t);
  const rg = Math.round(ag + (bg - ag) * t);
  const rb = Math.round(ab + (bb - ab) * t);
  return '#' + [rr, rg, rb].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════════
async function main() {
  await cropPouches();

  console.log('\n═══ STEP 2-3: BANNERS + EMAILS ═══');
  for (const flavor of FLAVOURS) {
    const bannerSvg = buildBannerSVG(flavor);

    // Berry writes to main welcome-header-bg.svg (the main email uses it).
    // Other flavors write to banners/banner-{id}.svg.
    const bannerPath = flavor.outputBanner
      ? path.join(__dirname, '../public/images', flavor.outputBanner)
      : DEST_BANNER(`banner-${flavor.id}.svg`);
    fs.writeFileSync(bannerPath, bannerSvg);

    // Berry skips email gen (main welcome-email.html already exists).
    let emailSize = 0;
    if (!flavor.skipEmailGen) {
      const emailHtml = buildEmailHTML(flavor);
      fs.writeFileSync(DEST_EMAIL(`welcome-${flavor.id}.html`), emailHtml);
      emailSize = emailHtml.length;
    }

    console.log(`  ✓ ${flavor.id.padEnd(12)} → banner ${(bannerSvg.length / 1024).toFixed(0)}KB${emailSize ? ', email ' + (emailSize / 1024).toFixed(0) + 'KB' : ' (skipped email — uses main welcome)'}`);
  }

  console.log('\n═══ STEP 4: GALLERY ═══');
  const gallery = buildGalleryHTML(FLAVOURS);
  fs.writeFileSync(path.join(__dirname, '../emails/variants-gallery.html'), gallery);
  console.log(`  ✓ gallery written (${(gallery.length / 1024).toFixed(0)}KB)`);

  console.log('\n═══ STEP 5: STATIC GMAIL MOCKS (Netlify-ready) ═══');
  const mocksDir = path.join(__dirname, '../emails/mocks');
  if (!fs.existsSync(mocksDir)) fs.mkdirSync(mocksDir, { recursive: true });
  for (const flavor of FLAVOURS) {
    const mock = buildGmailMockStatic(flavor);
    fs.writeFileSync(path.join(mocksDir, `gmail-welcome-${flavor.id}.html`), mock);
    console.log(`  ✓ gmail-welcome-${flavor.id}.html (${(mock.length / 1024).toFixed(0)}KB)`);
  }

  console.log('\n✓ DONE. Open /emails/variants-gallery.html to see the gallery.\n');
}

main().catch(console.error);
