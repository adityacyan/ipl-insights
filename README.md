# 🏏 IPL AI Insights Agent

A real-time, second-screen companion application designed to enhance the live sports viewing experience. This MVP was built specifically for the Indian Premier League (IPL) and transforms passive watching into an interactive, data-rich experience.

**[🔴 Live Demo on Google Cloud Run](https://ipl-agent-34304543027.us-central1.run.app)**

<img width="1680" height="1050" alt="Screenshot 2026-05-13 at 9 37 52 PM" src="https://github.com/user-attachments/assets/95598ed8-7eb1-442f-ac8a-0952c6e610e2" />

---

## ✨ Features

This agent introduces a "True OTT (Over-The-Top)" layout, where the live match video serves as the immersive background, and an expandable AI overlay provides deep, contextual data.

1. **Live Player Milestones (AI Predicted)**
   - Automatically tracks the current active Batter and Bowler.
   - Calculates and displays exact runs/wickets needed to break major records (e.g., Orange Cap, Purple Cap, All-time leading run-scorer).
2. **Dynamic Playoff Predictor**
   - An interactive league standings table.
   - Users can toggle hypothetical match outcomes (e.g., "If MI Wins" vs "If RCB Wins").
   - The agent instantly recalculates and animates the shifting playoff probabilities for all 10 teams in the league.
3. **Second-Screen OTT Layout**
   - Fullscreen responsive video placeholder.
   - Floating Action Button (FAB) that slides out a frosted-glass sidebar containing the AI insights, ensuring the data never interrupts the live action.

---

## 🏗 Architecture

The application is built using a modern JavaScript stack and containerized for serverless scaling.

* **Frontend:** React (bootstrapped with Vite)
  * **Socket.IO Client:** Real-time WebSocket communication for live updates
  * **Vanilla CSS:** Custom, premium dark-mode styling with glassmorphism effects and CSS grid layouts. No heavy UI libraries were used, ensuring lightning-fast load times.
* **Backend:** FastAPI (Python)
  * **Google Gemini AI:** Integration with Gemini 1.5 Flash for AI insights and analysis
  * **Mock Data Engine:** The backend utilizes a lightweight Python mock data engine to simulate live context in the MVP.
* **Deployment:** Docker & Google Cloud Run
  * A multi-stage `Dockerfile` builds the static Vite frontend and serves it directly through the Express backend, resulting in a single, highly-optimized container. 
  * Automatically deployed and scaled globally via Google Cloud Run.

---

## 🚀 Running Locally

To run the application on your local machine:

**1. Install All Dependencies**
```bash
# Install all dependencies (root, client, and server)
npm run install-all
```

**2. Set Up Environment Variables**
```bash
# Copy the example environment file
cp server/.env.example server/.env

# Edit server/.env and add your Google Gemini API key:
# GEMINI_API_KEY=your_gemini_api_key_here
```

**3. Start Development Servers**
```bash
# Start both client and server in development mode
npm run dev
```

This will start:
- Client development server on `http://localhost:5173`
- Backend server on `http://localhost:8080` (FastAPI)

**Alternative: Manual Setup**
```bash
# Build the frontend for production
cd client
npm run build

# Copy the built files to the server's public directory
cp -r dist/* ../server/public/

# Start the server
cd ../server
uvicorn app:app --host 0.0.0.0 --port 8080
```

The application will be running at `http://localhost:8080`.

> Note: The Node/Express backend remains in the repo for reference, but the default runtime and Docker image use FastAPI.

---

## 📦 Deployment to Cloud Run

If you wish to deploy your own instance to Google Cloud Run:

```bash
# Make sure you are authenticated with gcloud
gcloud run deploy ipl-agent \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```
