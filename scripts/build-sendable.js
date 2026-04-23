/**
 * build-sendable.js
 *
 * Produces a SELF-CONTAINED Gmail-compatible HTML email:
 *   - All images base64-embedded (inline data URIs) so they render without
 *     needing a public server
 *   - SVG background replaced with a CSS gradient (Gmail strips SVG bgs)
 *   - Pouch inserted as a regular <img> inside the hero
 *   - Video placeholder click-through → Google Drive link
 *   - Merge tags resolved
 *
 * Usage:  node scripts/build-sendable.js <flavor> <firstName>
 *         node scripts/build-sendable.js melon Alex
 */

const fs = require('fs');
const path = require('path');
const { Jimp, ResizeStrategy } = require('jimp');

const flavorId = (process.argv[2] || 'melon').toLowerCase();
const firstName = process.argv[3] || 'Alex';

// ────────────────────────────────────────────────────────────
// Flavor theme map (matches build-variants.js)
// ────────────────────────────────────────────────────────────
const THEMES = {
  berry:       { name: 'Purple Punch',       primary: '#8C1470', deep: '#2E0428', light: '#D040A8', darkest: '#1A0014', accent: '#FFDD00', accentHot: '#FF5600', body: '#8B1468' },
  peach:       { name: 'Peach Flame',        primary: '#FF7550', deep: '#8B2410', light: '#FFAE8A', darkest: '#2A0A04', accent: '#FFCC33', accentHot: '#FF3820', body: '#D84820' },
  wintergreen: { name: 'Wintergreen Malla',  primary: '#4D9A3F', deep: '#153815', light: '#8BC878', darkest: '#0A1E0A', accent: '#FFE040', accentHot: '#FF5600', body: '#2E6B28' },
  melon:       { name: 'Melon Blaze',        primary: '#E05030', deep: '#5A0A0A', light: '#FF9070', darkest: '#200505', accent: '#FFE040', accentHot: '#FFB020', body: '#A82820' },
  mango:       { name: 'Mango Rush',         primary: '#FFA41F', deep: '#8A4A00', light: '#FFD070', darkest: '#2A1400', accent: '#FFEE50', accentHot: '#FF3820', body: '#B86D00' },
  mint:        { name: 'Jalapeño Glow',      primary: '#1D9E6F', deep: '#0A3524', light: '#4DD5A0', darkest: '#051810', accent: '#E8FCF0', accentHot: '#FFDD00', body: '#117048' },
  cafe:        { name: 'Smooth Cappuccino',  primary: '#8C6850', deep: '#2A180C', light: '#C8A485', darkest: '#14090A', accent: '#E8D5B0', accentHot: '#FFA45A', body: '#5D3D2A' },
  blue:        { name: 'Mint Freeze',        primary: '#1E8FF0', deep: '#0A2850', light: '#6FC0FF', darkest: '#050F28', accent: '#FFDD00', accentHot: '#FF5600', body: '#0858B8' }
};

const t = THEMES[flavorId];
if (!t) {
  console.error('Unknown flavor:', flavorId, '— valid:', Object.keys(THEMES).join(', '));
  process.exit(1);
}

console.log('Building sendable email:', t.name, '→', firstName);

// ────────────────────────────────────────────────────────────
// Inline the key assets as base64 data URIs — resize for email size limit
// ────────────────────────────────────────────────────────────
async function b64Resized(relPath, maxWidth) {
  const full = path.join(__dirname, '..', 'public', relPath);
  const img = await Jimp.read(full);
  if (img.bitmap.width > maxWidth) {
    const scale = maxWidth / img.bitmap.width;
    img.resize({ w: maxWidth, h: Math.round(img.bitmap.height * scale), mode: ResizeStrategy.BILINEAR });
  }
  const buf = await img.getBuffer('image/png');
  return `data:image/png;base64,${buf.toString('base64')}`;
}

const VIDEO_LINK = 'https://drive.google.com/file/d/1ukvCUPhwBbE6CQv1kpA3KncI9NUWKCq1/view';

async function buildEmail() {
  // Aggressive sizing to keep email under 75KB so it easily fits in tool calls
  const LOGO_WHITE = await b64Resized('images/n1ce-logo-white.png', 160);
  const POUCH = await b64Resized(`images/pouches/${flavorId}.png`, 140);

  console.log('  logo    :', (LOGO_WHITE.length / 1024).toFixed(0), 'KB');
  console.log('  pouch   :', (POUCH.length / 1024).toFixed(0), 'KB');

  return { LOGO_WHITE, POUCH };
}

