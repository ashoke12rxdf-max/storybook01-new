#!/usr/bin/env python3
"""
Test email branding and delivery email skipping functionality
"""

import sys
import os

def test_email_branding():
    """Test that email_sender.py uses Keepsake Gifts branding"""
    print("🔍 Testing email branding...")
    
    try:
        # Read email_sender.py content
        with open('/app/backend/automation/email_sender.py', 'r') as f:
            content = f.read()
        
        # Check for Keepsake Gifts branding
        checks = [
            ('BRAND_NAME = "Keepsake Gifts"', 'Brand name constant'),
            ('Keepsake Gifts branding', 'Class docstring mentions branding'),
            ('With love,', 'Email footer template'),
            ('Complete your storybook personalization', 'Email subject'),
            ('Your keepsake storybook is almost ready', 'Email content')
        ]
        
        passed = 0
        for check, description in checks:
            if check in content:
                print(f"   ✅ {description}: Found")
                passed += 1
            else:
                print(f"   ❌ {description}: Not found")
        
        print(f"   📊 Email branding checks: {passed}/{len(checks)} passed")
        return passed == len(checks)
        
    except Exception as e:
        print(f"   ❌ Error reading email_sender.py: {e}")
        return False

def test_delivery_email_skipping():
    """Test that delivery email is skipped in personalization_processor.py and email_sender.py"""
    print("🔍 Testing delivery email skipping...")
    
    try:
        # Read personalization_processor.py content
        with open('/app/backend/automation/personalization_processor.py', 'r') as f:
            processor_content = f.read()
        
        # Read email_sender.py content
        with open('/app/backend/automation/email_sender.py', 'r') as f:
            email_content = f.read()
        
        # Check for delivery email skipping
        checks = [
            ('# Step 4: Skip delivery email - link is shown on success page instead', 'Skip delivery email comment', processor_content),
            ('logger.info(f"Delivery email skipped - link shown on success page")', 'Skip delivery email log', processor_content),
            ('DEPRECATED: This email is no longer sent automatically.', 'Deprecated delivery email method', email_content),
            ('The storybook link is shown on the success page instead.', 'Success page explanation', email_content)
        ]
        
        passed = 0
        for check, description, content in checks:
            if check in content:
                print(f"   ✅ {description}: Found")
                passed += 1
            else:
                print(f"   ❌ {description}: Not found")
        
        print(f"   📊 Delivery email skipping checks: {passed}/{len(checks)} passed")
        return passed == len(checks)
        
    except Exception as e:
        print(f"   ❌ Error reading files: {e}")
        return False

def test_success_page_enhancements():
    """Test that PersonalizationForm.js has enhanced success page"""
    print("🔍 Testing success page enhancements...")
    
    try:
        # Read PersonalizationForm.js content
        with open('/app/frontend/src/pages/PersonalizationForm.js', 'r') as f:
            content = f.read()
        
        # Check for success page enhancements
        checks = [
            ('submittedPassword && (', 'Password display section'),
            ('Storybook password', 'Password label'),
            ('Your personalization details', 'Personalization details section'),
            ('data-testid="view-storybook-link"', 'View storybook link'),
            ('Copy password', 'Copy password functionality')
        ]
        
        passed = 0
        for check, description in checks:
            if check in content:
                print(f"   ✅ {description}: Found")
                passed += 1
            else:
                print(f"   ❌ {description}: Not found")
        
        print(f"   📊 Success page enhancement checks: {passed}/{len(checks)} passed")
        return passed == len(checks)
        
    except Exception as e:
        print(f"   ❌ Error reading PersonalizationForm.js: {e}")
        return False

def test_password_viewer_title_only():
    """Test that CustomerViewer.js shows only title without subtitle"""
    print("🔍 Testing password viewer title display...")
    
    try:
        # Read CustomerViewer.js content
        with open('/app/frontend/src/pages/CustomerViewer.js', 'r') as f:
            content = f.read()
        
        # Check for title-only display
        checks = [
            ('const displayTitle = storybook.title?.trim() || \'Your Storybook\';', 'Title with fallback'),
            ('{displayTitle}', 'Display title usage'),
            ('This storybook is password protected', 'Password protection message')
        ]
        
        passed = 0
        for check, description in checks:
            if check in content:
                print(f"   ✅ {description}: Found")
                passed += 1
            else:
                print(f"   ❌ {description}: Not found")
        
        print(f"   📊 Password viewer title checks: {passed}/{len(checks)} passed")
        return passed == len(checks)
        
    except Exception as e:
        print(f"   ❌ Error reading CustomerViewer.js: {e}")
        return False

def main():
    print("🚀 Testing Keepsake Gifts Rebranding Features")
    print("=" * 60)
    
    tests = [
        ("Email Branding (Keepsake Gifts)", test_email_branding),
        ("Delivery Email Skipping", test_delivery_email_skipping),
        ("Success Page Enhancements", test_success_page_enhancements),
        ("Password Viewer Title Only", test_password_viewer_title_only)
    ]
    
    passed = 0
    total = len(tests)
    
    for name, test_func in tests:
        print(f"\n📋 {name}")
        if test_func():
            print(f"✅ PASS: {name}")
            passed += 1
        else:
            print(f"❌ FAIL: {name}")
    
    print("\n" + "=" * 60)
    print(f"📊 Overall Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All rebranding features implemented correctly!")
        return True
    else:
        print(f"❌ {total - passed} features need attention")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)