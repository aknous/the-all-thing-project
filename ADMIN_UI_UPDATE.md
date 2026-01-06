# AI Context Generation - Admin UI Update

## What Changed

I've added a user-friendly "Generate with AI" button to the admin portal's template edit page, making it easy to generate and customize poll context without using API calls.

## New Admin UI Features

### Template Edit Page (`/admin/templates/[id]`)

**New "Context" Section:**
- Located after the "Question" field in the Basic Information section
- **"Generate with AI" button** with:
  - Gradient purple-to-blue styling (matches AI theme)
  - Lightning bolt icon
  - Loading spinner during generation
  - Disabled state while generating
- **Large textarea** for editing context:
  - Monospace font for easier markdown editing
  - 8 rows tall for comfortable editing
  - Supports full markdown syntax
  - Help text explains markdown support
- Context is saved along with other template fields when clicking "Save Changes"

### Workflow
1. Go to `/admin/templates`
2. Click on any template to edit
3. Scroll to "Context (optional)" section
4. Click "Generate with AI"
5. Wait for AI to generate (5-10 seconds)
6. Review and edit the generated markdown
7. Click "Save Changes"

### Template Creation Page
- Added helpful note that context can be added after creation
- Since the AI needs the template ID and options to generate context, it's only available on existing templates

## Technical Implementation

### Frontend Changes
**File**: `/frontend/src/app/admin/templates/[id]/page.tsx`

Added:
- `contextText` field to `Template` interface
- `contextText` to form state
- `generatingContext` loading state
- `generateContext()` async function that calls the API
- New UI section with button and textarea
- Includes contextText in PATCH payload when saving

### Backend (Already Implemented)
- `POST /admin/templates/{templateId}/generate-context` endpoint
- Returns AI-generated markdown text
- Requires OpenAI API key configured

## User Experience

### Before
❌ Admins had to use curl/Postman to generate context:
```bash
curl -X POST https://api.../admin/templates/123/generate-context \
  -H "X-Admin-Key: ..."
```

### After
✅ Admins click a button in the UI:
1. Click "Generate with AI"
2. See loading spinner
3. Generated text appears in textarea
4. Edit if needed
5. Save

## Button Design
The "Generate with AI" button has a distinctive design:
- **Gradient**: Purple to blue (AI/magic theme)
- **Icon**: Lightning bolt (instant generation)
- **Loading State**: Spinning icon + "Generating..." text
- **Position**: Top-right of the Context section
- **Size**: Small/compact to not overwhelm the form

## Files Modified
1. `/frontend/src/app/admin/templates/[id]/page.tsx` - Added context generation UI
2. `/frontend/src/app/admin/templates/new/page.tsx` - Added help text
3. `/AI_CONTEXT_FEATURE.md` - Updated documentation

## Next Steps
- ✅ Run database migration: `alembic upgrade head`
- ✅ Set `OPENAI_API_KEY` environment variable
- ✅ Test the feature in admin portal
- 📸 Optional: Add markdown preview tab (future enhancement)
