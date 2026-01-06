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

### Future Feature: Anonymous Demographic Survey (NOT YET IMPLEMENTED)
**Privacy-First Architecture** - Collect demographic data from anonymous users without creating persistent profiles:

**Implementation Plan**:

1. **Client-Side Survey Modal**:
   - Show popup on first visit if localStorage doesn't have `demographic_survey_completed` flag
   - Multi-step form with questions: age range, gender, race/ethnicity, location (state/region, urban/suburban/rural), political affiliation/ideology, religion, education level
   - Users can skip survey (optional participation)
   - Store responses in localStorage as JSON object
   - Set `demographic_survey_completed: true` flag to prevent re-showing

2. **Vote Submission with Demographics**:
   - When user votes, client reads demographic data from localStorage
   - Send demographics along with vote payload to backend
   - Backend stores demographic attributes directly on `voteBallots` table (new columns: `ageRange`, `gender`, `race`, `region`, `politicalAffiliation`, etc.)
   - Users who skip survey get NULL values for demographic fields

3. **Privacy Benefits**:
   - No persistent demographic profile on backend
   - No separate `demographicId` or linkage tables
   - Demographics only stored when user actually votes
   - Each vote is independent snapshot with demographic attributes
   - If user clears localStorage, they get fresh survey (new "identity")
   - Can't track a person across devices or sessions
   - Can analyze aggregate patterns: "voters aged 25-34 preferred option X"
   - Can't trace: "all votes from this specific person"

4. **Database Schema Changes**:
   - Add demographic columns to `voteBallots` table (all nullable)
   - Columns: `ageRange`, `gender`, `race`, `ethnicity`, `region`, `urbanRuralSuburban`, `politicalParty`, `politicalIdeology`, `religion`, `educationLevel`
   - Use standardized enum values or broad categories for each field

