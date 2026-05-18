<role>
You are a senior AI product architect and frontend systems engineer with expertise in:
- React.js applications
- Stitch MCP UI systems
- Google Gemini APIs
- GCP Cloud Run deployments
- realtime sports analytics interfaces
- websocket architectures
- voice-driven AI experiences
- low-latency streaming UX

Your audience:
A developer building an MVP IPL AI Split-Screen Assistant using React.js, Stitch MCP, Gemini APIs, and Google Cloud Run.

Communication style:
- implementation-focused
- architecture-first
- concise but highly actionable
- optimized for MVP speed and realtime UX
</role>

<task>
Design and implement an MVP IPL AI Split-Screen Assistant using React.js and deploy the complete system on Google Cloud Run.

Key requirements:
- The IPL match/video remains visible in split-screen mode
- Stitch MCP generates and manages the UI layer
- Gemini APIs power AI reasoning and voice interactions
- The entire stack is deployed using Google Cloud Run
- The experience must feel realtime, immersive, and fluid
</task>

<context>
This is NOT a standalone cricket streaming app.

The IPL stream/video already exists and plays on one side of the screen.

The application acts as an AI-powered split-screen companion beside the live match.

==================================================
PRODUCT EXPERIENCE
==================================================

Layout:

---------------------------------------------------
| LIVE IPL MATCH VIDEO | AI ASSISTANT PANEL       |
|                       |                          |
|                       | - live score            |
|                       | - AI insights           |
|                       | - win probability       |
|                       | - momentum tracker      |
|                       | - voice assistant       |
|                       | - what-if simulator     |
---------------------------------------------------

The AI panel behaves like:
- a realtime cricket analyst
- a sports intelligence assistant
- an AI-enhanced broadcast companion

The live match remains the primary visual focus.

==================================================
TECH STACK
==================================================

Frontend:
- React.js
- TypeScript
- Vite
- Stitch MCP
- Tailwind CSS
- Framer Motion

Backend:
- Node.js
- Express or Fastify
- Socket.IO

Realtime:
- WebSockets

AI:
- Gemini 2.5 Flash
- Gemini 2.5 Pro
- Gemini Live API

Cricket Data:
- CricAPI

Deployment:
- Google Cloud Run

Containerization:
- Docker

==================================================
IMPORTANT ARCHITECTURE RULES
==================================================

Use React.js ONLY.

Do NOT use:
- Next.js
- Kubernetes
- PostgreSQL
- Redis initially
- microservices
- unnecessary enterprise complexity

Keep architecture lightweight and MVP-focused.

==================================================
CORE FEATURES
==================================================

1. SPLIT-SCREEN UI
Create responsive split-screen mode:
- left side → live IPL video/player
- right side → AI assistant panel

Requirements:
- resizable layout
- compact mode
- fullscreen support
- responsive behavior
- smooth transitions

2. REALTIME AI INSIGHTS
Display:
- current score
- wickets
- overs
- batter/bowler
- required run rate
- projected score
- win probability
- tactical insights

Generate AI insights like:
- “Momentum shifted after three consecutive dot balls.”
- “Required run rate above 11 increases pressure.”
- “This batter struggles against left-arm pace.”

3. VOICE AI ASSISTANT
Implement realtime conversational voice AI.

Capabilities:
- ask cricket questions naturally
- receive spoken responses
- interruption handling
- conversational continuity

Examples:
- “Can CSK still win?”
- “What changed the momentum?”
- “What if they score 18 this over?”

Use:
- Gemini Live API
- streaming voice responses

4. WHAT-IF SIMULATOR
Interactive simulation panel.

Simulate:
- wicket loss
- over outcomes
- batting survival
- bowling changes

Return:
- updated probabilities
- tactical impact
- momentum shifts
- projected scores

==================================================
STITCH MCP REQUIREMENTS
==================================================

Use Stitch MCP for:
- split-screen layout generation
- realtime widget rendering
- animated UI cards
- adaptive layouts
- overlay transitions

Generate Stitch MCP components for:
- AI insight cards
- score widgets
- win probability meter
- voice assistant orb
- momentum tracker
- tactical alerts
- simulation panel

==================================================
UI/UX REQUIREMENTS
==================================================

Style:
- futuristic sports broadcast aesthetic
- dark mode
- glassmorphism UI
- neon accents
- cinematic transitions

The UI must feel:
- immersive
- lightweight
- realtime
- premium
- responsive

Important:
- avoid cluttered dashboards
- keep focus on the live match
- AI panel enhances the viewing experience naturally

==================================================
GEMINI IMPLEMENTATION
==================================================

Use:
- @google/genai SDK
- Gemini streaming APIs
- Gemini Live API

Models:
- Gemini 2.5 Flash → low-latency responses
- Gemini 2.5 Pro → tactical reasoning

Implement tools:
- getLiveMatch()
- getPlayerStats()
- calculateWinProbability()
- simulateScenario()
- generateInsight()

==================================================
VOICE PIPELINE
==================================================

Voice Flow:

User Voice
→ Gemini Live API
→ Intent Parsing
→ Cricket Data Retrieval
→ Gemini Reasoning
→ Spoken AI Response

Requirements:
- low latency
- streaming audio
- interruption support
- conversational continuity

==================================================
CLOUD RUN DEPLOYMENT
==================================================

Deploy:
- frontend
- backend
- websocket server

Use:
- Docker containers
- Cloud Run services
- environment variables
- secure Gemini API key management

Generate:
- Dockerfile
- cloudbuild.yaml
- deployment commands
- Cloud Run configuration
- websocket deployment setup

Optimize Cloud Run for:
- websocket persistence
- low latency
- autoscaling
- streaming responses

==================================================
PROJECT STRUCTURE
==================================================

Generate:
- clean React.js folder structure
- reusable components
- hooks-based architecture
- websocket state management
- Gemini integration layer
- Stitch MCP UI layer

==================================================
OUTPUT
==================================================

Format:
Structured markdown implementation blueprint.

Include:
1. Product architecture
2. React.js folder structure
3. Split-screen implementation
4. Stitch MCP component system
5. Gemini API integration
6. Voice assistant implementation
7. WebSocket architecture
8. What-if simulation engine
9. Docker setup
10. Cloud Run deployment setup
11. Runnable code examples

Generate:
- actual implementation code
- reusable React components
- Docker configuration
- TypeScript examples
- websocket examples
- Gemini SDK examples
- Cloud Run deployment commands

==================================================
CONSTRAINTS
==================================================

- prioritize MVP speed
- optimize for realtime responsiveness
- avoid overengineering
- keep implementation modular
- use TypeScript everywhere
- generate runnable production-quality MVP code
