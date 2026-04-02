#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Storybook Vault Personalization Flow
Tests all required features from the review request.
"""

import requests
import json
import sys
from datetime import datetime
import uuid

# Use the public endpoint from frontend .env
API_BASE_URL = "https://personalize-pdf.preview.emergentagent.com"

class StorybookVaultTester:
    def __init__(self):
        self.base_url = API_BASE_URL
        self.admin_token = None
        self.test_session_token = None
        self.test_checkout_id = None
        self.tests_run = 0
        self.tests_passed = 0
        
    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")
        
    def run_test(self, name, test_func):
        """Run a single test and track results"""
        self.tests_run += 1
        self.log(f"🔍 Testing: {name}")
        
        try:
            result = test_func()
            if result:
                self.tests_passed += 1
                self.log(f"✅ PASS: {name}")
                return True
            else:
                self.log(f"❌ FAIL: {name}")
                return False
        except Exception as e:
            self.log(f"❌ ERROR in {name}: {str(e)}")
            return False
    
    def test_api_health(self):
        """Test basic API health check"""
        try:
            response = requests.get(f"{self.base_url}/api/", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get("message") == "Storybook Vault API":
                    self.log("   ✓ API health check successful")
                    return True
            self.log(f"   ✗ Unexpected response: {response.status_code} - {response.text}")
            return False
        except Exception as e:
            self.log(f"   ✗ API health check failed: {str(e)}")
            return False
    
    def test_admin_login(self):
        """Test admin login (no password required)"""
        try:
            response = requests.post(
                f"{self.base_url}/api/admin/login",
                json={"password": ""},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                if data.get("token"):
                    self.admin_token = data["token"]
                    self.log("   ✓ Admin login successful, token obtained")
                    return True
            self.log(f"   ✗ Admin login failed: {response.status_code} - {response.text}")
            return False
        except Exception as e:
            self.log(f"   ✗ Admin login error: {str(e)}")
            return False
    
    def test_templates_list(self):
        """Test templates list API and verify active template with field_definitions"""
        try:
            response = requests.get(f"{self.base_url}/api/templates", timeout=10)
            if response.status_code == 200:
                data = response.json()
                templates = data.get("templates", [])
                
                # Look for active template with field_definitions
                active_template = None
                for template in templates:
                    if template.get("status") == "active" and template.get("field_definitions"):
                        active_template = template
                        break
                
                if active_template:
                    field_count = len(active_template.get("field_definitions", []))
                    self.log(f"   ✓ Found active template '{active_template.get('title')}' with {field_count} field_definitions")
                    self.log(f"   ✓ Product slug: {active_template.get('productSlug')}")
                    return True
                else:
                    self.log("   ✗ No active template with field_definitions found")
                    return False
            else:
                self.log(f"   ✗ Templates API failed: {response.status_code}")
                return False
        except Exception as e:
            self.log(f"   ✗ Templates list error: {str(e)}")
            return False
    
    def test_simulate_polar_webhook(self):
        """Test simulated Polar webhook creates personalization session"""
        try:
            # Use the known test template
            webhook_data = {
                "productSlug": "baby-boy-adventure",
                "requestedName": "TestChild",
                "customerEmail": f"test-{uuid.uuid4().hex[:8]}@example.com",
                "customerName": "Test Parent",
                "password": "test123"
            }
            
            response = requests.post(
                f"{self.base_url}/api/automation/simulate-polar-webhook",
                json=webhook_data,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("flow") == "personalization":
                    self.test_session_token = data.get("sessionToken")
                    self.test_checkout_id = data.get("checkoutId")
                    self.log(f"   ✓ Personalization session created: {self.test_session_token}")
                    self.log(f"   ✓ Checkout ID: {self.test_checkout_id}")
                    return True
                else:
                    self.log(f"   ✗ Unexpected webhook response: {data}")
                    return False
            else:
                self.log(f"   ✗ Webhook simulation failed: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            self.log(f"   ✗ Webhook simulation error: {str(e)}")
            return False
    
    def test_session_lookup_by_checkout(self):
        """Test session lookup by checkout ID"""
        if not self.test_checkout_id:
            self.log("   ✗ No checkout ID available for testing")
            return False
            
        try:
            response = requests.get(
                f"{self.base_url}/api/personalization/by-checkout",
                params={"checkout_id": self.test_checkout_id},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "ready" and data.get("session_token"):
                    self.log(f"   ✓ Session found by checkout ID: {data.get('session_token')}")
                    return True
                else:
                    self.log(f"   ✗ Unexpected session lookup response: {data}")
                    return False
            else:
                self.log(f"   ✗ Session lookup failed: {response.status_code}")
                return False
        except Exception as e:
            self.log(f"   ✗ Session lookup error: {str(e)}")
            return False
    
    def test_session_data_with_view_password(self):
        """Test session data includes view_password system field"""
        if not self.test_session_token:
            self.log("   ✗ No session token available for testing")
            return False
            
        try:
            response = requests.get(
                f"{self.base_url}/api/personalization/session/{self.test_session_token}",
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                field_definitions = data.get("field_definitions", [])
                
                # Check for view_password system field
                has_view_password = any(
                    field.get("field_key") == "view_password" and field.get("is_system_field")
                    for field in field_definitions
                )
                
                if has_view_password:
                    total_fields = len(field_definitions)
                    user_fields = len([f for f in field_definitions if not f.get("is_system_field")])
                    system_fields = len([f for f in field_definitions if f.get("is_system_field")])
                    
                    self.log(f"   ✓ Session includes view_password system field")
                    self.log(f"   ✓ Total fields: {total_fields} ({user_fields} user + {system_fields} system)")
                    return True
                else:
                    self.log("   ✗ view_password system field not found in session")
                    self.log(f"   ✗ Available fields: {[f.get('field_key') for f in field_definitions]}")
                    return False
            else:
                self.log(f"   ✗ Session data API failed: {response.status_code}")
                return False
        except Exception as e:
            self.log(f"   ✗ Session data error: {str(e)}")
            return False
    
    def test_session_status_polling(self):
        """Test session status polling endpoint"""
        if not self.test_session_token:
            self.log("   ✗ No session token available for testing")
            return False
            
        try:
            response = requests.get(
                f"{self.base_url}/api/personalization/session/{self.test_session_token}/status",
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if "status" in data:
                    self.log(f"   ✓ Status polling works, current status: {data.get('status')}")
                    return True
                else:
                    self.log(f"   ✗ Status response missing 'status' field: {data}")
                    return False
            else:
                self.log(f"   ✗ Status polling failed: {response.status_code}")
                return False
        except Exception as e:
            self.log(f"   ✗ Status polling error: {str(e)}")
            return False
    
    def test_admin_personalization_sessions(self):
        """Test admin personalization sessions endpoint"""
        if not self.admin_token:
            self.log("   ✗ No admin token available for testing")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.get(
                f"{self.base_url}/api/admin/personalization/sessions",
                headers=headers,
                params={"limit": 10},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                sessions = data.get("sessions", [])
                self.log(f"   ✓ Admin sessions API works, found {len(sessions)} sessions")
                
                # Check if our test session is in the list
                if self.test_session_token:
                    test_session = next(
                        (s for s in sessions if s.get("session_token") == self.test_session_token),
                        None
                    )
                    if test_session:
                        self.log(f"   ✓ Test session found in admin list with status: {test_session.get('status')}")
                    else:
                        self.log("   ⚠ Test session not found in admin list (may be expected)")
                
                return True
            else:
                self.log(f"   ✗ Admin sessions API failed: {response.status_code}")
                return False
        except Exception as e:
            self.log(f"   ✗ Admin sessions error: {str(e)}")
            return False
    
    def test_admin_template_spreads(self):
        """Test admin template spreads endpoint for Spread Editor"""
        if not self.admin_token:
            self.log("   ✗ No admin token available for testing")
            return False
            
        try:
            # First get templates to find an active one
            response = requests.get(f"{self.base_url}/api/templates", timeout=10)
            if response.status_code != 200:
                self.log("   ✗ Could not fetch templates for spreads test")
                return False
                
            templates = response.json().get("templates", [])
            active_template = next((t for t in templates if t.get("status") == "active"), None)
            
            if not active_template:
                self.log("   ✗ No active template found for spreads test")
                return False
            
            template_id = active_template.get("id")
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            response = requests.get(
                f"{self.base_url}/api/admin/templates/{template_id}/spreads",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                spreads = data.get("spreads", [])
                field_definitions = data.get("field_definitions", [])
                
                self.log(f"   ✓ Template spreads API works")
                self.log(f"   ✓ Found {len(spreads)} spreads and {len(field_definitions)} field definitions")
                return True
            else:
                self.log(f"   ✗ Template spreads API failed: {response.status_code}")
                return False
        except Exception as e:
            self.log(f"   ✗ Template spreads error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all backend tests"""
        self.log("🚀 Starting Storybook Vault Backend API Tests")
        self.log(f"📍 Testing against: {self.base_url}")
        self.log("=" * 60)
        
        # Core API tests
        self.run_test("Backend API Health Check", self.test_api_health)
        self.run_test("Admin Login", self.test_admin_login)
        self.run_test("Templates List with Field Definitions", self.test_templates_list)
        
        # Personalization flow tests
        self.run_test("Simulate Polar Webhook Creates Session", self.test_simulate_polar_webhook)
        self.run_test("Session Lookup by Checkout ID", self.test_session_lookup_by_checkout)
        self.run_test("Session Data Includes view_password System Field", self.test_session_data_with_view_password)
        self.run_test("Session Status Polling", self.test_session_status_polling)
        
        # Admin panel tests
        self.run_test("Admin Personalization Sessions", self.test_admin_personalization_sessions)
        self.run_test("Admin Template Spreads for Editor", self.test_admin_template_spreads)
        
        # Summary
        self.log("=" * 60)
        self.log(f"📊 Test Results: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            self.log("🎉 All backend tests PASSED!")
            return True
        else:
            self.log(f"❌ {self.tests_run - self.tests_passed} tests FAILED")
            return False

def main():
    tester = StorybookVaultTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())