# N'ICE Circle Email Referral System

A complete email referral and lottery system for N'ICE nicotine pouches Circle membership.

**Features:**
- ✅ Circle signup with automatic welcome emails
- ✅ Referral links that track who brought friends in
- ✅ Automatic unlock when members refer 2+ friends
- ✅ Random lottery to select 2 UFC fighter meet & greet winners
- ✅ Clean REST API for all operations
- ✅ Mock integration ready for Shopify/Klaviyo hookup

---

## Quick Start

### Prerequisites
- Node.js 16+ installed
- PostgreSQL 12+ (or Docker)
- `.env` file with database credentials

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Database

**Option A: Using Docker**
```bash
docker run -d \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=nice_circle \
  -p 5432:5432 \
  postgres:15
```

**Option B: Local PostgreSQL**
```bash
createdb nice_circle
psql nice_circle < schema.sql
```

### 3. Configure Environment
```bash
cp .env.example .env
# Edit .env with your database credentials
```

### 4. Start Server
```bash
npm run dev
```

Server runs on `http://localhost:3000`

---

## API Endpoints

### Health Check
```bash
GET /health
```

### Signup Endpoints

**Standard Signup**
```bash
POST /api/circle/signup

{
  "firstName": "John",
  "email": "john@example.com",
  "phone": "+1234567890" // optional
}

Returns:
{
  "success": true,
  "memberId": "NICE-abc123",
  "referralLink": "nice.run/abc123xy",
  "email": "john@example.com"
}
```

**Referral Signup**
```bash
POST /api/circle/referral-signup

{
  "firstName": "Jane",
  "email": "jane@example.com",
  "referralCode": "abc123xy"
}

Returns:
{
  "success": true,
  "memberId": "NICE-def456",
  "referrerEmail": "john@example.com",
  "email": "jane@example.com"
}
```

### Lottery Endpoints

**Run Lottery Draw**
```bash
POST /api/circle/select-winners

{
  "poolStartDate": "2026-05-14",
  "poolEndDate": "2026-06-14",
  "count": 2
}

Returns:
{
  "success": true,
  "drawId": "DRAW-1718000000000-ABC123",
  "totalPoolSize": 450,
  "winners": [
    {
      "email": "john@example.com",
      "firstName": "John",
      "memberId": "NICE-abc123"
    },
    {
      "email": "jane@example.com",
      "firstName": "Jane",
      "memberId": "NICE-def456"
    }
  ],
  "drawDate": "2026-06-14T20:00:00Z"
}
```

### Stats & Info Endpoints

**Get System Stats**
```bash
GET /api/circle/stats

Returns:
{
  "totalSignups": 450,
  "totalReferrals": 125,
  "winnersSelected": true,
  "currentWinners": [...],
  "drawHistory": [...]
}
```

**Get Member Info**
```bash
GET /api/circle/member/:memberId

Returns:
{
  "id": "uuid",
  "member_id": "NICE-abc123",
  "first_name": "John",
  "email": "john@example.com",
  "referral_code": "abc123xy",
  "referral_link": "nice.run/abc123xy",
  "referral_count": 2,
  "is_winner": false,
  "signup_date": "2026-05-14T10:30:00Z"
}
```

**Get Winners**
```bash
GET /api/circle/winners

Returns:
{
  "currentWinners": [
    {
      "email": "john@example.com",
      "first_name": "John",
      "member_id": "NICE-abc123",
      "winner_draw_date": "2026-06-14T20:00:00Z"
    }
  ]
}
```

---

## Welcome Email Template

Located in `emails/welcome-email.html`

**Features:**
- Fully responsive (mobile, tablet, desktop)
- N'ICE brand colors (teal, orange, hot pink)
- Professional typography
- Dynamic personalization: `{{firstName}}`
- Prize highlight section
- Timeline of what's next
- Social media links
- Ready for Klaviyo integration

**To integrate with Klaviyo:**
1. Copy HTML from `emails/welcome-email.html`
2. Paste into Klaviyo email template editor
3. Set trigger: Customer signup event
4. Add dynamic fields: `{{firstName}}` (maps to customer first_name)

---

## Database Schema

