# Storybook Vault - Product Requirements Document

## Original Problem Statement
Fix and complete the full personalization flow for Storybook Vault so that template setup, Polar payment, personalization session, form rendering, storybook generation, and email delivery all work reliably without blank states or race-condition failures.

## Architecture Overview
- **Backend**: FastAPI (Python) with MongoDB
- **Frontend**: React.js with Tailwind CSS
- **Email**: Resend API
- **Payment**: Polar (webhook integration)
- **PDF Processing**: PyMuPDF (fitz)
- **Flipbook**: Self-hosted via /view/{slug}

## User Personas
1. **Admin**: Creates templates, defines personalization fields, manages orders
2. **Customer**: Purchases storybook, fills personalization form, receives final storybook

## Core Requirements (Static)
1. Template field_definitions as source of truth for customer forms
2. Built-in optional password field (view_password) in every personalization form
3. Polar webhook creates personalization session with template snapshot
4. Success page polls for session and redirects to form
5. Post-submit polling for storybook generation status
6. Email delivery via Resend (personalization link + final delivery)

---

## What's Been Implemented (Jan 2026)

### Backend Improvements
- [x] System password field injection in `personalization_session.py`
- [x] Session status polling endpoint (`/api/personalization/session/{token}/status`)
- [x] Delivery email tracking (`delivery_email_sent`, `delivery_email_sent_at`)
- [x] Password extraction from `view_password` field for storybook protection
- [x] Idempotent session creation on webhook retries

### Frontend Improvements
- [x] **PersonalizationForm.js**: Complete rewrite with:
  - Post-submit polling for generation status
  - "Optional Settings" section for system password field
  - Empty field definitions error state
  - Generation progress indicator
  - Final "View Your Storybook" link display
  
- [x] **PersonalizationSuccess.js**: Polling with timeout and email fallback

- [x] **TemplateManagement.js**: 
  - Live form preview panel
  - Field usage validation warnings
  - System password field preview

- [x] **SpreadBlockEditor.js**:
  - Token insertion chips for quick placeholder insertion
  - Field definition quick-define from undefined tokens

- [x] **PersonalizationOrders.js**:
  - Enhanced status tracking (ready, submitted, processing, completed, failed, expired)
  - Delivery email sent indicator
  - Error message display
  - Session token display

### Environment Configuration
- [x] RESEND_API_KEY configured
- [x] FROM_EMAIL configured  
- [x] APP_BASE_URL configured
- [x] POLAR_WEBHOOK_SECRET configured

---

## Prioritized Backlog

### P0 - Critical (Done)
- [x] System password field injection
- [x] Session creation on webhook
- [x] Success page polling
- [x] Form rendering with all fields
- [x] Post-submit generation polling

### P1 - High Priority
- [ ] Real Polar integration testing (currently using simulation)
- [ ] Email delivery verification with real customer flow
- [ ] PDF generation with actual base PDF uploads

### P2 - Medium Priority
- [ ] "Create missing fields from placeholders" helper in Spread Editor
- [ ] Bulk operations in Personalization Orders
- [ ] Session retry/regenerate functionality
- [ ] Export sessions to CSV

### P3 - Nice to Have
- [ ] Custom email templates
- [ ] Analytics dashboard for conversion tracking
- [ ] Multiple storybook delivery formats
- [ ] Customer account portal

---

## Next Tasks
1. Test real Polar webhook flow (not simulation)
2. Upload actual PDF template and test generation
3. Verify email delivery end-to-end
4. Add more field types (checkbox, radio, etc.)

---

## API Endpoints Reference

### Personalization Flow
- `POST /api/automation/simulate-polar-webhook` - Test webhook
- `GET /api/personalization/by-checkout?checkout_id=xxx` - Session lookup
- `GET /api/personalization/session/{token}` - Session data
- `GET /api/personalization/session/{token}/status` - Status polling
- `POST /api/personalization/session/{token}/submit` - Form submission

### Admin
- `GET /api/admin/personalization/sessions` - List all sessions
- `POST /api/admin/personalization/sessions/{token}/resend-email` - Resend email
- `GET /api/admin/templates/{id}/spreads` - Get template spreads
