# N'ICE Circle - Setup Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Install PostgreSQL (If you don't have it)

**Using Docker (Easiest):**
```bash
docker run -d \
  --name nice_postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=nice_circle \
  -p 5432:5432 \
  postgres:15
```

**Or download:** https://www.postgresql.org/download/

---

### Step 2: Configure Environment

```bash
# Copy example to .env
cp .env.example .env

# Edit .env with your database info
# Default values work with Docker setup above
```

---

### Step 3: Create Database & Tables

```bash
# Option A: Using psql command line
psql -U postgres -h localhost -c "CREATE DATABASE nice_circle;"
psql -U postgres -h localhost nice_circle < schema.sql

# Option B: Using Docker
docker exec nice_postgres psql -U postgres -c "CREATE DATABASE nice_circle;"
docker exec nice_postgres psql -U postgres nice_circle < schema.sql
```

---

### Step 4: Start the Server

```bash
npm run dev
```

You should see:
```
🚀 N'ICE Circle Referral System running on http://localhost:3000
📊 Health check: GET /health
📝 Sign up: POST /api/circle/signup
🔗 Referral signup: POST /api/circle/referral-signup
🎰 Run lottery: POST /api/circle/select-winners
📈 Stats: GET /api/circle/stats
```

---

## ✅ Test Everything Works

### Test 1: Health Check
```bash
curl http://localhost:3000/health
```

Should return: `{"status":"ok",...}`

---

### Test 2: Create First Member

```bash
curl -X POST http://localhost:3000/api/circle/signup \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "email": "john@example.com"
  }'
```

Should return:
```json
{
  "success": true,
  "memberId": "NICE-abc123",
  "referralLink": "nice.run/xyz789",
  "email": "john@example.com"
}
```

**Copy the referralLink for next test**

---

### Test 3: Create Referral Signup

```bash
curl -X POST http://localhost:3000/api/circle/referral-signup \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "email": "jane@example.com",
    "referralCode": "xyz789"
  }'
```

Should return success with Jane's member ID

---

### Test 4: Check Stats

```bash
curl http://localhost:3000/api/circle/stats
```

Should show:
- totalSignups: 2
- totalReferrals: 1

---

### Test 5: Run Lottery

```bash
curl -X POST http://localhost:3000/api/circle/select-winners \
  -H "Content-Type: application/json" \
  -d '{
    "poolStartDate": "2026-05-01",
    "poolEndDate": "2026-06-30"
  }'
```

Should return 2 random winners

---

## 📧 Welcome Email Template

Open `emails/welcome-email.html` in your browser to preview.

**To use in Klaviyo:**
1. Copy HTML content from `emails/welcome-email.html`
2. Go to Klaviyo → Email Templates → Create New
3. Paste HTML
4. Set trigger: `Customer signup event`
5. Add variable: `{{firstName}}` maps to `first_name` from Shopify

---

## 🔗 Ready for Integration

### When Client Provides Shopify Credentials:

1. Get API key and secret from Shopify
2. Add to `.env`:
   ```
   SHOPIFY_API_KEY=your_key
   SHOPIFY_API_SECRET=your_secret
   SHOPIFY_SHOP_URL=your_shop.myshopify.com
   ```
3. Uncomment Shopify integration code in `server.js`
4. Set webhook in Shopify → Settings → Apps and Integrations → Webhooks
   - URL: `https://your-domain.com/webhooks/shopify`
   - Topic: `customers/create`

### When Client Provides Klaviyo Credentials:

1. Get API key from Klaviyo
2. Add to `.env`:
   ```
   KLAVIYO_API_KEY=your_key
   KLAVIYO_LIST_ID=your_list_id
   ```
3. Update `triggerEmail()` function in `server.js` to call Klaviyo API
4. Upload email template to Klaviyo

---

## 🧪 Development

### Run in Development Mode
```bash
npm run dev
```

Uses `nodemon` for auto-restart on file changes.

### Debug Database
```bash
# Connect to database
psql -U postgres -h localhost nice_circle

# View all signups
SELECT member_id, email, referral_count, is_winner FROM circle_signups;

# View draw history
SELECT draw_id, draw_date, winner1_email, winner2_email FROM winner_draw_log;

# Exit
\q
```

---

## 📦 Production Deployment

### Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

### Heroku
```bash
heroku create your-app-name
heroku config:set DB_HOST=your_database_host DB_PORT=5432 DB_USER=postgres DB_PASSWORD=your_password DB_NAME=nice_circle
git push heroku main
```

### Environment Variables Required
```
DB_HOST
DB_PORT
DB_USER
DB_PASSWORD
DB_NAME
PORT (default 3000)
```

---

## 🆘 Troubleshooting

### "Can't connect to database"
- Ensure PostgreSQL is running: `docker ps` (if using Docker)
- Check `.env` has correct credentials
- Try: `psql -U postgres -h localhost` to test connection

### "Email not triggering"
- Currently emails log to console only
- For real emails: add Klaviyo/Mailtrap credentials to `.env`
- Check server logs for `[EMAIL]` messages

### "Referral code not found"
- Make sure referral code is exactly 8 characters
- Test with code from previous signup response

### "Random selection not working"
- Ensure you have at least 2 signups in the date range
- Check pool dates: `poolStartDate` <= `poolEndDate`

---

## 📊 Next Steps

1. ✅ Get server running locally
2. ✅ Test all endpoints with curl
3. ✅ Preview welcome email in browser
4. ✅ Show client the working system
5. ⏳ Client provides Shopify + Klaviyo credentials
6. ⏳ Add integrations and deploy

---

**Questions?** Check `README.md` or `API_DOCS.md`
