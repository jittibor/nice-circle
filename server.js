const express = require('express');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

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
    const referralLink = `nice.run/${referralCode}`;

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
    const newReferralLink = `nice.run/${newReferralCode}`;

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

    // If referrer now has 2+ referrals, trigger "unlocked" email
    if (newReferralCount >= 2) {
      await triggerEmail(referrer.email, referrer.first_name, 'UNLOCKED_MEET_GREET');
      console.log(`✓ ${referrer.email} unlocked meet & greet draw (${newReferralCount} referrals)`);
    }

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
  const { poolStartDate, poolEndDate, count = 2 } = req.body;

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

    // Log draw
    const logQuery = `
      INSERT INTO winner_draw_log
      (draw_id, draw_date, pool_start_date, pool_end_date, total_pool_size, random_seed,
       winner1_email, winner1_first_name, winner1_member_id,
       winner2_email, winner2_first_name, winner2_member_id)
      VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;
    await pool.query(logQuery, [
      drawId,
      poolStartDate,
      poolEndDate,
      pool_signups.length,
      randomSeed,
      winners[0].email,
      winners[0].first_name,
      winners[0].member_id,
      winners[1].email,
      winners[1].first_name,
      winners[1].member_id,
    ]);

    console.log(`✓ Lottery draw completed: ${drawId}`);
    console.log(`  Winners: ${winners[0].email}, ${winners[1].email}`);
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
    const drawHistory = await pool.query('SELECT draw_id, draw_date, total_pool_size, winner1_email, winner2_email FROM winner_draw_log ORDER BY draw_date DESC LIMIT 10');

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
  console.log(`📈 Stats: GET /api/circle/stats\n`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await pool.end();
  process.exit(0);
});
