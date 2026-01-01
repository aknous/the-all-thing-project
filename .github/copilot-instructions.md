# The All Thing Project - AI Agent Instructions

## Project Overview
FastAPI-based polling platform with daily poll instances, voter anonymity via signed cookies, ranked-choice voting (IRV), and automated daily snapshots. Deployed to Fly.io with PostgreSQL and Redis.

## Architecture & Key Flows

### Data Hierarchy (Template → Plan → Instance)
- **PollTemplate**: Reusable poll definition with default options (stored in `pollTemplates`, `pollTemplateOptions`)
- **PollPlan**: Optional per-date override to customize question or disable specific dates (stored in `pollPlans`, `pollPlanOptions`)
- **PollInstance**: Actual daily poll created by rollover process (stored in `pollInstances`, `pollInstanceOptions`)

Daily rollover creates instances from templates, applying plan overrides if present. See [app/rollover.py](backend/app/rollover.py) `ensureInstancesForDate()`.

### Voter Identity & Anti-Fraud
- Uses signed cookie (`vt`) containing random token, hashed before storage (see [app/voterToken.py](backend/app/voterToken.py))
- **Never** store raw tokens; only hashed values in database
- Duplicate vote prevention: database unique constraint on `(instanceId, voterTokenHash)` in `voteBallots` table
- IP-based rate limiting via Redis with graceful degradation (see [app/abuse.py](backend/app/abuse.py))

### Ranked-Choice Voting (IRV)
- Instant Runoff Voting tallies in [app/tally.py](backend/app/tally.py) - eliminates lowest-ranked option each round until majority winner
- Vote structure: `VoteBallot` + `VoteRanking` (one-to-many) storing ordered preference lists
- Snapshots freeze results at poll close time for historical accuracy

### Daily Operations
1. **Rollover** (AM Eastern): `python -m app.rolloverCli` → closes yesterday's polls, creates snapshots, then creates today's poll instances for ALL active templates
2. **Close by date** (batch): `POST /admin/close?pollDate=YYYY-MM-DD` → closes all polls for a specific date
3. **Close specific instance**: `POST /admin/instances/{instanceId}/close` → closes and snapshots a single poll (useful for mid-day closures)
4. **Replace instance**: `POST /admin/instances/{instanceId}/replace` → closes current instance, creates new one using current template+plan settings (for mid-day corrections)
5. **Snapshot**: [app/snapshotService.py](backend/app/snapshotService.py) `upsertResultSnapshot()` computes and freezes final results as JSON

### Mid-Day Correction Workflow
When you need to fix a poll mid-day (typo, wrong options, etc):
1. **Update plan**: `PUT /admin/templates/{templateId}/plan` with corrected question/options for today's date
2. **Replace instance**: `POST /admin/instances/{instanceId}/replace` to close old poll and create fresh one
3. New instance uses updated plan settings automatically

### Poll Instance Lifecycle
- **One instance per template per day**: Database enforces unique constraint on `(templateId, pollDate)` in `pollInstances` table
- **Status transitions**: `OPEN` → `CLOSED` (one-way, irreversible)
- **Snapshots created** when closing (either via daily rollover, manual date close, or individual instance close)
- **Replace operation**: Closes old instance (with snapshot), deletes it, creates fresh instance from current template+plan - allows mid-day corrections while preserving vote history in snapshot

## Database & Models

### Async SQLAlchemy Pattern
- Always use `async with sessionFactory()` for CLI scripts
- API routes use `getDb()` dependency for auto-cleanup (see [app/db.py](backend/app/db.py))
- Connection pooling tuned for concurrent load: 20 base + 10 overflow

### URL Handling Quirk
Fly.io provides `DATABASE_URL` with `?sslmode=require`, but asyncpg rejects `sslmode`. The `fly_database_url_to_asyncpg()` function in [app/db.py](backend/app/db.py) strips it before engine creation.

### Key Models (camelCase fields)
- `PollCategory`, `PollTemplate`, `PollPlan`, `PollInstance` (main hierarchy)
- `VoteBallot`, `VoteRanking` (voting data)
- `PollResultSnapshot` (frozen results with JSONB column)
- `AdminAuditLog` (admin action tracking)

See [app/models.py](backend/app/models.py) for full schema. Note `pollType` field: `"SINGLE"` or `"RANKED"`.

## Code Conventions

### Field Naming
- **Models & schemas**: camelCase (e.g., `pollDate`, `voterTokenHash`)
- **Python variables**: snake_case (e.g., `poll_date`, `voter_token`)
- **Database tables**: camelCase to match model fields

### Input Sanitization
When accepting user text (poll questions, option labels), use [app/sanitize.py](backend/app/sanitize.py) functions:
- `sanitizeTitle()` - for poll titles
- `sanitizeQuestion()` - for poll questions (optional field)
- `sanitizeLabel()` - for option labels
- `sanitizeName()` - for category names
- `sanitizeKey()` - for category/template keys
- Prevents XSS and normalizes whitespace

### Admin Authentication
- Admin routes require `adminAuth.requireAdmin()` dependency returning `AdminContext`
- Validates admin key hash, logs actions to `AdminAuditLog` via [app/auditLog.py](backend/app/auditLog.py)
- Always call `logAdminAction()` for audit trail on mutations

