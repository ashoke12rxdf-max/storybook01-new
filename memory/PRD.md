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

### Bug Fixes (Latest)
- [x] Fixed: `customer_name` was None from Polar webhook causing Pydantic validation error
- [x] Fixed: Now handles None/missing customer_name gracefully with empty string default
- [x] Added: `send_personalization_link_email()` function for immediate email after payment
- [x] Added: Webhook now sends personalization email automatically for real (non-simulated) orders
- [x] Added: Email sent tracking (`email_sent`, `email_sent_at` fields on session)

### Backend Improvements
- [x] System password field injection in `personalization_session.py`
- [x] Session status polling endpoint (`/api/personalization/session/{token}/status`)
- [x] Delivery email tracking (`delivery_email_sent`, `delivery_email_sent_at`)
- [x] Password extraction from `view_password` field for storybook protection
- [x] Idempotent session creation on webhook retries
- [x] Personalization link email template with branded design

### Frontend Improvements
- [x] **PersonalizationForm.js**: Complete rewrite with post-submit polling
- [x] **PersonalizationSuccess.js**: Polling with timeout and email fallback
- [x] **TemplateManagement.js**: Live form preview panel and field validation
- [x] **SpreadBlockEditor.js**: Token insertion chips for quick placeholder insertion
- [x] **PersonalizationOrders.js**: Enhanced status tracking with email indicators

### Environment Configuration
- [x] RESEND_API_KEY configured
- [x] FROM_EMAIL: orders@keepsakegifts.store
- [x] APP_BASE_URL: https://personalize-pdf.preview.emergentagent.com
- [x] POLAR_WEBHOOK_SECRET configured

---

## Templates Available
1. **Baby Boy Adventure** (baby-boy-adventure) - 4 fields
2. **Storybook** (storybook) - 1 field

---

## Email Templates

### 1. Personalization Link Email
- Sent immediately after Polar payment webhook
- Contains: Product title, unique personalization form link
- Subject: "Complete your storybook personalization - {product_title}"

### 2. Storybook Delivery Email  
- Sent after storybook generation completes
- Contains: Storybook title, view URL, password (if set)
- Subject: "Your personalized storybook is ready!"

---

## Next Tasks
1. Monitor real Polar webhooks for any edge cases
2. Test full generation flow with actual PDF uploads
3. Add more field types if needed

---

## API Endpoints Reference

### Personalization Flow
- `POST /api/automation/simulate-polar-webhook` - Test webhook
- `POST /api/webhooks/polar` - Real Polar webhook endpoint
- `GET /api/personalization/by-checkout?checkout_id=xxx` - Session lookup
- `GET /api/personalization/session/{token}` - Session data
- `GET /api/personalization/session/{token}/status` - Status polling
- `POST /api/personalization/session/{token}/submit` - Form submission
