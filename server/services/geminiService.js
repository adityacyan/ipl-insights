const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
    constructor() {
        if (!process.env.GEMINI_API_KEY) {
            console.warn('GEMINI_API_KEY not found in environment variables');
            this.genAI = null;
            return;
        }

        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    }

    async generateInsight(matchContext, insightType = 'tactical') {
        if (!this.genAI) {
            return {
                id: Date.now().toString(),
                type: insightType,
                title: 'AI Service Unavailable',
                content: 'Gemini API key not configured. Please set GEMINI_API_KEY environment variable.',
                confidence: 0,
                timestamp: Date.now()
            };
        }

        try {
            const prompt = this.buildPrompt(matchContext, insightType);
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            return this.parseInsightResponse(text, insightType);
        } catch (error) {
            console.error('Error generating insight:', error);
            return {
                id: Date.now().toString(),
                type: insightType,
                title: 'Analysis Error',
                content: 'Unable to generate insight at this time. Please try again.',
                confidence: 0,
                timestamp: Date.now()
            };
        }
    }

    buildPrompt(matchContext, insightType) {
        const basePrompt = `You are an expert cricket analyst providing real-time insights for an IPL match.
    
Match Context:
- Teams: ${matchContext.match?.team1} vs ${matchContext.match?.team2}
- Venue: ${matchContext.match?.venue}
- Current Batter: ${matchContext.activeBatter?.name} (${matchContext.activeBatter?.role})
- Current Bowler: ${matchContext.activeBowler?.name} (${matchContext.activeBowler?.role})

Provide a ${insightType} insight in the following JSON format:
{
  "title": "Brief insight title (max 50 characters)",
  "content": "Detailed analysis (max 200 characters)",
  "confidence": 0.85
}

Focus on actionable insights that would interest cricket fans watching live.`;

        return basePrompt;
    }

    parseInsightResponse(text, insightType) {
        try {
            // Try to extract JSON from the response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    id: Date.now().toString(),
                    type: insightType,
                    title: parsed.title || 'AI Insight',
                    content: parsed.content || text.substring(0, 200),
                    confidence: parsed.confidence || 0.7,
                    timestamp: Date.now()
                };
            }
        } catch (error) {
            console.error('Error parsing insight response:', error);
        }

        // Fallback if JSON parsing fails
        return {
            id: Date.now().toString(),
            type: insightType,
            title: 'Cricket Analysis',
            content: text.substring(0, 200),
            confidence: 0.7,
            timestamp: Date.now()
        };
    }

    async generateWinProbabilityHistory(matchId) {
        if (!this.genAI) {
            return this.getFallbackHistory();
        }

        try {
            const prompt = `You are an expert cricket analyst with deep knowledge of T20 cricket dynamics and win probability calculations.

Generate a realistic win probability history for an ongoing IPL match between two teams. The data should reflect how win probabilities naturally fluctuate during a T20 cricket match based on:

1. **Match Phases**: Powerplay (0-6 overs), middle overs (7-15), death overs (16-20)
2. **Key Events**: Wickets, boundaries, partnerships, bowling changes
3. **Match Situation**: Current score, required run rate, wickets in hand
4. **Momentum Shifts**: How probabilities swing based on match events

**Current Match Context:**
- Format: T20 (20 overs per side)
- Current Over: 18.2 (batting team is in death overs)
- Match Stage: First innings in progress
- Typical T20 score range: 140-200 runs

**Generate realistic data points that show:**
- Natural probability fluctuations throughout the match
- Bigger swings during key moments (wickets, big overs)
- Gradual changes during stable periods
- Current probabilities that reflect a competitive T20 match

Respond in this exact JSON format:
{
  "dataPoints": [
    {"over": 0, "team1Prob": 50, "team2Prob": 50},
    {"over": 3, "team1Prob": 55, "team2Prob": 45},
    {"over": 6, "team1Prob": 48, "team2Prob": 52},
    {"over": 10, "team1Prob": 65, "team2Prob": 35},
    {"over": 15, "team1Prob": 42, "team2Prob": 58},
    {"over": 18.2, "team1Prob": 62, "team2Prob": 38}
  ],
  "currentOver": 18.2,
  "team1Peak": 78,
  "team2Peak": 68,
  "lastUpdated": ${Date.now()}
}

**Guidelines:**
- Include 8-12 data points across the match
- Probabilities should always sum to 100
- Peak values should be realistic (60-85% range)
- Show at least 2-3 momentum shifts
- Current probabilities should favor the batting team slightly (typical for T20s)
- Make the data engaging and realistic for cricket fans`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    dataPoints: parsed.dataPoints || this.getFallbackHistory().dataPoints,
                    currentOver: parsed.currentOver || 18.2,
                    team1Peak: parsed.team1Peak || 82,
                    team2Peak: parsed.team2Peak || 65,
                    lastUpdated: Date.now()
                };
            }
        } catch (error) {
            console.error('Error generating win probability history:', error);
        }

        return this.getFallbackHistory();
    }

    getFallbackHistory() {
        return {
            dataPoints: [
                { over: 0, team1Prob: 50, team2Prob: 50 },
                { over: 2, team1Prob: 45, team2Prob: 55 },
                { over: 5, team1Prob: 40, team2Prob: 60 },
                { over: 8, team1Prob: 55, team2Prob: 45 },
                { over: 10, team1Prob: 70, team2Prob: 30 },
                { over: 12, team1Prob: 65, team2Prob: 35 },
                { over: 15, team1Prob: 75, team2Prob: 25 },
                { over: 17, team1Prob: 60, team2Prob: 40 },
                { over: 18.2, team1Prob: 62, team2Prob: 38 }
            ],
            currentOver: 18.2,
            team1Peak: 82,
            team2Peak: 65,
            lastUpdated: Date.now()
        };
    }

    async calculateWinProbability(matchState) {
        if (!this.genAI) {
            return {
                team1: 50,
                team2: 50,
                lastUpdated: Date.now(),
                trend: 'stable'
            };
        }

        try {
            const prompt = `As a cricket analyst, calculate win probabilities for this IPL match:
      
Teams: ${matchState.match?.team1} vs ${matchState.match?.team2}
Current situation: Analyze the match context and provide win probabilities.

Respond in JSON format:
{
  "team1": 45,
  "team2": 55,
  "trend": "increasing"
}

Trend can be: "increasing", "decreasing", or "stable"`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    team1: parsed.team1 || 50,
                    team2: parsed.team2 || 50,
                    lastUpdated: Date.now(),
                    trend: parsed.trend || 'stable'
                };
            }
        } catch (error) {
            console.error('Error calculating win probability:', error);
        }

        // Fallback probabilities
        return {
            team1: 50,
            team2: 50,
            lastUpdated: Date.now(),
            trend: 'stable'
        };
    }
}

module.exports = new GeminiService();