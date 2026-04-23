const express = require('express');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
require('dotenv').config();

const shopifyWebhook = require('./lib/shopify-webhook');

const app = express();
app.use(cors());

// IMPORTANT: mount the webhook routes BEFORE express.json() so the raw
// body is preserved for HMAC verification.
shopifyWebhook.mountRoutes(app, express);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
// Netlify-parity: serve /emails/* as static files so the same URLs work locally
app.use('/emails', express.static(path.join(__dirname, 'emails')));

// Friendly routes for landing pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'signup.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, 'public', 'signup.html')));

// Demo signup → simulated Gmail inbox
app.get('/join', (req, res) => res.sendFile(path.join(__dirname, 'public', 'join.html')));
app.get('/demo', (req, res) => res.sendFile(path.join(__dirname, 'public', 'join.html')));

// Presentation slide (for the client pitch)
app.get('/presentation', (req, res) => res.sendFile(path.join(__dirname, 'public', 'presentation.html')));
app.get('/pitch', (req, res) => res.sendFile(path.join(__dirname, 'public', 'presentation.html')));

// Operator margin dashboard (INTERNAL — not for client)
app.get('/operator', (req, res) => res.sendFile(path.join(__dirname, 'public', 'operator.html')));
app.get('/margin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'operator.html')));
app.get('/internal', (req, res) => res.sendFile(path.join(__dirname, 'public', 'operator.html')));

// ═══════════════════════════════════════════════════════════════════
// MOCK EMAIL PRESET NAMES — for the Gmail-mock "send as" dropdown
// ═══════════════════════════════════════════════════════════════════
const MOCK_NAMES = ['Minou', 'Stefan', 'Durim', 'Micheal'];

// Helper: read an email HTML file, pass it through as-is.
// Name substitution + video injection now happens CLIENT-SIDE via the
// inline <script> baked into each email (Netlify-compatible). We keep
// this server-side wrapper minimal so both environments behave the same.
function serveWithName(filePath, req, res) {
  try {
    const html = fs.readFileSync(filePath, 'utf8');
    res.set('Content-Type', 'text/html').send(html);
  } catch (e) {
    console.error('Email serve error:', e);
    res.status(500).send('Failed to load email template');
  }
}
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Email preview routes (for design/testing only) — support ?name=X for merge-tag swap
app.get('/preview/welcome-email', (req, res) =>
  serveWithName(path.join(__dirname, 'emails', 'welcome-email.html'), req, res)
);
app.get('/preview/winner-email', (req, res) =>
  serveWithName(path.join(__dirname, 'emails', 'winner-email.html'), req, res)
);
app.get('/preview/gmail-welcome', (req, res) => res.send(buildGmailWrapper('berry', req.query.name)));
app.get('/preview/gmail-winner', (req, res) => res.sendFile(path.join(__dirname, 'emails', 'gmail-preview-winner.html')));

// ═══ Variants gallery + per-flavour welcome previews ═══
app.get('/preview/variants', (req, res) =>
  res.sendFile(path.join(__dirname, 'emails', 'variants-gallery.html'))
);

const FLAVOR_IDS = ['peach', 'wintergreen', 'melon', 'mango', 'mint', 'cafe', 'blue'];
FLAVOR_IDS.forEach(id => {
  // Plain email preview — supports ?name=X to swap {{firstName}}
  app.get(`/preview/welcome-${id}`, (req, res) =>
    serveWithName(path.join(__dirname, 'emails', 'variants', `welcome-${id}.html`), req, res)
  );
  // Gmail-wrapped preview with name dropdown
  app.get(`/preview/gmail-welcome-${id}`, (req, res) => {
    res.send(buildGmailWrapper(id, req.query.name));
  });
});

// Helper: Gmail-style wrapper around any welcome variant.
// Includes a floating name-selector dropdown for personalising the preview.
function buildGmailWrapper(flavorId, selectedName) {
  // Berry → main welcome-email; all others → variant
  const emailRoute = flavorId === 'berry'
    ? '/preview/welcome-email'
    : `/preview/welcome-${flavorId}`;
  const safeName = (selectedName || '').trim();
  const iframeSrc = safeName ? `${emailRoute}?name=${encodeURIComponent(safeName)}` : emailRoute;
  const displayName = safeName || 'me';

  const namesJSON = JSON.stringify(MOCK_NAMES);

  return `<!DOCTYPE html>
<html><head><title>Gmail · N1CE Circle</title>
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
  .name-picker{margin-left:auto;display:flex;align-items:center;gap:8px;font-family:'Google Sans','Roboto',Arial,sans-serif;font-size:12px;color:#5f6368;}
  .name-picker label{font-weight:500;letter-spacing:0.05em;text-transform:uppercase;}
  .name-picker select{appearance:none;-webkit-appearance:none;background:#f1f3f4;border:1px solid #dadce0;border-radius:18px;padding:6px 30px 6px 14px;font-family:inherit;font-size:13px;color:#202124;cursor:pointer;outline:none;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 14 14'><path fill='%235f6368' d='M3 5l4 4 4-4z'/></svg>");background-repeat:no-repeat;background-position:right 10px center;}
  .name-picker select:hover{background-color:#e8eaed;}
  .name-picker select:focus{border-color:#1a73e8;box-shadow:0 0 0 2px rgba(26,115,232,0.15);}
  .subject-row{padding:24px 48px 0;font-size:22px;}
  .sender-row{padding:16px 48px 20px;border-bottom:1px solid #f1f3f4;color:#5f6368;font-size:12px;}
  .sender-row strong{color:#202124;font-size:14px;}
  .email-body{padding:0;}
  .email-body iframe{width:100%;max-width:620px;height:2400px;border:0;display:block;margin:0 auto;}
</style></head><body>
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
        <span>&larr; &nbsp; 1 of 2,841</span>
        <div class="name-picker">
          <label for="name-select">Send as</label>
          <select id="name-select" onchange="swapName(this.value)">
            <option value="">{{firstName}} (default)</option>
            ${MOCK_NAMES.map(n => `<option value="${n}"${n === safeName ? ' selected' : ''}>${n}</option>`).join('\n            ')}
          </select>
        </div>
      </div>
      <div class="subject-row">Welcome to N1CE Circle${safeName ? ', ' + escapeHtml(safeName) : ''}. <span style="font-size:11px;background:#e8f0fe;color:#1967d2;padding:2px 8px;border-radius:4px;margin-left:8px;">Inbox</span></div>
      <div class="sender-row"><strong>N1CE</strong> &lt;hello@n1ce.com&gt; &middot; to ${escapeHtml(displayName)} &middot; 2:41 PM</div>
      <div class="email-body"><iframe id="email-iframe" src="${iframeSrc}" title="Welcome email"></iframe></div>
    </main>
  </div>
  <script>
    function swapName(name) {
      const base = '${emailRoute}';
      const url = name ? base + '?name=' + encodeURIComponent(name) : base;
      // Navigate the whole page so the subject line and sender row update too.
      const qp = name ? ('?name=' + encodeURIComponent(name)) : '';
      window.location.href = window.location.pathname + qp;
    }
  </script>
</body></html>`;
}

// Short referral link: /r/:code -> referral page with code prefilled
app.get('/r/:code', (req, res) => {
  res.redirect(`/referral.html?ref=${encodeURIComponent(req.params.code)}`);
});

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'nice_circle',
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Utility: Generate referral code (8-char alphanumeric)
function generateReferralCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Utility: Generate member ID
function generateMemberId() {
  return 'NICE-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Utility: Trigger email (mock for now, will integrate with Klaviyo later)
async function triggerEmail(email, firstName, templateType) {
  console.log(`[EMAIL] Triggered: ${templateType} to ${email} (First Name: ${firstName})`);
  // TODO: Connect to Klaviyo/Mailtrap
  return true;
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'N\'ICE Circle Referral System is running' });
});

