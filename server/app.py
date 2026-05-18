import asyncio
import os
import time
from datetime import datetime, time as dt_time, timedelta
from zoneinfo import ZoneInfo
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

# Fallback Cricbuzz API (api.cricapi.com) configuration
cricbuzz_fallback_key = os.getenv("CRICBUZZ_FALLBACK_KEY")
cricbuzz_fallback_series_id = os.getenv(
    "CRICBUZZ_FALLBACK_SERIES_ID", "87c62aac-bc3c-4738-ab93-19da0690488f"
)
cricbuzz_fallback_url = "https://api.cricapi.com/v1"

# Primary fallback API (ipl-okn0.onrender.com)
ipl_primary_fallback_url = os.getenv(
    "IPL_PRIMARY_FALLBACK_URL", "https://ipl-okn0.onrender.com/ipl-2026-live-score"
)

live_scores_cache: Dict[str, Any] = {
    "updatedAt": None,
    "matches": [],
    "source": "cricbuzz",
}

insights_cache: Dict[str, Any] = {"data": None, "updatedAt": None}
tactical_insights_cache: Dict[str, Any] = {"data": None, "updatedAt": None}
win_probability_cache: Dict[str, Any] = {"data": None, "updatedAt": None}

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


def _format_innings_score(innings: Dict[str, Any]) -> tuple[str | None, str | None]:
    if not innings:
        return None, None

    runs = innings.get("runs") or innings.get("r")
    wickets = innings.get("wickets") or innings.get("w")
    overs = innings.get("overs") or innings.get("o")

    if runs is None:
        return None, None

    score_text = f"{runs}/{wickets}" if wickets is not None else f"{runs}"
    overs_text = f"{overs}" if overs is not None else None
    return score_text, overs_text


@app.get("/api/live-context")
def live_context():
    """Get current live match context with active players

    DATA SOURCES:
    - Match data: From live_scores_cache (Render API → RapidAPI → CricAPI → Sample data)
    - Player data: From mock_db.py (hardcoded mock database)

    Returns:
    - match: Current match info (teams, score, status, venue)
    - activeBatter: Current batting player (from mock_db)
    - activeBowler: Current bowling player (from mock_db)
    - isLive: Whether match is currently live
    - dataSource: Description of where data is coming from
    """
    if live_scores_cache.get("matches"):
        first_match = live_scores_cache["matches"][0]

        # Determine if this is live or recent data
        is_live = first_match.get("isLive", False)
        match_state = first_match.get("state", "")
        hide_score = first_match.get("hideScore", False)

        # Extract better match context from live data
        match_info = {
            "team1": first_match.get("teams"),
            "team2": first_match.get("opponent"),
            "venue": first_match.get("venue"),
            "status": first_match.get("status"),
            "description": first_match.get("description"),
            "matchId": first_match.get("id"),
            "battingTeam": first_match.get("battingTeam"),
            "bowlingTeam": first_match.get("bowlingTeam"),
            "matchState": match_state,
            "matchStarted": first_match.get("matchStarted", False),
            "matchEnded": first_match.get("matchEnded", False),
            "hideScore": hide_score,
        }

        # Include score and overs when available and not hidden
        if not hide_score:
            current_innings = first_match.get("currentInnings") or {}
            score_text, overs_text = _format_innings_score(current_innings)
            if score_text:
                match_info["score"] = score_text
            if overs_text:
                match_info["overs"] = overs_text

        # Add contextual information based on match state
        if not is_live and match_state == "result":
            match_info["contextNote"] = "Most recent completed match"
        elif not is_live and match_state == "fixture":
            match_info["contextNote"] = "Upcoming match"
        elif is_live:
            match_info["contextNote"] = "Live match"

        # For live matches, use mock data for active players
        # For completed/upcoming matches, don't include player data
        if is_live:
            mock_context = get_live_match_context()
            active_batter = mock_context.get("activeBatter")
            active_bowler = mock_context.get("activeBowler")
        else:
            active_batter = None
            active_bowler = None

        return {
            "match": match_info,
            "activeBatter": active_batter,
            "activeBowler": active_bowler,
            "isLive": is_live,
            "source": live_scores_cache.get("source", "unknown"),
            "lastUpdated": live_scores_cache.get("updatedAt"),
            "dataSource": "Live match data from Render API / RapidAPI / CricAPI, player data from mock database",
        }

    # Fallback to mock data
    context = get_live_match_context()
    context["isLive"] = False
    context["source"] = "mock_data"
    context["match"]["contextNote"] = "Sample data - no live matches available"
    context["match"]["hideScore"] = False  # Mock data can show scores
    context["dataSource"] = "Mock database (fallback)"
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
            if not any(
                keyword in series_name
                for keyword in ["IPL", "INDIAN PREMIER LEAGUE", "PREMIER LEAGUE"]
            ):
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
                    batting_team = team1_info.get("teamName") or team1_info.get(
                        "teamSName"
                    )
                    bowling_team = team2_info.get("teamName") or team2_info.get(
                        "teamSName"
                    )
                elif curr_bat_team_id == team2_info.get("teamId"):
                    current_innings = team2_innings
                    batting_team = team2_info.get("teamName") or team2_info.get(
                        "teamSName"
                    )
                    bowling_team = team1_info.get("teamName") or team1_info.get(
                        "teamSName"
                    )
                else:
                    # Default to team2 if no current batting team specified
                    current_innings = team2_innings if team2_innings else team1_innings
                    batting_team = team2_info.get("teamName") or team2_info.get(
                        "teamSName"
                    )
                    bowling_team = team1_info.get("teamName") or team1_info.get(
                        "teamSName"
                    )

                match_data = {
                    "id": match_info.get("matchId"),
                    "series": series.get("seriesName"),
                    "description": match_info.get("matchDesc"),
                    "status": match_info.get("status"),
                    "state": match_info.get("state"),
                    "venue": venue_info.get("ground") or venue_info.get("city"),
                    "teams": team1_info.get("teamName") or team1_info.get("teamSName"),
                    "opponent": team2_info.get("teamName")
                    or team2_info.get("teamSName"),
                    "battingTeam": batting_team,
                    "bowlingTeam": bowling_team,
                    "team1": {
                        "name": team1_info.get("teamName"),
                        "shortName": team1_info.get("teamSName"),
                        "score": team1_innings,
                        "teamId": team1_info.get("teamId"),
                    },
                    "team2": {
                        "name": team2_info.get("teamName"),
                        "shortName": team2_info.get("teamSName"),
                        "score": team2_innings,
                        "teamId": team2_info.get("teamId"),
                    },
                    "currentInnings": current_innings,
                    "score": match_score,
                    "isLive": match_info.get("state") in ["In Progress", "Live"],
                    "matchFormat": match_info.get("matchFormat"),
                    "currBatTeamId": curr_bat_team_id,
                }
                matches.append(match_data)

    return matches


