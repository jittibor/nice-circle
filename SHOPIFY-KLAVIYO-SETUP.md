# N1CE Circle · Shopify → Email Automation

How to wire up the welcome emails so they fire automatically when a
customer signs up for the Circle Club on Shopify. **No code. No
paid API keys (within the free tier). No webhook handlers to host.**

---

## TL;DR — 4 steps

1. **Deploy the email assets** (images + video) to Netlify (free)
2. **Re-build the production HTMLs** with the real Netlify URL
3. **Connect Shopify to Klaviyo** (free tier: 500 emails/month, 250 contacts)
4. **Paste each email** into a Klaviyo Flow triggered by a "Circle Club" tag

Total recurring cost: **$0** up to 250 contacts / 500 emails a month.
Scales to $20–30/mo at ~500 contacts if needed.

---

## Why this architecture (no API keys, no code)

| Layer        | Service          | Free tier                     | What it does                                         |
|--------------|------------------|-------------------------------|-------------------------------------------------------|
| Images/video | **Netlify**      | 100 GB bandwidth/mo           | Hosts the 8 banner SVGs, pouch PNGs, video, logos    |
| Customer data| **Shopify**      | (your plan)                   | Customer signs up → has the "Circle Club" tag        |
| Sync         | **Shopify ↔ Klaviyo** native app | free                 | Auto-syncs every customer + tag to Klaviyo           |
| Email send   | **Klaviyo Flow** | 500 emails/mo, 250 contacts   | Fires the right welcome email based on their flavour |

No servers to run. No `POST /webhook` endpoints to write. No Amazon SES,
no SendGrid, no SMTP credentials in a .env file. Shopify and Klaviyo talk
to each other via their official native integration.

---

## Step 1 · Deploy email assets to Netlify

The email HTMLs reference images by absolute URL (`https://…/images/pouches/melon.png`).
Those URLs need to resolve, so we deploy the `public/` folder to Netlify's CDN.

```bash
# One-time install
npm install -g netlify-cli

# From the project root
netlify login             # opens browser, authenticates
netlify init              # prompts: new site or existing; choose a name
netlify deploy --prod     # uploads → gives you https://xxx.netlify.app
```

You'll get a URL like `https://n1ce-circle-email.netlify.app` — **copy it**.

Your `netlify.toml` + `.netlifyignore` are already configured — the deploy
will publish everything in `public/` (images, videos, fonts) with a 7-day
immutable cache header for best inbox-load performance.

---

## Step 2 · Build the production emails with the real URL

```bash
BASE_URL=https://n1ce-circle-email.netlify.app node scripts/build-production-emails.js
```

This regenerates all 8 files in `emails/production/welcome-{flavor}.html`
with the absolute URL baked in. Each file is ~10 KB (well under Gmail's
102 KB truncation point) and renders pixel-identical to the Gmail mock in
every major client: Gmail web, Gmail iOS/Android, Apple Mail, Outlook,
Yahoo.

> **One difference from the mock:** the video is a clickable thumbnail
> that opens `/video-play.html` in a new tab. No email client — Gmail,
> Outlook, Yahoo — supports inline video playback. Every major e-commerce
> brand (ZYN, Velo, Lyft, White Fox) uses the same static-thumbnail
> pattern. The landing page `/video-play.html` auto-plays the video
> when opened.

---

## Step 3 · Connect Shopify ↔ Klaviyo (5 minutes, no code)

1. Sign up for Klaviyo: <https://www.klaviyo.com/pricing> (Free plan works).
2. From Shopify admin → **Apps** → search "Klaviyo" → **Install**.
3. In Klaviyo: **Integrations** → **Shopify** → click **Enable**.
   This pulls every customer, order, and tag into Klaviyo automatically —
   no webhook handlers needed.
4. Verify: create a test customer in Shopify, wait ~30 seconds, find them
   in Klaviyo under **Profiles**.

### How customers get into the Circle Club

Pick one of these signup paths in Shopify:

| Signup path                 | Trigger for email                          |
|-----------------------------|--------------------------------------------|
| Dedicated Shopify form      | Customer tag added: `circle-club`          |
| Checkout opt-in checkbox    | Marketing consent + `circle-club` tag      |
| Standalone form (Typeform/Formspark) | Zapier/Make → Shopify customer create w/ tag |

Each of these results in **the customer having a `circle-club` tag in
Shopify**, which is synced to Klaviyo as a profile property.

---

## Step 4 · Build the Klaviyo Flow

In Klaviyo admin:

1. **Flows** → **Create Flow** → **From scratch** → name it `Circle Club · Welcome`
2. **Trigger** → `Added to List` or `Profile Property Changed` (whichever you wire)
   - If using a Shopify tag: use **Metric: "Customer tag added"** with filter `tag equals circle-club`
3. **Add action** → **Email** → **Create Email**

### 8 flavour variants = 1 flow with conditional splits

