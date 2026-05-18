#!/usr/bin/env python3
"""
Simple test script to verify the server works correctly
"""

import sys
import os
sys.path.append('server')

# Test imports
try:
    from server.app import app
    from server.data.sample_api_response import SAMPLE_CRICBUZZ_RESPONSE
    from server.app import _extract_ipl_matches
    print("✓ All imports successful")
except ImportError as e:
    print(f"✗ Import error: {e}")
    sys.exit(1)

# Test data extraction
try:
    matches = _extract_ipl_matches(SAMPLE_CRICBUZZ_RESPONSE)
    print(f"✓ Data extraction successful: {len(matches)} matches found")
    
    if matches:
        match = matches[0]
        print(f"  - Match: {match.get('teams')} vs {match.get('opponent')}")
        print(f"  - Status: {match.get('status')}")
        print(f"  - Is Live: {match.get('isLive')}")
        print(f"  - Batting Team: {match.get('battingTeam')}")
        print(f"  - Current Score: {match.get('currentInnings', {})}")
    
except Exception as e:
    print(f"✗ Data extraction error: {e}")
    sys.exit(1)

print("\n✓ All tests passed! Server should work correctly.")
print("\nTo start the server, run:")
print("  cd server && python -m uvicorn app:app --reload --port 8080")