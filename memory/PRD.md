# Storybook Vault - PRD & Implementation Record

## Original Problem Statement
Build a Template-Driven Personalization System for Storybook Vault where:
- Payment through Polar creates personalization sessions for templates with field_definitions
- Customers fill dynamic forms generated from template specifications
- Flipbooks are generated after form submission
- Templates without field_definitions continue using existing auto-generation flow

**Additional Tasks (April 2026):**
- Task 1: Remove admin password security completely
- Task 2: Add Review/Feedback system in storybook view

## Architecture

### Tech Stack
- **Frontend**: React.js with Tailwind CSS
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Payment**: Polar.sh integration
- **Email**: Resend

### Data Flow
```
Polar Payment → Webhook → Check Template 
    ↓
[Has field_definitions?]
    ↓ YES                    ↓ NO
Create Session           Auto-generate (legacy)
    ↓
Email personalization link
    ↓
Customer fills form at /personalize/:token
    ↓
Submit → Generate flipbook
    ↓
Email delivery link
```

## What's Been Implemented

### Phase 1: Personalization System (April 2026)
- Extended template model with `field_definitions` and `spread_blocks`
- New `personalization_sessions` collection
- Conditional webhook handling (personalization vs auto-generation)
- Dynamic form page at `/personalize/:token`
- Success page at `/personalization/success` with polling and redirect
- One-time submit with form locking
- Seeded "Baby Boy Adventure" template

### Task 1: Admin Password Removal (April 2026)
- Removed hardcoded password "Pankaj021" check
- AuthContext auto-authenticates all users
- ProtectedRoute always allows access
- Backend `/api/admin/login` accepts any/empty password
- Admin panel directly accessible at `/admin`

### Task 2: Review/Feedback System (April 2026)
- **Frontend:**
  - MessageSquare icon added to navbar (desktop, mobile portrait, mobile landscape)
  - Review modal with 5-star rating and textarea
  - Star hover effects and selection feedback
  - Duplicate submission prevention via sessionStorage
  - Thank you message after successful submission
- **Backend:**
  - `reviews` collection in MongoDB
  - `POST /api/reviews/submit` - Submit review with duplicate check
  - `GET /api/admin/reviews` - List all reviews
  - `GET /api/reviews/check/{storybook_id}/{session_id}` - Check if already reviewed
- **Admin:**
  - Reviews tab in sidebar
  - Statistics display (total reviews, average rating, distribution)
  - List view of all reviews with star rating, text, storybook title, date

## Environment Variables Required

```env
# Backend
APP_BASE_URL=https://storybook-vault.vercel.app  # CRITICAL for email links
RESEND_API_KEY=re_xxx                            # For email delivery
FROM_EMAIL=noreply@yourdomain.com
SESSION_EXPIRY_DAYS=30

# Frontend  
REACT_APP_BACKEND_URL=https://your-railway-url.railway.app
```

## Prioritized Backlog

### P0 (Critical - Next)
- [ ] Configure Resend API key for email delivery
- [ ] Set APP_BASE_URL on Railway deployment

### P1 (High)
- [ ] Admin visual editor for spread_blocks (Fabric.js) - PROMPT 3
- [ ] Field definitions editor in admin panel

### P2 (Medium)
- [ ] Review analytics dashboard
- [ ] Session management UI
- [ ] Multi-template checkout support

## Load History

### April 2, 2026 - Loaded from GitHub + Phase 2 Implemented
- Cloned from `https://github.com/plannersandjournal0-wq/story-vault-new-feature`
- Phase 2 completed: Admin Visual Editor (Fabric.js)

## Phase 2 Enhancement (April 2, 2026 — Session 2)

### New Features Added
4. **Allow any PDF upload** — removed fillable-fields restriction; plain PDFs now upload successfully
5. **Upload Modal** — replaced browser `prompt()` dialogs with a proper modal (Title + Slug + Description)
6. **Field Definitions tab inside SpreadBlockEditor** — "Fields" tab in right panel; create `[dad_name]`, `[son_name]`, etc. without leaving the editor; directly connected to personalization sessions
7. **Quick Define** — when an undefined `[token]` appears in a block, click "+ Define" to pre-fill and define it instantly in the Fields tab; valid = green, invalid = red
8. **Full Preview Modal** — "Full Preview" button captures the canvas at 2× resolution with placeholder values applied; shows in a modal with Refresh + Download buttons



### Features Added
1. **SpreadBlockEditor** (`/admin/templates/:templateId/spread-editor`)
   - Fabric.js 5.3.0 canvas for visual block placement
   - Left panel: Page selector (all spreads listed)
   - Center: Fabric canvas with background spread images
   - Right panel: Block config (font, size, bold/italic, color, alignment)
   - Preview mode: replaces `[field_key]` with sample values
   - Save button: PUT /api/admin/templates/:id/spreads/:spreadId/blocks
   - Token validation: green badge for valid fields, red warning for unknown

2. **Field Definitions Tab** in TemplateManagement modal
   - New 3rd tab alongside Field Mapping and Default Styling
   - Add/edit/delete field definitions inline
   - Reorder with up/down buttons
   - Saved to template via PUT /api/templates/:id

3. **Edit Spread Layout Button** on TemplateCard
   - Layers icon navigates to spread editor route

### Known Issues / Notes

1. **Email URLs**: Ensure `APP_BASE_URL` is set correctly on Railway
2. **Admin Access**: Now open without password - add proper auth if needed for production
3. **Review Duplicates**: Prevented per browser session only (not per user account)
4. **Spread blocks vs PDF overlay**: `spread_blocks` are stored visually; actual PDF overlay rendering is future work
