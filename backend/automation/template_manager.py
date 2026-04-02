import fitz  # PyMuPDF
from PIL import Image
import io
from pathlib import Path
from typing import List, Dict, Tuple
import logging

logger = logging.getLogger(__name__)

class TemplateManager:
    """Handles template PDF operations"""
    
    @staticmethod
    async def detect_fillable_fields(pdf_path: str) -> List[Dict]:
        """
        Detect all fillable form fields in a PDF using PyMuPDF.
        
        Args:
            pdf_path: Path to the PDF file
            
        Returns:
            List of fillable field dictionaries
        """
        try:
            doc = fitz.open(pdf_path)
            fields = []
            
            for page_num in range(len(doc)):
                page = doc[page_num]
                
                # Get form widgets on this page
                widgets = page.widgets()
                
                if widgets:
                    for widget in widgets:
                        # Extract field information
                        field_info = {
                            "fieldName": widget.field_name or f"field_{page_num}_{len(fields)}",
                            "fieldType": widget.field_type_string or "text",
                            "pageNumber": page_num + 1,  # 1-indexed for display
                            "currentValue": widget.field_value or "",
                            "bounds": {
                                "x": float(widget.rect.x0),
                                "y": float(widget.rect.y0),
                                "w": float(widget.rect.width),
                                "h": float(widget.rect.height)
                            }
                        }
                        fields.append(field_info)
            
            doc.close()
            
            if not fields:
                logger.warning(f"No fillable fields detected in {pdf_path}")
            else:
                logger.info(f"Detected {len(fields)} fillable fields in {pdf_path}")
            
            return fields
            
        except Exception as e:
            logger.error(f"Error detecting fields in {pdf_path}: {str(e)}")
            raise Exception(f"Failed to detect fillable fields: {str(e)}")
    
    @staticmethod
    async def generate_thumbnail(pdf_path: str, output_path: str) -> str:
        """
        Generate a thumbnail image from the first page of a PDF.
        
        Args:
            pdf_path: Path to the PDF file
            output_path: Path where thumbnail should be saved
            
        Returns:
            Path to the generated thumbnail
        """
        try:
            doc = fitz.open(pdf_path)
            
            if len(doc) == 0:
                raise Exception("PDF has no pages")
            
            # Get first page
            page = doc[0]
            
            # Render at lower resolution for thumbnail
            mat = fitz.Matrix(0.5, 0.5)  # 0.5x zoom for thumbnail
            pix = page.get_pixmap(matrix=mat)
            
            # Convert to PIL Image
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            
            # Resize to max 400px width
            max_width = 400
            if img.width > max_width:
                ratio = max_width / img.width
                new_height = int(img.height * ratio)
                img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
            
            # Save as WebP
            img.save(output_path, "WEBP", quality=80)
            
            doc.close()
            
            logger.info(f"Generated thumbnail: {output_path}")
            return output_path
            
        except Exception as e:
            logger.error(f"Error generating thumbnail: {str(e)}")
            raise Exception(f"Failed to generate thumbnail: {str(e)}")
    
    @staticmethod
    async def get_pdf_info(pdf_path: str) -> Dict:
        """
        Extract basic information from a PDF.
        
        Args:
            pdf_path: Path to the PDF file
            
        Returns:
            Dictionary with PDF information
        """
        try:
            doc = fitz.open(pdf_path)
            
            # Determine orientation from first page
            orientation = "landscape"
            if len(doc) > 0:
                page = doc[0]
                if page.rect.width < page.rect.height:
                    orientation = "portrait"
            
            info = {
                "pageCount": len(doc),
                "orientation": orientation
            }
            
            doc.close()
            return info
            
        except Exception as e:
            logger.error(f"Error getting PDF info: {str(e)}")
            raise Exception(f"Failed to get PDF information: {str(e)}")
    
    @staticmethod
    async def validate_field_mappings(
        fillable_fields: List[Dict],
        field_mappings: List[Dict]
    ) -> Tuple[bool, str]:
        """
        Validate that field mappings reference existing fillable fields.
        
        Args:
            fillable_fields: List of detected fillable fields
            field_mappings: List of proposed field mappings
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        field_names = {f["fieldName"] for f in fillable_fields}
        
        for mapping in field_mappings:
            pdf_field = mapping.get("pdfFieldName")
            if pdf_field not in field_names:
                return False, f"Field '{pdf_field}' not found in PDF"
            
            # Validate variableType
            var_type = mapping.get("variableType")
            if var_type not in ["requestedName"]:
                return False, f"Invalid variableType '{var_type}'. Phase 1 only supports 'requestedName'"
        
        return True, ""
