import requests
import sys
import json
from datetime import datetime

class StorybookAPITester:
    def __init__(self, base_url="https://flipbook-deploy.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.reviewer_session_id = f"test_session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and len(str(response_data)) < 500:
                        print(f"   Response: {response_data}")
                except:
                    pass
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Response text: {response.text[:200]}")

            return success, response.json() if response.content else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_admin_login_no_password(self):
        """Test admin login with empty password"""
        success, response = self.run_test(
            "Admin Login (No Password)",
            "POST",
            "admin/login",
            200,
            data={"password": ""}
        )
        if success and 'token' in response:
            self.token = response['token']
            print(f"   Token received: {self.token[:20]}...")
            return True
        return False

    def test_admin_login_any_password(self):
        """Test admin login with any password (should still work)"""
        success, response = self.run_test(
            "Admin Login (Any Password)",
            "POST", 
            "admin/login",
            200,
            data={"password": "any_password_should_work"}
        )
        return success and 'token' in response

    def test_submit_review(self, storybook_id="test-storybook", storybook_slug="test-slug", star_rating=5, review_text="Great storybook!", session_suffix=""):
        """Test submitting a review"""
        session_id = self.reviewer_session_id + session_suffix
        success, response = self.run_test(
            f"Submit Review (Rating: {star_rating})",
            "POST",
            "reviews/submit",
            200,  # Backend returns 200, not 201
            data={
                "storybook_id": storybook_id,
                "storybook_slug": storybook_slug,
                "star_rating": star_rating,
                "review_text": review_text,
                "reviewer_session_id": session_id
            }
        )
        return success, response

    def test_duplicate_review(self, storybook_id="test-storybook", storybook_slug="test-slug"):
        """Test submitting duplicate review (should be rejected)"""
        success, response = self.run_test(
            "Submit Duplicate Review",
            "POST",
            "reviews/submit",
            409,  # Expecting conflict
            data={
                "storybook_id": storybook_id,
                "storybook_slug": storybook_slug,
                "star_rating": 4,
                "review_text": "Duplicate review attempt",
                "reviewer_session_id": self.reviewer_session_id  # Same session ID
            }
        )
        return success

    def test_get_admin_reviews(self):
        """Test getting all reviews from admin endpoint"""
        success, response = self.run_test(
            "Get Admin Reviews",
            "GET",
            "admin/reviews",
            200
        )
        if success:
            reviews = response.get('reviews', [])
            total = response.get('total', 0)
            print(f"   Found {total} reviews")
            if reviews:
                print(f"   Latest review: {reviews[0].get('star_rating')} stars")
        return success, response

    def test_review_validation(self):
        """Test review validation (invalid star rating)"""
        success, response = self.run_test(
            "Invalid Star Rating",
            "POST",
            "reviews/submit",
            400,  # Backend returns 400, not 422
            data={
                "storybook_id": "test-storybook",
                "storybook_slug": "test-slug", 
                "star_rating": 6,  # Invalid rating
                "review_text": "Invalid rating test",
                "reviewer_session_id": f"{self.reviewer_session_id}_invalid"
            }
        )
        return success

def main():
    print("🚀 Starting Storybook API Tests")
    print("=" * 50)
    
    tester = StorybookAPITester()
    
    # Test 1: Admin login with no password
    if not tester.test_admin_login_no_password():
        print("❌ Admin login failed, stopping tests")
        return 1

    # Test 2: Admin login with any password (should still work)
    if not tester.test_admin_login_any_password():
        print("❌ Admin login with password failed")

    # Test 3: Submit a review
    success, review_response = tester.test_submit_review(
        storybook_id="sophies-baby-boy-adventure-be48f6c8",
        storybook_slug="sophies-baby-boy-adventure-be48f6c8",
        star_rating=5,
        review_text="Amazing storybook! My child loves it."
    )
    if not success:
        print("❌ Review submission failed")

    # Test 4: Submit another review with different session
    tester.test_submit_review(
        storybook_id="sophies-baby-boy-adventure-be48f6c8", 
        storybook_slug="sophies-baby-boy-adventure-be48f6c8",
        star_rating=4,
        review_text="Very good quality and engaging story.",
        session_suffix="_2"
    )

    # Test 5: Try to submit duplicate review (should fail)
    if not tester.test_duplicate_review(
        storybook_id="sophies-baby-boy-adventure-be48f6c8",
        storybook_slug="sophies-baby-boy-adventure-be48f6c8"
    ):
        print("❌ Duplicate review rejection failed")

    # Test 6: Test invalid star rating
    tester.test_review_validation()

    # Test 7: Get admin reviews
    success, admin_reviews = tester.test_get_admin_reviews()
    if not success:
        print("❌ Admin reviews retrieval failed")

    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())