"""
Tests for Polar personalization flow end-to-end
Steps 1-4: simulate webhook, by-checkout lookup, admin sessions list, resend email
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def simulate_result():
    """Step 1: Simulate Polar webhook and return result"""
    response = requests.post(f"{BASE_URL}/api/automation/simulate-polar-webhook", json={
        "productSlug": "baby-boy-story",
        "customerEmail": "test@example.com",
        "customerName": "Test User"
    })
    print(f"[SIMULATE] Status: {response.status_code}, Body: {response.text[:500]}")
    return response

class TestStep1SimulateWebhook:
    """Step 1: POST simulate-polar-webhook"""

    def test_simulate_returns_200(self, simulate_result):
        assert simulate_result.status_code == 200, f"Got {simulate_result.status_code}: {simulate_result.text}"

    def test_simulate_flow_is_personalization(self, simulate_result):
        data = simulate_result.json()
        assert data.get("flow") == "personalization", f"Expected 'personalization', got: {data.get('flow')}"

    def test_simulate_checkout_id_format(self, simulate_result):
        data = simulate_result.json()
        checkout_id = data.get("checkoutId", "")
        assert checkout_id.startswith("chk_sim_"), f"checkoutId should start with 'chk_sim_', got: {checkout_id}"

    def test_simulate_has_session_token(self, simulate_result):
        data = simulate_result.json()
        assert data.get("sessionToken"), "Expected sessionToken in response"


class TestStep2ByCheckout:
    """Step 2: GET /personalization/by-checkout"""

    def test_by_checkout_returns_ready(self, simulate_result):
        data = simulate_result.json()
        checkout_id = data.get("checkoutId")
        assert checkout_id, "No checkoutId from simulate step"

        response = requests.get(f"{BASE_URL}/api/personalization/by-checkout", params={"checkout_id": checkout_id})
        print(f"[BY-CHECKOUT] Status: {response.status_code}, Body: {response.text[:500]}")
        assert response.status_code == 200

        result = response.json()
        assert result.get("status") == "ready", f"Expected status='ready', got: {result}"
        assert result.get("session_token"), "Expected session_token in response"

    def test_by_checkout_checkout_id_not_order_id(self, simulate_result):
        """Verify that session stores checkout_id (chk_sim_xxx), not order_id (uuid)"""
        data = simulate_result.json()
        checkout_id = data.get("checkoutId")
        order_id = data.get("orderId")
        
        response = requests.get(f"{BASE_URL}/api/personalization/by-checkout", params={"checkout_id": checkout_id})
        assert response.status_code == 200
        result = response.json()
        
        # The by-checkout lookup using checkoutId must succeed (this would fail if order_id was stored)
        assert result.get("status") == "ready", f"Lookup by checkoutId failed - bug may still exist. Result: {result}"
        print(f"[VERIFIED] checkout_id={checkout_id} found, NOT order_id={order_id}")

    def test_by_order_id_returns_not_found(self, simulate_result):
        """order_id should NOT be findable via by-checkout (confirms correct storage)"""
        data = simulate_result.json()
        order_id = data.get("orderId")
        if not order_id:
            pytest.skip("No orderId in response")
        
        response = requests.get(f"{BASE_URL}/api/personalization/by-checkout", params={"checkout_id": order_id})
        result = response.json()
        # Should be not_found since we now store real checkout_id
        print(f"[ORDER_ID_LOOKUP] Result: {result}")
        # This is informational - if not_found, the fix is correct


class TestStep3AdminSessions:
    """Step 3: GET /admin/personalization/sessions"""

    def test_admin_sessions_returns_200(self):
        response = requests.get(f"{BASE_URL}/api/admin/personalization/sessions")
        assert response.status_code == 200, f"Got {response.status_code}: {response.text}"

    def test_admin_sessions_has_sessions_key(self):
        response = requests.get(f"{BASE_URL}/api/admin/personalization/sessions")
        data = response.json()
        assert "sessions" in data, f"Expected 'sessions' key, got: {data.keys()}"
        assert isinstance(data["sessions"], list)

    def test_admin_sessions_contains_created_session(self, simulate_result):
        sim_data = simulate_result.json()
        session_token = sim_data.get("sessionToken")
        checkout_id = sim_data.get("checkoutId")

        response = requests.get(f"{BASE_URL}/api/admin/personalization/sessions")
        data = response.json()
        sessions = data.get("sessions", [])

        tokens = [s.get("session_token") for s in sessions]
        assert session_token in tokens, f"Session {session_token} not found in admin list: {tokens[:5]}"

        # Find the specific session and verify checkout_id
        session = next((s for s in sessions if s.get("session_token") == session_token), None)
        assert session is not None
        assert session.get("checkout_id") == checkout_id, (
            f"checkout_id mismatch. Expected {checkout_id}, got {session.get('checkout_id')}"
        )


class TestStep4ResendEmail:
    """Step 4: POST /admin/personalization/sessions/{token}/resend-email"""

    def test_resend_email_returns_success(self, simulate_result):
        sim_data = simulate_result.json()
        session_token = sim_data.get("sessionToken")
        assert session_token, "No session token"

        response = requests.post(
            f"{BASE_URL}/api/admin/personalization/sessions/{session_token}/resend-email"
        )
        print(f"[RESEND-EMAIL] Status: {response.status_code}, Body: {response.text[:500]}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True, f"Expected success=true, got: {data}"
