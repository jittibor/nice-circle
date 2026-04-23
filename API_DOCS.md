# N'ICE Circle API Documentation

## Base URL
```
http://localhost:3000
(Production: https://your-domain.com)
```

## Authentication
Currently no authentication required. Add API keys before production.

---

## Health Check

### GET /health
Check if server is running.

**Response:**
```json
{
  "status": "ok",
  "message": "N'ICE Circle Referral System is running"
}
```

---

## Signup Endpoints

### POST /api/circle/signup
Create a new Circle member signup.

**Request:**
```json
{
  "firstName": "John",
  "email": "john@example.com",
  "phone": "+1-555-123-4567"
}
```

**Required Fields:**
- `firstName` (string, min 2 chars)
- `email` (string, valid email format)

**Optional Fields:**
- `phone` (string)

**Response (201):**
```json
{
  "success": true,
  "message": "Successfully joined N'ICE Circle",
  "memberId": "NICE-abc123",
  "referralLink": "nice.run/abc123xy",
  "email": "john@example.com"
}
```

**Error Responses:**
- 400: Missing or invalid fields
- 409: Email already registered
- 500: Server error

**Actions on Success:**
1. Member record created in database
2. Unique referral code generated
3. Welcome email triggered
4. Referral link created

---

### POST /api/circle/referral-signup
Create a signup via referral link (friend was referred).

**Request:**
```json
{
  "firstName": "Jane",
  "email": "jane@example.com",
  "referralCode": "abc123xy"
}
```

**Required Fields:**
- `firstName` (string, min 2 chars)
- `email` (string, valid email format)
- `referralCode` (string, 8-char code from referrer)

**Response (201):**
```json
{
  "success": true,
  "message": "Successfully joined N'ICE Circle via referral",
  "memberId": "NICE-def456",
  "referrerEmail": "john@example.com",
  "email": "jane@example.com"
}
```

**Error Responses:**
- 400: Missing or invalid fields
- 404: Invalid referral code
- 409: Email already registered
- 500: Server error

**Actions on Success:**
1. New member record created with `referred_by` = referrer ID
2. Referrer's `referral_count` incremented (tracking only; no email is sent to the referrer)
3. New member's welcome email triggered

> Every Circle member is automatically eligible for the meet & greet draw on signup. There is no referral threshold required to qualify.

---

## Lottery Endpoints

### POST /api/circle/select-winners
Run random lottery draw to select N winners (default 2; configurable per draw).

**Algorithm:** Fisher-Yates shuffle (unbiased random selection)

**Request:**
```json
{
  "poolStartDate": "2026-05-14",
  "poolEndDate": "2026-06-14",
  "count": 2
}
```

**Required Fields:**
- `poolStartDate` (ISO date string: YYYY-MM-DD)
- `poolEndDate` (ISO date string: YYYY-MM-DD)

**Optional Fields:**
- `count` (integer, default 2) — number of winners to select

**Response (200):**
```json
{
  "success": true,
  "message": "Winners selected successfully",
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
  "drawDate": "2026-06-14T20:00:00.000Z"
}
```

**Error Responses:**
- 400: Missing dates or insufficient signups in pool
- 500: Server error

**Actions on Success:**
1. All eligible signups fetched from database
2. Fisher-Yates shuffle applied
3. First 2 (or count) selected as winners
4. Winners marked in database: `is_winner = true`
5. Draw logged in WinnerDrawLog table
6. Winner notification emails triggered
7. Both winners notified of their win

---

## Stats & Info Endpoints

### GET /api/circle/stats
Get system statistics and draw history.

**Response (200):**
```json
{
  "totalSignups": 450,
  "totalReferrals": 125,
  "winnersSelected": true,
  "currentWinners": [
    {
      "email": "john@example.com",
      "first_name": "John",
      "winner_draw_date": "2026-06-14T20:00:00.000Z"
    }
  ],
  "drawHistory": [
    {
      "draw_id": "DRAW-1718000000000-ABC123",
      "draw_date": "2026-06-14T20:00:00.000Z",
      "total_pool_size": 450,
      "winner_count": 2,
      "winners": [
        { "email": "john@example.com", "first_name": "John", "member_id": "NICE-abc123" },
        { "email": "jane@example.com", "first_name": "Jane", "member_id": "NICE-def456" }
      ]
    }
  ]
}
```