## Redis Failover Strategy
Redis powers rate limiting, caching, and vote deduplication but **must fail open**:
- Use `safeRedisGet/Set/Delete/Incr/Expire` from [app/redisClient.py](backend/app/redisClient.py)
- If Redis is down, functions return None/False and log warnings
- Database constraints still prevent duplicate votes even if Redis fails
- See [MEDIUM_PRIORITY_GUIDE.md](backend/MEDIUM_PRIORITY_GUIDE.md) for details

## Development Workflows

### Local Setup
```bash
cd backend
pip install -r requirements.txt
# Set .env with databaseUrl, redisUrl, secretKey, adminKey
alembic upgrade head  # Run migrations
uvicorn app.main:app --reload
```

### Database Migrations
```bash
# Generate migration after model changes
alembic revision --autogenerate -m "description"
# Review generated file in alembic/versions/, edit if needed
alembic upgrade head
```

### CLI Tools
- `python -m app.adminCli audit-logs` - view admin audit log
- `python -m app.adminCli instances --date 2025-12-30` - list poll instances
- `python -m app.adminCli find-missing-snapshots` - find closed polls without snapshots
- `python -m app.adminCli create-missing-snapshots` - create snapshots for closed polls missing them
- `python -m app.adminCli regenerate-snapshots` - regenerate all snapshots (updates data structure)
- `python -m app.adminCli test-vote --instance-id <ID> --count 50 --random` - create test votes (bypasses all duplicate checks)
- `python -m app.rolloverCli` - manually trigger rollover
- `python -m app.closeCli` - manually close polls

For production (Fly.io): `fly ssh console -C "python -m app.adminCli <command>"`

### Testing Vote Flow

**Via API:**
```bash
# Start server
uvicorn app.main:app --reload

# Get today's polls
curl http://localhost:8000/polls/today

# Submit vote (cookie automatically set in response)
curl -X POST http://localhost:8000/polls/vote \
  -H "Content-Type: application/json" \
  -d '{"instanceId":"...", "rankings":["option1", "option2"]}'
```

**Via CLI (recommended for testing):**
```bash
# Create a single test vote with specific rankings
python -m app.adminCli test-vote --instance-id <ID> --rankings "opt1,opt2,opt3"

# Create 50 random test votes (SINGLE polls: picks 1 random option, RANKED polls: random rankings)
python -m app.adminCli test-vote --instance-id <ID> --count 50 --random

# On production
fly ssh console -C "python -m app.adminCli test-vote --instance-id <ID> --count 100 --random"
```

The test-vote CLI command:
- Bypasses all duplicate vote checks (IP, cookie, database constraints)
- Generates unique voter token hashes for each vote
- `--random` flag: For SINGLE polls, randomly picks one option; for RANKED polls, randomly selects 1-N options in shuffled order
- Useful for testing tally logic, result displays, and generating realistic vote distributions

## Common Gotchas

### Timezone Handling
All "today" logic uses `America/New_York` timezone (see `getEasternToday()`). Don't use `date.today()` directly.

### Idempotency
- Rollover is idempotent: won't recreate instances if they exist
- Snapshot upsert overwrites previous snapshot for same instance
- Vote submission returns 409 if duplicate (database constraint enforced)

### Settings & Environment
- Cookie domain/secure flags controlled by `settings.cookieDomain` and `settings.cookieSecure`
- CORS origins from `settings.corsOrigins` (comma-separated in env)
- Always use `settings.async_database_url` property for engine creation

### Admin API Responses
Admin routes return camelCase JSON matching Pydantic schemas. Example: `categoryId` not `category_id`.

## Deployment (Fly.io)

### Key Files
- [fly.toml](backend/fly.toml): concurrency limits (200 soft, 250 hard), auto-scaling config
- [Dockerfile](backend/Dockerfile): multi-stage build, runs as non-root user
- Health check endpoint: `/healthz` (required for Fly health monitoring)

### Secrets Management
Set secrets via Fly CLI:
```bash
fly secrets set DATABASE_URL="postgres://..." REDIS_URL="redis://..." SECRET_KEY="..." ADMIN_KEY="..."
```

### Monitoring
- Logs: `fly logs`
- SSH access: `fly ssh console`
- Health status checked at `/healthz` every 30s

## Frontend Architecture (Next.js + TypeScript)

### Tech Stack
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **CAPTCHA**: Recommended - Cloudflare Turnstile or hCaptcha (lighter than reCAPTCHA)

### Key Components Needed
1. **PollList** - Groups polls by category, hides empty categories
2. **PollCard** - Displays single poll with voting UI
3. **RankedChoiceVoter** - Drag-and-drop or numbered ranking interface
4. **SingleChoiceVoter** - Radio button selection
5. **CategoryGroup** - Collapsible category sections

### API Integration
- Base URL: `https://the-all-thing-backend.fly.dev` (or configure via env)
- Endpoints:
  - `GET /polls/today` - Today's active polls
  - `POST /polls/vote` - Submit vote (returns cookie)
- Cookie handling: Browser automatically manages `vt` cookie for voter identity

### Voter Experience
- **First visit**: API sets signed cookie (`vt`) automatically
- **Voting**: One vote per poll (enforced server-side)
- **Duplicate prevention**: 409 error if already voted
- **Rankings**: For RANKED polls, submit array of optionIds in preference order
