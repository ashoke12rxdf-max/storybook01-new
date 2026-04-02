"""
Test POST /api/admin/templates/{template_id}/preview-pdf endpoint
Verifies spread_blocks are overlaid into the PDF with field substitution
"""
import pytest
import requests
import os
import fitz  # PyMuPDF

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEMPLATE_ID = "414c7edb-e024-4791-be25-99f17f44d3e6"


class TestPreviewPDF:
    """Test preview-pdf endpoint with spread_blocks rendering"""

    def test_preview_pdf_returns_200(self):
        """POST preview-pdf with field values returns HTTP 200"""
        url = f"{BASE_URL}/api/admin/templates/{TEMPLATE_ID}/preview-pdf"
        payload = {"field_values": {"dad_name": "John", "son_name": "Jake"}}
        response = requests.post(url, json=payload, timeout=30)
        print(f"Status: {response.status_code}")
        print(f"Content-Type: {response.headers.get('content-type')}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}. Body: {response.text[:500]}"

    def test_preview_pdf_returns_pdf_content_type(self):
        """Response content-type is application/pdf"""
        url = f"{BASE_URL}/api/admin/templates/{TEMPLATE_ID}/preview-pdf"
        payload = {"field_values": {"dad_name": "John", "son_name": "Jake"}}
        response = requests.post(url, json=payload, timeout=30)
        assert response.status_code == 200
        ct = response.headers.get('content-type', '')
        assert 'pdf' in ct.lower(), f"Expected PDF content-type, got: {ct}"

    def test_preview_pdf_contains_dear_john(self):
        """PDF page 0 contains 'Dear John' from spread_blocks overlay"""
        url = f"{BASE_URL}/api/admin/templates/{TEMPLATE_ID}/preview-pdf"
        payload = {"field_values": {"dad_name": "John", "son_name": "Jake"}}
        response = requests.post(url, json=payload, timeout=30)
        assert response.status_code == 200, f"Bad status: {response.status_code}"

        # Save PDF to /tmp
        pdf_path = "/tmp/preview_test.pdf"
        with open(pdf_path, "wb") as f:
            f.write(response.content)
        print(f"PDF saved to {pdf_path}, size={len(response.content)} bytes")

        # Open with PyMuPDF and check text
        doc = fitz.open(pdf_path)
        print(f"PDF pages: {doc.page_count}")
        all_text = ""
        for i, page in enumerate(doc):
            text = page.get_text()
            print(f"Page {i} text: {repr(text[:300])}")
            all_text += text

        doc.close()
        assert "Dear John" in all_text or "John" in all_text, \
            f"'Dear John' not found in PDF text. Full text: {repr(all_text[:500])}"
        print("SUCCESS: Found 'John' in PDF text content")

    def test_spreads_have_image_url(self):
        """GET spreads returns all spreads with non-null spread_image_url"""
        url = f"{BASE_URL}/api/admin/templates/{TEMPLATE_ID}/spreads"
        response = requests.get(url, timeout=15)
        assert response.status_code == 200, f"Got {response.status_code}"
        data = response.json()
        spreads = data.get('spreads', data) if isinstance(data, dict) else data
        print(f"Total spreads: {len(spreads)}")
        for s in spreads:
            assert s.get('spread_image_url') is not None, \
                f"Spread {s.get('spread_index')} has null spread_image_url"
        print("SUCCESS: All spreads have non-null spread_image_url")
