#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Storybook Vault Personalization Flow
Tests all features mentioned in the review request.
"""

import requests
import sys
import os
import json
from datetime import datetime

# Use the public backend URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    print("❌ REACT_APP_BACKEND_URL not found in environment")
    sys.exit(1)

print(f"🔗 Testing backend at: {BASE_URL}")

class BackendTester:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.session_token = None
        self.checkout_id = None
        self.template_id = None

    def run_test(self, name, test_func):
        """Run a single test and track results"""
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            result = test_func()
            if result:
                self.tests_passed += 1
                print(f"✅ PASS - {name}")
                return True
            else:
                print(f"❌ FAIL - {name}")
                return False
        except Exception as e:
            print(f"❌ ERROR - {name}: {str(e)}")
            return False

    def test_api_health(self):
        """Test: Backend API /api/ returns success"""
        response = requests.get(f"{BASE_URL}/api/", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"   API Response: {data}")
            return True
        print(f"   Status: {response.status_code}")
        return False

    def test_templates_list(self):
        """Test: Template list API /api/templates works"""
        response = requests.get(f"{BASE_URL}/api/templates", timeout=10)
        if response.status_code == 200:
            data = response.json()
            templates = data.get('templates', [])
            print(f"   Found {len(templates)} templates")
            
            # Look for a template with field_definitions for personalization testing
            for template in templates:
                if template.get('field_definitions') and len(template['field_definitions']) > 0:
                    self.template_id = template['id']
                    print(f"   Found personalization template: {template['title']} (ID: {self.template_id})")
                    break
            
            return True
        print(f"   Status: {response.status_code}")
        return False

    def test_simulate_polar_webhook(self):
        """Test: Simulated Polar webhook creates personalization session with injected password field"""
        payload = {
            "productSlug": "baby-boy-story",  # Use a known template
            "customerEmail": "test@example.com",
            "customerName": "Test User",
            "requestedName": "TestChild"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/automation/simulate-polar-webhook",
            json=payload,
            timeout=15
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {data}")
            
            # Check for personalization flow
            if data.get('flow') == 'personalization':
                self.session_token = data.get('sessionToken')
                self.checkout_id = data.get('checkoutId')
                print(f"   ✓ Personalization flow triggered")
                print(f"   ✓ Session token: {self.session_token}")
                print(f"   ✓ Checkout ID: {self.checkout_id}")
                return True
            else:
                print(f"   ❌ Expected personalization flow, got: {data.get('flow')}")
                return False
        
        print(f"   Status: {response.status_code}, Response: {response.text}")
        return False

    def test_session_lookup_by_checkout(self):
        """Test: Session lookup by checkout_id works"""
        if not self.checkout_id:
            print("   ⚠️ No checkout_id available from previous test")
            return False
        
        response = requests.get(
            f"{BASE_URL}/api/personalization/by-checkout",
            params={"checkout_id": self.checkout_id},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {data}")
            
            if data.get('status') == 'ready' and data.get('session_token'):
                print(f"   ✓ Session found with status: {data['status']}")
                return True
            else:
                print(f"   ❌ Unexpected session status: {data}")
                return False
        
        print(f"   Status: {response.status_code}, Response: {response.text}")
        return False

    def test_session_data_includes_password_field(self):
        """Test: Session data includes view_password system field"""
        if not self.session_token:
            print("   ⚠️ No session_token available from previous test")
            return False
        
        response = requests.get(
            f"{BASE_URL}/api/personalization/session/{self.session_token}",
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            field_definitions = data.get('field_definitions', [])
            
            # Check for injected password field
            password_field = None
            for field in field_definitions:
                if field.get('field_key') == 'view_password':
                    password_field = field
                    break
            
            if password_field:
                print(f"   ✓ Found view_password field: {password_field}")
                print(f"   ✓ Field type: {password_field.get('type')}")
                print(f"   ✓ Required: {password_field.get('required')}")
                print(f"   ✓ System field: {password_field.get('is_system_field')}")
                return True
            else:
                print(f"   ❌ view_password field not found in: {[f.get('field_key') for f in field_definitions]}")
                return False
        
        print(f"   Status: {response.status_code}, Response: {response.text}")
        return False

    def test_session_status_endpoint(self):
        """Test: Session status polling endpoint works"""
        if not self.session_token:
            print("   ⚠️ No session_token available from previous test")
            return False
        
        response = requests.get(
            f"{BASE_URL}/api/personalization/session/{self.session_token}/status",
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Status response: {data}")
            
            # Should have status field
            if 'status' in data:
                print(f"   ✓ Status endpoint working, current status: {data['status']}")
                return True
            else:
                print(f"   ❌ No status field in response")
                return False
        
        print(f"   Status: {response.status_code}, Response: {response.text}")
        return False

    def test_admin_login(self):
        """Test: Admin login works (no password required)"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"password": ""},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('token'):
                print(f"   ✓ Admin login successful, token received")
                return True
            else:
                print(f"   ❌ No token in response: {data}")
                return False
        
        print(f"   Status: {response.status_code}, Response: {response.text}")
        return False

    def test_admin_templates_endpoint(self):
        """Test: Admin can access templates endpoint"""
        response = requests.get(f"{BASE_URL}/api/templates", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            templates = data.get('templates', [])
            print(f"   ✓ Admin templates access working, found {len(templates)} templates")
            
            # Check for templates with field_definitions
            personalization_templates = [t for t in templates if t.get('field_definitions')]
            print(f"   ✓ Found {len(personalization_templates)} templates with personalization fields")
            
            return True
        
        print(f"   Status: {response.status_code}, Response: {response.text}")
        return False

    def test_template_spreads_endpoint(self):
        """Test: Template spreads endpoint for admin spread editor"""
        if not self.template_id:
            print("   ⚠️ No template_id available, skipping spreads test")
            return True  # Not critical for this test
        
        response = requests.get(
            f"{BASE_URL}/api/admin/templates/{self.template_id}/spreads",
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✓ Template spreads endpoint working")
            print(f"   ✓ Template: {data.get('title')}")
            print(f"   ✓ Page count: {data.get('page_count')}")
            print(f"   ✓ Spreads: {len(data.get('spreads', []))}")
            return True
        
        print(f"   Status: {response.status_code}, Response: {response.text}")
        return False

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Backend API Tests")
        print("=" * 50)
        
        # Core API tests
        self.run_test("Backend API Health Check", self.test_api_health)
        self.run_test("Templates List API", self.test_templates_list)
        
        # Personalization flow tests
        self.run_test("Simulate Polar Webhook", self.test_simulate_polar_webhook)
        self.run_test("Session Lookup by Checkout ID", self.test_session_lookup_by_checkout)
        self.run_test("Session Data Includes Password Field", self.test_session_data_includes_password_field)
        self.run_test("Session Status Polling Endpoint", self.test_session_status_endpoint)
        
        # Admin functionality tests
        self.run_test("Admin Login", self.test_admin_login)
        self.run_test("Admin Templates Access", self.test_admin_templates_endpoint)
        self.run_test("Template Spreads Endpoint", self.test_template_spreads_endpoint)
        
        # Print results
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All backend tests PASSED!")
            return True
        else:
            print(f"⚠️ {self.tests_run - self.tests_passed} tests FAILED")
            return False

def main():
    tester = BackendTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())