---

### GET /api/circle/member/:memberId
Get individual member information.

**Parameters:**
- `memberId` (path param): Member ID like "NICE-abc123"

**Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "member_id": "NICE-abc123",
  "first_name": "John",
  "email": "john@example.com",
  "phone": "+1-555-123-4567",
  "referral_code": "abc123xy",
  "referral_link": "nice.run/abc123xy",
  "referral_count": 2,
  "is_winner": false,
  "signup_date": "2026-05-14T10:30:00.000Z"
}
```

**Error Responses:**
- 404: Member not found
- 500: Server error

---

### GET /api/circle/winners
Get all current winners (those with `is_winner = true`).

**Response (200):**
```json
{
  "currentWinners": [
    {
      "email": "john@example.com",
      "first_name": "John",
      "member_id": "NICE-abc123",
      "winner_draw_date": "2026-06-14T20:00:00.000Z"
    },
    {
      "email": "jane@example.com",
      "first_name": "Jane",
      "member_id": "NICE-def456",
      "winner_draw_date": "2026-06-14T20:00:00.000Z"
    }
  ]
}
```

---

## Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success (GET, or other non-creation operations) |
| 201 | Created (successful signup) |
| 400 | Bad request (invalid input) |
| 404 | Not found (member/code doesn't exist) |
| 409 | Conflict (email already registered) |
| 500 | Server error |

---

## Error Response Format

All errors return:
```json
{
  "success": false,
  "message": "Human-readable error message",
  "error": "Technical error details (optional)"
}
```

---

## Rate Limiting

Currently unlimited. Add rate limiting before production.

---

## Data Validation

### Email
- Must be valid email format
- Must be unique in system
- Case-insensitive comparison

### First Name
- Required
- Minimum 2 characters
- Trimmed of whitespace

### Referral Code
- 8 alphanumeric characters
- Randomly generated
- Unique in system
- URL-safe (no special chars)

---

## Integrations

### Shopify Webhook Integration
When connected, Shopify will POST to `/webhooks/shopify`:

```json
{
  "event_type": "customer.create",
  "customer": {
    "id": "shopify_customer_id",
    "first_name": "John",
    "email": "john@example.com",
    "phone": "+1-555-123-4567"
  }
}
```

Server routes this to `POST /api/circle/signup`

### Klaviyo Email Integration
When connected, server calls Klaviyo API:

```
PUT /v1/lists/{list_id}/members
{
  "email": "john@example.com",
  "first_name": "John",
  "properties": {
    "member_id": "NICE-abc123",
    "referral_link": "nice.run/abc123xy"
  }
}
```

---

## Example Workflows

### Complete Signup → Referral → Lottery Flow

```
1. John signs up:
   POST /api/circle/signup
   → member_id: NICE-abc123
   → referral_code: abc123xy
   → welcome email triggered

2. John shares referral link: nice.run/abc123xy

3. Jane signs up via link:
   POST /api/circle/referral-signup
   → referral_code: abc123xy
   → referred_by: john's id
   → jane's welcome email triggered
   → john's referral_count: 1

4. Bob signs up via John's link:
   POST /api/circle/referral-signup
   → john's referral_count: 2
   → bob's welcome email triggered (no separate email to John)

5. On June 14, run lottery:
   POST /api/circle/select-winners
   → Pool size: 450 members
   → Random selection: John & Jane selected as winners
   → Winner emails triggered
   → Draw logged in history
```

---

## Monitoring

### Key Metrics to Track
- `totalSignups` - Growth over time
- `totalReferrals` - Referral participation rate
- Email trigger latency - Should be <2 seconds
- Database query times - Should be <500ms

### Check Logs
```bash
# View recent signups
curl http://localhost:3000/api/circle/stats

# View specific member
curl http://localhost:3000/api/circle/member/NICE-abc123

# View draw history
curl http://localhost:3000/api/circle/stats | jq '.drawHistory'
```

---

**Last Updated:** April 2026
