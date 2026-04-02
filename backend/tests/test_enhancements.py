"""
Tests for 3 new enhancements:
1. PDF upload without fillable fields
2. Full Preview modal (frontend only - tested via playwright)
3. Field Definitions panel in SpreadBlockEditor (Fields tab)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

BABY_BOY_ID = "414c7edb-e024-4791-be25-99f17f44d3e6"
PLAIN_PDF_ID = "38d6a760-6b6e-4eac-b467-b0cad5d51426"

class TestTemplateList:
    """Template list loads both templates"""

    def test_get_all_templates(self):
        r = requests.get(f"{BASE_URL}/api/templates")
        assert r.status_code == 200
        data = r.json()
        assert "templates" in data
        ids = [t["id"] for t in data["templates"]]
        print(f"Templates found: {[t['title'] for t in data['templates']]}")
        assert BABY_BOY_ID in ids, "My Baby Boy Story template missing"
        assert PLAIN_PDF_ID in ids, "Plain PDF Test template missing"
        print("PASS: Both templates present")

    def test_baby_boy_has_field_definitions(self):
        r = requests.get(f"{BASE_URL}/api/templates/{BABY_BOY_ID}")
        assert r.status_code == 200
        data = r.json()
        field_defs = data.get("field_definitions", [])
        print(f"Field definitions: {[f['field_key'] for f in field_defs]}")
        assert len(field_defs) >= 3, f"Expected 3 field defs, got {len(field_defs)}"
        keys = [f["field_key"] for f in field_defs]
        assert "dad_name" in keys
        assert "son_name" in keys
        assert "message" in keys
        print("PASS: 3 field definitions present")

    def test_plain_pdf_no_fillable_fields(self):
        r = requests.get(f"{BASE_URL}/api/templates/{PLAIN_PDF_ID}")
        assert r.status_code == 200
        data = r.json()
        fillable = data.get("fillableFields", [])
        print(f"Plain PDF fillable fields: {fillable}")
        # Plain PDF should have 0 fillable fields
        assert len(fillable) == 0, f"Expected 0 fillable fields, got {len(fillable)}"
        print("PASS: Plain PDF has no fillable fields")


class TestSpreadBlocks:
    """Spread blocks API for both templates"""

    def test_get_spreads_baby_boy(self):
        r = requests.get(f"{BASE_URL}/api/admin/templates/{BABY_BOY_ID}/spreads")
        assert r.status_code == 200
        data = r.json()
        assert "spreads" in data
        print(f"Baby Boy spreads count: {len(data['spreads'])}")
        print("PASS: Spreads loaded")

    def test_get_spreads_plain_pdf(self):
        r = requests.get(f"{BASE_URL}/api/admin/templates/{PLAIN_PDF_ID}/spreads")
        assert r.status_code == 200
        data = r.json()
        assert "spreads" in data
        print(f"Plain PDF spreads count: {len(data['spreads'])}")
        print("PASS: Spreads loaded for plain PDF")


class TestFieldDefinitionsSave:
    """Field definitions can be saved via PUT /api/templates/{id}"""

    def test_add_and_verify_field_definition(self):
        # Get current field defs
        r = requests.get(f"{BASE_URL}/api/templates/{BABY_BOY_ID}")
        assert r.status_code == 200
        current_defs = r.json().get("field_definitions", [])

        # Add a test field
        test_field = {
            "field_key": "test_gift_msg",
            "label": "Test Gift Message",
            "type": "text",
            "required": False,
            "placeholder": "Test placeholder",
            "help_text": "",
            "max_length": None,
            "options": [],
            "validation_regex": None
        }
        new_defs = current_defs + [test_field]
        put_r = requests.put(
            f"{BASE_URL}/api/templates/{BABY_BOY_ID}",
            json={"field_definitions": new_defs}
        )
        assert put_r.status_code == 200, f"PUT failed: {put_r.text}"

        # Verify persisted
        verify_r = requests.get(f"{BASE_URL}/api/templates/{BABY_BOY_ID}")
        assert verify_r.status_code == 200
        saved_keys = [f["field_key"] for f in verify_r.json().get("field_definitions", [])]
        assert "test_gift_msg" in saved_keys
        print("PASS: Field definition saved and persisted")

        # Cleanup
        cleanup_defs = [f for f in verify_r.json().get("field_definitions", []) if f["field_key"] != "test_gift_msg"]
        requests.put(f"{BASE_URL}/api/templates/{BABY_BOY_ID}", json={"field_definitions": cleanup_defs})
        print("PASS: Cleanup done")
