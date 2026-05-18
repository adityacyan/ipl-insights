import asyncio
import os
import time
from contextlib import asynccontextmanager
from typing import Any, Dict, List

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from data.mock_db import get_live_match_context
from services.gemini_service import gemini_service

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global polling_task
    if polling_task is None:
        polling_task = asyncio.create_task(_poll_live_scores())
    try:
        yield
    finally:
        if polling_task:
            polling_task.cancel()


app = FastAPI(lifespan=lifespan)

cricbuzz_live_url = os.getenv(
    "CRICBUZZ_LIVE_URL", "https://cricbuzz-cricket.p.rapidapi.com/matches/v1/live"
)
cricbuzz_api_host = os.getenv("CRICBUZZ_API_HOST", "cricbuzz-cricket.p.rapidapi.com")
cricbuzz_api_key = os.getenv("CRICBUZZ_API_KEY")
poll_interval_seconds = int(os.getenv("SCORES_POLL_INTERVAL", "20"))

live_scores_cache: Dict[str, Any] = {
    "updatedAt": None,
    "matches": [],
    "source": "cricbuzz",
}

polling_task: asyncio.Task | None = None

cors_origin = os.getenv("CORS_ORIGIN", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[cors_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class InsightRequest(BaseModel):
    matchContext: Dict[str, Any] = Field(default_factory=dict)
    insightType: str = "tactical"


class WinProbabilityRequest(BaseModel):
    matchState: Dict[str, Any] = Field(default_factory=dict)


@app.get("/api/live-context")
def live_context():
    if live_scores_cache.get("matches"):
        first_match = live_scores_cache["matches"][0]
        # Extract better match context from live data
        match_info = {
            "team1": first_match.get("teams"),
            "team2": first_match.get("opponent"),
            "venue": first_match.get("venue"),
            "status": first_match.get("status"),
            "score": first_match.get("score"),
            "description": first_match.get("description"),
            "matchId": first_match.get("id"),
            "overs": first_match.get("currentInnings", {}).get("overs"),
            "battingTeam": first_match.get("battingTeam"),
            "bowlingTeam": first_match.get("bowlingTeam")
        }
        
        # Get active players from mock data for now
        mock_context = get_live_match_context()
        return {
            "match": match_info,
            "activeBatter": mock_context.get("activeBatter"),
            "activeBowler": mock_context.get("activeBowler"),
            "isLive": first_match.get("isLive", False)
        }
    
    # Fallback to mock data
    context = get_live_match_context()
    context["isLive"] = False
    return context


def _extract_ipl_matches(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    matches: List[Dict[str, Any]] = []
    if not payload:
        return matches

    for type_group in payload.get("typeMatches", []) or []:
        match_type = type_group.get("matchType", "")
        
        # Look for League matches (IPL is usually under League)
        if match_type not in ["League", "International"]:
            continue
            
        for series_group in type_group.get("seriesMatches", []) or []:
            series = series_group.get("seriesAdWrapper") or {}
            series_name = (series.get("seriesName") or "").upper()
            
            # Check for IPL in series name
            if not any(keyword in series_name for keyword in ["IPL", "INDIAN PREMIER LEAGUE", "PREMIER LEAGUE"]):
                continue
            
            for match in series.get("matches", []) or []:
                match_info = match.get("matchInfo") or {}
                match_score = match.get("matchScore") or {}
                venue_info = match_info.get("venueInfo") or {}
                
                # Extract team information
                team1_info = match_info.get("team1", {})
                team2_info = match_info.get("team2", {})
                
                # Extract score information
                team1_score = match_score.get("team1Score", {})
                team2_score = match_score.get("team2Score", {})
                
                # Get the latest innings for each team
                team1_innings = team1_score.get("inngs1", {})
                team2_innings = team2_score.get("inngs1", {})
                
                # Determine current batting team and innings
                curr_bat_team_id = match_info.get("currBatTeamId")
                current_innings = None
                batting_team = None
                bowling_team = None
                
                if curr_bat_team_id == team1_info.get("teamId"):
                    current_innings = team1_innings
                    batting_team = team1_info.get("teamName") or team1_info.get("teamSName")
                    bowling_team = team2_info.get("teamName") or team2_info.get("teamSName")
                elif curr_bat_team_id == team2_info.get("teamId"):
                    current_innings = team2_innings
                    batting_team = team2_info.get("teamName") or team2_info.get("teamSName")
                    bowling_team = team1_info.get("teamName") or team1_info.get("teamSName")
                else:
                    # Default to team2 if no current batting team specified
                    current_innings = team2_innings if team2_innings else team1_innings
                    batting_team = team2_info.get("teamName") or team2_info.get("teamSName")
                    bowling_team = team1_info.get("teamName") or team1_info.get("teamSName")
                
                match_data = {
                    "id": match_info.get("matchId"),
                    "series": series.get("seriesName"),
                    "description": match_info.get("matchDesc"),
                    "status": match_info.get("status"),
                    "state": match_info.get("state"),
                    "venue": venue_info.get("ground") or venue_info.get("city"),
                    "teams": team1_info.get("teamName") or team1_info.get("teamSName"),
                    "opponent": team2_info.get("teamName") or team2_info.get("teamSName"),
                    "battingTeam": batting_team,
                    "bowlingTeam": bowling_team,
                    "team1": {
                        "name": team1_info.get("teamName"),
                        "shortName": team1_info.get("teamSName"),
                        "score": team1_innings,
                        "teamId": team1_info.get("teamId")
                    },
                    "team2": {
                        "name": team2_info.get("teamName"),
                        "shortName": team2_info.get("teamSName"),
                        "score": team2_innings,
                        "teamId": team2_info.get("teamId")
                    },
                    "currentInnings": current_innings,
                    "score": match_score,
                    "isLive": match_info.get("state") in ["In Progress", "Live"],
                    "matchFormat": match_info.get("matchFormat"),
                    "currBatTeamId": curr_bat_team_id
                }
                matches.append(match_data)

    return matches


async def _poll_live_scores() -> None:
    if not cricbuzz_api_key:
        print("Warning: CRICBUZZ_API_KEY not configured. Using sample data.")
        # Load sample data for testing
        from data.sample_api_response import SAMPLE_CRICBUZZ_RESPONSE
        matches = _extract_ipl_matches(SAMPLE_CRICBUZZ_RESPONSE)
        live_scores_cache["matches"] = matches
        live_scores_cache["updatedAt"] = int(time.time() * 1000)
        live_scores_cache["error"] = None
        live_scores_cache["source"] = "sample_data"
        print(f"Loaded {len(matches)} sample IPL matches")
        return

    import httpx

    headers = {
        "Content-Type": "application/json",
        "x-rapidapi-host": cricbuzz_api_host,
        "x-rapidapi-key": cricbuzz_api_key,
    }

    async with httpx.AsyncClient(timeout=12.0) as client:
        while True:
            try:
                print(f"Fetching live scores from Cricbuzz API...")
                response = await client.get(cricbuzz_live_url, headers=headers)
                response.raise_for_status()
                payload = response.json()
                
                matches = _extract_ipl_matches(payload)
                live_scores_cache["matches"] = matches
                live_scores_cache["updatedAt"] = int(time.time() * 1000)
                live_scores_cache["error"] = None
                live_scores_cache["source"] = "cricbuzz_api"
                
                print(f"Successfully fetched {len(matches)} IPL matches")
                if matches:
                    for match in matches[:2]:  # Log first 2 matches
                        print(f"  - {match.get('teams')} vs {match.get('opponent')}: {match.get('status')}")
                        
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 403:
                    error_msg = "API subscription required. Using sample data instead."
                    print(f"API Error: {error_msg}")
                    
                    # Fallback to sample data
                    from data.sample_api_response import SAMPLE_CRICBUZZ_RESPONSE
                    matches = _extract_ipl_matches(SAMPLE_CRICBUZZ_RESPONSE)
                    live_scores_cache["matches"] = matches
                    live_scores_cache["updatedAt"] = int(time.time() * 1000)
                    live_scores_cache["error"] = error_msg
                    live_scores_cache["source"] = "sample_data_fallback"
                    print(f"Using sample data: {len(matches)} IPL matches")
                    break  # Don't keep polling if subscription is required
                else:
                    error_msg = f"HTTP error {e.response.status_code}: {e.response.text}"
                    print(f"Error fetching live scores: {error_msg}")
                    live_scores_cache["error"] = error_msg
                    live_scores_cache["updatedAt"] = int(time.time() * 1000)
            except Exception as e:
                error_msg = f"Unexpected error: {str(e)}"
                print(f"Error fetching live scores: {error_msg}")
                live_scores_cache["error"] = error_msg
                live_scores_cache["updatedAt"] = int(time.time() * 1000)
                
            await asyncio.sleep(poll_interval_seconds)


@app.post("/api/insights")
def insights(payload: InsightRequest):
    # Get current live context for better insights
    current_context = live_context()
    
    # Merge with provided context
    enhanced_context = {**current_context, **payload.matchContext}
    
    insight = gemini_service.generate_insight(enhanced_context, payload.insightType)
    return insight


@app.get("/api/insights/live")
def live_insights():
    """Generate insights based on current live match context
    BATCHED: Requests all 3 insight types in a single API call to save quota"""
    current_context = live_context()
    
    # BATCHED PROMPT: Request all 3 insights in a single API call
    try:
        result = gemini_service.generate_batched_insights(current_context)
        return result
    except Exception as e:
        print(f"Error generating batched insights: {e}")
        return {
            "insights": [
                {
                    "id": str(int(time.time() * 1000)),
                    "type": "tactical",
                    "title": "AI Service Error",
                    "content": "Unable to generate insights. Please check Gemini API configuration.",
                    "confidence": 0,
                    "timestamp": int(time.time() * 1000)
                }
            ],
            "context": current_context,
            "timestamp": int(time.time() * 1000)
        }


@app.get("/api/insights/all-parallel")
async def all_insights_parallel():
    """Generate ALL insights in PARALLEL for minimum latency
    Makes 2 concurrent API calls:
    1. General Insights (batched: tactical + momentum + prediction)
    2. Tactical Insights (batched: momentum shift + tactical read)
    
    This endpoint returns ALL 5 insights faster than calling endpoints separately"""
    current_context = live_context()
    
    try:
        result = await gemini_service.generate_all_insights_parallel(current_context)
        return result
    except Exception as e:
        print(f"Error generating parallel insights: {e}")
        return {
            "insights": [],
            "error": str(e),
            "context": current_context,
            "timestamp": int(time.time() * 1000),
            "parallel": False
        }


@app.get("/api/tactical-insights")
def tactical_insights():
    """Generate dynamic tactical insights including momentum shifts and tactical reads"""
    current_context = live_context()
    
    try:
        result = gemini_service.generate_tactical_insights(current_context)
        return result
    except Exception as e:
        print(f"Error generating tactical insights: {e}")
        return {
            "insights": [
                {
                    "id": str(int(time.time() * 1000)),
                    "type": "momentum",
                    "label": "Momentum Shift",
                    "text": "Unable to generate insights. Please check Gemini API configuration.",
                    "timestamp": int(time.time() * 1000)
                },
                {
                    "id": str(int(time.time() * 1000) + 1),
                    "type": "tactical",
                    "label": "Tactical Read",
                    "text": "Unable to generate insights. Please check Gemini API configuration.",
                    "timestamp": int(time.time() * 1000)
                }
            ],
            "lastUpdated": int(time.time() * 1000)
        }


@app.post("/api/win-probability")
def win_probability(payload: WinProbabilityRequest):
    probability = gemini_service.calculate_win_probability(payload.matchState)
    return probability


@app.get("/api/win-probability-history")
def win_probability_history(matchId: str = "current"):
    """Get win probability history for a match"""
    try:
        history = gemini_service.generate_win_probability_history(matchId)
        return history
    except Exception as e:
        print(f"Error generating win probability history: {e}")
        return {
            "error": "Failed to generate win probability history",
            "data": [],
            "team1Peak": 50,
            "team2Peak": 50,
            "lastUpdated": int(time.time() * 1000),
            "matchId": matchId
        }


@app.get("/api/live-scores")
def live_scores():
    if not cricbuzz_api_key:
        return {
            **live_scores_cache, 
            "error": "CRICBUZZ_API_KEY not configured - using sample data",
            "configured": False
        }
    
    result = {**live_scores_cache, "configured": True}
    
    # Add helpful status information
    if live_scores_cache.get("matches"):
        result["matchCount"] = len(live_scores_cache["matches"])
        result["liveMatchCount"] = len([m for m in live_scores_cache["matches"] if m.get("isLive")])
        
        # Add info about the first match for debugging
        if live_scores_cache["matches"]:
            first_match = live_scores_cache["matches"][0]
            result["firstMatch"] = {
                "teams": f"{first_match.get('teams')} vs {first_match.get('opponent')}",
                "status": first_match.get("status"),
                "isLive": first_match.get("isLive"),
                "battingTeam": first_match.get("battingTeam"),
                "currentScore": first_match.get("currentInnings", {})
            }
    else:
        result["matchCount"] = 0
        result["liveMatchCount"] = 0
        
    return result


@app.get("/api/test-data")
def test_data():
    """Test endpoint to verify data parsing with sample data"""
    from data.sample_api_response import SAMPLE_CRICBUZZ_RESPONSE
    
    matches = _extract_ipl_matches(SAMPLE_CRICBUZZ_RESPONSE)
    
    return {
        "message": "Test data parsing",
        "matchCount": len(matches),
        "matches": matches,
        "rawSample": SAMPLE_CRICBUZZ_RESPONSE
    }


@app.post("/api/tactical-chat")
def tactical_chat(payload: dict):
    """Handle tactical chat questions from users"""
    question = payload.get("question", "")
    current_context = live_context()
    
    if not question:
        return {
            "error": "No question provided",
            "response": ""
        }
    
    try:
        response = gemini_service.answer_tactical_question(question, current_context)
        return response
    except Exception as e:
        print(f"Error answering tactical question: {e}")
        return {
            "error": "Failed to generate response",
            "response": "Unable to process your question. Please check Gemini API configuration."
        }


@app.get("/api/health")
def health():
    return {"status": "ok", "geminiConfigured": bool(os.getenv("GEMINI_API_KEY"))}


public_dir = os.path.join(os.path.dirname(__file__), "public")
assets_dir = os.path.join(public_dir, "assets")
if os.path.isdir(assets_dir):
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


@app.get("/")
def index():
    index_path = os.path.join(public_dir, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path)
    raise HTTPException(status_code=404, detail="index.html not found")


@app.get("/{full_path:path}")
def spa_fallback(full_path: str):
    if full_path.startswith("api"):
        raise HTTPException(status_code=404, detail="Not found")
    index_path = os.path.join(public_dir, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path)
    raise HTTPException(status_code=404, detail="index.html not found")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8080, reload=True)
