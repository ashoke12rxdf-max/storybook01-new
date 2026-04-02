import fitz  # PyMuPDF
import os
from pathlib import Path
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)

# Path to custom fonts directory
FONTS_DIR = Path(__file__).parent.parent / "fonts"

class PDFFiller:
    """Handles filling PDF form fields with customer data using custom fonts"""
    
    @staticmethod
    async def fill_pdf_fields(
        template_path: str,
        field_mappings: List[Dict],
        customer_data: Dict,
        output_path: str
    ) -> str:
        """
        Fill PDF form fields based on field mappings and customer data.
        Uses custom font (AbroSans-Thin) for text rendering to match original design.
        
        Args:
            template_path: Path to the base template PDF
            field_mappings: List of {pdfFieldName, variableType, fallbackValue}
            customer_data: Dict with requestedName, buyerFullName, etc.
            output_path: Where to save the personalized PDF
            
        Returns:
            Path to the filled PDF
        """
        try:
            logger.info(f"Starting PDF fill: {template_path} -> {output_path}")
            doc = fitz.open(template_path)
            filled_fields = []
            
            # Load custom font
            custom_font_path = FONTS_DIR / "AbroSans-Thin.ttf"
            font_available = custom_font_path.exists()
            
            if font_available:
                logger.info(f"Custom font found: {custom_font_path}")
            else:
                logger.warning(f"Custom font not found at {custom_font_path}, will use fallback")

            # Track field names that were filled (to delete widgets after)
            filled_field_names = set()
            
            for mapping in field_mappings:
                pdf_field_name = mapping.get("pdfFieldName")
                variable_type = mapping.get("variableType")
                fallback_value = mapping.get("fallbackValue", "")

                # Get the value to fill based on variable type
                fill_value = None
                if variable_type == "requestedName":
                    fill_value = customer_data.get("requestedName")
                # Future: Add more variable types
                
                if not fill_value:
                    fill_value = fallback_value
                if not fill_value:
                    logger.warning(f"No value for field '{pdf_field_name}'")
                    continue

                filled = False
                for page_num in range(len(doc)):
                    page = doc[page_num]
                    for widget in page.widgets():
                        if widget.field_name != pdf_field_name:
                            continue

                        # Get the field rectangle
                        rect = widget.rect
                        
                        if font_available:
                            # Use custom font by drawing text directly on page
                            filled = PDFFiller._fill_with_custom_font(
                                page, rect, fill_value, str(custom_font_path), pdf_field_name
                            )
                            filled_field_names.add(pdf_field_name)
                        else:
                            # Fallback: clear widget background before setting value
                            widget.fill_color = None
                            widget.border_color = None
                            widget.field_value = fill_value
                            widget.text_fontsize = 0
                            widget.update()
                            filled = True
                            filled_field_names.add(pdf_field_name)
                        
                        if filled:
                            logger.info(
                                f"Filled '{pdf_field_name}' on page {page_num+1} "
                                f"with value: '{fill_value}' using {'custom font' if font_available else 'fallback'}"
                            )

                if filled:
                    filled_fields.append({"fieldName": pdf_field_name, "value": fill_value})
                else:
                    logger.warning(f"Field '{pdf_field_name}' not found in PDF")
            
            # Remove all form field widgets to eliminate background colors
            # Do a fresh iteration to delete widgets by field name
            for page_num in range(len(doc)):
                page = doc[page_num]
                # Get list of widget xrefs to delete (xref is stable identifier)
                xrefs_to_delete = []
                for widget in page.widgets():
                    if widget.field_name in filled_field_names:
                        xrefs_to_delete.append(widget.xref)
                
                # Now delete by xref
                for xref in xrefs_to_delete:
                    try:
                        # Re-find widget by xref and delete
                        for widget in page.widgets():
                            if widget.xref == xref:
                                page.delete_widget(widget)
                                logger.info(f"Deleted widget on page {page_num+1} (xref={xref}) to remove form field background")
                                break
                    except Exception as e:
                        logger.warning(f"Could not delete widget (xref={xref}): {e}")

            # Save with garbage collection
            doc.save(output_path, incremental=False, encryption=fitz.PDF_ENCRYPT_NONE, garbage=4)
            doc.close()

            logger.info(f"PDF fill complete. Filled {len(filled_fields)} field(s)")
            return output_path

        except Exception as e:
            logger.error(f"Error filling PDF: {str(e)}")
            raise Exception(f"Failed to fill PDF fields: {str(e)}")
    
    @staticmethod
    def _fill_with_custom_font(page, rect, text: str, font_path: str, field_name: str) -> bool:
        """
        Fill a form field area with text using a custom font.
        Draws text directly on the page at the field location without any background.
        
        Args:
            page: The PDF page object
            rect: The rectangle area of the form field
            text: The text to insert
            font_path: Path to the custom .ttf font file
            field_name: Name of the field (for font size lookup)
            
        Returns:
            True if successful
        """
        try:
            # Font settings based on field (from pdf-form-spec.json)
            # text_0 (page 1): fontSize 35, fontColor #2F2A28
            # text_1 (page 2): fontSize auto, fontColor #000000
            
            if field_name == "text_0":
                font_size = 35
                font_color = (0.184, 0.165, 0.157)  # #2F2A28
            else:
                # Auto-fit font size for other fields
                font_size = 32  # Default size that fits well
                font_color = (0, 0, 0)  # Black
            
            # Create a text writer for precise font control
            writer = fitz.TextWriter(page.rect)
            
            # Load the custom font
            font = fitz.Font(fontfile=font_path)
            
            # Calculate text position (left-aligned, vertically centered)
            # The rect coordinates are in PDF space
            x = rect.x0 + 2  # Small left padding
            
            # Calculate vertical center
            text_height = font_size * 0.75  # Approximate text height
            y = rect.y0 + (rect.height + text_height) / 2
            
            # Add text to writer
            writer.append(
                pos=(x, y),
                text=text,
                font=font,
                fontsize=font_size
            )
            
            # Write the text directly to the page - NO background rectangle
            # The form field widget will be deleted afterwards to remove its background
            writer.write_text(page, color=font_color)
            
            return True
            
        except Exception as e:
            logger.error(f"Custom font fill failed for field '{field_name}': {str(e)}")
            return False
    
    @staticmethod
    async def validate_pdf_fillable(pdf_path: str) -> bool:
        """
        Check if a PDF has fillable form fields.
        
        Args:
            pdf_path: Path to the PDF file
            
        Returns:
            True if PDF has fillable fields
        """
        try:
            doc = fitz.open(pdf_path)
            
            has_fields = False
            for page_num in range(len(doc)):
                page = doc[page_num]
                if page.widgets():
                    has_fields = True
                    break
            
            doc.close()
            return has_fields
            
        except Exception as e:
            logger.error(f"Error validating PDF: {str(e)}")
            return False
