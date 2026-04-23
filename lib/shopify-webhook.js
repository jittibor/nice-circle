/**
 * lib/shopify-webhook.js
 *
 * Receives Shopify customer-signup webhooks and sends the personalised
 * welcome email to the new customer.
 *
 * Security:  Verifies Shopify's HMAC-SHA256 signature using the shared secret.
 *            Any request with a missing or wrong signature is rejected 401.
 *
 * Email:     Uses Nodemailer over SMTP (free: Gmail / Outlook / Zoho / SES).
 *            No paid API keys required.
 *
 * Flavour:   Determined from the customer's Shopify tags in priority:
 *              1. Explicit tag matching a known flavour (peach, melon, etc.)
 *              2. "circle-club" tag → falls back to DEFAULT_FLAVOR
 *              3. Anything else → falls back to DEFAULT_FLAVOR
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const KNOWN_FLAVORS = ['berry', 'peach', 'wintergreen', 'melon', 'mango', 'mint', 'cafe', 'blue'];

// ─────────────────────────────────────────────────────────────
//  HMAC SIGNATURE VERIFICATION
//  Shopify signs each webhook body with your shared secret.
//  We recompute and timing-safe compare. Reject on mismatch.
// ─────────────────────────────────────────────────────────────
function verifyShopifySignature(rawBody, providedSignature, secret) {
  if (!providedSignature || !secret) return false;
  const computed = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('base64');
  const a = Buffer.from(computed, 'base64');
  const b = Buffer.from(providedSignature, 'base64');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ─────────────────────────────────────────────────────────────
//  FLAVOUR ROUTING
//  Read the customer's tags — find the matching flavour, or use default.
// ─────────────────────────────────────────────────────────────
function pickFlavorFromCustomer(customer, defaultFlavor) {
  // Shopify tags come as a comma-separated string: "circle-club, peach, vip"
  const tags = String(customer.tags || '')
    .split(',')
    .map(t => t.trim().toLowerCase());

  for (const tag of tags) {
    if (KNOWN_FLAVORS.includes(tag)) return tag;
  }

  // Check metafield if present (customer.metafields.favorite_flavor)
  const metaFlavor = String(customer.metafields?.favorite_flavor || '').toLowerCase();
  if (KNOWN_FLAVORS.includes(metaFlavor)) return metaFlavor;

  return defaultFlavor || 'berry';
}

// ─────────────────────────────────────────────────────────────
//  EMAIL TEMPLATE LOADING + MERGE-TAG SUBSTITUTION
//  Reads the production HTML for the chosen flavour and
//  substitutes the Klaviyo-style merge tags with real values.
//  (When Klaviyo sends the email, Klaviyo does this step. Here we
//  do it ourselves so the webhook can send directly via SMTP.)
// ─────────────────────────────────────────────────────────────
function loadAndRenderTemplate(flavor, { firstName, referralCode, unsubscribeUrl }) {
  const templatePath = path.join(__dirname, '..', 'emails', 'production', `welcome-${flavor}.html`);
  let html = fs.readFileSync(templatePath, 'utf8');

  const safeName = escapeHtml(firstName || 'Friend');
  const safeRef = escapeHtml(referralCode || 'YOURCODE');

  // Replace Klaviyo's {% if person|lookup:"first_name" %}…{% endif %} block
  const ifBlock = /\{% if person\|lookup:"first_name" %\}\{\{ person\|lookup:"first_name" \}\}\{% else %\}Friend\{% endif %\}/g;
  html = html.replace(ifBlock, safeName);

  // Replace the simpler {{ person|lookup:"first_name"|default:"Friend" }} shorthand
  html = html.replace(/\{\{ person\|lookup:"first_name"\|default:"Friend" \}\}/g, safeName);

  // Replace the referral-code tag
  html = html.replace(/\{\{ event\.referral_code\|default:"YOURCODE" \}\}/g, safeRef);

  // Replace unsubscribe tag
  html = html.replace(/\{% unsubscribe %\}/g, unsubscribeUrl || '#');

  return html;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function capitalize(s) {
  if (!s) return '';
  s = String(s).trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─────────────────────────────────────────────────────────────
//  SMTP TRANSPORT — shared pooled transporter, created lazily.
//
//  Pooling is critical for high-volume sending (Amazon SES, Resend).
//  Enable it with SMTP_POOL=true once you're off Gmail. With pooling:
//    - MAX_CONNECTIONS parallel SMTP sockets
//    - MAX_MESSAGES per socket before it recycles
//    - Automatic rate limiting so you don't get throttled
//  Result: 10,000+ emails/day happily, up to SES's 100k/day limit
//  on warmed IPs.
// ─────────────────────────────────────────────────────────────
let _transporter = null;
function getTransporter() {
  if (_transporter) return _transporter;
  const pool = String(process.env.SMTP_POOL || 'false').toLowerCase() === 'true';
  const cfg = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: String(process.env.SMTP_SECURE || 'true').toLowerCase() === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  };
  if (pool) {
    cfg.pool = true;
    cfg.maxConnections = parseInt(process.env.SMTP_MAX_CONNECTIONS || '10', 10);
    cfg.maxMessages = parseInt(process.env.SMTP_MAX_MESSAGES || '100', 10);
    // SES supports roughly 14 emails/sec on a new account.
    // rateLimit throttles sends automatically.
    cfg.rateLimit = parseInt(process.env.SMTP_RATE_LIMIT || '14', 10);
  }
  _transporter = nodemailer.createTransport(cfg);
  return _transporter;
}

// ─────────────────────────────────────────────────────────────
//  SEND EMAIL — the main function the webhook + test endpoint both use
// ─────────────────────────────────────────────────────────────
async function sendWelcomeEmail({ toEmail, firstName, flavor, referralCode }) {
  const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER;
  const fromName = process.env.FROM_NAME || 'N1CE Circle';
  const cleanName = capitalize(firstName);

  const html = loadAndRenderTemplate(flavor, {
    firstName: cleanName,
    referralCode,
    unsubscribeUrl: `https://n1ce.com/unsubscribe?email=${encodeURIComponent(toEmail)}`
  });

  const subject = cleanName
    ? `Welcome to N1CE Circle, ${cleanName}.`
    : `Welcome to N1CE Circle.`;

  // Plain-text fallback (shown in clients that block HTML)
  const textBody =
`Welcome to N1CE Circle${cleanName ? ', ' + cleanName : ''}.

Thanks for joining the N1CE Circle. A personal message from Justin is waiting for you.

Your referral link: https://n1ce.com/r/${referralCode || 'YOURCODE'}

Watch the video: https://${process.env.BASE_URL?.replace(/^https?:\/\//, '') || 'n1ce.com'}/video-play.html

— N1CE
Stockholm, Sweden | Must be 21+`;

  const info = await getTransporter().sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: toEmail,
    subject,
    text: textBody,
    html
  });

  console.log(`[email] → ${toEmail} [${flavor}] messageId=${info.messageId}`);
  return { messageId: info.messageId, flavor, subject };
}

// ─────────────────────────────────────────────────────────────
//  EXPRESS HANDLER FACTORY
//  Mounts two endpoints on the provided app:
//    POST /webhook/shopify/customer-created   — the live webhook
//    POST /webhook/test                       — manual test trigger
// ─────────────────────────────────────────────────────────────
function mountRoutes(app, express) {
  // Shopify's webhook body is JSON. We need the RAW bytes for HMAC check,
  // so we use express.raw() and parse the JSON ourselves inside the handler.
  const rawJson = express.raw({ type: 'application/json', limit: '1mb' });

  app.post('/webhook/shopify/customer-created', rawJson, async (req, res) => {
    try {
      const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : '';
      const sig = req.headers['x-shopify-hmac-sha256'];
      const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

      if (!secret) {
        console.error('[webhook] SHOPIFY_WEBHOOK_SECRET not configured');
        return res.status(500).json({ ok: false, error: 'server_not_configured' });
      }

      if (!verifyShopifySignature(rawBody, sig, secret)) {
        console.warn('[webhook] HMAC mismatch — rejected');
        return res.status(401).json({ ok: false, error: 'invalid_signature' });
      }

      const customer = JSON.parse(rawBody);
      const email = customer.email;
      if (!email) return res.status(400).json({ ok: false, error: 'no_email' });

      // Only send to customers tagged "circle-club"
      const tags = String(customer.tags || '').toLowerCase();
      if (!tags.split(',').map(t => t.trim()).includes('circle-club')) {
        console.log(`[webhook] skipping ${email} — no circle-club tag`);
        // Respond 200 anyway so Shopify stops retrying
        return res.json({ ok: true, skipped: 'no_circle_club_tag' });
      }

      const flavor = pickFlavorFromCustomer(customer, process.env.DEFAULT_FLAVOR || 'berry');
      const firstName = customer.first_name || customer.firstName || '';
      const referralCode = customer.metafields?.referral_code
        || generateReferralCode(customer.id);

      const result = await sendWelcomeEmail({
        toEmail: email,
        firstName,
        flavor,
        referralCode
      });

      return res.json({ ok: true, sent: result });
    } catch (err) {
      console.error('[webhook] error:', err);
      // 200 so Shopify doesn't retry forever on bugs, but log them
      return res.status(200).json({ ok: false, error: err.message });
    }
  });

  // Manual test — hit this from the presentation or curl to fire a sample
  app.post('/webhook/test', express.json(), async (req, res) => {
    try {
      const { email, firstName, flavor } = req.body || {};
      if (!email) return res.status(400).json({ ok: false, error: 'email required' });
      const chosenFlavor = KNOWN_FLAVORS.includes((flavor || '').toLowerCase())
        ? flavor.toLowerCase()
        : (process.env.DEFAULT_FLAVOR || 'berry');

      const result = await sendWelcomeEmail({
        toEmail: email,
        firstName: firstName || 'Friend',
        flavor: chosenFlavor,
        referralCode: 'PREVIEW' + Math.random().toString(36).slice(2, 7).toUpperCase()
      });
      return res.json({ ok: true, sent: result });
    } catch (err) {
      console.error('[test] error:', err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  console.log('[webhook] mounted /webhook/shopify/customer-created + /webhook/test');
}

// ─────────────────────────────────────────────────────────────
//  UTIL — generate a referral code from customer id
// ─────────────────────────────────────────────────────────────
function generateReferralCode(customerId) {
  const seed = String(customerId || Date.now());
  const hash = crypto.createHash('md5').update(seed).digest('hex');
  return hash.slice(0, 8).toUpperCase();
}

module.exports = {
  mountRoutes,
  sendWelcomeEmail,
  verifyShopifySignature,
  pickFlavorFromCustomer,
  loadAndRenderTemplate,
  KNOWN_FLAVORS
};
