/**
 * build-production-emails.js
 *
 * Generates the FINAL production-ready welcome emails for all 8 flavours.
 * Output goes to emails/production/ and is ready for Klaviyo / Shopify Email.
 *
 * Why this exists vs. the dev variants:
 *   - All asset URLs are absolute (served from BASE_URL, e.g. Netlify CDN)
 *   - Merge tags use Klaviyo/Shopify syntax: {% if person.first_name %}…
 *   - Inline <video> replaced with a static play-thumbnail click-through
 *     (no email client supports inline video — this is the industry standard)
 *   - No <script> tags (email clients strip them)
 *   - All CSS inline (no external stylesheets, no <head><style>)
 *
 * Usage:
 *   BASE_URL=https://n1ce-circle.netlify.app node scripts/build-production-emails.js
 *   # or defaults to the placeholder if no env
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'https://YOUR-SITE.netlify.app';
const VIDEO_URL = process.env.VIDEO_URL || `${BASE_URL}/videos/message-for-you.mp4`;
const VIDEO_LANDING_URL = process.env.VIDEO_LANDING_URL || `${BASE_URL}/video-play.html`;

console.log('─'.repeat(60));
console.log('Building production emails');
console.log('  BASE_URL:', BASE_URL);
console.log('  VIDEO_URL:', VIDEO_URL);
console.log('  VIDEO_LANDING:', VIDEO_LANDING_URL);
console.log('─'.repeat(60));

// ─────────────────────────────────────────────────────────────
//  Merge-tag dialect — defaults to Klaviyo syntax (also works in
//  Shopify Email as-is for simple first-name substitution).
//  Customer signs up on Shopify → Klaviyo receives profile →
//  flow fires → these tags get substituted.
// ─────────────────────────────────────────────────────────────
const TAG = {
  firstNameOrDefault: '{% if person|lookup:"first_name" %}{{ person|lookup:"first_name" }}{% else %}Friend{% endif %}',
  firstName: '{{ person|lookup:"first_name"|default:"Friend" }}',
  referralCode: '{{ event.referral_code|default:"YOURCODE" }}'
};

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

// ─────────────────────────────────────────────────────────────
//  Build email for one flavour
// ─────────────────────────────────────────────────────────────
function buildEmail(flavorId) {
  const t = THEMES[flavorId];
  const pouchUrl = `${BASE_URL}/images/pouches/${flavorId}.png`;
  const logoUrl = `${BASE_URL}/images/n1ce-logo-white.png`;
  const videoPoster = `${BASE_URL}/images/video-poster.jpg`; // optional poster frame

  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <title>Welcome to N1CE Circle</title>
  <!--[if mso]>
  <style>body,table,td{font-family:Arial,sans-serif !important;}</style>
  <![endif]-->
</head>
<body style="margin:0; padding:0; background-color:#FAF7F2; font-family:Arial,Helvetica,sans-serif;">

  <!-- Pre-header (hidden preview text shown in inbox list) -->
  <div style="display:none; font-size:1px; color:#FAF7F2; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
    ${TAG.firstNameOrDefault}, you're in. A personal message from Justin Gaethje + your member link inside.
  </div>

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#FAF7F2;">
    <tr>
      <td align="center" style="padding:0;">

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="width:600px; max-width:600px; background-color:#FAF7F2;">

          <!-- ════════════════ HERO ════════════════ -->
          <tr>
            <td valign="middle" align="left"
                bgcolor="${t.primary}"
                style="background:${t.primary}; background:linear-gradient(160deg, ${t.primary} 0%, ${t.body} 35%, ${t.deep} 70%, ${t.darkest} 100%); padding:60px 48px 72px;">

              <img src="${logoUrl}" width="140" alt="N1CE" style="display:block; width:140px; max-width:140px; margin:0 0 32px 0; border:0;" />

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td valign="middle" width="60%" style="width:60%;">
                    <p style="margin:0 0 14px; font-family:Arial,sans-serif; font-size:11px; letter-spacing:3.5px; text-transform:uppercase; color:${t.accent}; font-weight:700;">Circle &nbsp;/&nbsp; ${t.name}</p>
                    <h1 style="margin:0 0 20px; font-family:'Arial Black',sans-serif; font-size:54px; line-height:0.95; letter-spacing:-1px; color:#FFFFFF; text-transform:uppercase;">
                      Welcome,<br/>
                      <span style="color:${t.light};">${TAG.firstNameOrDefault}<span style="color:${t.accentHot};">.</span></span>
                    </h1>
                    <p style="margin:0; font-family:'Courier New',monospace; font-size:14px; color:#FAF7F2; line-height:1.7;">
                      Thanks for joining the N1CE Circle.
                    </p>
                  </td>
                  <td valign="middle" align="right" width="40%" style="width:40%;">
                    <img src="${pouchUrl}" width="200" alt="${t.name}" style="display:block; width:200px; max-width:200px; border:0; margin:0 0 0 auto;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- themed divider -->
          <tr><td bgcolor="${t.accentHot}" style="height:6px; line-height:6px; font-size:0; background:${t.accentHot};">&nbsp;</td></tr>

          <!-- ════════════════ VIDEO ════════════════ -->
          <tr>
            <td bgcolor="#FAF7F2" style="background-color:#FAF7F2; padding:44px 48px 36px;">
              <p style="margin:0 0 14px; font-family:Arial,sans-serif; font-size:11px; letter-spacing:3px; color:${t.accentHot}; text-transform:uppercase; font-weight:700;">A message for you</p>
              <h2 style="margin:0 0 28px; font-family:'Arial Black',sans-serif; font-size:46px; line-height:1; color:#0A0A0A; text-transform:uppercase; letter-spacing:-0.5px;">From <span style="color:${t.primary};">Justin.</span></h2>

              <!-- Click-through video card: static thumbnail with play overlay.
                   Links to a landing page that hosts the real video (or direct to video). -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td bgcolor="${t.accentHot}" style="padding:3px; background-color:${t.accentHot};">
                    <a href="${VIDEO_LANDING_URL}" target="_blank" style="text-decoration:none; color:inherit; display:block;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#0A0A0A;">
                        <tr>
                          <td align="center" valign="middle" height="280" background="${videoPoster}" bgcolor="#0A0A0A" style="height:280px; background-color:#0A0A0A; background-image:url('${videoPoster}'); background-size:cover; background-position:center;">
                            <!--[if gte mso 9]>
                            <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:504px; height:280px;">
                              <v:fill type="frame" src="${videoPoster}" color="#0A0A0A" />
                              <v:textbox inset="0,0,0,0">
                            <![endif]-->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                              <tr>
                                <td align="center" valign="middle" width="90" height="90" bgcolor="${t.accentHot}" style="width:90px; height:90px; background-color:${t.accentHot}; border-radius:50%; border:4px solid #FFFFFF;">
                                  <span style="font-family:Arial,sans-serif; font-size:36px; color:#FFFFFF; line-height:1; padding-left:8px;">&#9654;</span>
                                </td>
                              </tr>
                            </table>
                            <!--[if gte mso 9]>
                              </v:textbox>
                            </v:rect>
                            <![endif]-->
                          </td>
                        </tr>
                        <tr>
                          <td bgcolor="#0A0A0A" style="background-color:#0A0A0A; padding:14px 18px;" align="left">
                            <span style="font-family:Arial,sans-serif; font-size:11px; letter-spacing:2.5px; color:${t.accent}; text-transform:uppercase;">&#9654; Personalized for ${TAG.firstNameOrDefault} &nbsp;/&nbsp; Tap to play</span>
                          </td>
                        </tr>
                      </table>
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ════════════════ REFERRAL ════════════════ -->
          <tr>
            <td valign="middle" bgcolor="${t.darkest}" style="background:${t.darkest}; background:linear-gradient(160deg, ${t.darkest} 0%, ${t.primary} 55%, ${t.body} 100%); padding:48px 48px 56px;">

              <p style="margin:0 0 14px; font-family:Arial,sans-serif; font-size:11px; letter-spacing:3px; color:${t.accent}; text-transform:uppercase; font-weight:700;">Your Member Link</p>
              <h2 style="margin:0 0 18px; font-family:'Arial Black',sans-serif; font-size:52px; line-height:0.95; color:#FFFFFF; text-transform:uppercase; letter-spacing:-1px;">Bring a<br/><span style="color:${t.light};">friend.</span></h2>
              <p style="margin:0 0 28px; font-family:'Courier New',monospace; font-size:14px; color:#FAF7F2; line-height:1.65; max-width:440px;">Share your link. Anyone who joins through it goes into the draw too.</p>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td bgcolor="#0A0A0A" style="background-color:#0A0A0A; border-left:4px solid ${t.accentHot}; padding:22px 24px;" align="left">
                    <p style="margin:0 0 10px; font-family:Arial,sans-serif; font-size:10px; letter-spacing:3px; color:${t.accent}; text-transform:uppercase; font-weight:700;">Your link</p>
                    <div style="font-family:'Courier New',monospace; font-size:15px; color:#FFFFFF; word-break:break-all; font-weight:700;">n1ce.com/r/${TAG.referralCode}</div>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px;">
                <tr>
                  <td bgcolor="${t.accentHot}" align="center" style="background-color:${t.accentHot};">
                    <a href="https://n1ce.com/r/${TAG.referralCode}" style="display:inline-block; padding:16px 36px; font-family:'Arial Black',sans-serif; font-size:17px; letter-spacing:1.5px; color:#FFFFFF; text-decoration:none; text-transform:uppercase; font-weight:700;">Share My Link &rarr;</a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ════════════════ FOOTER ════════════════ -->
          <tr>
            <td bgcolor="#0A0A0A" style="background-color:#0A0A0A; padding:36px 32px;" align="center">
              <img src="${logoUrl}" width="80" alt="N1CE" style="display:block; width:80px; max-width:80px; margin:0 auto 18px auto; border:0;" />
              <p style="margin:0 0 14px; font-family:Arial,sans-serif; font-size:11px; letter-spacing:3px; color:${t.light}; text-transform:uppercase; font-weight:700;">
                <a href="#" style="color:${t.light}; text-decoration:none;">Instagram</a> &middot;
                <a href="#" style="color:${t.accentHot}; text-decoration:none;">TikTok</a> &middot;
                <a href="#" style="color:${t.accent}; text-decoration:none;">Contact</a>
              </p>
              <p style="margin:0 0 6px; font-family:'Courier New',monospace; font-size:11px; color:#FAF7F2; opacity:0.55;">N1CE / Stockholm, Sweden</p>
              <p style="margin:0; font-family:'Courier New',monospace; font-size:10px; color:#FAF7F2; opacity:0.45;">© 2026 N1CE &middot; <a href="{% unsubscribe %}" style="color:#FAF7F2; text-decoration:underline;">Unsubscribe</a> &middot; Must be 21+</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────
//  Write all 8 production emails
// ─────────────────────────────────────────────────────────────
const outDir = path.join(__dirname, '..', 'emails', 'production');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

Object.keys(THEMES).forEach(id => {
  const html = buildEmail(id);
  const outPath = path.join(outDir, `welcome-${id}.html`);
  fs.writeFileSync(outPath, html);
  console.log(`  ✓ welcome-${id}.html  (${(html.length / 1024).toFixed(1)} KB)`);
});

// Also build a simple video landing page (what the play button links to).
const videoLandingHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>A message from Justin · N1CE Circle</title>
  <style>
    html, body { margin:0; padding:0; background:#0A0A0A; color:#FAF7F2; font-family:'Oswald',Arial,sans-serif; min-height:100vh; display:flex; align-items:center; justify-content:center; }
    .wrap { text-align:center; max-width:720px; padding:24px; }
    video { width:100%; max-width:720px; border-radius:8px; box-shadow:0 8px 40px rgba(0,0,0,0.5); background:#000; }
    h1 { font-family:'Anton',Arial Black,sans-serif; font-size:48px; margin:0 0 8px; text-transform:uppercase; letter-spacing:-1px; }
    h1 .dot { color:#FF5600; }
    p { font-family:'JetBrains Mono',monospace; font-size:14px; color:rgba(255,255,255,0.7); margin:0 0 32px; }
  </style>
  <link href="https://fonts.googleapis.com/css2?family=Anton&family=Oswald:wght@500;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
</head>
<body>
  <div class="wrap">
    <h1>From Justin<span class="dot">.</span></h1>
    <p>A personal message for you.</p>
    <video controls autoplay playsinline preload="auto" src="${VIDEO_URL}" poster="${BASE_URL}/images/video-poster.jpg"></video>
  </div>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, '..', 'public', 'video-play.html'), videoLandingHtml);
console.log(`\n  ✓ /video-play.html (landing page for the video click-through)`);

console.log('\n─'.repeat(60));
console.log('Done. Next steps:');
console.log('  1. Deploy assets to Netlify (netlify deploy --prod)');
console.log('  2. Re-run with real BASE_URL:');
console.log('     BASE_URL=https://your-site.netlify.app node scripts/build-production-emails.js');
console.log('  3. Paste emails/production/welcome-{flavor}.html into Klaviyo');
console.log('  4. See SHOPIFY-KLAVIYO-SETUP.md for the full integration flow');
console.log('─'.repeat(60));
