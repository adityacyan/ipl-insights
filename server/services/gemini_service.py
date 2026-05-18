import asyncio
import json
import os
import re
import time
from typing import Any, Dict, List

import google.generativeai as genai


class GeminiService:
    def __init__(self) -> None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            self.model_workhorse = None
            self.model_tactical = None
            self.model_chat = None
            return

        genai.configure(api_key=api_key)

        # Using Gemma 4 26B for all models - efficient and powerful
        # Model allocation based on quota limits
        # Workhorse: 15 RPM / 500 RPD - for general insights (every 30s)
        self.model_workhorse = genai.GenerativeModel("gemini-3.1-flash-lite")

        # Tactical Buffer: 10 RPM / 20 RPD - for tactical insights (every 20s)
        self.model_tactical = genai.GenerativeModel("gemini-3.1-flash-lite")

        # Chat: 5 RPM / 20 RPD - for user-triggered Q&A
        self.model_chat = genai.GenerativeModel("gemini-3.1-flash-lite")

        # Legacy fallback for backward compatibility
        self.model = self.model_workhorse

    def generate_insight(
        self, match_context: Dict[str, Any], insight_type: str
    ) -> Dict[str, Any]:
        if not self.model_workhorse:
            return self._fallback_insight(insight_type)

        prompt = self._build_insight_prompt(match_context, insight_type)
        try:
            # Use workhorse model (Gemma 4 26B)
            print(f"Generating {insight_type} insight using Gemma 4 26B...")
            response = self.model_workhorse.generate_content(prompt)
            text = response.text or ""
            result = self._parse_insight_response(text, insight_type)
            print(
                f"Successfully generated {insight_type} insight: {result.get('title', 'N/A')}"
            )
            return result
        except Exception as e:
            print(f"Error generating {insight_type} insight: {e}")
            return self._fallback_insight(insight_type)

    def calculate_win_probability(self, match_state: Dict[str, Any]) -> Dict[str, Any]:
        if not self.model_workhorse:
            return self._fallback_probability()

        prompt = self._build_probability_prompt(match_state)
        try:
            # Use workhorse model (Gemma 4 26B)
            print(f"Calculating win probability using Gemma 4 26B...")
            response = self.model_workhorse.generate_content(prompt)
            text = response.text or ""
            parsed = self._extract_json(text)
            if parsed:
                result = {
                    "team1": int(parsed.get("team1", 50)),
                    "team2": int(parsed.get("team2", 50)),
                    "trend": parsed.get("trend", "stable"),
                    "lastUpdated": int(time.time() * 1000),
                }
                print(
                    f"Win probability calculated: Team1={result['team1']}%, Team2={result['team2']}%, Trend={result['trend']}"
                )
                return result
        except Exception as e:
            print(f"Error calculating win probability: {e}")

        return self._fallback_probability()

    def _build_insight_prompt(
        self, match_context: Dict[str, Any], insight_type: str
    ) -> str:
        match = match_context.get("match", {})
        batter = match_context.get("activeBatter", {})
        bowler = match_context.get("activeBowler", {})
        is_live = match_context.get("isLive", False)

        live_status = "LIVE" if is_live else "Recent"

        context_info = []
        if match.get("team1") and match.get("team2"):
            context_info.append(f"Teams: {match.get('team1')} vs {match.get('team2')}")
        if match.get("venue"):
            context_info.append(f"Venue: {match.get('venue')}")
        if match.get("status"):
            context_info.append(f"Status: {match.get('status')}")
        if match.get("score"):
            context_info.append(f"Current Score: {match.get('score')}")
        if batter.get("name"):
            context_info.append(
                f"Active Batter: {batter.get('name')} ({batter.get('role', 'Batter')})"
            )
        if bowler.get("name"):
            context_info.append(
                f"Active Bowler: {bowler.get('name')} ({bowler.get('role', 'Bowler')})"
            )

        context_str = "\n".join([f"- {info}" for info in context_info])

        return (
            f"You are an expert cricket analyst providing real-time insights for an IPL match.\n\n"
            f"{live_status} Match Context:\n"
            f"{context_str}\n\n"
            f"Provide a {insight_type} insight in the following JSON format:\n"
            "{\n"
            '  "title": "Brief insight title (max 50 characters)",\n'
            '  "content": "Detailed analysis (max 200 characters)",\n'
            '  "confidence": 0.85\n'
            "}\n\n"
            f"Focus on actionable {insight_type} insights that would interest cricket fans watching live. "
            f"Consider the current match situation, team dynamics, and player matchups."
        )

    def _build_probability_prompt(self, match_state: Dict[str, Any]) -> str:
        match = match_state.get("match", {})
        return (
            "As a cricket analyst, calculate win probabilities for this IPL match.\n\n"
            f"Teams: {match.get('team1')} vs {match.get('team2')}\n"
            "Current situation: Analyze the match context and provide win probabilities.\n\n"
            "Respond in JSON format:\n"
            "{\n"
            '  "team1": 45,\n'
            '  "team2": 55,\n'
            '  "trend": "increasing"\n'
            "}\n\n"
            'Trend can be: "increasing", "decreasing", or "stable"'
        )

    def _parse_insight_response(self, text: str, insight_type: str) -> Dict[str, Any]:
        parsed = self._extract_json(text)
        if parsed:
            return {
                "id": str(int(time.time() * 1000)),
                "type": insight_type,
                "title": parsed.get("title", "AI Insight"),
                "content": parsed.get("content", text[:200]),
                "confidence": float(parsed.get("confidence", 0.7)),
                "timestamp": int(time.time() * 1000),
            }

        return {
            "id": str(int(time.time() * 1000)),
            "type": insight_type,
            "title": "Cricket Analysis",
            "content": text[:200],
            "confidence": 0.7,
            "timestamp": int(time.time() * 1000),
        }

    def _extract_json(self, text: str) -> Dict[str, Any] | None:
        match = re.search(r"\{[\s\S]*\}", text)
        if not match:
            return None
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None

    def _fallback_insight(self, insight_type: str) -> Dict[str, Any]:
        return {
            "id": str(int(time.time() * 1000)),
            "type": insight_type,
            "title": "AI Service Unavailable",
            "content": "Gemini API key not configured. Please set GEMINI_API_KEY.",
            "confidence": 0,
            "timestamp": int(time.time() * 1000),
        }

    def generate_win_probability_history(
        self, match_id: str = "current"
    ) -> Dict[str, Any]:
        """Generate win probability history for a match"""
        if not self.model_workhorse:
            return self._fallback_win_probability_history()

        prompt = (
            f"Generate win probability history for IPL match ID: {match_id}\n\n"
            "Create a realistic win probability timeline showing how probabilities changed "
            "throughout the match. Consider typical cricket match dynamics.\n\n"
            "Respond in JSON format:\n"
            "{\n"
            '  "data": [\n'
            '    {"over": 1, "team1": 52, "team2": 48},\n'
            '    {"over": 5, "team1": 48, "team2": 52},\n'
            '    {"over": 10, "team1": 45, "team2": 55}\n'
            "  ],\n"
            '  "team1Peak": 65,\n'
            '  "team2Peak": 58,\n'
            '  "lastUpdated": "timestamp"\n'
            "}\n\n"
            "Generate 15-20 data points covering the match progression."
        )

        try:
            # Use workhorse model (Gemma 4 26B)
            print(f"Generating win probability history using Gemma 4 26B...")
            response = self.model_workhorse.generate_content(prompt)
            text = response.text or ""
            parsed = self._extract_json(text)
            if parsed and "data" in parsed:
                result = {
                    **parsed,
                    "lastUpdated": int(time.time() * 1000),
                    "matchId": match_id,
                }
                print(
                    f"Win probability history generated: {len(parsed.get('data', []))} data points"
                )
                return result
        except Exception as e:
            print(f"Error generating win probability history: {e}")

        return self._fallback_win_probability_history()

    def _fallback_win_probability_history(self) -> Dict[str, Any]:
        """Fallback win probability history when Gemini is unavailable"""
        # Generate realistic sample data
        import random

        data = []
        team1_prob = 50
        team2_prob = 50

        for over in range(1, 21):
            # Add some realistic fluctuation
            change = random.randint(-8, 8)
            team1_prob = max(10, min(90, team1_prob + change))
            team2_prob = 100 - team1_prob

            data.append({"over": over, "team1": team1_prob, "team2": team2_prob})

        return {
            "data": data,
            "team1Peak": max(point["team1"] for point in data),
            "team2Peak": max(point["team2"] for point in data),
            "lastUpdated": int(time.time() * 1000),
            "matchId": "current",
        }

    def _fallback_probability(self) -> Dict[str, Any]:
        return {
            "team1": 50,
            "team2": 50,
            "trend": "stable",
            "lastUpdated": int(time.time() * 1000),
        }

    def generate_tactical_insights(
        self, match_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate dynamic tactical insights including momentum shifts and tactical reads
        Uses Gemini 2.0 Flash Lite (10 RPM / 20 RPD) - Isolated buffer for complex analysis
        """
        if not self.model_tactical:
            return self._fallback_tactical_insights(match_context)

        if not match_context:
            return self._fallback_tactical_insights(None)

        match = match_context.get("match") or {}
        batter = match_context.get("activeBatter") or {}
        bowler = match_context.get("activeBowler") or {}
        is_live = match_context.get("isLive", False)

        # Extract match details
        team1 = match.get("team1", "Team 1")
        team2 = match.get("team2", "Team 2")
        score = match.get("score", "0/0")
        overs = match.get("overs", "0.0")
        status = match.get("status", "")
        batting_team = match.get("battingTeam", team1)
        bowling_team = match.get("bowlingTeam", team2)

        # Extract player details
        batter_name = batter.get("name", "Batter")
        bowler_name = bowler.get("name", "Bowler")

        # Check if match is completed
        is_completed = any(
            keyword in status.lower() for keyword in ["won", "win", "lost", "complete"]
        )

        # BATCHED PROMPT: Request both insights in a single API call to save quota
        if is_completed:
            prompt = (
                f"You are an expert IPL cricket analyst providing post-match tactical analysis.\n\n"
                f"Match Context:\n"
                f"- Teams: {team1} vs {team2}\n"
                f"- Final Score: {score} in {overs} overs\n"
                f"- Match Result: {status}\n"
                f"- Batting Team: {batting_team}\n"
                f"- Bowling Team: {bowling_team}\n\n"
                f"Generate TWO post-match tactical insights in a SINGLE response:\n\n"
                f"1. MATCH SUMMARY insight:\n"
                f"   - Analyze the key turning points in the match\n"
                f"   - Mention specific overs or partnerships that decided the match\n"
                f"   - Identify what led to the victory\n"
                f'   Example: "Match sealed in final 3 overs with 45 runs scored. Decisive partnership of 78 runs turned momentum."\n\n'
                f"2. TACTICAL ANALYSIS insight:\n"
                f"   - Analyze winning team's strategy execution\n"
                f"   - Include specific player performances and efficiency metrics\n"
                f"   - Mention tactical decisions that worked\n"
                f'   Example: "Death bowling execution at 92% efficiency. Yorker strategy restricted scoring to 8.2 runs per over."\n\n'
                f"Respond in JSON format:\n"
                "{{\n"
                '  "momentumShift": {{\n'
                '    "label": "Match Summary",\n'
                '    "text": "Your match summary with key turning points"\n'
                "  }},\n"
                '  "tacticalRead": {{\n'
                '    "label": "Tactical Analysis",\n'
                '    "text": "Your tactical analysis with performance metrics"\n'
                "  }}\n"
                "}}\n\n"
                f"Make it specific to the match result. Use real cricket terminology and tactical concepts."
            )
        else:
            prompt = (
                f"You are an expert IPL cricket analyst providing real-time tactical insights.\n\n"
                f"Match Context:\n"
                f"- Teams: {team1} vs {team2}\n"
                f"- Current Score: {score} in {overs} overs\n"
                f"- Batting Team: {batting_team}\n"
                f"- Bowling Team: {bowling_team}\n"
                f"- Active Batter: {batter_name}\n"
                f"- Active Bowler: {bowler_name}\n"
                f'- Match Status: {"LIVE" if is_live else "Recent"}\n\n'
                f"Generate TWO tactical insights in a SINGLE response:\n\n"
                f"1. MOMENTUM SHIFT insight:\n"
                f"   - Analyze probability of target being reached\n"
                f"   - Mention specific over numbers and percentages\n"
                f"   - Identify boundary patterns or scoring trends\n"
                f'   Example: "Projected target reached 78% probability after over 17. High frequency boundaries detected."\n\n'
                f"2. TACTICAL READ insight:\n"
                f"   - Analyze bowling/fielding strategy adjustments\n"
                f"   - Include specific player efficiency metrics\n"
                f"   - Mention tactical changes (field placements, bowling variations)\n"
                f'   Example: "{bowling_team} adjusting fields to wide-line yorker strategy. {batter_name} efficiency vs wide pace is 142.0."\n\n'
                f"Respond in JSON format:\n"
                "{{\n"
                '  "momentumShift": {{\n'
                '    "label": "Momentum Shift",\n'
                '    "text": "Your momentum analysis with specific numbers and percentages"\n'
                "  }},\n"
                '  "tacticalRead": {{\n'
                '    "label": "Tactical Read",\n'
                '    "text": "Your tactical strategy analysis with player efficiency metrics"\n'
                "  }}\n"
                "}}\n\n"
                f"Make it specific to the current match situation. Use real cricket terminology and tactical concepts."
            )

        try:
            # Use tactical model (10 RPM / 20 RPD) - Isolated buffer
            response = self.model_tactical.generate_content(prompt)
            text = response.text or ""
            parsed = self._extract_json(text)

            if parsed and "momentumShift" in parsed and "tacticalRead" in parsed:
                return {
                    "insights": [
                        {
                            "id": str(int(time.time() * 1000)),
                            "type": "momentum" if not is_completed else "summary",
                            "label": parsed["momentumShift"].get(
                                "label",
                                (
                                    "Momentum Shift"
                                    if not is_completed
                                    else "Match Summary"
                                ),
                            ),
                            "text": parsed["momentumShift"].get("text", ""),
                            "timestamp": int(time.time() * 1000),
                        },
                        {
                            "id": str(int(time.time() * 1000) + 1),
                            "type": "tactical",
                            "label": parsed["tacticalRead"].get(
                                "label",
                                (
                                    "Tactical Read"
                                    if not is_completed
                                    else "Tactical Analysis"
                                ),
                            ),
                            "text": parsed["tacticalRead"].get("text", ""),
                            "timestamp": int(time.time() * 1000),
                        },
                    ],
                    "lastUpdated": int(time.time() * 1000),
                    "isCompleted": is_completed,
                }
        except Exception as e:
            print(f"Error generating tactical insights: {e}")

        return self._fallback_tactical_insights(match_context)

    def _fallback_tactical_insights(
        self, match_context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Fallback tactical insights when Gemini is unavailable"""
        if match_context:
            status = match_context.get("match", {}).get("status", "")
            is_completed = any(
                keyword in status.lower()
                for keyword in ["won", "win", "lost", "complete"]
            )

            if is_completed:
                return {
                    "insights": [
                        {
                            "id": str(int(time.time() * 1000)),
                            "type": "summary",
                            "label": "Match Summary",
                            "text": "Match decided in final overs with clinical execution. Key partnerships and tactical decisions proved decisive.",
                            "timestamp": int(time.time() * 1000),
                        },
                        {
                            "id": str(int(time.time() * 1000) + 1),
                            "type": "tactical",
                            "label": "Tactical Analysis",
                            "text": "Winning team executed death bowling strategy at high efficiency. Field placements and bowling variations restricted scoring.",
                            "timestamp": int(time.time() * 1000),
                        },
                    ],
                    "lastUpdated": int(time.time() * 1000),
                    "isCompleted": True,
                }

        return {
            "insights": [
                {
                    "id": str(int(time.time() * 1000)),
                    "type": "momentum",
                    "label": "Momentum Shift",
                    "text": "Projected target probability moved to 58% after over 17. Boundary rate climbed in the last two overs.",
                    "timestamp": int(time.time() * 1000),
                },
                {
                    "id": str(int(time.time() * 1000) + 1),
                    "type": "tactical",
                    "label": "Tactical Read",
                    "text": "Bowling side shifting to wide-line yorkers with a deep sweeper. Batter scoring rate versus wide pace is trending up.",
                    "timestamp": int(time.time() * 1000),
                },
            ],
            "lastUpdated": int(time.time() * 1000),
            "isCompleted": False,
        }

    def answer_tactical_question(
        self, question: str, match_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Answer tactical questions about the match
        Uses Gemma 4 26B - User-triggered Q&A"""
        if not self.model_chat:
            return {
                "response": "Gemini API key not configured. Please set GEMINI_API_KEY in your .env file.",
                "timestamp": int(time.time() * 1000),
            }

        match = match_context.get("match", {})
        batter = match_context.get("activeBatter", {})
        bowler = match_context.get("activeBowler", {})
        is_live = match_context.get("isLive", False)

        # Build context for the question
        team1 = match.get("team1", "Team 1")
        team2 = match.get("team2", "Team 2")
        score = match.get("score", "0/0")
        overs = match.get("overs", "0.0")
        status = match.get("status", "")
        batting_team = match.get("battingTeam", team1)
        bowling_team = match.get("bowlingTeam", team2)

        batter_name = batter.get("name", "Batter")
        bowler_name = bowler.get("name", "Bowler")

        print(f"Answering tactical question using Gemma 4 26B...")
        print(f"  Question: {question}")
        print(f"  Match: {team1} vs {team2} ({score} in {overs} overs)")

        prompt = (
            f"You are an expert IPL cricket tactical analyst. Answer the following question about the current match.\n\n"
            f"Match Context:\n"
            f"- Teams: {team1} vs {team2}\n"
            f"- Current Score: {score} in {overs} overs\n"
            f"- Status: {status}\n"
            f"- Batting Team: {batting_team}\n"
            f"- Bowling Team: {bowling_team}\n"
            f"- Active Batter: {batter_name}\n"
            f"- Active Bowler: {bowler_name}\n"
            f'- Match Status: {"LIVE" if is_live else "Recent"}\n\n'
            f"Question: {question}\n\n"
            f"Provide a detailed tactical analysis answering this question. "
            f"Use specific cricket terminology, mention probabilities, strategies, and player matchups. "
            f"Keep your response concise but informative (max 300 characters)."
        )

        try:
            # Use chat model (Gemma 4 26B) - User-triggered
            response = self.model_chat.generate_content(prompt)
            text = response.text or "Unable to generate response."

            print(f"Successfully answered: {text[:80]}...")

            return {
                "response": text,
                "timestamp": int(time.time() * 1000),
                "question": question,
            }
        except Exception as e:
            print(f"Error answering tactical question: {e}")
            return {
                "response": "Unable to generate response. Please try again.",
                "timestamp": int(time.time() * 1000),
                "error": str(e),
            }

    def generate_batched_insights(
        self, match_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate all 3 insight types in a SINGLE API call to save quota
        Uses Gemma 4 26B - Workhorse model"""
        if not self.model_workhorse:
            return self._fallback_batched_insights()

        if not match_context:
            return self._fallback_batched_insights()

        match = match_context.get("match") or {}
        batter = match_context.get("activeBatter") or {}
        bowler = match_context.get("activeBowler") or {}
        is_live = match_context.get("isLive", False)

        team1 = match.get("team1", "Team 1")
        team2 = match.get("team2", "Team 2")
        score = match.get("score", "0/0")
        overs = match.get("overs", "0.0")
        status = match.get("status", "")
        batting_team = match.get("battingTeam", team1)
        bowling_team = match.get("bowlingTeam", team2)
        batter_name = batter.get("name", "Batter")
        bowler_name = bowler.get("name", "Bowler")

        print(f"Generating batched insights (3-in-1) using Gemma 4 26B...")
        print(f"  Match: {team1} vs {team2}")
        print(f"  Score: {score} in {overs} overs")

        # BATCHED PROMPT: Request all 3 insights in a single API call
        prompt = (
            f"You are an expert IPL cricket analyst. Generate THREE different insights in a SINGLE response.\n\n"
            f"Match Context:\n"
            f"- Teams: {team1} vs {team2}\n"
            f"- Current Score: {score} in {overs} overs\n"
            f"- Status: {status}\n"
            f"- Batting Team: {batting_team}\n"
            f"- Bowling Team: {bowling_team}\n"
            f"- Active Batter: {batter_name}\n"
            f"- Active Bowler: {bowler_name}\n"
            f'- Match Status: {"LIVE" if is_live else "Recent"}\n\n'
            f"Generate these THREE insights:\n\n"
            f"1. TACTICAL insight (max 200 chars):\n"
            f"   - Strategic recommendations for the current situation\n"
            f"   - Specific field placements or bowling changes\n"
            f'   Example: "Deploy third man and fine leg to counter edge-prone deliveries. Target 6-8 RPO."\n\n'
            f"2. MOMENTUM insight (max 200 chars):\n"
            f"   - Current match momentum and flow\n"
            f"   - Recent scoring patterns or wicket clusters\n"
            f'   Example: "Momentum shifted after 3 boundaries in 2 overs. Run rate jumped from 7.2 to 9.8."\n\n'
            f"3. PREDICTION insight (max 200 chars):\n"
            f"   - Likely outcome or next phase prediction\n"
            f"   - Target projections or win probability shifts\n"
            f'   Example: "Projected final score 185-190. Death overs will be decisive with 65% win probability."\n\n'
            f"Respond in JSON format:\n"
            "{{\n"
            '  "tactical": {{\n'
            '    "title": "Brief title (max 50 chars)",\n'
            '    "content": "Tactical insight (max 200 chars)",\n'
            '    "confidence": 0.85\n'
            "  }},\n"
            '  "momentum": {{\n'
            '    "title": "Brief title (max 50 chars)",\n'
            '    "content": "Momentum insight (max 200 chars)",\n'
            '    "confidence": 0.80\n'
            "  }},\n"
            '  "prediction": {{\n'
            '    "title": "Brief title (max 50 chars)",\n'
            '    "content": "Prediction insight (max 200 chars)",\n'
            '    "confidence": 0.75\n'
            "  }}\n"
            "}}\n\n"
            f"Use real cricket terminology and be specific to the current match situation."
        )

        try:
            # Use workhorse model (Gemma 4 26B) - Single call for all 3 insights
            response = self.model_workhorse.generate_content(prompt)
            text = response.text or ""
            parsed = self._extract_json(text)

            if parsed and all(
                key in parsed for key in ["tactical", "momentum", "prediction"]
            ):
                timestamp = int(time.time() * 1000)
                insights = []

                print(f"Successfully generated 3 batched insights:")
                for idx, (insight_type, data) in enumerate(parsed.items()):
                    title = data.get("title", f"{insight_type.capitalize()} Insight")
                    content = data.get("content", "")
                    print(f"  - {title}: {content[:60]}...")

                    insights.append(
                        {
                            "id": str(timestamp + idx),
                            "type": insight_type,
                            "title": title,
                            "content": content,
                            "confidence": float(data.get("confidence", 0.7)),
                            "timestamp": timestamp,
                        }
                    )

                return {
                    "insights": insights,
                    "context": match_context,
                    "timestamp": timestamp,
                }
        except Exception as e:
            print(f"Error generating batched insights: {e}")

        return self._fallback_batched_insights()

    async def generate_all_insights_parallel(
        self, match_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate ALL insights in PARALLEL for minimum latency
        Makes 2 concurrent API calls:
        1. General Insights (batched: tactical + momentum + prediction)
        2. Tactical Insights (batched: momentum shift + tactical read)

        Returns combined results from both calls"""

        print(
            f"Starting parallel insight generation (2 concurrent Gemma 4 26B calls)..."
        )

        # Create tasks for parallel execution
        tasks = [
            asyncio.to_thread(self.generate_batched_insights, match_context),
            asyncio.to_thread(self.generate_tactical_insights, match_context),
        ]

        try:
            # Execute both API calls in parallel
            start_time = time.time()
            results = await asyncio.gather(*tasks, return_exceptions=True)
            duration = time.time() - start_time

            print(f"Parallel execution completed in {duration:.2f}s")

            general_insights = (
                results[0]
                if not isinstance(results[0], Exception)
                else self._fallback_batched_insights()
            )
            tactical_insights = (
                results[1]
                if not isinstance(results[1], Exception)
                else self._fallback_tactical_insights(match_context)
            )

            # Combine results
            all_insights = []

            # Add general insights (tactical, momentum, prediction)
            if "insights" in general_insights:
                all_insights.extend(general_insights["insights"])
                print(f"  - Added {len(general_insights['insights'])} general insights")

            # Add tactical insights (momentum shift, tactical read)
            if "insights" in tactical_insights:
                all_insights.extend(tactical_insights["insights"])
                print(
                    f"  - Added {len(tactical_insights['insights'])} tactical insights"
                )

            print(f"Total insights generated: {len(all_insights)}")

            return {
                "insights": all_insights,
                "general": general_insights,
                "tactical": tactical_insights,
                "context": match_context,
                "timestamp": int(time.time() * 1000),
                "parallel": True,
                "duration": duration,
            }

        except Exception as e:
            print(f"Error in parallel insight generation: {e}")
            # Fallback to sequential if parallel fails
            return {
                "insights": [],
                "error": str(e),
                "timestamp": int(time.time() * 1000),
                "parallel": False,
            }

    def _fallback_batched_insights(self) -> Dict[str, Any]:
        """Fallback for batched insights when Gemini is unavailable"""
        timestamp = int(time.time() * 1000)
        return {
            "insights": [
                {
                    "id": str(timestamp),
                    "type": "tactical",
                    "title": "Tactical Analysis",
                    "content": "Deploy third man and fine leg to counter edge-prone deliveries. Target 6-8 RPO.",
                    "confidence": 0.7,
                    "timestamp": timestamp,
                },
                {
                    "id": str(timestamp + 1),
                    "type": "momentum",
                    "title": "Momentum Shift",
                    "content": "Momentum shifted after 3 boundaries in 2 overs. Run rate jumped from 7.2 to 9.8.",
                    "confidence": 0.7,
                    "timestamp": timestamp,
                },
                {
                    "id": str(timestamp + 2),
                    "type": "prediction",
                    "title": "Match Prediction",
                    "content": "Projected final score 185-190. Death overs will be decisive with 65% win probability.",
                    "confidence": 0.7,
                    "timestamp": timestamp,
                },
            ],
            "context": {},
            "timestamp": timestamp,
        }


gemini_service = GeminiService()
