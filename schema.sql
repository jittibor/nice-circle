-- N1CE Circle Referral System Database Schema

-- CircleSignups Table
CREATE TABLE IF NOT EXISTS circle_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id VARCHAR(50) UNIQUE NOT NULL DEFAULT ('NICE-' || SUBSTR(MD5(RANDOM()::TEXT), 1, 6)),
  first_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  referral_code VARCHAR(20) UNIQUE NOT NULL,
  referral_link VARCHAR(255),
  referred_by UUID REFERENCES circle_signups(id),
  referral_count INTEGER DEFAULT 0,
  is_winner BOOLEAN DEFAULT FALSE,
  winner_draw_date TIMESTAMP,
  shopify_customer_id VARCHAR(255),
  signup_date TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for CircleSignups
CREATE INDEX idx_circle_signups_email ON circle_signups(email);
CREATE INDEX idx_circle_signups_referral_code ON circle_signups(referral_code);
CREATE INDEX idx_circle_signups_referred_by ON circle_signups(referred_by);
CREATE INDEX idx_circle_signups_is_winner ON circle_signups(is_winner);
CREATE INDEX idx_circle_signups_signup_date ON circle_signups(signup_date);

-- WinnerDrawLog Table
-- Flexible winner count: stores N winners as JSONB array.
-- Each element: { "email": "...", "first_name": "...", "member_id": "..." }
CREATE TABLE IF NOT EXISTS winner_draw_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id VARCHAR(50) UNIQUE NOT NULL,
  draw_date TIMESTAMP NOT NULL DEFAULT NOW(),
  pool_start_date DATE NOT NULL,
  pool_end_date DATE NOT NULL,
  total_pool_size INTEGER NOT NULL,
  random_seed VARCHAR(255),
  winner_count INTEGER NOT NULL,
  winners JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for WinnerDrawLog
CREATE INDEX idx_winner_draw_log_draw_date ON winner_draw_log(draw_date);
CREATE INDEX idx_winner_draw_log_draw_id ON winner_draw_log(draw_id);
-- GIN index lets us search inside the winners JSONB array (e.g. find draws containing an email)
CREATE INDEX idx_winner_draw_log_winners ON winner_draw_log USING GIN (winners);
