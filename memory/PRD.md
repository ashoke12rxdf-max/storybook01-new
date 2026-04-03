# Storybook Vault / Keepsake Gifts - Product Requirements Document

## Original Problem Statement
Fix and complete the full personalization flow for Storybook Vault so that template setup, Polar payment, personalization session, form rendering, storybook generation, and email delivery all work reliably without blank states or race-condition failures.

## Brand
- **Customer-facing brand**: Keepsake Gifts
- **Support email**: orchidsplanner@gmail.com
- **Sender name**: Keepsake Gifts <orders@keepsakegifts.store>

## Architecture Overview
- **Backend**: FastAPI (Python) with MongoDB
- **Frontend**: React.js with Tailwind CSS
- **Email**: Resend API (single personalization email only)
- **Payment**: Polar (webhook integration)
- **PDF Processing**: PyMuPDF (fitz)
- **Flipbook**: Self-hosted via /view/{slug}

---

## What's Been Implemented (Jan 2026)

### Major Updates (Latest)

#### Email Flow Simplification
- [x] Only ONE email sent after purchase: personalization link email
- [x] Removed automatic delivery email (link shown on success page instead)
- [x] All emails use "Keepsake Gifts" branding
- [x] Support email (orchidsplanner@gmail.com) included in all customer communications

#### Personalization Success Page
- [x] Shows "Your storybook is ready!" banner
- [x] "View Your Storybook" button with final URL
- [x] Password display box with copy button (if password was set)
- [x] "Save this password to open your storybook later." help text
- [x] "Your personalization details" section showing submitted values
- [x] Support email contact link

#### Password Viewer Page
- [x] Shows only storybook title (removed "Personalized for" subtitle)
- [x] Fallback to "Your Storybook" if title is empty
- [x] Clean "This storybook is password protected" label

### Backend Improvements
- [x] System password field (view_password) auto-injection
- [x] Session status polling endpoint
- [x] Delivery email skipped by default
- [x] Idempotent session creation on webhook retries
- [x] Handle None customer_name gracefully

### Frontend Improvements
- [x] PersonalizationForm.js with enhanced success state
- [x] CustomerViewer.js with simplified password gate
- [x] All pages use Keepsake Gifts branding

---

## Email Templates

### Personalization Link Email (Only Email Sent)
- **Subject**: "Complete your storybook personalization"
- **Sender**: Keepsake Gifts <orders@keepsakegifts.store>
- **Content**:
  - "Hi there, Thank you for your order..."
  - "Personalize My Storybook" button
  - Warning about one-time submission
  - Support contact: orchidsplanner@gmail.com

### Delivery Email (Disabled)
- Not sent automatically
- Link shown on success page instead
- Admin can manually resend if needed

---

## Next Tasks
1. Add child name field to templates for better storybook titles
2. Test full payment flow with real Polar checkout
3. Monitor email delivery rates

---

## API Reference

### Personalization
- `POST /api/webhooks/polar` - Real Polar webhook
- `POST /api/automation/simulate-polar-webhook` - Test webhook
- `GET /api/personalization/by-checkout?checkout_id=xxx`
- `GET /api/personalization/session/{token}`
- `GET /api/personalization/session/{token}/status`
- `POST /api/personalization/session/{token}/submit`
