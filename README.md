# The All Thing Project

FastAPI-based polling platform with daily poll instances, voter anonymity, ranked-choice voting (IRV), and Cloudflare Turnstile bot protection.

## Quick Setup (New Machine)

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd theAllThingProject

# 2. Run the setup script
./setup.sh

# 3. Configure environment variables
# Edit backend/.env with your local database/redis credentials
# Edit frontend/.env.local with your API URL

# 4. Start the services
# Terminal 1 - Backend:
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload

# Terminal 2 - Frontend:
cd frontend
npm run dev
```

## Environment Variables

### Backend (.env)
```bash
# Database
databaseUrl=postgresql+asyncpg://user:pass@localhost:5432/dbname

# Redis
redisUrl=redis://localhost:6379/0

# Secrets
secretKey=your-secret-key
adminKey=your-admin-key

# Turnstile (optional - use test key for dev)
turnstileSecretKey=1x0000000000000000000000000000000AA
```

### Frontend (.env.local)
```bash
# API URL
NEXT_PUBLIC_API_URL=http://localhost:8000

# Turnstile Site Key (optional - use test key for dev)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
```

## Production Deployment

Secrets are managed via Fly.io:

```bash
# Backend secrets
fly secrets set DATABASE_URL=... --app the-all-thing-backend
fly secrets set REDIS_URL=... --app the-all-thing-backend
fly secrets set SECRET_KEY=... --app the-all-thing-backend
fly secrets set ADMIN_KEY=... --app the-all-thing-backend
fly secrets set TURNSTILE_SECRET_KEY=... --app the-all-thing-backend

# Frontend (via Vercel or similar)
NEXT_PUBLIC_API_URL=https://the-all-thing-backend.fly.dev
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your-real-site-key
```

## Features

- ✅ Daily poll instances with automated rollover
- ✅ Ranked-choice voting (IRV) with instant runoff tallying
- ✅ Voter anonymity via signed cookies
- ✅ Duplicate vote prevention (cookie + IP + database)
- ✅ Cloudflare Turnstile bot protection
- ✅ Redis-based rate limiting and caching
- ✅ Admin portal for poll management
- ✅ Automated snapshots for historical results

## Documentation

- [SETUP.md](SETUP.md) - Detailed setup instructions
- [TURNSTILE_SETUP.md](TURNSTILE_SETUP.md) - Cloudflare Turnstile integration guide
- [IRV_AUDIT_COMPLETE.md](backend/IRV_AUDIT_COMPLETE.md) - Ranked-choice voting audit report
- [.github/copilot-instructions.md](.github/copilot-instructions.md) - AI agent instructions

## Tech Stack

**Backend:**
- FastAPI + SQLAlchemy (async)
- PostgreSQL
- Redis
- Alembic migrations

**Frontend:**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- React Turnstile

## Security Notes

⚠️ **Never commit secrets to git!**
- `.env` files are gitignored
- Use `.env.example` as templates
- Production secrets only in Fly.io/Vercel
- Rotate keys if accidentally exposed