5. **Differential Privacy for Display**:
   - Add statistical noise to published demographic breakdowns
   - Never display exact counts, only percentages
   - Implement minimum thresholds (e.g., don't show breakdowns with < 30 votes)
   - Use broad categories (age ranges, not exact ages)

**Key Principles**:
- Demographics stored purely client-side until vote submission
- No persistent demographic identity on backend
- Demographic data stored as attributes on vote ballots, not separate profiles
- Users can opt-out of demographic tracking entirely (skip survey)
- Clear user communication about privacy protections and data usage

### Future Feature: AI-Generated Poll Context (NOT YET IMPLEMENTED)
**Optional Educational Context** - Provide neutral, factual background information for poll questions:

**Implementation Plan**:

1. **Database Schema**:
   - Add `contextText` field to `pollTemplates` table (nullable TEXT or JSONB)
   - Optional field - not required for all polls
   - Supports markdown formatting for rich text (links, bold, lists, etc.)

2. **Admin Workflow**:
   - When creating/editing poll template, admin sees "Generate Context" button
   - Clicking triggers AI API call to generate neutral background explanation
   - AI receives poll title, question, and options as input
   - Generated text appears in editable text area for admin review
   - Admin can edit, rewrite, or regenerate before saving
   - Save template with approved context text

3. **AI Generation**:
   - Use OpenAI GPT-4 or Anthropic Claude API (configurable)
   - System prompt ensures neutrality: "Provide neutral, factual context for this poll question. Include relevant background, key perspectives, and definitions. Stay objective and cite sources where possible. Keep it concise (200-400 words)."
   - Input: poll title, question text, option labels
   - Output: Markdown-formatted context text (~200-400 words)

4. **Frontend Display**:
   - Add "?" icon or "Context" button to poll cards (both list and detail views)
   - Click expands section below poll question showing context text
   - Smooth accordion animation for expansion/collapse
   - Render markdown with proper formatting
   - Context state persists in URL or local component state

5. **User Experience**:
   - Context button only appears if template has contextText
   - Expandable section doesn't interfere with voting UI
   - Users can read context before or after voting
   - Mobile-friendly responsive design

**Key Principles**:
- Context is optional, not required for all polls
- Admin has full editorial control - AI only assists
- Neutrality is critical - avoid bias in explanations
- Keep context concise and factual
- Cite sources where appropriate

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
- **Styling**: Tailwind CSS v4
- **CAPTCHA**: Cloudflare Turnstile (integrated via @marsidev/react-turnstile)
- **Theme**: Dark mode support with localStorage persistence

### Project Structure
```
frontend/src/
├── app/
│   ├── layout.tsx              # Root layout with theme script
│   ├── page.tsx                # Home page (redirects to /polls)
│   ├── polls/
│   │   ├── page.tsx            # Main polls listing (defaults to Featured)
│   │   └── [categoryKey]/
│   │       ├── page.tsx        # Category view
│   │       └── [templateKey]/
│   │           └── page.tsx    # Poll detail with history
│   └── globals.css             # Tailwind v4 configuration
├── components/
│   ├── PublicLayout.tsx        # Sidebar navigation + search
│   ├── PollList.tsx            # Renders categories and polls
│   ├── PollCard.tsx            # Individual poll with voting UI
│   ├── CurrentResults.tsx      # Live vote results display
│   ├── ThemeToggle.tsx         # Dark mode toggle
│   └── IRVRoundsVisualization.tsx # Ranked-choice results display
└── lib/
    ├── api.ts                  # Backend API client
    └── types.ts                # TypeScript interfaces
```

### Key Components

#### PublicLayout.tsx
- **Purpose**: Main layout with sidebar navigation and search
- **Features**:
  - Integrated Featured polls section at top of navigation
  - Active page markers and visible section highlights
  - Global search across all poll titles/questions (max-w-2xl width)
  - Search results dropdown with poll title, question, and category badge
  - Responsive sidebar (collapsible on mobile)
  - Logo switches between light/dark versions based on theme (all locations: desktop sidebar, mobile sidebar, mobile header)
- **Navigation Structure**:
  ```typescript
  const navCategories = [
    { categoryKey: 'featured', categoryName: 'Featured' },
    ...sortedCategories
  ];
  ```
- **Search Implementation**: Uses `useMemo` to prevent cascading renders
- **State Management**: Tracks `activeCategory`, `activeParent`, `visibleSection`, `searchQuery`, `showSearchResults`

#### PollCard.tsx
- **Purpose**: Individual poll display and voting interface
- **Key Features**:
  - Always expanded (no collapse functionality)
  - Supports both SINGLE and RANKED poll types
  - Cloudflare Turnstile integration for vote submission
  - LocalStorage for vote state persistence (`poll_votes` JSON array)
  - Shows vote confirmation after submission
  - Different displays based on context:
    - **Main list**: Full "Your Vote" breakdown with link to view history
    - **Detail page** (hideHistoryLink=true): Minimal vote indicator, results shown in CurrentResults component below
  - Color accents: emerald primary, blue secondary
- **Props**: `poll`, `category`, `allCategories`, `hideHistoryLink` (optional)
- **Styling**: 
  - Success state: `border-l-4 border-emerald-500` with gradient background
  - Voting state: `border-l-4 border-blue-500`
  - Options: `border-2 hover:border-emerald-500`

#### CurrentResults.tsx
- **Purpose**: Display live vote results on poll detail page after user has voted
- **Features**:
  - For SINGLE polls: Shows vote counts and percentages with emerald-to-blue gradient progress bars
  - For RANKED polls: Shows first-choice counts only with message that full IRV results available after close
  - Uses `CurrentPollResults` type from lib/types.ts
  - Displays total votes/ballots count
- **Used In**: Poll detail page when user has voted and poll status is OPEN 
  - Success state: `border-l-4 border-emerald-500` with gradient background
  - Voting state: `border-l-4 border-blue-500`
  - Options: `border-2 hover:border-emerald-500`

#### PollList.tsx
- **Purpose**: Renders list of categories and their polls
- **Features**:
  - Groups polls by category
  - Gradient headers: `bg-gradient-to-r from-emerald-600 to-blue-600`
  - Border accents: `border-b-2 border-emerald-500/50`
- **Props**: `categories: PollCategory[]`

#### ThemeToggle.tsx
- **Purpose**: Dark mode toggle button
- **Implementation**:
  - Uses DOM manipulation directly (avoids cascading renders)
  - Persists to localStorage
  - Force update pattern: `const [, forceUpdate] = useState({})`
  - Checks `document.documentElement.classList.contains('dark')`
- **Important**: Root layout includes inline script to set theme before hydration

#### IRVRoundsVisualization.tsx
- **Purpose**: Displays ranked-choice voting (IRV) round-by-round results
- **Features**:
  - Shows each elimination round
  - Vote transfer visualization
  - Winner highlighting
- **Used In**: Poll detail page history section

### Page Routing & Navigation

#### Featured Polls
- **Default landing page**: `/polls` defaults to showing Featured category
- **Implementation**:
  ```typescript
  const effectiveCategory = categoryParam || selectedCategory || 'featured';
  ```
- **Data Structure**: `extractFeaturedPolls()` returns `PollCategory[]` preserving original category structure
  - Each featured poll maintains reference to its original category
  - Enables correct URL generation: `/polls/{originalCategoryKey}/{templateKey}`
- **Navigation**: Featured appears as first item in sidebar with active markers

#### URL Structure
- `/polls` - Polls listing (defaults to Featured)
- `/polls/featured` - Featured polls explicitly
- `/polls/{categoryKey}` - Specific category view
- `/polls/{categoryKey}/{templateKey}` - Individual poll detail page

#### Layout & Centering
- **Container width**: `max-w-3xl` (768px) for optimal readability
- **Centering**: `mx-auto` on all main content containers
- **Applied to**:
  - `/polls/page.tsx` main content area
  - `/polls/[categoryKey]/[templateKey]/page.tsx` detail view
  - Both "not found" states

### Theme System

#### Implementation
1. **Root Layout Script** (runs before React hydration):
   ```typescript
   <html lang="en" suppressHydrationWarning>
     <head>
       <script dangerouslySetInnerHTML={{ __html: `
         const theme = localStorage.getItem('theme') || 
           (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
         if (theme === 'dark') document.documentElement.classList.add('dark');
       `}} />
     </head>
   ```
2. **ThemeToggle Component**: Manipulates DOM directly, updates localStorage
3. **Tailwind**: Uses `dark:` variants throughout components

### Color Scheme
- **Primary**: Emerald (`#10b981` / `emerald-500/600`)
- **Secondary**: Blue (`#3b82f6` / `blue-500/600`)
- **Gradients**: `from-emerald-600 to-blue-600` on headers and links
- **Borders**: `border-emerald-500` for active/hover states
- **Usage**:
  - Category headers: gradient text with emerald border
  - Poll cards: blue border when voting, emerald when voted
  - Buttons/options: emerald hover states
  - Links: emerald-to-blue gradient on hover

### Search Functionality
- **Scope**: Searches across all poll titles and questions
- **UI**: Dropdown below search input showing:
  - Poll title
  - Poll question (if present)
  - Category badge
- **Behavior**:
  - Opens on input focus/typing
  - Closes on outside click
  - Clears on result selection
  - Navigates to poll detail page on click
- **Performance**: Uses `useMemo` to avoid cascading renders

### API Integration
- **Base URL**: `https://the-all-thing-backend.fly.dev` (configured via `NEXT_PUBLIC_API_URL`)
- **Client**: `/lib/api.ts` with functions:
  - `getTodayPolls()` - Fetches all polls for today
  - `submitVote(instanceId, rankings, turnstileToken)` - Submit vote with CAPTCHA
  - `getPollHistory(templateId)` - Fetch historical results for a poll
  - `getCurrentResults(pollId)` - Fetch live vote results for open polls
- **Cookie handling**: Browser automatically manages `vt` cookie for voter identity
- **Error handling**: API errors displayed in UI with user-friendly messages

### Voter Experience Flow
1. **First visit**: API sets signed cookie (`vt`) automatically on first vote
2. **Voting**: 
   - Complete Turnstile CAPTCHA challenge
   - Select option (SINGLE) or rank options (RANKED)
   - Submit vote
3. **Duplicate prevention**: 409 error if already voted (stored in localStorage `poll_votes` array + cookie check)
4. **Results Display**:
   - **Main list**: Shows "Your Vote" breakdown with link to view history
   - **Detail page**: Shows minimal vote indicator + live CurrentResults component below
   - For SINGLE polls: Vote counts and percentages with gradient bars
   - For RANKED polls: First-choice counts only (full IRV rounds shown after poll closes)
5. **Rankings**: For RANKED polls, submit array of optionIds in preference order

### TypeScript Types
Located in `/lib/types.ts`:
- `Poll` - Individual poll instance
- `PollCategory` - Category with polls and subcategories
- `PollOption` - Poll option/choice
- `PollResult` - Historical result snapshot
- `CurrentPollResults` - Live vote results for open polls
- `IRVRound` - Ranked-choice voting round data

### Development Patterns

#### State Management
- Use `useState` for local component state
- Use `useMemo` for derived/computed values (prevents cascading renders)
- Use `useEffect` for side effects (API calls, localStorage)
- Avoid `useEffect` with setState for search/filtering (use `useMemo` instead)

#### Preventing Cascading Renders
- ❌ Don't: `useEffect(() => setResults(search()), [query])`
- ✅ Do: `const results = useMemo(() => search(), [query])`

#### Featured Polls Pattern
Extract featured polls while preserving original category structure:
```typescript
function extractFeaturedPolls(categories: PollCategory[]): PollCategory[] {
  const result: PollCategory[] = [];
  for (const cat of categories) {
    const featuredInCategory = cat.polls.filter(p => p.isFeatured);
    if (featuredInCategory.length > 0) {
      result.push({
        ...cat,
        polls: featuredInCategory,
        subCategories: []
      });
    }
  }
  return result;
}
```

### Common UI Patterns

#### Always-Expanded Cards
Poll cards no longer have collapse functionality - they always show full content:
- Removed `isExpanded` state
- Removed toggle button
- Simplified component structure

#### Gradient Progress Bars
Use emerald-to-blue gradient for all progress bars (current results and history):
```tsx
<div className="bg-linear-to-r from-emerald-600 to-blue-600 h-2 rounded-full" />
```

#### Gradient Headers
```tsx
<h2 className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-blue-600">
  {title}
</h2>
```

#### Hover Effects
```tsx
<button className="border-2 hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20">
  {label}
</button>
```
