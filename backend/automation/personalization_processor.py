"""
Personalization Processor
Handles the flipbook generation pipeline after personalization form submission.
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional, Callable, List
import logging
import traceback
import os
import re
import tempfile
import shutil

import fitz  # PyMuPDF

from automation.pdf_filler import PDFFiller
from automation.personalization_session import PersonalizationSessionManager

logger = logging.getLogger(__name__)


class PersonalizationProcessor:
    """Processes submitted personalization sessions into flipbooks"""
    
    def __init__(self, db, templates_dir: Path, personalized_dir: Path):
        self.db = db
        self.templates_dir = templates_dir
        self.personalized_dir = personalized_dir
        self.pdf_filler = PDFFiller()
        self.session_manager = PersonalizationSessionManager(db)
    
    async def process_session(
        self,
        session_token: str,
        convert_to_flipbook_func: Callable
    ) -> Dict:
        """
        Process a submitted personalization session into a flipbook.
        
        Args:
            session_token: The session token to process
            convert_to_flipbook_func: Function to convert PDF to flipbook
            
        Returns:
            Updated session dict
        """
        try:
            # Get session
            session = await self.session_manager.get_session_by_token(session_token)
            
            if not session:
                raise Exception(f"Session {session_token} not found")
            
            if session.get("status") != "submitted":
                raise Exception(f"Session status is '{session.get('status')}', expected 'submitted'")
            
            # Update status to processing
            await self.session_manager.update_session_status(
                session_token, 
                "processing"
            )
            
            logger.info(f"Processing personalization session: {session_token}")
            
            # Get template snapshot and personalization data
            snapshot = session.get("template_snapshot", {})
            personalization_data = session.get("personalization_data", {})
            
            # Step 1: Fill PDF with personalization data
            personalized_pdf_path = await self._fill_pdf(
                session,
                snapshot,
                personalization_data
            )
            
            # Step 2: Generate flipbook
            flipbook_data = await self._generate_flipbook(
                session,
                personalized_pdf_path,
                convert_to_flipbook_func
            )
            
            # Step 3: Update session with completion data
            await self.session_manager.update_session_status(
                session_token,
                "completed",
                storybook_id=flipbook_data["storybookId"],
                storybook_slug=flipbook_data["slug"],
                customer_view_url=flipbook_data["customerViewUrl"]
            )
            
            # Step 4: Send delivery email
            await self._send_delivery_email(session, flipbook_data)
            
            # Step 5: Cleanup personalized PDF
            await self._cleanup_pdf(personalized_pdf_path)
            
            logger.info(f"Session {session_token} processed successfully")
            
            # Return updated session
            return await self.session_manager.get_session_by_token(session_token)
            
        except Exception as e:
            error_msg = str(e)
            error_details = traceback.format_exc()
            logger.error(f"Session processing failed: {error_msg}\n{error_details}")
            
            # Update session with error
            await self.session_manager.update_session_status(
                session_token,
                "failed",
                error_message=error_msg
            )
            
            raise
    
    async def _fill_pdf(
        self,
        session: Dict,
        snapshot: Dict,
        personalization_data: Dict
    ) -> str:
        """
        Produce the personalized PDF.
        - If fieldMappings exist: fill form fields (legacy pipeline)
        - If spread_blocks exist: overlay visual text blocks on top
        - Handles all combinations; preserves backward compatibility.
        """
        template_pdf_path = snapshot.get("basePdfPath")
        field_mappings = snapshot.get("fieldMappings", [])
        spread_blocks = snapshot.get("spread_blocks", [])
        orientation = snapshot.get("orientation", "landscape")

        # Build customer_data for legacy field-mapping filler
        customer_data = {
            "requestedName": session.get("requested_name", ""),
            "buyerFullName": session.get("customer_name", ""),
            "customerEmail": session.get("customer_email", ""),
        }
        # Pre-resolve spread block texts as named keys (legacy compatibility)
        for block in spread_blocks:
            if block.get("type") == "text" and block.get("text_template") and block.get("block_id"):
                customer_data[block["block_id"]] = self._apply_placeholders(
                    block["text_template"], personalization_data
                )
        # Add raw personalization fields
        for key, value in personalization_data.items():
            if isinstance(value, str):
                customer_data[key] = value
            elif isinstance(value, dict) and "url" in value:
                customer_data[key] = value.get("url", "")

        output_path = self.personalized_dir / f"{session['id']}.pdf"

        if field_mappings and spread_blocks:
            # Fill form fields to a temp file, then overlay spread blocks
            fd, temp_path = tempfile.mkstemp(suffix=".pdf")
            os.close(fd)
            try:
                await self.pdf_filler.fill_pdf_fields(
                    template_path=template_pdf_path,
                    field_mappings=field_mappings,
                    customer_data=customer_data,
                    output_path=temp_path,
                )
                await self._overlay_spread_blocks(
                    temp_path, spread_blocks, personalization_data,
                    str(output_path), orientation,
                )
            finally:
                if os.path.exists(temp_path):
                    os.unlink(temp_path)

        elif field_mappings:
            # Legacy flow: only form-field filling
            await self.pdf_filler.fill_pdf_fields(
                template_path=template_pdf_path,
                field_mappings=field_mappings,
                customer_data=customer_data,
                output_path=str(output_path),
            )

        elif spread_blocks:
            # New visual-editor flow: overlay spread blocks on clean template
            await self._overlay_spread_blocks(
                template_pdf_path, spread_blocks, personalization_data,
                str(output_path), orientation,
            )

        else:
            # Nothing to do — deliver the template as-is
            shutil.copy2(template_pdf_path, str(output_path))

        logger.info(f"PDF generated for session {session['session_token']}: {output_path}")
        return str(output_path)

    # ------------------------------------------------------------------
    # Spread Blocks Overlay (visual editor → PDF)
    # ------------------------------------------------------------------

    async def _overlay_spread_blocks(
        self,
        source_pdf_path: str,
        spread_blocks: List[Dict],
        personalization_data: Dict,
        output_path: str,
        orientation: str = "landscape",
    ) -> None:
        """
        Render spread_blocks onto the PDF using PyMuPDF.

        Coordinate system:
          - spread images were generated at zoom=1.5, capped at max_width
          - block x/y/width/height/font_size are in those image-pixel units
          - we convert to PDF points via  pdf_pt = image_px * (page_pts / img_px)
        """
        if not spread_blocks:
            shutil.copy2(source_pdf_path, output_path)
            return

        # Build font lookup: {font_id: file_path} and {name.lower(): file_path}
        font_id_lookup: Dict[str, str] = {}
        font_name_lookup: Dict[str, str] = {}
        try:
            fonts = await self.db.assets.find({"type": "font"}, {"_id": 0}).to_list(100)
            for f in fonts:
                if f.get("id") and f.get("filePath"):
                    font_id_lookup[f["id"]] = f["filePath"]
                if f.get("name") and f.get("filePath"):
                    font_name_lookup[f["name"].lower()] = f["filePath"]
        except Exception as e:
            logger.warning(f"Could not fetch custom fonts from DB: {e}")

        # Image-generation parameters — must mirror generate_template_spread_images
        ZOOM = 1.5
        MAX_WIDTH_LANDSCAPE = 1920
        MAX_WIDTH_PORTRAIT = 1080

        doc = fitz.open(source_pdf_path)
        try:
            for block in spread_blocks:
                if block.get("type") != "text":
                    continue

                page_num = int(block.get("spread_id", 0))
                if page_num >= len(doc):
                    logger.warning(
                        f"Block spread_id={page_num} exceeds PDF page count {len(doc)} — skipping"
                    )
                    continue

                # Resolve placeholder text
                text = self._apply_placeholders(
                    block.get("text_template", ""), personalization_data
                )
                if not text.strip():
                    continue

                page = doc[page_num]

                # Compute spread-image dimensions (deterministic, same as editor)
                max_w = MAX_WIDTH_LANDSCAPE if orientation == "landscape" else MAX_WIDTH_PORTRAIT
                pix_w = page.rect.width * ZOOM
                pix_h = page.rect.height * ZOOM
                if pix_w > max_w:
                    ratio = max_w / pix_w
                    img_w = float(max_w)
                    img_h = pix_h * ratio
                else:
                    img_w = float(pix_w)
                    img_h = float(pix_h)

                # Scale factors: image pixels → PDF points
                sx = page.rect.width / img_w
                sy = page.rect.height / img_h

                # Block geometry in PDF points
                bx = float(block.get("x", 0)) * sx
                by = float(block.get("y", 0)) * sy
                bw = max(float(block.get("width", 200)) * sx, 20.0)
                bh = max(float(block.get("height", 50)) * sy, 15.0)
                rect = fitz.Rect(bx, by, bx + bw, by + bh)

                # Font size in PDF points
                font_size_pdf = max(6.0, float(block.get("font_size", 24)) * sx)

                # Color
                color = self._hex_to_rgb(block.get("color", "#000000"))

                # Alignment
                align_map = {
                    "left": fitz.TEXT_ALIGN_LEFT,
                    "center": fitz.TEXT_ALIGN_CENTER,
                    "right": fitz.TEXT_ALIGN_RIGHT,
                }
                align = align_map.get(block.get("alignment", "left"), fitz.TEXT_ALIGN_LEFT)

                # Line height
                line_height = float(block.get("line_height", 1.2))
                line_height = max(0.5, min(line_height, 4.0))

                # Resolve font file
                font_file = None
                font_id = block.get("font_id")
                font_family = block.get("font_family", "Helvetica")

                if font_id and font_id in font_id_lookup:
                    candidate = font_id_lookup[font_id]
                    if Path(candidate).exists():
                        font_file = candidate
                elif font_family.lower() in font_name_lookup:
                    candidate = font_name_lookup[font_family.lower()]
                    if Path(candidate).exists():
                        font_file = candidate

                # Insert text box
                insert_kwargs = dict(
                    fontsize=font_size_pdf,
                    color=color,
                    align=align,
                    lineheight=line_height,
                )
                if font_file:
                    insert_kwargs.update(fontfile=font_file, fontname="custom")
                else:
                    insert_kwargs["fontname"] = self._get_fitz_fontname(font_family, block)

                try:
                    page.insert_textbox(rect, text, **insert_kwargs)
                except Exception as e:
                    logger.warning(
                        f"insert_textbox failed for block {block.get('block_id')} "
                        f"(font={font_family}): {e} — retrying with Helvetica"
                    )
                    page.insert_textbox(
                        rect, text,
                        fontname=self._get_fitz_fontname("Helvetica", block),
                        fontsize=font_size_pdf,
                        color=color,
                        align=align,
                        lineheight=line_height,
                    )

            doc.save(output_path, incremental=False, garbage=4, deflate=True)
            logger.info(
                f"Overlaid {len(spread_blocks)} spread blocks onto PDF → {output_path}"
            )

        finally:
            doc.close()

    # ------------------------------------------------------------------
    # Font Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _hex_to_rgb(hex_color: str) -> tuple:
        """Convert CSS hex color (#RRGGBB) to fitz RGB tuple (0.0–1.0)."""
        h = hex_color.lstrip("#")
        if len(h) == 6:
            return (int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255)
        return (0.0, 0.0, 0.0)

    @staticmethod
    def _get_fitz_fontname(font_family: str, block: Dict) -> str:
        """Map font family + bold/italic flags to a fitz built-in font name."""
        bold = block.get("font_weight") == "bold"
        italic = block.get("italic", False)
        fam = font_family.lower()

        if any(k in fam for k in ("helvetica", "arial", "sans")):
            return ("hebi" if bold and italic else "hebo" if bold else "heit" if italic else "helv")
        if any(k in fam for k in ("times", "serif", "georgia", "palatino", "garamond")):
            return ("tibi" if bold and italic else "tibo" if bold else "tiit" if italic else "tiro")
        if any(k in fam for k in ("courier", "mono", "typewriter", "inconsolata")):
            return ("cobi" if bold and italic else "cobo" if bold else "coit" if italic else "cour")
        # Default
        return ("hebi" if bold and italic else "hebo" if bold else "heit" if italic else "helv")
    
    def _apply_placeholders(self, text_template: str, personalization_data: Dict) -> str:
        """Replace [field_key] placeholders with actual values"""
        result = text_template
        
        placeholders = re.findall(r'\[(\w+)\]', text_template)
        
        for placeholder in placeholders:
            value = personalization_data.get(placeholder, "")
            
            # Handle image fields
            if isinstance(value, dict):
                value = value.get("display_name", "")
            
            result = result.replace(f"[{placeholder}]", str(value))
        
        return result
    
    async def _generate_flipbook(
        self,
        session: Dict,
        pdf_path: str,
        convert_func: Callable
    ) -> Dict:
        """Generate flipbook from personalized PDF"""
        
        snapshot = session.get("template_snapshot", {})
        personalization_data = session.get("personalization_data", {})
        
        # Build title using personalization data
        template_title = snapshot.get("title", "Storybook")
        
        # Try to get a name field for the title
        name_for_title = ""
        for field_key in ["child_name", "son_name", "daughter_name", "baby_name", "name", "requested_name"]:
            if field_key in personalization_data:
                val = personalization_data[field_key]
                if isinstance(val, str) and val.strip():
                    name_for_title = val.strip()
                    break
        
        # Fallback to legacy requested_name
        if not name_for_title:
            name_for_title = session.get("requested_name", "Friend")
        
        storybook_title = f"{name_for_title}'s {template_title}"
        
        # Get password if in personalization data
        password = personalization_data.get("password")
        
        # Get styling defaults
        styling_defaults = snapshot.get("stylingDefaults")
        
        # Convert to flipbook
        flipbook_data = await convert_func(
            pdf_path=pdf_path,
            title=storybook_title,
            customer_name=name_for_title,
            password=password,
            styling_defaults=styling_defaults
        )
        
        logger.info(f"Flipbook generated for session {session['session_token']}: {flipbook_data['storybookId']}")
        
        return flipbook_data
    
    async def _send_delivery_email(self, session: Dict, flipbook_data: Dict):
        """Send delivery email to customer"""
        try:
            from automation.email_sender import EmailSender
            
            customer_email = session.get("customer_email")
            if not customer_email:
                logger.warning(f"No email for session {session['session_token']}")
                return
            
            customer_name = session.get("customer_name", "Friend")
            personalization_data = session.get("personalization_data", {})
            
            # Try to get name from personalization data
            for field_key in ["child_name", "son_name", "daughter_name", "baby_name", "name"]:
                if field_key in personalization_data:
                    val = personalization_data[field_key]
                    if isinstance(val, str) and val.strip():
                        customer_name = val.strip()
                        break
            
            # Get storybook title
            storybook = await self.db.storybooks.find_one(
                {"id": flipbook_data["storybookId"]},
                {"title": 1}
            )
            storybook_title = storybook.get("title") if storybook else f"{customer_name}'s Storybook"
            
            # Build full URL
            base_url = os.getenv("APP_BASE_URL", "http://localhost:3000").rstrip('/')
            full_view_url = f"{base_url}{flipbook_data['customerViewUrl']}"
            
            # Get password from personalization data
            password = personalization_data.get("password")
            
            email_sent = await EmailSender.send_storybook_delivery_email(
                to_email=customer_email,
                customer_name=customer_name,
                storybook_title=storybook_title,
                customer_view_url=full_view_url,
                password=password,
                order_id=session.get("order_id", "")
            )
            
            logger.info(f"Delivery email {'sent' if email_sent else 'FAILED'} for session {session['session_token']}")
            
        except Exception as e:
            logger.error(f"Email delivery failed for session {session['session_token']}: {str(e)}")
    
    async def _cleanup_pdf(self, pdf_path: str):
        """Delete personalized PDF to save storage"""
        try:
            if os.path.exists(pdf_path):
                os.remove(pdf_path)
                logger.info(f"Cleaned up personalized PDF: {pdf_path}")
        except Exception as e:
            logger.warning(f"Could not delete PDF {pdf_path}: {str(e)}")
