#!/usr/bin/env python3
"""
Quick test script to verify the IPL AI Assistant fixes
"""
import os
import sys
from dotenv import load_dotenv

def test_env_configuration():
    """Test if environment variables are properly configured"""
    print("Testing environment configuration...")
    load_dotenv('server/.env')
    
    gemini_key = os.getenv('GEMINI_API_KEY')
    cricbuzz_key = os.getenv('CRICBUZZ_API_KEY')
    
    print(f"  GEMINI_API_KEY: {'Configured' if gemini_key and gemini_key != 'your_gemini_api_key_here' else 'NOT CONFIGURED'}")
    print(f"  CRICBUZZ_API_KEY: {'Configured' if cricbuzz_key else 'Not configured (optional)'}")
    
    if not gemini_key or gemini_key == 'your_gemini_api_key_here':
        print("\n  WARNING: Gemini API key not configured!")
        print("  Please add your API key to server/.env")
        print("  Get one from: https://aistudio.google.com/app/apikey")
        return False
    
    return True

def test_imports():
    """Test if all required packages are installed"""
    print("\nTesting Python dependencies...")
    
    required_packages = [
        ('fastapi', 'FastAPI'),
        ('uvicorn', 'Uvicorn'),
        ('dotenv', 'python-dotenv'),
        ('google.generativeai', 'google-generativeai'),
        ('httpx', 'httpx')
    ]
    
    all_installed = True
    for module_name, package_name in required_packages:
        try:
            __import__(module_name)
            print(f"  {package_name}: OK")
        except ImportError:
            print(f"  {package_name}: MISSING")
            all_installed = False
    
    if not all_installed:
        print("\n  Run: conda activate adobehackathon && pip install -r server/requirements.txt")
        return False
    
    return True

def test_gemini_service():
    """Test if Gemini service can be initialized"""
    print("\nTesting Gemini service...")
    
    try:
        sys.path.insert(0, 'server')
        from services.gemini_service import gemini_service
        
        if gemini_service.model is None:
            print("  Gemini service: NOT INITIALIZED (API key missing)")
            return False
        else:
            print("  Gemini service: OK")
            return True
    except Exception as e:
        print(f"  Gemini service: ERROR - {e}")
        return False

def test_tactical_chat():
    """Test the tactical chat functionality"""
    print("\nTesting tactical chat endpoint...")
    
    try:
        sys.path.insert(0, 'server')
        from services.gemini_service import gemini_service
        
        # Test with sample context
        sample_context = {
            'match': {
                'team1': 'CSK',
                'team2': 'MI',
                'score': '184/4',
                'overs': '18.2',
                'status': 'In Progress',
                'battingTeam': 'CSK',
                'bowlingTeam': 'MI'
            },
            'activeBatter': {
                'name': 'R. Gaikwad',
                'role': 'Batter'
            },
            'activeBowler': {
                'name': 'J. Bumrah',
                'role': 'Bowler'
            },
            'isLive': True
        }
        
        result = gemini_service.answer_tactical_question(
            "What is the win probability?",
            sample_context
        )
        
        if 'response' in result:
            print("  Tactical chat: OK")
            print(f"  Sample response: {result['response'][:100]}...")
            return True
        else:
            print("  Tactical chat: ERROR - No response")
            return False
            
    except Exception as e:
        print(f"  Tactical chat: ERROR - {e}")
        return False

def main():
    print("=" * 60)
    print("IPL AI Assistant - Testing Fixes")
    print("=" * 60)
    
    results = []
    
    # Run tests
    results.append(("Environment Configuration", test_env_configuration()))
    results.append(("Python Dependencies", test_imports()))
    results.append(("Gemini Service", test_gemini_service()))
    results.append(("Tactical Chat", test_tactical_chat()))
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    for test_name, passed in results:
        status = "PASS" if passed else "FAIL"
        print(f"  {test_name}: {status}")
    
    all_passed = all(result[1] for result in results)
    
    if all_passed:
        print("\n  All tests passed! The application should work correctly.")
        print("\n  Next steps:")
        print("  1. Build frontend: cd client && npm run build")
        print("  2. Copy build: cp -r client/dist/* server/public/")
        print("  3. Start server: conda activate adobehackathon && python server/app.py")
    else:
        print("\n  Some tests failed. Please fix the issues above.")
        print("  See SETUP_GUIDE.md for detailed instructions.")
    
    return 0 if all_passed else 1

if __name__ == '__main__':
    sys.exit(main())
