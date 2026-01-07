# AI-Generated Poll Context Feature

## Overview
This feature provides optional educational context for poll questions using AI-powered generation. The context appears as an expandable section in the poll card, allowing voters to understand the background and key perspectives before voting.

## Architecture

### Backend Components

#### 1. Database Schema
- **Field**: `contextText` (nullable TEXT) added to `pollTemplates` table
- **Migration**: `g3h4i5j6k7l8_add_contextText_to_poll_templates.py`
- Run migration: `alembic upgrade head`

#### 2. AI Context Generation Service
- **File**: `backend/app/aiContext.py`
- **Model**: OpenAI GPT-4
- **System Prompt**: Ensures neutral, factual, educational content
- **Input**: Poll title, question (optional), and option labels
- **Output**: Markdown-formatted text (200-400 words)

#### 3. Admin API Endpoints
- **Generate Context**: `POST /admin/templates/{templateId}/generate-context`
  - Calls OpenAI API to generate context
  - Returns generated text for admin review/editing
  - Logs action to admin audit log
  
- **Update Template**: `PATCH /admin/templates/{templateId}`
  - Now accepts `contextText` field
  - Admin can save AI-generated or manually-written context

#### 4. Public API Changes
- `contextText` field now included in poll responses
- Available in `/polls/today` and `/polls` endpoints

### Frontend Components

#### 1. Dependencies
- `react-markdown`: Renders markdown content
- `remark-gfm`: GitHub Flavored Markdown support

#### 2. UI/UX
- **Admin Portal**: 
  - Edit template page (`/admin/templates/[id]`) has "Context" section
  - "Generate with AI" button with gradient purple-to-blue styling
  - Loading state with spinner during generation
  - Textarea for editing generated or custom context
  - Monospace font for markdown editing
- **Public Site (PollCard component)**:
  - Expandable section with "Show/Hide Context" button
  - Blue-themed container with proper dark mode support
  - Markdown rendered with `react-markdown` and `remark-gfm`
  - Works in both voting mode and "already voted" mode
  - Responsive mobile-friendly design

#### 3. TypeScript Types
- `Poll` interface updated with `contextText: string | null`

## Configuration

### Environment Variables
```bash
# Required for AI context generation
OPENAI_API_KEY=sk-...

# Existing required variables
DATABASE_URL=...
REDIS_URL=...
SECRET_KEY=...
ADMIN_KEY=...
```

### Settings
- **File**: `backend/app/settings.py`
- **Field**: `openaiApiKey` (optional)
- If not configured, generate-context endpoint returns 503 error

## Usage Workflow

### Admin Workflow (via Admin Portal UI)
1. Navigate to `/admin/templates` and select a template to edit
2. Scroll to the "Context" section
3. Click the **"Generate with AI"** button
   - The button will show a loading spinner while generating
   - Uses the poll title, question, and current options to generate context
4. Review the AI-generated markdown content in the textarea
5. Edit/rewrite the context as needed (supports markdown formatting)
6. Click **"Save Changes"** to update the template
7. Context will now appear in polls on the public-facing site

**Note**: Context can only be added to existing templates (not during creation). After creating a new template, edit it to add context.

### Admin Workflow (via API)
For programmatic access or bulk operations:
1. Create or edit a poll template
2. Call `POST /admin/templates/{templateId}/generate-context` to generate AI context
3. Review generated content
4. Call `PATCH /admin/templates/{templateId}` with `contextText` field to save

### User Experience
1. User views poll with context available
2. Clicks "Show Context" button to expand
3. Reads markdown-formatted background information
4. Clicks "Hide Context" to collapse
5. Proceeds to vote

## Key Principles

### Neutrality
- AI system prompt enforces neutral, objective tone
- No advocacy for specific options
- No predictions about voting outcomes
- Focus on factual background and definitions

### Privacy
- Context is template-level, not instance-level
- Same context for all daily instances of a poll
- No user data involved in generation

### Editorial Control
- Admins have full control over final content
- AI only assists - never auto-publishes
- Context is optional, not required

## API Examples

### Generate Context
```bash
curl -X POST https://api.example.com/admin/templates/{templateId}/generate-context \
  -H "X-Admin-Key: your-admin-key" \
  -H "Content-Type: application/json"
```

Response:
```json
{
  "ok": true,
  "contextText": "## Background\n\nThis poll asks about...\n\n### Key Perspectives\n- Option A represents...\n- Option B reflects..."
}
```

### Update Template with Context
```bash
curl -X PATCH https://api.example.com/admin/templates/{templateId} \
  -H "X-Admin-Key: your-admin-key" \
  -H "Content-Type: application/json" \
  -dAdmin UI Testing
1. Navigate to `/admin/login` and enter admin key
2. Go to `/admin/templates` and click on any template
3. Scroll to "Context (optional)" section
4. Click "Generate with AI" button
5. Verify loading state appears
6. Verify generated markdown content appears in textarea
7. Edit the context text
8. Click "Save Changes"
9. Navigate to public site and verify context appears in poll
10. Test "Show Context" / "Hide Context" toggle

###  '{
    "contextText": "## Custom Context\n\nEdited markdown content..."
  }'
```

## Testing

### Backend Testing
```bash
# Test context generation (requires OpenAI API key)
python -c "
from app.aiContext import generatePollContext
import asyncio

async def test():
    context = await generatePollContext(
        title='Favorite Programming Language',
        question='Which language do you prefer?',
        optionLabels=['Python', 'JavaScript', 'Rust']
    )
    print(context)

asyncio.run(test())
"
```

### Frontend Testing
1. Add context to a template via admin API
2. View poll on frontend
3. Click "Show Context" button
4. Verify markdown rendering
5. Test dark mode
6. Test responsive design

## Deployment Checklist

- [ ] Run database migration: `alembic upgrade head`
- [ ] Set `OPENAI_API_KEY` in environment (Fly.io secrets)
- [ ] Install frontend dependencies: `npm install`
- [ ] Deploy backend to Fly.io
- [ ] Deploy frontend to Vercel/hosting platform
- [ ] Test generate-context endpoint
- [ ] Verify context display on frontend

## Future Enhancements

### Potential Improvements
- Support for Anthropic Claude API as alternative to OpenAI
- Context versioning/history
- A/B testing of different context styles
- User feedback on context helpfulness
- Multi-language context generation
- Automatic context updates when poll changes

### Admin UI
Currently requires API calls. Could add:
- Admin dashboard UI for context management
- In-line editing with markdown preview
- Context templates/library
- Bulk context generation for multiple polls

## Troubleshooting

### Context Not Generating
- Check `OPENAI_API_KEY` is set correctly
- Verify API key has sufficient credits
- Check backend logs for API errors
- Test with curl to isolate frontend/backend

### Markdown Not Rendering
- Verify `react-markdown` and `remark-gfm` installed
- Check browser console for errors
- Validate markdown syntax
- Test with simple markdown first

### Context Not Displaying
- Check poll has `contextText` field populated
- Verify TypeScript types match API response
- Inspect network response in browser devtools
- Test with hardcoded contextText value
