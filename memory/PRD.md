# Storybook Vault — PRD

## Original Problem Statement
Load public GitHub repo (`https://github.com/plannersandjournal0-wq/story-vault-new-feature`) 
for "Storybook Vault" without changing existing code, then implement admin features.

## Users
- **Admin** — uploads PDFs, designs spread layouts, maps personalization fields
- **Customer/Buyer** — fills out personalization form, receives customized flipbook PDF

## Core Architecture
- **Frontend**: React + TailwindCSS + Fabric.js (canvas editor)
- **Backend**: FastAPI + Motor (async MongoDB) + PyMuPDF (fitz)
- **DB**: MongoDB
- **Key Dirs**: `/app/backend/templates/`, `/app/backend/spreads/`, `/app/backend/personalized/`

---

## What's Been Implemented

### Phase 1 — Initial Setup (Session 1)
- Cloned GitHub repository and set up full-stack environment
- Installed dependencies: `fitz` (PyMuPDF) on backend, `fabric` on frontend

### Phase 2 — Admin Visual Editor (Session 1)
- Implemented `SpreadBlockEditor.js` — Fabric.js canvas editor for placing `spread_blocks`
- Added Field Definitions tab + Edit Spread Layout buttons to `TemplateManagement.js`
- PDF upload without fillable fields (removed server-side block, added UploadModal)
- Live preview modal inside SpreadBlockEditor
- Quick-Define custom fields directly inside the spread editor

### Phase 4 — Polar Flow Debug (Session 3 — Current)
**Problem:** Payment succeeds, success page loops → "check email", form never opens, email never arrives,
sometimes storybook generated without personalization.

**Root Causes Fixed:**

| # | Bug | Fix |
|---|-----|-----|
| 1 | `parse_polar_webhook` never extracted `data.checkout_id` → session stored with `order_id` as `checkout_id` → `by-checkout` lookup always failed | Added `data.get("checkout_id")` extraction; `checkoutId` now returned from parser |
| 2 | `get_session_by_checkout` had no fallback | Added 3-level fallback: `checkout_id` → `order_id` → `external_order_id` |
| 3 | `requestedName=None` from Polar payload caused Pydantic 500 | Added `or ""` guard to the `requested_name` extraction chain |
| 4 | `requestedName` hard-required in `_create_order` | Made it optional; only `customerEmail` is required |
| 5 | No debug logging anywhere in flow | Added `[POLAR PARSE]`, `[PERSONALIZATION FLOW]`, `[SESSION CREATED]`, `[BY-CHECKOUT]`, `[EMAIL]` logs |
| 6 | `send_personalization_email` swallowed all errors; didn't update session | Now logs Resend ID, updates `email_sent`, `email_sent_at`, `resend_email_id` in session |
| 7 | `simulate_polar_webhook` didn't inject `checkout_id` | Now generates `chk_sim_xxx` and returns `checkoutId` + `successPageUrl` in response |
| 8 | Success page timeout only 30s | Increased to 60s (`MAX_POLLS=30`), progress bar added |
| 9 | No admin visibility into personalization sessions | New `PersonalizationOrders.js` page, `/api/admin/personalization/sessions`, `/api/admin/personalization/sessions/{token}/resend-email` |


- **TASK 1 — Fix empty spreads**: Auto-generate spread background images from template PDF
  - `generate_template_spread_images()` helper added to `server.py`
  - Priority: storybook images → cached template images → generate from PDF
  - New route: `GET /api/template-spreads/{template_id}/{filename}`
  - `TEMPLATE_SPREADS_DIR = /app/backend/spreads/templates/`
- **TASK 2 — Custom font dropdown**: 
  - `SpreadBlockEditor.js` loads fonts from `GET /api/assets/fonts` on mount
  - Fonts registered via FontFace API (`document.fonts.add()`)
  - Font dropdown merges system fonts (10) + uploaded custom fonts
  - Block data stores `font_id`, `font_url`, `font_family` for full PDF/canvas parity
- **TASK 3 — Typography spacing controls**:
  - Added `letter_spacing` (Fabric `charSpacing`, ‰ of font size) control
  - Added `line_height` (Fabric `lineHeight`, multiplier) control
  - Both persisted in spread_blocks and applied end-to-end
- **TASK 4 — Wire spread_blocks into PDF rendering**:
  - Restructured `_fill_pdf()` in `personalization_processor.py`
  - Added `_overlay_spread_blocks()` using PyMuPDF `insert_textbox`
  - Supports font_family, font_id (custom font files), font_size, color, alignment, line_height
  - Coordinate parity: image-pixel → PDF-point using deterministic zoom=1.5 scaling
  - Added `_hex_to_rgb()` and `_get_fitz_fontname()` helpers
  - Rect height auto-expanded to `max(stored_h, font_size * line_height * 1.5)` to prevent clipping
  - New admin endpoint: `POST /api/admin/templates/{template_id}/preview-pdf`
  - Backward compatible: still handles legacy `fieldMappings` templates

---

## Key API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/templates/{id}/spreads` | Get spreads with background images + blocks |
| PUT | `/api/admin/templates/{id}/spreads/{sid}/blocks` | Save spread blocks |
| GET | `/api/template-spreads/{id}/{filename}` | Serve generated template spread images |
| GET | `/api/assets/fonts` | List uploaded custom fonts |
| POST | `/api/admin/templates/{id}/preview-pdf` | Generate test PDF with spread_blocks overlaid |

---

## DB Schema
```
templates: {id, title, productSlug, basePdfPath, pageCount, orientation,
            field_definitions, spread_blocks, requires_personalization}

spread_block: {spread_id, block_id, type, x, y, width, height,
               text_template, font_family, font_id, font_url,
               font_size, font_weight, italic, color, alignment,
               letter_spacing, line_height, max_lines, overflow_behavior,
               rotation, z_index, allowed_fields}

personalization_sessions: {session_token, checkout_id, template_snapshot,
                            personalization_data, status}
assets: {id, type, name, filePath, publicUrl}
```

---

## Prioritized Backlog

### P0 — Critical (all done)
- [x] Fix empty spreads in editor
- [x] Fix custom fonts (dropdown + canvas rendering)
- [x] Wire spread_blocks into PDF rendering
- [x] Add letter_spacing and line_height

### P1 — High
- [ ] Image-type spread blocks — place customer photo onto canvas/PDF
- [ ] Admin PDF preview modal (render preview-pdf in-browser)

### P2 — Medium
- [ ] Polar order webhook integration
- [ ] Email delivery via Resend after order processed
- [ ] Customer personalization form UI

### P3 — Backlog
- [ ] Multi-page spread pagination in personalization zone
- [ ] Block z-index drag reorder
- [ ] Undo/Redo in canvas editor