// ────────────────────────────────────────────────────────────
// Build the Gmail-safe HTML
// ────────────────────────────────────────────────────────────
(async () => {
const { LOGO_WHITE, POUCH } = await buildEmail();
const html = `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to N1CE Circle, ${firstName}.</title>
</head>
<body style="margin:0; padding:0; background-color:#FAF7F2;">
  <div style="display:none; font-size:1px; color:#FAF7F2; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
    ${firstName}, you're in. A personal message from Justin Gaethje + your member link inside.
  </div>

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#FAF7F2;">
    <tr>
      <td align="center" style="padding:0;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="width:600px; max-width:600px; background-color:#FAF7F2;">

          <!-- ═══ HERO ═══ — solid gradient bg (Gmail strips SVG bgs), pouch as inline <img> -->
          <tr>
            <td valign="middle" align="left"
                bgcolor="${t.primary}"
                style="background:${t.primary}; background:linear-gradient(160deg, ${t.primary} 0%, ${t.body} 35%, ${t.deep} 70%, ${t.darkest} 100%); padding:60px 48px 72px;">

              <img src="${LOGO_WHITE}" width="140" alt="N1CE" style="display:block; width:140px; max-width:140px; margin:0 0 32px 0; border:0;"/>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td valign="middle" width="60%">
                    <p style="margin:0 0 14px; font-family:'Oswald','Arial Narrow',sans-serif; font-size:11px; letter-spacing:0.35em; text-transform:uppercase; color:${t.accent}; font-weight:700;">Circle / ${t.name}</p>

                    <h1 style="margin:0 0 20px; font-family:'Anton','Arial Black',sans-serif; font-size:64px; line-height:0.92; letter-spacing:-0.02em; color:#FFFFFF; text-transform:uppercase; text-shadow:0 4px 20px rgba(0,0,0,0.5);">
                      Welcome,<br/>
                      <span style="color:${t.light};">${firstName}<span style="color:${t.accentHot};">.</span></span>
                    </h1>

                    <p style="margin:0; font-family:'JetBrains Mono','Courier New',monospace; font-size:14px; color:#FAF7F2; line-height:1.7; text-shadow:0 2px 8px rgba(0,0,0,0.4);">
                      Thanks for joining the N1CE Circle.
                    </p>
                  </td>
                  <td valign="middle" align="right" width="40%">
                    <img src="${POUCH}" width="200" alt="${t.name}" style="display:block; width:200px; max-width:200px; border:0; margin:0 0 0 auto;"/>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Thin themed divider -->
          <tr><td style="height:6px; line-height:6px; font-size:0; background:${t.accentHot};">&nbsp;</td></tr>

          <!-- ═══ A MESSAGE FOR YOU / FROM JUSTIN ═══ -->
          <tr>
            <td style="background-color:#FAF7F2; padding:44px 48px 36px;">
              <p style="margin:0 0 14px; font-family:'Oswald','Arial',sans-serif; font-size:11px; letter-spacing:0.3em; color:${t.accentHot}; text-transform:uppercase; font-weight:700;">A message for you</p>
              <h2 style="margin:0 0 28px; font-family:'Anton','Arial Black',sans-serif; font-size:46px; line-height:1; color:#0A0A0A; text-transform:uppercase; letter-spacing:-0.01em;">From <span style="color:${t.primary};">Justin.</span></h2>

              <!-- Video click-through card → Google Drive -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="padding:3px; background-color:${t.accentHot};">
                    <a href="${VIDEO_LINK}" style="text-decoration:none; color:inherit;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#0A0A0A;">
                        <tr>
                          <td align="center" valign="middle" height="280" style="height:280px; background-color:#0A0A0A;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                              <tr>
                                <td align="center" valign="middle" width="90" height="90" style="width:90px; height:90px; background-color:${t.accentHot}; border-radius:50%; border:4px solid #FFFFFF;">
                                  <span style="font-family:Arial,sans-serif; font-size:36px; color:#FFFFFF; line-height:1; padding-left:8px;">&#9654;</span>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td style="background-color:#0A0A0A; padding:14px 18px;" align="left">
                            <span style="font-family:'Oswald','Arial',sans-serif; font-size:11px; letter-spacing:0.25em; color:${t.accent}; text-transform:uppercase;">&#9654; Personalized for ${firstName} / Tap to play</span>
                          </td>
                        </tr>
                      </table>
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ═══ REFERRAL — BRING A FRIEND ═══ -->
          <tr>
            <td valign="middle" bgcolor="${t.darkest}" style="background:${t.darkest}; background:linear-gradient(160deg, ${t.darkest} 0%, ${t.primary} 55%, ${t.body} 100%); padding:48px 48px 56px;">

              <p style="margin:0 0 14px; font-family:'Oswald','Arial',sans-serif; font-size:11px; letter-spacing:0.3em; color:${t.accent}; text-transform:uppercase; font-weight:700;">Your Member Link</p>

              <h2 style="margin:0 0 18px; font-family:'Anton','Arial Black',sans-serif; font-size:52px; line-height:0.95; color:#FFFFFF; text-transform:uppercase; letter-spacing:-0.02em;">Bring a<br/><span style="color:${t.light};">friend.</span></h2>

              <p style="margin:0 0 28px; font-family:'JetBrains Mono','Courier New',monospace; font-size:14px; color:#FAF7F2; line-height:1.65; max-width:440px;">Share your link. Anyone who joins through it goes into the draw too.</p>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="background-color:#0A0A0A; border-left:4px solid ${t.accentHot}; padding:22px 24px;" align="left">
                    <p style="margin:0 0 10px; font-family:'Oswald','Arial',sans-serif; font-size:10px; letter-spacing:0.3em; color:${t.accent}; text-transform:uppercase; font-weight:700;">Your link</p>
                    <div style="font-family:'JetBrains Mono','Courier New',monospace; font-size:15px; color:#FFFFFF; word-break:break-all; font-weight:700;">n1ce.com/r/${firstName.toUpperCase().replace(/\W/g, '').slice(0, 8)}${'XYZ'}</div>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px;">
                <tr>
                  <td bgcolor="${t.accentHot}" align="center" style="background-color:${t.accentHot};">
                    <a href="https://n1ce.com/r/${firstName.toUpperCase().replace(/\W/g, '').slice(0, 8)}XYZ" style="display:inline-block; padding:16px 36px; font-family:'Anton','Arial Black',sans-serif; font-size:17px; letter-spacing:0.1em; color:#FFFFFF; text-decoration:none; text-transform:uppercase; font-weight:700;">Share My Link &rarr;</a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ═══ FOOTER ═══ (no image — keeps email under Gmail's 102KB) -->
          <tr>
            <td bgcolor="#0A0A0A" style="background-color:#0A0A0A; padding:36px 32px;" align="center">
              <p style="margin:0 0 18px; font-family:'Anton','Arial Black',sans-serif; font-size:32px; letter-spacing:0.05em; color:#FFFFFF;">N1CE<span style="color:${t.accentHot};">.</span></p>
              <p style="margin:0 0 14px; font-family:'Oswald','Arial',sans-serif; font-size:11px; letter-spacing:0.3em; color:${t.light}; text-transform:uppercase; font-weight:700;">
                <a href="#" style="color:${t.light}; text-decoration:none;">Instagram</a> &middot; <a href="#" style="color:${t.accentHot}; text-decoration:none;">TikTok</a> &middot; <a href="#" style="color:${t.accent}; text-decoration:none;">Contact</a>
              </p>
              <p style="margin:0 0 6px; font-family:'JetBrains Mono','Courier New',monospace; font-size:11px; color:#FAF7F2; opacity:0.55;">N1CE / Stockholm, Sweden</p>
              <p style="margin:0; font-family:'JetBrains Mono','Courier New',monospace; font-size:10px; color:#FAF7F2; opacity:0.45;">© 2026 N1CE &middot; <a href="#" style="color:#FAF7F2; text-decoration:underline;">Unsubscribe</a> &middot; Must be 21+</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const outPath = path.join(__dirname, `../emails/sendable-${flavorId}-${firstName.toLowerCase()}.html`);
fs.writeFileSync(outPath, html);
console.log('✓ Wrote:', outPath, `(${(html.length/1024).toFixed(0)} KB)`);
})();
