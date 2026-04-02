#!/usr/bin/env python3
"""Create a test fillable PDF template for testing"""

import fitz  # PyMuPDF

def create_fillable_test_pdf(output_path: str):
    """Create a simple fillable PDF with text fields"""
    
    # Create a new PDF
    doc = fitz.open()
    
    # Page 1
    page1 = doc.new_page(width=612, height=792)  # Letter size
    
    # Add some text
    page1.insert_text((50, 50), "Luna's Magical Adventure", fontsize=24)
    page1.insert_text((50, 100), "A Personalized Story For:", fontsize=14)
    
    # Add fillable field for child name on page 1
    widget1 = fitz.Widget()
    widget1.field_name = "child_name_page1"
    widget1.field_type = fitz.PDF_WIDGET_TYPE_TEXT
    widget1.rect = fitz.Rect(50, 120, 300, 150)
    widget1.field_value = ""
    widget1.text_fontsize = 18
    page1.add_widget(widget1)
    
    page1.insert_text((50, 200), "Once upon a time...", fontsize=12)
    
    # Page 2
    page2 = doc.new_page(width=612, height=792)
    page2.insert_text((50, 50), "Chapter 1", fontsize=20)
    page2.insert_text((50, 100), "This story belongs to:", fontsize=12)
    
    # Add another fillable field on page 2
    widget2 = fitz.Widget()
    widget2.field_name = "child_name_page2"
    widget2.field_type = fitz.PDF_WIDGET_TYPE_TEXT
    widget2.rect = fitz.Rect(50, 120, 300, 150)
    widget2.field_value = ""
    widget2.text_fontsize = 16
    page2.add_widget(widget2)
    
    page2.insert_text((50, 200), "And they lived happily ever after.", fontsize=12)
    
    # Page 3
    page3 = doc.new_page(width=612, height=792)
    page3.insert_text((50, 50), "Dedication", fontsize=20)
    page3.insert_text((50, 100), "Made especially for:", fontsize=12)
    
    # Add third fillable field
    widget3 = fitz.Widget()
    widget3.field_name = "dedication_name"
    widget3.field_type = fitz.PDF_WIDGET_TYPE_TEXT
    widget3.rect = fitz.Rect(50, 120, 400, 180)
    widget3.field_value = ""
    widget3.text_fontsize = 20
    page3.add_widget(widget3)
    
    # Save the PDF
    doc.save(output_path)
    doc.close()
    
    print(f"✓ Created test fillable PDF: {output_path}")
    print(f"  - 3 pages")
    print(f"  - 3 fillable text fields")
    print(f"    • child_name_page1 (Page 1)")
    print(f"    • child_name_page2 (Page 2)")
    print(f"    • dedication_name (Page 3)")

if __name__ == "__main__":
    create_fillable_test_pdf("/app/backend/test_template.pdf")
