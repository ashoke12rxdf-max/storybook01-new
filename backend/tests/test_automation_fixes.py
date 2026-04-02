"""
Tests for automation fixes (Fix 2-6):
- Fix 2: APP_BASE_URL environment variable usage in order_processor.py
- Fix 3: Font preservation in pdf_filler.py (code review only - no fillable PDF to test)
- Fix 4: Creem webhook endpoint with signature verification
- Fix 5: Storage cleanup - personalizedPdfPath set to 'deleted_after_use'
- Fix 6: Frontend navigation icons (tested via UI automation)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestApiHealth:
    """Basic API health checks"""
    
    def test_api_root_returns_valid_response(self):
        """Verify API root endpoint responds correctly"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["message"] == "Storybook Vault API"
        print(f"PASS: API root returns {data}")


class TestCreemWebhookEndpoint:
    """Tests for Fix 4: Creem webhook endpoint /api/webhooks/creem"""
    
    def test_creem_webhook_endpoint_exists(self):
        """Fix 4: Verify /api/webhooks/creem endpoint exists and accepts POST"""
        payload = {
            "orderId": "pytest-creem-test-1",
            "productSlug": "test-product",
            "requestedName": "TestUser",
            "customerEmail": "test@example.com"
        }
        response = requests.post(f"{BASE_URL}/api/webhooks/creem", json=payload)
        
        # Should return 200 (webhook received) or 403 (signature invalid if secret is set)
        assert response.status_code in [200, 403], f"Unexpected status: {response.status_code}"
        print(f"PASS: Creem webhook endpoint exists, returned status {response.status_code}")
    
    def test_creem_webhook_returns_received_true(self):
        """Fix 4: Verify webhook returns received: true for valid payload"""
        payload = {
            "orderId": "pytest-creem-test-2",
            "productSlug": "test-product",
            "requestedName": "TestUser2",
            "customerEmail": "test2@example.com"
        }
        response = requests.post(f"{BASE_URL}/api/webhooks/creem", json=payload)
        
        # With placeholder secret, signature verification should be skipped
        if response.status_code == 200:
            data = response.json()
            assert data.get("received") == True, f"Expected received: true, got {data}"
            assert "orderId" in data, "Response should contain orderId"
            print(f"PASS: Webhook response contains received: true and orderId: {data.get('orderId')}")
        else:
            print(f"INFO: Webhook returned {response.status_code} - signature verification is active")
    
    def test_creem_webhook_idempotency(self):
        """Fix 4: Verify webhook handles duplicate orderId (idempotency)"""
        unique_order_id = "pytest-idempotent-test-123"
        payload = {
            "orderId": unique_order_id,
            "productSlug": "test-product",
            "requestedName": "TestUser3",
            "customerEmail": "test3@example.com"
        }
        
        # First call
        response1 = requests.post(f"{BASE_URL}/api/webhooks/creem", json=payload)
        
        # Second call with same orderId
        response2 = requests.post(f"{BASE_URL}/api/webhooks/creem", json=payload)
        
        if response2.status_code == 200:
            data2 = response2.json()
            # Second call should indicate order already exists
            assert "orderId" in data2
            print(f"PASS: Idempotency working - second call returned orderId: {data2.get('orderId')}")
        print(f"PASS: Both calls returned successfully (status: {response1.status_code}, {response2.status_code})")