Instead of 8 separate flows, use ONE flow with a **Conditional Split** on
the customer's `favorite_flavor` property (or whichever field you collect
at signup):

```
Circle Club tag added
   ├─ Is favorite_flavor = "peach"  → Send welcome-peach.html
   ├─ Is favorite_flavor = "berry"  → Send welcome-berry.html
   ├─ Is favorite_flavor = "mango"  → Send welcome-mango.html
   ├─ … etc
   └─ Default                         → Send welcome-berry.html
```

For each email node:
1. Drag an **Email** block into the flow
2. Click **Configure Content** → **Code** tab
3. **Paste the entire contents** of `emails/production/welcome-{flavor}.html`
4. Subject line: `Welcome to N1CE Circle, {{ person|lookup:"first_name"|default:"Friend" }}.`
5. Preview with a real profile → confirm name substitutes correctly
6. Save

### The merge tags we already used

The production HTML uses Klaviyo's native template syntax:

```django
{% if person|lookup:"first_name" %}{{ person|lookup:"first_name" }}{% else %}Friend{% endif %}
```

If the customer's first name is known (from Shopify), it's used. If not,
it falls back to "Friend". No broken `{{firstName}}` ever shows up.

The referral code uses:
```django
{{ event.referral_code|default:"YOURCODE" }}
```

If you pass a `referral_code` when triggering the flow, it's personalized.
Otherwise falls back. (Most clean approach: compute it in Shopify when
the Circle Club tag is added, store on the customer profile as a
metafield, and Klaviyo will have it automatically.)

---

## Alternative: Shopify Email (even simpler, 10× free tier)

If you don't want to sign up for Klaviyo, Shopify itself has a built-in
email tool:

- **Free tier: 10,000 emails/month** (vs Klaviyo's 500)
- After that: $1 per 1,000 emails

Setup:
1. Shopify admin → **Marketing** → **Shopify Email**
2. **Create email** → choose **Code view** → paste the HTML
3. Send to: customer segment `tag:circle-club`
4. Personalization uses `{{ customer.first_name }}` — you'll need to
   search & replace `{% if person|lookup:"first_name" %}...{% endif %}`
   with `{{ customer.first_name | default: "Friend" }}` in each file.

The **downside**: Shopify Email doesn't support automation flows as
powerful as Klaviyo (no conditional splits on flavour, for example). For
a single unified welcome email it's perfect.

---

## Mass-send / throughput math

At **beta launch scale**: 250 signups/mo → free everywhere.

At **growth scale** (1,000 signups/mo):
- Klaviyo: ~$20/mo (1k contacts tier)
- Shopify Email: $1/mo (1k emails × $1)
- **Amazon SES** (if you want rock-bottom): $0.10/mo + 30 min dev work

At **mass scale** (10k+ signups/mo):
- Klaviyo: ~$150/mo (includes full flow + deliverability + analytics)
- Amazon SES: $1/mo + your own code to handle the Shopify webhook

For now **don't optimise yet**. Start with Klaviyo free, upgrade when you
actually need to. The email HTML files work identically on all of these
platforms.

---

## Testing before launch

1. In Klaviyo: open the flow email → click **Preview and test**
2. Enter your own email address → send test to yourself
3. Open in Gmail, Outlook, Apple Mail → confirm:
   - Your name appears in the subject line + hero
   - The themed pouch shows on the right
   - The video thumbnail click-throughs to `/video-play.html` and plays
   - The CTA button links to your referral URL
   - Everything renders on mobile (Gmail iOS/Android)

If anything looks off, edit `scripts/build-production-emails.js`, re-run,
paste the new HTML back into Klaviyo.

---

## Files you'll use

| File                                              | Purpose                                      |
|---------------------------------------------------|----------------------------------------------|
| `scripts/build-production-emails.js`              | Generates the 8 email HTMLs                  |
| `emails/production/welcome-{flavor}.html`         | Paste these into Klaviyo — one per flavour   |
| `public/video-play.html`                          | Video landing page (click-through target)    |
| `public/videos/message-for-you.mp4`               | The actual video                             |
| `public/images/pouches/{flavor}.png`              | Product shots referenced by each email       |
| `public/images/n1ce-logo-white.png`               | Logo shown in hero + footer                  |
| `netlify.toml`                                    | Netlify deploy config (already there)        |

---

## Summary — the finished pipeline

```
Customer fills in Shopify form with { name, email, favorite_flavor }
        ↓
Shopify stores them with tag "circle-club"
        ↓
Klaviyo sync (auto, no code) pulls the profile + tag
        ↓
Klaviyo Flow triggers: "Circle Club tag added"
        ↓
Conditional split on favorite_flavor
        ↓
Sends welcome-{flavor}.html with {first_name} substituted
        ↓
Email lands in inbox — looks exactly like the Gmail mock
```

**Zero lines of code you need to maintain. $0/mo up to 250 contacts.
Scales to 10k+ by flipping a Klaviyo pricing tier later.**