### CircleSignups Table
```sql
id (UUID) - Primary key
member_id (VARCHAR) - Public-facing ID (NICE-abc123)
first_name (VARCHAR) - Member's first name
email (VARCHAR) - Email address (unique)
phone (VARCHAR) - Optional phone number
referral_code (VARCHAR) - Unique 8-char code for referral link
referral_link (VARCHAR) - Generated link (nice.run/CODE)
referred_by (UUID) - Foreign key to referrer (if came via referral)
referral_count (INT) - How many friends they've referred
is_winner (BOOLEAN) - Whether they won the lottery
winner_draw_date (TIMESTAMP) - When they won
signup_date (TIMESTAMP) - When they joined
```

### WinnerDrawLog Table
```sql
id (UUID) - Primary key
draw_id (VARCHAR) - Unique ID for this draw (DRAW-...)
draw_date (TIMESTAMP) - When draw was executed
pool_start_date (DATE) - Start of eligibility window
pool_end_date (DATE) - End of eligibility window
total_pool_size (INT) - How many signups in pool
random_seed (VARCHAR) - Seed for reproducibility
winner1_email (VARCHAR) - First winner's email
winner2_email (VARCHAR) - Second winner's email
winner1_confirmed (BOOLEAN) - RSVP status
winner2_confirmed (BOOLEAN) - RSVP status
created_at (TIMESTAMP) - Log creation time
```

---

## Testing

### Test Signup
```bash
curl -X POST http://localhost:3000/api/circle/signup \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "email": "john@example.com"
  }'
```

### Test Referral
```bash
curl -X POST http://localhost:3000/api/circle/referral-signup \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "email": "jane@example.com",
    "referralCode": "abc123xy"
  }'
```

### Run Lottery
```bash
curl -X POST http://localhost:3000/api/circle/select-winners \
  -H "Content-Type: application/json" \
  -d '{
    "poolStartDate": "2026-05-14",
    "poolEndDate": "2026-06-14"
  }'
```

### Get Stats
```bash
curl http://localhost:3000/api/circle/stats
```

---

## Integration Checklist

### For Shopify Integration
- [ ] Create Shopify app in your store
- [ ] Get API credentials (API Key, Secret)
- [ ] Set webhook URL: `https://your-domain.com/webhooks/shopify`
- [ ] Add credentials to `.env`:
  ```
  SHOPIFY_API_KEY=your_key
  SHOPIFY_API_SECRET=your_secret
  SHOPIFY_SHOP_URL=your_shop.myshopify.com
  ```
- [ ] Server listens for Shopify customer.create events
- [ ] Webhook calls `POST /api/circle/signup`

### For Klaviyo Integration
- [ ] Create Klaviyo account
- [ ] Get API key
- [ ] Create email list for Circle members
- [ ] Add credentials to `.env`:
  ```
  KLAVIYO_API_KEY=your_api_key
  KLAVIYO_LIST_ID=your_list_id
  ```
- [ ] Upload welcome email template to Klaviyo
- [ ] Set trigger: Customer signup → Send welcome email

### For Email Demo (Before Client Integration)
- [ ] Use Mailtrap free account for testing
- [ ] Add Mailtrap credentials to `.env`
- [ ] Emails send to Mailtrap test inbox
- [ ] Show client: "Here's the system working, emails go to your Klaviyo account"

---

## Deployment

### Vercel (Recommended)
```bash
npm i -g vercel
vercel
```

### Heroku
```bash
heroku create your-app-name
heroku config:set DB_HOST=your_database_host
git push heroku main
```

### AWS Lambda
Use serverless framework or container deployment

---

## Project Structure

```
.
├── server.js              # Main Express app + API endpoints
├── schema.sql             # PostgreSQL schema
├── package.json           # Dependencies
├── .env.example           # Environment template
├── README.md              # This file
├── emails/
│   └── welcome-email.html # Welcome email template
└── .gitignore
```

---

## Support

For questions or issues:
- Check API response errors
- Review database logs: `psql nice_circle -c "SELECT * FROM circle_signups;"`
- Monitor console output for webhook events

---

**Built for N'ICE Circle Launch - May 2026**