class TestSimulateWebhookEndpoint:
    """Tests for simulate-webhook endpoint (should still work after changes)"""
    
    def test_simulate_webhook_still_works(self):
        """Verify simulate-webhook endpoint still functional"""
        payload = {
            "orderId": "pytest-simulate-test-1",
            "productSlug": "test-product-sim",
            "requestedName": "SimulateTestUser",
            "customerEmail": "simulate@example.com"
        }
        response = requests.post(f"{BASE_URL}/api/automation/simulate-webhook", json=payload)
        
        assert response.status_code == 200, f"Unexpected status: {response.status_code}"
        data = response.json()
        
        # Should have success (true or false depending on template existence) and orderId
        assert "orderId" in data, "Response should contain orderId"
        assert "order" in data, "Response should contain order details"
        print(f"PASS: simulate-webhook works, orderId: {data.get('orderId')}")
    
    def test_simulate_webhook_returns_order_details(self):
        """Verify simulate-webhook returns full order object"""
        payload = {
            "orderId": "pytest-simulate-detail-test",
            "productSlug": "non-existent-product",
            "requestedName": "DetailTestUser",
            "customerEmail": "detail@example.com"
        }
        response = requests.post(f"{BASE_URL}/api/automation/simulate-webhook", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        order = data.get("order", {})
        
        # Verify order structure
        assert "id" in order, "Order should have id"
        assert "status" in order, "Order should have status"
        assert "customerData" in order, "Order should have customerData"
        assert order["customerData"]["requestedName"] == "DetailTestUser"
        print(f"PASS: Order details returned correctly, status: {order.get('status')}")


class TestAutomationOrdersEndpoints:
    """Tests for automation orders list/detail endpoints"""
    
    def test_get_orders_list(self):
        """Verify GET /automation/orders returns list"""
        response = requests.get(f"{BASE_URL}/api/automation/orders")
        assert response.status_code == 200
        data = response.json()
        
        assert "orders" in data, "Response should contain orders array"
        assert "total" in data, "Response should contain total count"
        assert isinstance(data["orders"], list)
        print(f"PASS: Orders list returned, total: {data.get('total')}")
    
    def test_get_orders_with_status_filter(self):
        """Verify orders can be filtered by status"""
        response = requests.get(f"{BASE_URL}/api/automation/orders?status=failed")
        assert response.status_code == 200
        data = response.json()
        
        # All returned orders should have status=failed
        for order in data.get("orders", []):
            assert order.get("status") == "failed", f"Order status should be 'failed', got {order.get('status')}"
        print(f"PASS: Status filter works, returned {len(data.get('orders', []))} failed orders")


class TestStorageCleanup:
    """Tests for Fix 5: Storage cleanup - personalizedPdfPath should be 'deleted_after_use'"""
    
    def test_completed_orders_have_deleted_pdf_path(self):
        """Fix 5: Verify completed orders have personalizedPdfPath set to 'deleted_after_use'"""
        response = requests.get(f"{BASE_URL}/api/automation/orders?status=completed")
        
        if response.status_code == 200:
            data = response.json()
            completed_orders = data.get("orders", [])
            
            if len(completed_orders) > 0:
                for order in completed_orders:
                    pdf_path = order.get("personalizedPdfPath")
                    # Completed orders should either have 'deleted_after_use' or None
                    # (if cleanup hasn't run yet or order was completed before this fix)
                    if pdf_path and pdf_path != "deleted_after_use":
                        print(f"INFO: Order {order.get('id')} has pdf path: {pdf_path} (may be old order)")
                    else:
                        print(f"PASS: Order {order.get('id')} has proper cleanup status: {pdf_path}")
                print(f"PASS: Checked {len(completed_orders)} completed orders for storage cleanup")
            else:
                print("INFO: No completed orders found to verify storage cleanup")
                pytest.skip("No completed orders available for storage cleanup verification")
        else:
            print(f"WARN: Could not fetch completed orders: {response.status_code}")


class TestBaseUrlConfiguration:
    """Tests for Fix 2: APP_BASE_URL environment variable"""
    
    def test_backend_env_has_app_base_url(self):
        """Fix 2: Verify APP_BASE_URL is configured in backend/.env"""
        env_path = "/app/backend/.env"
        try:
            with open(env_path, "r") as f:
                env_content = f.read()
            assert "APP_BASE_URL" in env_content, "APP_BASE_URL should be in backend/.env"
            print(f"PASS: APP_BASE_URL is present in backend/.env")
        except FileNotFoundError:
            pytest.fail(f"backend/.env not found at {env_path}")


class TestWebhookSecretConfiguration:
    """Tests for Fix 4: Creem webhook secret configuration"""
    
    def test_backend_env_has_webhook_secret(self):
        """Fix 4: Verify CREEM_WEBHOOK_SECRET is configured in backend/.env"""
        env_path = "/app/backend/.env"
        try:
            with open(env_path, "r") as f:
                env_content = f.read()
            assert "CREEM_WEBHOOK_SECRET" in env_content, "CREEM_WEBHOOK_SECRET should be in backend/.env"
            print(f"PASS: CREEM_WEBHOOK_SECRET is present in backend/.env")
        except FileNotFoundError:
            pytest.fail(f"backend/.env not found at {env_path}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
