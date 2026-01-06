# Cloudflare Turnstile Integration

## Overview
Cloudflare Turnstile is integrated for bot protection on vote submissions. It's privacy-friendly, free, and lighter than reCAPTCHA.

## Setup

### 1. Get Cloudflare Turnstile Keys

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to Turnstile
3. Create a new site
4. Get your Site Key and Secret Key

### 2. Configure Backend

Add to your backend `.env` file:

```bash
TURNSTILE_SECRET_KEY=your_secret_key_here
```

### 3. Configure Frontend

Add to your frontend `.env.local` file:

```bash
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_site_key_here
```

### 4. Deploy to Production

**Backend (Fly.io):**
```bash
fly secrets set TURNSTILE_SECRET_KEY=your_secret_key_here --app the-all-thing-backend
```

**Frontend (Vercel/etc):**
Add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to your deployment platform's environment variables.

## How It Works

### Without Turnstile Configured
- Bot protection gracefully degrades
- Rate limiting and IP/cookie tracking still active
- Votes are accepted without CAPTCHA verification

### With Turnstile Configured
- Widget appears before vote submission button
- Token is verified server-side before vote is recorded
- Invalid/missing tokens result in 403 Forbidden
- Verification failures are logged for monitoring

## Testing

### Development
During development, Turnstile provides test keys that always pass:

**Site Key:** `1x00000000000000000000AA`  
**Secret Key:** `1x0000000000000000000000000000000AA`

### Production
Use real keys from your Cloudflare dashboard for production deployment.

## Graceful Degradation

The implementation follows a "fail open" strategy:
- If Turnstile service is down → votes are accepted
- If verification times out → votes are accepted
- If frontend doesn't send token → votes are accepted (unless secret key is configured)
- If backend secret key is not configured → verification is skipped

This ensures legitimate users can always vote while still blocking obvious bot traffic when Turnstile is working.

## Monitoring

Check backend logs for Turnstile-related events:
- `turnstile_verify_failed` - Verification failed (likely bot)
- `turnstile_verify_error` - HTTP error contacting Cloudflare
- `turnstile_timeout` - Verification timed out
- `turnstile_exception` - Unexpected error

## Customization

Edit the Turnstile widget options in `frontend/src/components/PollCard.tsx`:

```typescript
<Turnstile
  siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
  options={{
    theme: 'auto',  // 'light', 'dark', or 'auto'
    size: 'normal', // 'normal', 'compact', or 'flexible'
  }}
/>
```

## Cost
Cloudflare Turnstile is **free** for unlimited usage.