// ============ SIGNUP ENDPOINTS ============

// POST /api/circle/signup - Standard signup
app.post('/api/circle/signup', async (req, res) => {
  const { firstName, email, phone } = req.body;

  try {
    // Validation
    if (!firstName || firstName.length < 2) {
      return res.status(400).json({ success: false, message: 'First name required (min 2 chars)' });
    }
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Valid email required' });
    }

    // Check if email already exists
    const existing = await pool.query('SELECT id FROM circle_signups WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    // Generate IDs and code
    const memberId = generateMemberId();
    const referralCode = generateReferralCode();
    const referralLink = `${process.env.PUBLIC_URL || 'http://localhost:3000'}/r/${referralCode}`;

    // Insert into database
    const query = `
      INSERT INTO circle_signups
      (member_id, first_name, email, phone, referral_code, referral_link, signup_date)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING id, member_id, referral_code, referral_link, email, first_name
    `;
    const result = await pool.query(query, [memberId, firstName, email.toLowerCase(), phone || null, referralCode, referralLink]);
    const newMember = result.rows[0];

    // Trigger welcome email
    await triggerEmail(email, firstName, 'WELCOME_EMAIL');

    console.log(`✓ New signup: ${email} (${memberId})`);

    res.status(201).json({
      success: true,
      message: 'Successfully joined N\'ICE Circle',
      memberId: newMember.member_id,
      referralLink: newMember.referral_link,
      email: newMember.email,
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// POST /api/circle/referral-signup - Signup via referral link
app.post('/api/circle/referral-signup', async (req, res) => {
  const { firstName, email, referralCode } = req.body;

  try {
    // Validation
    if (!firstName || firstName.length < 2) {
      return res.status(400).json({ success: false, message: 'First name required (min 2 chars)' });
    }
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Valid email required' });
    }
    if (!referralCode) {
      return res.status(400).json({ success: false, message: 'Referral code required' });
    }

    // Check if email already exists
    const emailCheck = await pool.query('SELECT id FROM circle_signups WHERE email = $1', [email.toLowerCase()]);
    if (emailCheck.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    // Find referrer
    const referrerQuery = await pool.query('SELECT id, email, first_name, referral_count FROM circle_signups WHERE referral_code = $1', [referralCode]);
    if (referrerQuery.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invalid referral code' });
    }
    const referrer = referrerQuery.rows[0];

    // Generate new member IDs
    const newMemberId = generateMemberId();
    const newReferralCode = generateReferralCode();
    const newReferralLink = `${process.env.PUBLIC_URL || 'http://localhost:3000'}/r/${newReferralCode}`;

    // Insert new signup with referred_by
    const insertQuery = `
      INSERT INTO circle_signups
      (member_id, first_name, email, referral_code, referral_link, referred_by, signup_date)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING id, member_id, email
    `;
    const newSignup = await pool.query(insertQuery, [newMemberId, firstName, email.toLowerCase(), newReferralCode, newReferralLink, referrer.id]);
    const newMember = newSignup.rows[0];

    // Increment referrer's referral count
    const updateReferrerQuery = `
      UPDATE circle_signups
      SET referral_count = referral_count + 1, updated_at = NOW()
      WHERE id = $1
      RETURNING referral_count
    `;
    const updatedReferrer = await pool.query(updateReferrerQuery, [referrer.id]);
    const newReferralCount = updatedReferrer.rows[0].referral_count;

    // Trigger welcome email for new member
    await triggerEmail(email, firstName, 'WELCOME_EMAIL');

    console.log(`✓ Referral signup: ${email} referred by ${referrer.email} (Referrer now has ${newReferralCount} referrals)`);

    res.status(201).json({
      success: true,
      message: 'Successfully joined N\'ICE Circle via referral',
      memberId: newMember.member_id,
      referrerEmail: referrer.email,
      email: newMember.email,
    });
  } catch (error) {
    console.error('Referral signup error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// ============ LOTTERY ENDPOINTS ============

// POST /api/circle/select-winners - Random selection (Fisher-Yates shuffle)
app.post('/api/circle/select-winners', async (req, res) => {
  const { poolStartDate, poolEndDate, count: rawCount = 2 } = req.body;
  const count = Math.max(1, Math.min(100, parseInt(rawCount, 10) || 2));

  try {
    // Validate dates
    if (!poolStartDate || !poolEndDate) {
      return res.status(400).json({ success: false, message: 'poolStartDate and poolEndDate required' });
    }

    // Query all eligible signups
    const query = `
      SELECT id, email, first_name, member_id
      FROM circle_signups
      WHERE signup_date::date >= $1::date
        AND signup_date::date <= $2::date
      ORDER BY signup_date ASC
    `;
    const result = await pool.query(query, [poolStartDate, poolEndDate]);
    const pool_signups = result.rows;

    // Validate pool size
    if (pool_signups.length < count) {
      return res.status(400).json({
        success: false,
        message: `Not enough signups in pool. Required: ${count}, Available: ${pool_signups.length}`,
      });
    }

    // Fisher-Yates shuffle
    const shuffled = [...pool_signups];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Select winners
    const winners = shuffled.slice(0, count);
    const drawId = `DRAW-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
    const randomSeed = Math.random().toString();

    // Mark winners in database
    for (const winner of winners) {
      await pool.query(
        'UPDATE circle_signups SET is_winner = true, winner_draw_date = NOW(), updated_at = NOW() WHERE id = $1',
        [winner.id]
      );
      // Trigger winner email
      await triggerEmail(winner.email, winner.first_name, 'WINNER_ANNOUNCEMENT');
    }

    // Log draw — flexible winner count, stored as JSONB array
    const winnersPayload = winners.map(w => ({
      email: w.email,
      first_name: w.first_name,
      member_id: w.member_id,
    }));

    const logQuery = `
      INSERT INTO winner_draw_log
      (draw_id, draw_date, pool_start_date, pool_end_date, total_pool_size, random_seed,
       winner_count, winners)
      VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7)
    `;
    await pool.query(logQuery, [
      drawId,
      poolStartDate,
      poolEndDate,
      pool_signups.length,
      randomSeed,
      winners.length,
      JSON.stringify(winnersPayload),
    ]);

    console.log(`✓ Lottery draw completed: ${drawId}`);
    console.log(`  Winners (${winners.length}): ${winners.map(w => w.email).join(', ')}`);
    console.log(`  Pool size: ${pool_signups.length}`);

    res.status(200).json({
      success: true,
      message: 'Winners selected successfully',
      drawId,
      totalPoolSize: pool_signups.length,
      winners: winners.map(w => ({
        email: w.email,
        firstName: w.first_name,
        memberId: w.member_id,
      })),
      drawDate: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Lottery error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// ============ STATS & INFO ENDPOINTS ============

// GET /api/circle/stats - System stats
app.get('/api/circle/stats', async (req, res) => {
  try {
    const totalSignups = await pool.query('SELECT COUNT(*) as count FROM circle_signups');
    const totalReferrals = await pool.query('SELECT COUNT(*) as count FROM circle_signups WHERE referred_by IS NOT NULL');
    const winners = await pool.query('SELECT email, first_name, winner_draw_date FROM circle_signups WHERE is_winner = true');
    const drawHistory = await pool.query('SELECT draw_id, draw_date, total_pool_size, winner_count, winners FROM winner_draw_log ORDER BY draw_date DESC LIMIT 10');

    res.json({
      totalSignups: parseInt(totalSignups.rows[0].count),
      totalReferrals: parseInt(totalReferrals.rows[0].count),
      winnersSelected: winners.rows.length > 0,
      currentWinners: winners.rows,
      drawHistory: drawHistory.rows,
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// GET /api/circle/member/:memberId - Get member info
app.get('/api/circle/member/:memberId', async (req, res) => {
  try {
    const { memberId } = req.params;
    const member = await pool.query(
      'SELECT id, member_id, first_name, email, phone, referral_code, referral_link, referral_count, is_winner, signup_date FROM circle_signups WHERE member_id = $1',
      [memberId]
    );

    if (member.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    res.json(member.rows[0]);
  } catch (error) {
    console.error('Member lookup error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// GET /api/circle/members - Get all members (for admin dashboard)
app.get('/api/circle/members', async (req, res) => {
  try {
    const members = await pool.query(
      `SELECT member_id, first_name, email, referral_code, referral_count,
              is_winner, signup_date
       FROM circle_signups
       ORDER BY signup_date DESC
       LIMIT 500`
    );
    res.json({ members: members.rows });
  } catch (error) {
    console.error('Members lookup error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// GET /api/circle/winners - Get current winners
app.get('/api/circle/winners', async (req, res) => {
  try {
    const winners = await pool.query(
      'SELECT email, first_name, member_id, winner_draw_date FROM circle_signups WHERE is_winner = true ORDER BY winner_draw_date DESC'
    );

    res.json({
      currentWinners: winners.rows,
    });
  } catch (error) {
    console.error('Winners lookup error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// ============ SERVER START ============

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 N'ICE Circle Referral System running on http://localhost:${PORT}`);
  console.log(`📊 Health check: GET /health`);
  console.log(`📝 Sign up: POST /api/circle/signup`);
  console.log(`🔗 Referral signup: POST /api/circle/referral-signup`);
  console.log(`🎰 Run lottery: POST /api/circle/select-winners`);
  console.log(`📈 Stats: GET /api/circle/stats`);
  console.log(`\n🌐 Pages:`);
  console.log(`   Signup:    http://localhost:${PORT}/signup`);
  console.log(`   Admin:     http://localhost:${PORT}/admin`);
  console.log(`   Referral:  http://localhost:${PORT}/r/<code>\n`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await pool.end();
  process.exit(0);
});
