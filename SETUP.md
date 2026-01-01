# Frontend Setup Guide

## Quick Start

```bash
cd frontend

# Initialize Next.js with TypeScript and Tailwind
npx create-next-app@latest . --typescript --tailwind --app --use-npm

# Install additional dependencies
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install @hookform/resolvers zod react-hook-form
npm install clsx tailwind-merge

# For CAPTCHA (choose one):
npm install @hcaptcha/react-hcaptcha
# OR
npm install @cloudflare/turnstile
```

## Project Structure

```
frontend/
├── app/
│   ├── page.tsx                 # Main poll listing page
│   ├── layout.tsx               # Root layout
│   └── api/                     # Optional API routes for server-side calls
├── components/
│   ├── PollList.tsx             # Main container, groups by category
│   ├── CategoryGroup.tsx        # Category section with polls
│   ├── PollCard.tsx             # Individual poll wrapper
│   ├── SingleChoiceVoter.tsx    # Radio button voting
│   ├── RankedChoiceVoter.tsx    # Drag-and-drop ranking
│   └── CaptchaWrapper.tsx       # CAPTCHA integration
├── lib/
│   ├── api.ts                   # API client functions
│   ├── types.ts                 # TypeScript types
│   └── utils.ts                 # Utility functions
└── .env.local                   # Environment variables
```

## Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=https://the-all-thing-backend.fly.dev
# Or for local development:
# NEXT_PUBLIC_API_URL=http://localhost:8000

# CAPTCHA keys (choose one provider)
NEXT_PUBLIC_HCAPTCHA_SITE_KEY=your_site_key
HCAPTCHA_SECRET_KEY=your_secret_key
```

## Key TypeScript Types

```typescript
// lib/types.ts
export type PollType = "SINGLE" | "RANKED";

export interface PollOption {
  id: string;
  label: string;
  sortOrder: number;
}

export interface Poll {
  id: string;
  templateId: string;
  categoryId: string;
  pollDate: string;
  title: string;
  question: string | null;
  pollType: PollType;
  maxRank: number | null;
  status: "OPEN" | "CLOSED";
  options: PollOption[];
}

export interface Category {
  id: string;
  key: string;
  name: string;
  sortOrder: number;
}

export interface PollsData {
  categories: Category[];
  instances: Poll[];
}

export interface VoteSubmission {
  instanceId: string;
  rankings: string[]; // Array of optionIds in preference order
  captchaToken?: string;
}
```

## API Client Example

```typescript
// lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function getTodayPolls(): Promise<PollsData> {
  const res = await fetch(`${API_URL}/polls/today`, {
    credentials: 'include', // Important: sends/receives cookies
  });
  
  if (!res.ok) throw new Error('Failed to fetch polls');
  
  const json = await res.json();
  return json.data;
}

export async function submitVote(vote: VoteSubmission): Promise<void> {
  const res = await fetch(`${API_URL}/polls/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(vote),
  });
  
  if (res.status === 409) {
    throw new Error('You have already voted on this poll');
  }
  
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to submit vote');
  }
}
```

## Ranked Choice UI Recommendations

### Option 1: Drag and Drop (@dnd-kit)
- Most intuitive for users
- Visually clear ranking order
- Mobile-friendly with touch support

### Option 2: Number Input
- Simpler implementation
- Good for keyboard users
- Accessible

### Option 3: Up/Down Buttons
- No drag-and-drop needed
- Works everywhere
- Clear visual feedback

## CAPTCHA Integration

### Cloudflare Turnstile (Recommended)
- Lighter weight
- Better UX (fewer challenges)
- Free tier available

### hCaptcha
- Privacy-focused
- Earns small revenue for site owners
- Good reCAPTCHA alternative

## Deployment Options

### Vercel (Recommended for Next.js)
```bash
npm install -g vercel
vercel
```

### Fly.io
```bash
# Add Dockerfile and fly.toml
fly launch
```

### Netlify
```bash
# Connect via Git
# Auto-deploys on push
```

## Development Workflow

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run type-check
```

## CORS Configuration

Your backend is already configured for CORS. Make sure your frontend URL is in the backend's `CORS_ORIGINS` environment variable:

```bash
# On Fly.io
fly secrets set CORS_ORIGINS="http://localhost:3000,https://your-frontend.vercel.app"
```

## Next Steps

1. Initialize Next.js project with the commands above
2. Create the type definitions in `lib/types.ts`
3. Build the API client in `lib/api.ts`
4. Start with a simple PollList component
5. Add voting functionality
6. Integrate CAPTCHA
7. Deploy to Vercel or your preferred platform

## Example Component Skeleton

```typescript
// components/PollList.tsx
'use client';

import { useEffect, useState } from 'react';
import { getTodayPolls } from '@/lib/api';
import { PollsData } from '@/lib/types';
import CategoryGroup from './CategoryGroup';

export default function PollList() {
  const [data, setData] = useState<PollsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTodayPolls()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;
  if (!data) return <div>Failed to load polls</div>;

  // Group polls by category
  const pollsByCategory = data.instances.reduce((acc, poll) => {
    if (!acc[poll.categoryId]) acc[poll.categoryId] = [];
    acc[poll.categoryId].push(poll);
    return acc;
  }, {} as Record<string, Poll[]>);

  // Filter out empty categories
  const categoriesWithPolls = data.categories
    .filter(cat => pollsByCategory[cat.id]?.length > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-8">
      {categoriesWithPolls.map(category => (
        <CategoryGroup
          key={category.id}
          category={category}
          polls={pollsByCategory[category.id]}
        />
      ))}
    </div>
  );
}
```