def _is_rapidapi_minute(now_ms: int) -> bool:
    return (now_ms // 60000) % 4 == 0


def _is_match_live() -> bool:
    first_match = (live_scores_cache.get("matches") or [None])[0]
    return bool(first_match and first_match.get("isLive", False))


async def _poll_gemini_before_pause() -> None:
    """Run a single Gemini poll to seed insight caches before long pause."""
    if not getattr(gemini_service, "model_workhorse", None):
        print("Gemini poll skipped: API key not configured")
        return

    current_context = live_context()
    try:
        print("No live match. Running one-time Gemini poll before pause.")
        result = await gemini_service.generate_all_insights_parallel(current_context)

        general = result.get("general")
        tactical = result.get("tactical")

        if general:
            insights_cache["data"] = general
            insights_cache["updatedAt"] = int(time.time() * 1000)

        if tactical:
            tactical_insights_cache["data"] = tactical
            tactical_insights_cache["updatedAt"] = int(time.time() * 1000)
    except Exception as e:
        print(f"Gemini poll failed before pause: {e}")


def _seconds_until_next_match_start(now_ms: int) -> int:
    ist = ZoneInfo("Asia/Kolkata")
    now_ist = datetime.fromtimestamp(now_ms / 1000, tz=ist)

    def _slots_for_day(weekday: int) -> List[dt_time]:
        if weekday >= 5:
            return [dt_time(15, 30), dt_time(19, 30)]
        return [dt_time(19, 30)]

    for day_offset in range(0, 8):
        candidate_date = now_ist.date() + timedelta(days=day_offset)
        weekday = (now_ist.weekday() + day_offset) % 7
        for slot in _slots_for_day(weekday):
            candidate = datetime(
                candidate_date.year,
                candidate_date.month,
                candidate_date.day,
                slot.hour,
                slot.minute,
                tzinfo=ist,
            )
            if candidate > now_ist:
                return max(60, int((candidate - now_ist).total_seconds()))

    return 4 * 60 * 60


def _merge_render_scores(
    existing_matches: List[Dict[str, Any]],
    render_matches: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    if not existing_matches:
        return render_matches
    if not render_matches:
        return existing_matches

    def _key(match: Dict[str, Any]) -> str:
        return f"{match.get('teams')}|{match.get('opponent')}"

    updates_by_key = {_key(match): match for match in render_matches}
    merged: List[Dict[str, Any]] = []

    for match in existing_matches:
        update = updates_by_key.get(_key(match))
        if not update:
            merged.append(match)
            continue

        merged_match = {**match}
        for field in [
            "status",
            "state",
            "isLive",
            "matchStarted",
            "matchEnded",
            "hideScore",
            "currentInnings",
            "score",
        ]:
            if update.get(field) is not None:
                merged_match[field] = update.get(field)

        if update.get("team1"):
            merged_match["team1"] = {
                **match.get("team1", {}),
                "score": update.get("team1", {}).get("score"),
            }

        if update.get("team2"):
            merged_match["team2"] = {
                **match.get("team2", {}),
                "score": update.get("team2", {}).get("score"),
            }

        merged.append(merged_match)

    return merged


async def _fetch_from_rapidapi() -> List[Dict[str, Any]]:
    if not cricbuzz_api_key:
        return []

    import httpx

    headers = {
        "Content-Type": "application/json",
        "x-rapidapi-host": cricbuzz_api_host,
        "x-rapidapi-key": cricbuzz_api_key,
    }

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.get(cricbuzz_live_url, headers=headers)
            response.raise_for_status()
            payload = response.json()
            return _extract_ipl_matches(payload)
    except Exception as e:
        print(f"RapidAPI Cricbuzz failed: {e}")
        return []


async def _poll_live_scores() -> None:
    while True:
        now_ms = int(time.time() * 1000)
        use_rapidapi = _is_rapidapi_minute(now_ms)

        try:
            if use_rapidapi:
                print("4-minute cycle: RapidAPI Cricbuzz refresh")
                matches = await _fetch_from_rapidapi()
                if matches:
                    live_scores_cache["matches"] = matches
                    live_scores_cache["updatedAt"] = now_ms
                    live_scores_cache["error"] = None
                    live_scores_cache["source"] = "cricbuzz_api"
                    live_scores_cache["lastDetailedAt"] = now_ms
                else:
                    print(
                        "RapidAPI Cricbuzz returned no matches; keeping last detailed state"
                    )
            else:
                print("4-minute cycle: Render API score-only refresh")
                matches = await _fetch_from_primary_fallback()
                if matches:
                    live_scores_cache["matches"] = _merge_render_scores(
                        live_scores_cache.get("matches", []),
                        matches,
                    )
                    live_scores_cache["updatedAt"] = now_ms
                    live_scores_cache["error"] = None
                    live_scores_cache["source"] = "primary_api"
                else:
                    print("Render API returned no matches; keeping last state")
        except Exception as e:
            print(f"Polling error: {e}")

        sleep_seconds = poll_interval_seconds
        first_match = (live_scores_cache.get("matches") or [None])[0]
        if first_match and not first_match.get("isLive", False):
            await _poll_gemini_before_pause()
            sleep_seconds = _seconds_until_next_match_start(now_ms)
            print(
                "No live match. Pausing polling until next scheduled start "
                f"({sleep_seconds}s)."
            )

        await asyncio.sleep(sleep_seconds)


async def _fetch_from_primary_fallback() -> List[Dict[str, Any]]:
    """Primary fallback to ipl-okn0.onrender.com API"""
    matches: List[Dict[str, Any]] = []

    try:
        import httpx

        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(ipl_primary_fallback_url)
            if response.status_code != 200:
                print(f"Primary fallback API failed with {response.status_code}")
                return []

            data = response.json()

            # Check if there are live matches
            live_count = data.get("live_count", 0)
            matches_data = data.get("matches", {})

            if live_count > 0:
                # Find live matches
                for match_key, match_info in matches_data.items():
                    status = match_info.get("status", "").lower()
                    if status not in ["completed", "upcoming"]:
                        # This is likely a live match
                        match_data = _parse_primary_fallback_match(match_info, True)
                        if match_data:
                            matches.append(match_data)
                            print(
                                f"Primary fallback: Found live match - {match_data.get('teams')} vs {match_data.get('opponent')}"
                            )
            else:
                # No live matches, find the most recent completed match
                completed_matches = []
                upcoming_matches = []

                for match_key, match_info in matches_data.items():
                    status = match_info.get("status", "").lower()
                    if status == "completed":
                        completed_matches.append((match_key, match_info))
                    elif status == "upcoming":
                        upcoming_matches.append((match_key, match_info))

                # Sort completed matches by match number (descending) to get the most recent
                completed_matches.sort(
                    key=lambda x: (
                        int(x[0].split()[-1]) if x[0].split()[-1].isdigit() else 0
                    ),
                    reverse=True,
                )

                if completed_matches:
                    # Get the most recent completed match
                    _, most_recent_match = completed_matches[0]
                    match_data = _parse_primary_fallback_match(most_recent_match, False)
                    if match_data:
                        matches.append(match_data)
                        print(
                            f"Primary fallback: No live matches, showing most recent completed match - {match_data.get('teams')} vs {match_data.get('opponent')}"
                        )
                        print(f"  Result: {match_data.get('status')}")

            print(f"Primary fallback: Retrieved {len(matches)} matches")
            return matches

    except Exception as e:
        print(f"Primary fallback API error: {e}")
        return []


def _get_match_equation(match_data: Dict[str, Any]) -> str:
    """Generate live match equation like 'Team needs X runs in Y balls'"""
    try:
        team1 = match_data.get("team_1", "Team 1")
        team2 = match_data.get("team_2", "Team 2")
        score1 = match_data.get("score_1", "")
        score2 = match_data.get("score_2", "")

        # Handle edge case: If Team 2 hasn't started batting yet
        if not score2 or score2 == "N.A":
            if score1 and "/" in score1:
                team1_runs = int(score1.split("/")[0])
                target = team1_runs + 1
                return f"{team2} needs {target} runs to win before the innings starts."
            return f"{team2} to chase the target."

        # Parse Team 1's score to get the target
        if not score1 or "/" not in score1:
            return f"Match in progress: {team1} vs {team2}"

        team1_runs = int(score1.split("/")[0])
        target = team1_runs + 1

        # Parse Team 2's current runs
        if "/" not in score2:
            return f"{team2} needs {target} runs to win."

        team2_runs = int(score2.split("/")[0])
        runs_needed = target - team2_runs

        # Extract overs and calculate remaining balls
        # score_2 format example: "181/5 (19.2)" -> extract "19.2"
        if "(" in score2 and ")" in score2:
            overs_data = score2.split("(")[1].replace(")", "")
            if "." in overs_data:
                completed_overs, balls_in_current_over = overs_data.split(".")
                completed_overs = int(completed_overs)
                balls_in_current_over = (
                    int(balls_in_current_over) if balls_in_current_over else 0
                )
            else:
                completed_overs = int(overs_data)
                balls_in_current_over = 0

            total_balls_bowled = (completed_overs * 6) + balls_in_current_over
            balls_remaining = 120 - total_balls_bowled  # T20 = 120 balls

            # Final validation checks
            if runs_needed <= 0:
                return f"{team2} has already won the match!"

            if balls_remaining <= 0:
                return f"Innings over. {team1} wins unless scores are level."

            # Return the active live equation
            return f"{team2} needs {runs_needed} runs in {balls_remaining} balls."
        else:
            # No overs data available
            if runs_needed <= 0:
                return f"{team2} has already won the match!"
            return f"{team2} needs {runs_needed} runs to win."

    except Exception as e:
        print(f"Error generating match equation: {e}")
        return f"Match in progress: {match_data.get('team_1', 'Team 1')} vs {match_data.get('team_2', 'Team 2')}"


def _parse_primary_fallback_match(
    match_info: Dict[str, Any], is_live: bool
) -> Dict[str, Any] | None:
    """Parse match data from primary fallback API"""
    try:
        team1 = match_info.get("team_1", "Team 1")
        team2 = match_info.get("team_2", "Team 2")
        score1 = match_info.get("score_1", "")
        score2 = match_info.get("score_2", "")
        result = match_info.get("result", "")
        venue = match_info.get("venue", "")
        match_type = match_info.get("type", "")
        date = match_info.get("date", "")

        def _parse_score_text(score_text: str) -> Dict[str, Any] | None:
            if not score_text or score_text == "N.A":
                return None
            import re

            score_match = re.match(
                r"\s*(\d+)(?:/(\d+))?\s*(?:\(([0-9.]+)\))?\s*", score_text
            )
            if not score_match:
                return None
            runs = int(score_match.group(1))
            wickets = int(score_match.group(2)) if score_match.group(2) else None
            overs = float(score_match.group(3)) if score_match.group(3) else None
            innings = {"runs": runs}
            if wickets is not None:
                innings["wickets"] = wickets
            if overs is not None:
                innings["overs"] = overs
            return innings

        # Determine status and batting/bowling teams
        if is_live:
            # Generate live match equation
            status = _get_match_equation(match_info)
            # For live matches, assume team2 is batting (this is a simplification)
            batting_team = team2
            bowling_team = team1
        else:
            # For completed matches, format result as "Team won by X"
            if result and result != "N.A":
                status = result
            else:
                # Try to determine winner from scores
                try:
                    if score1 and score1 != "N.A" and score2 and score2 != "N.A":
                        team1_runs = (
                            int(score1.split("/")[0])
                            if "/" in score1
                            else int(score1.split("(")[0].strip())
                        )
                        team2_runs = (
                            int(score2.split("/")[0])
                            if "/" in score2
                            else int(score2.split("(")[0].strip())
                        )
                        if team1_runs > team2_runs:
                            status = f"{team1} won by {team1_runs - team2_runs} runs"
                        elif team2_runs > team1_runs:
                            status = f"{team2} won by {team2_runs - team1_runs} runs"
                        else:
                            status = "Match Tied"
                    else:
                        status = "Completed"
                except (ValueError, IndexError):
                    status = "Completed"
            # For completed matches, we can't determine current batting team
            batting_team = team1
            bowling_team = team2

        # Create current innings data
        current_innings = {}
        if is_live and score2 and score2 != "N.A":
            # Only show score data for live matches
            # Parse score like "203/4 (15.4)" to extract runs, wickets, overs
            import re

            score_match = re.match(r"(\d+)(?:/(\d+))?\s*\(([0-9.]+)\)", score2)
            if score_match:
                runs = int(score_match.group(1))
                wickets = int(score_match.group(2)) if score_match.group(2) else 0
                overs = float(score_match.group(3))
                current_innings = {
                    "r": runs,
                    "w": wickets,
                    "o": overs,
                    "inning": f"{team2} Inning 1",
                }
        # For completed matches, we don't show score data - only the result

        team1_score_obj = _parse_score_text(score1)
        team2_score_obj = _parse_score_text(score2)

        match_data = {
            "id": f"primary_fallback_{hash(f'{team1}_{team2}_{date}')}",
            "series": "IPL 2026",
            "description": match_info.get("description", f"{team1} vs {team2}"),
            "status": status,
            "state": "live" if is_live else "result",
            "venue": venue,
            "teams": team1,
            "opponent": team2,
            "battingTeam": batting_team,
            "bowlingTeam": bowling_team,
            "team1": {"name": team1, "shortName": team1, "score": team1_score_obj},
            "team2": {"name": team2, "shortName": team2, "score": team2_score_obj},
            "currentInnings": current_innings,
            "score": (
                [current_innings] if current_innings and is_live else []
            ),  # Only show scores for live matches
            "isLive": is_live,
            "matchFormat": "T20",
            "matchId": f"primary_fallback_{hash(f'{team1}_{team2}_{date}')}",
            "dateTimeGMT": match_info.get("start_time_utc", ""),
            "matchStarted": True,
            "matchEnded": not is_live,
            "matchType": match_type,
            "date": date,
            "hideScore": not is_live,  # Flag to indicate UI should hide score display for completed matches
        }

        return match_data

    except Exception as e:
        print(f"Error parsing primary fallback match: {e}")
        return None


async def _fetch_from_cricapi_fallback() -> List[Dict[str, Any]]:
    """Fallback to api.cricapi.com when RapidAPI Cricbuzz fails"""
    if not cricbuzz_fallback_key:
        return []

    matches: List[Dict[str, Any]] = []
    import httpx

    try:
        # Step 1: Get IPL 2026 series info
        series_url = f"{cricbuzz_fallback_url}/series_info?apikey={cricbuzz_fallback_key}&id={cricbuzz_fallback_series_id}"
        async with httpx.AsyncClient(timeout=12.0) as client:
            series_resp = await client.get(series_url)
            if series_resp.status_code != 200:
                print(
                    f"CricAPI fallback: Series info failed with {series_resp.status_code}"
                )
                return []

            series_data = series_resp.json()
            if series_data.get("status") != "success":
                print(f"CricAPI fallback: {series_data.get('reason', 'Unknown error')}")
                return []

            match_list = series_data.get("data", {}).get("matchList", [])
            if not match_list:
                return []

            # Step 2: Separate live and recent matches
            live_matches = []
            recent_matches = []

            for match in match_list:
                ms = match.get("ms", "")
                if ms not in ["live", "result", "fixture"]:
                    continue

                # Step 3: Get detailed match info
                match_id = match.get("id")
                if not match_id:
                    continue

                match_url = f"{cricbuzz_fallback_url}/match_info?apikey={cricbuzz_fallback_key}&id={match_id}"
                match_resp = await client.get(match_url)

                if match_resp.status_code != 200:
                    continue

                match_data = match_resp.json()
                if match_data.get("status") != "success":
                    continue

                match_details = match_data.get("data", {})
                teams = match_details.get("teams", [])

                # Extract team names
                team1_name = (
                    teams[0].get("name", "Team 1") if len(teams) > 0 else "Team 1"
                )
                team2_name = (
                    teams[1].get("name", "Team 2") if len(teams) > 1 else "Team 2"
                )

                # Get scores
                scores = match_details.get("score", [])
                current_innings = scores[-1] if scores else {}
                inning_name = current_innings.get("inning", "")

                # Determine batting/bowling teams
                batting_team = (
                    inning_name.split(" Inning")[0] if inning_name else team1_name
                )
                bowling_team = team2_name if batting_team == team1_name else team1_name

                # Get match result/status for completed matches
                match_status = match_details.get("status", "")
                if ms == "result" and not match_status:
                    # Try to determine winner from scores
                    if len(scores) >= 2:
                        team1_score = scores[0]
                        team2_score = scores[1]
                        team1_runs = team1_score.get("r", 0)
                        team2_runs = team2_score.get("r", 0)
                        if team1_runs > team2_runs:
                            match_status = (
                                f"{team1_name} won by {team1_runs - team2_runs} runs"
                            )
                        elif team2_runs > team1_runs:
                            match_status = (
                                f"{team2_name} won by {team2_runs - team1_runs} runs"
                            )

                match_data = {
                    "id": match_id,
                    "series": "IPL 2026",
                    "description": match.get("matchDesc", ""),
                    "status": match_status,
                    "state": ms,
                    "venue": match_details.get("venue", ""),
                    "teams": team1_name,
                    "opponent": team2_name,
                    "battingTeam": batting_team,
                    "bowlingTeam": bowling_team,
                    "team1": {"name": team1_name, "shortName": team1_name[:3].upper()},
                    "team2": {"name": team2_name, "shortName": team2_name[:3].upper()},
                    "currentInnings": (
                        current_innings if ms == "live" else {}
                    ),  # Only show innings data for live matches
                    "score": (
                        match_details.get("score", []) if ms == "live" else []
                    ),  # Only show scores for live matches
                    "isLive": ms == "live",
                    "matchFormat": "T20",
                    "matchId": match_id,
                    "dateTimeGMT": match_details.get("dateTimeGMT", ""),
                    "matchStarted": match_details.get("matchStarted", False),
                    "matchEnded": match_details.get("matchEnded", ms == "result"),
                    "hideScore": ms
                    != "live",  # Hide score display for completed matches
                }

                if ms == "live":
                    live_matches.append(match_data)
                elif ms == "result":
                    recent_matches.append(match_data)
                else:  # fixture
                    recent_matches.append(match_data)

            # Priority: Live matches first, then most recent completed matches
            if live_matches:
                matches.extend(live_matches)
                print(f"CricAPI fallback: Found {len(live_matches)} live matches")
            elif recent_matches:
                # Sort recent matches by date (most recent first) and take the most recent one
                recent_matches.sort(
                    key=lambda x: x.get("dateTimeGMT", ""), reverse=True
                )
                matches.append(recent_matches[0])  # Only show the most recent match
                print(
                    f"CricAPI fallback: No live matches, showing most recent match: {recent_matches[0].get('teams')} vs {recent_matches[0].get('opponent')}"
                )
                print(f"  Status: {recent_matches[0].get('status')}")
                print(f"  Match State: {recent_matches[0].get('state')}")
            else:
                print("CricAPI fallback: No live or recent matches found")

            print(f"CricAPI fallback: Retrieved {len(matches)} matches")
            return matches

    except Exception as e:
        print(f"CricAPI fallback error: {e}")
        return []

    return matches

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
                        print(
                            f"  - {match.get('teams')} vs {match.get('opponent')}: {match.get('status')}"
                        )

            except httpx.HTTPStatusError as e:
                if e.response.status_code == 403:
                    error_msg = "RapidAPI Cricbuzz subscription required. Trying primary fallback..."
                    print(f"API Error: {error_msg}")

                    # Try primary fallback first (ipl-okn0.onrender.com)
                    matches = await _fetch_from_primary_fallback()
                    if matches:
                        live_scores_cache["matches"] = matches
                        live_scores_cache["updatedAt"] = int(time.time() * 1000)
                        live_scores_cache["error"] = None
                        live_scores_cache["source"] = "primary_fallback"
                        print(f"Primary fallback successful: {len(matches)} matches")
                        # Continue polling with primary fallback
                    else:
                        # Try secondary fallback (CricAPI)
                        print("Primary fallback failed, trying CricAPI...")
                        matches = await _fetch_from_cricapi_fallback()
                        if matches:
                            live_scores_cache["matches"] = matches
                            live_scores_cache["updatedAt"] = int(time.time() * 1000)
                            live_scores_cache["error"] = None
                            live_scores_cache["source"] = "cricapi_fallback"
                            print(
                                f"CricAPI fallback successful: {len(matches)} matches"
                            )
                            # Continue polling with CricAPI fallback
                        else:
                            # Final fallback to sample data
                            from data.sample_api_response import (
                                SAMPLE_CRICBUZZ_RESPONSE,
                            )

                            matches = _extract_ipl_matches(SAMPLE_CRICBUZZ_RESPONSE)
                            live_scores_cache["matches"] = matches
                            live_scores_cache["updatedAt"] = int(time.time() * 1000)
                            live_scores_cache["error"] = (
                                "Using sample data - all APIs failed"
                            )
                            live_scores_cache["source"] = "sample_data_fallback"
                            print(f"Using sample data: {len(matches)} IPL matches")
                            break  # Don't keep polling if all APIs failed
                else:
                    error_msg = (
                        f"HTTP error {e.response.status_code}: {e.response.text}"
                    )
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
    BATCHED: Requests all 3 insight types in a single API call to save quota

    UPDATE FREQUENCY: Every 2 minutes (120 seconds) from frontend
    ENDPOINT: /api/insights/live
    GEMINI MODEL: Gemma 4 26B (Workhorse)

    Returns:
    - insights: List of 3 insights (tactical, momentum, prediction)
    - context: Current match context
    - timestamp: When insights were generated
    """
    current_context = live_context()
    if not current_context.get("isLive"):
        if insights_cache.get("data"):
            print("Insights: returning cached (no live match)")
            return insights_cache["data"]
        print("Insights: returning fallback (no live match, no cache)")
        fallback = gemini_service._fallback_batched_insights()
        fallback["context"] = current_context
        fallback["timestamp"] = int(time.time() * 1000)
        return fallback

    # BATCHED PROMPT: Request all 3 insights in a single API call
    try:
        print("Insights: generating fresh (live match)")
        result = gemini_service.generate_batched_insights(current_context)
        insights_cache["data"] = result
        insights_cache["updatedAt"] = int(time.time() * 1000)
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
                    "timestamp": int(time.time() * 1000),
                }
            ],
            "context": current_context,
            "timestamp": int(time.time() * 1000),
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
            "parallel": False,
        }


@app.get("/api/tactical-insights")
def tactical_insights():
    """Generate dynamic tactical insights including momentum shifts and tactical reads

    UPDATE FREQUENCY: Every 2 minutes (120 seconds) from frontend
    ENDPOINT: /api/tactical-insights
    GEMINI MODEL: Gemma 4 26B (Tactical Buffer)

    Returns:
    - insights: List of 2 insights (momentum shift, tactical read)
    - lastUpdated: Timestamp of generation
    - isCompleted: Whether match is completed
    """
    current_context = live_context()
    if not current_context.get("isLive"):
        if tactical_insights_cache.get("data"):
            print("Tactical insights: returning cached (no live match)")
            return tactical_insights_cache["data"]
        print("Tactical insights: returning fallback (no live match, no cache)")
        return gemini_service._fallback_tactical_insights(current_context)

    try:
        print("Tactical insights: generating fresh (live match)")
        result = gemini_service.generate_tactical_insights(current_context)
        tactical_insights_cache["data"] = result
        tactical_insights_cache["updatedAt"] = int(time.time() * 1000)
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
                    "timestamp": int(time.time() * 1000),
                },
                {
                    "id": str(int(time.time() * 1000) + 1),
                    "type": "tactical",
                    "label": "Tactical Read",
                    "text": "Unable to generate insights. Please check Gemini API configuration.",
                    "timestamp": int(time.time() * 1000),
                },
            ],
            "lastUpdated": int(time.time() * 1000),
        }


@app.post("/api/win-probability")
def win_probability(payload: WinProbabilityRequest):
    probability = gemini_service.calculate_win_probability(payload.matchState)
    return probability


@app.get("/api/win-probability-history")
def win_probability_history(matchId: str = "current"):
    """Get win probability history for a match"""
    try:
        if not _is_match_live():
            if win_probability_cache.get("data"):
                print("Win probability: returning cached (no live match)")
                return win_probability_cache["data"]
            print("Win probability: returning fallback (no live match, no cache)")
            fallback = gemini_service._fallback_win_probability_history()
            fallback["lastUpdated"] = int(time.time() * 1000)
            fallback["matchId"] = matchId
            return fallback

        print("Win probability: generating fresh (live match)")
        history = gemini_service.generate_win_probability_history(matchId)
        win_probability_cache["data"] = history
        win_probability_cache["updatedAt"] = int(time.time() * 1000)
        return history
    except Exception as e:
        print(f"Error generating win probability history: {e}")
        return {
            "error": "Failed to generate win probability history",
            "data": [],
            "team1Peak": 50,
            "team2Peak": 50,
            "lastUpdated": int(time.time() * 1000),
            "matchId": matchId,
        }


@app.get("/api/live-scores")
def live_scores():
    if not cricbuzz_api_key and not cricbuzz_fallback_key:
        return {
            **live_scores_cache,
            "error": "No API keys configured - using sample data",
            "configured": False,
        }

    result = {**live_scores_cache, "configured": True}

    # Add helpful status information
    if live_scores_cache.get("matches"):
        result["matchCount"] = len(live_scores_cache["matches"])
        result["liveMatchCount"] = len(
            [m for m in live_scores_cache["matches"] if m.get("isLive")]
        )

        # Add info about the first match for debugging
        if live_scores_cache["matches"]:
            first_match = live_scores_cache["matches"][0]
            match_state = first_match.get("state", "")
            is_live = first_match.get("isLive", False)

            # Determine what type of data we're showing
            data_type = (
                "Live match"
                if is_live
                else (
                    "Most recent match" if match_state == "result" else "Upcoming match"
                )
            )

            result["firstMatch"] = {
                "teams": f"{first_match.get('teams')} vs {first_match.get('opponent')}",
                "status": first_match.get("status"),
                "isLive": is_live,
                "battingTeam": first_match.get("battingTeam"),
                "currentScore": first_match.get("currentInnings", {}),
                "dataType": data_type,
                "matchState": match_state,
            }

            # Add contextual message
            if not is_live and match_state == "result":
                result["message"] = (
                    f"No live matches available. Showing most recent completed match."
                )
            elif not is_live and match_state == "fixture":
                result["message"] = (
                    f"No live matches available. Showing upcoming match."
                )
            elif is_live:
                result["message"] = f"Live match in progress."
    else:
        result["matchCount"] = 0
        result["liveMatchCount"] = 0
        result["message"] = "No match data available."

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
        "rawSample": SAMPLE_CRICBUZZ_RESPONSE,
    }


@app.post("/api/tactical-chat")
def tactical_chat(payload: dict):
    """Handle tactical chat questions from users"""
    question = payload.get("question", "")
    current_context = live_context()

    if not question:
        return {"error": "No question provided", "response": ""}

    try:
        response = gemini_service.answer_tactical_question(question, current_context)
        return response
    except Exception as e:
        print(f"Error answering tactical question: {e}")
        return {
            "error": "Failed to generate response",
            "response": "Unable to process your question. Please check Gemini API configuration.",
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
