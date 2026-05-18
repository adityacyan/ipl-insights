# IPL AI Assistant - Setup Guide

## Issues Fixed

1. Added missing GEMINI_API_KEY configuration in .env file
2. Implemented tactical chat functionality (backend + frontend)
3. Connected the "Send" button to the AI chat API
4. Added proper error handling for API failures

## Setup Instructions

### 1. Configure Gemini API Key

You need to get a Gemini API key from Google AI Studio:

1. Go to https://aistudio.google.com/app/apikey
2. Create a new API key
3. Copy the API key
4. Open `server/.env` file
5. Replace `your_gemini_api_key_here` with your actual API key:

```env
GEMINI_API_KEY=your_actual_api_key_here
```

### 2. Install Dependencies

#### Backend (Python)
```bash
conda activate adobehackathon && pip install -r server/requirements.txt
```

#### Frontend (Node.js)
```bash
cd client
npm install
```

### 3. Build Frontend

```bash
cd client
npm run build
```

This will create a production build in `client/dist` that needs to be copied to `server/public`:

```bash
# From project root
cp -r client/dist/* server/public/
```

### 4. Start the Server

```bash
conda activate adobehackathon && python server/app.py
```

The server will start on http://localhost:8080

### 5. Test the Application

1. Open http://localhost:8080 in your browser
2. You should see the IPL AI Assistant interface
3. Try asking a tactical question in the chat box at the bottom
4. The AI should respond with tactical insights

## Features Now Working

### Tactical Chat
- Ask questions like "What is the win probability if Dhoni enters now?"
- Get AI-powered tactical analysis based on current match context
- Real-time responses from Gemini AI

### AI Insights
- Momentum Shift analysis
- Tactical Read recommendations
- Win Probability History chart
- Active matchup analysis

### Live Match Data
- Real-time score updates (if Cricbuzz API is configured)
- Fallback to sample data if API is not available
- Match status and venue information

## Troubleshooting

### Issue: "Gemini API key not configured"
**Solution:** Make sure you've added your actual Gemini API key to `server/.env`

### Issue: Chat not responding
**Solution:** 
1. Check that the server is running
2. Check browser console for errors
3. Verify Gemini API key is valid

### Issue: No live match data
**Solution:** 
- The app uses sample data by default
- To get real live data, configure CRICBUZZ_API_KEY in .env
- The sample data is sufficient for testing AI features

### Issue: Frontend not loading
**Solution:**
1. Make sure you've built the frontend: `cd client && npm run build`
2. Copy the build to server: `cp -r client/dist/* server/public/`
3. Restart the server

## Development Mode

For development with hot reload:

### Terminal 1 - Backend
```bash
conda activate adobehackathon && python server/app.py
```

### Terminal 2 - Frontend
```bash
cd client
npm run dev
```

Frontend will be available at http://localhost:5173 (with hot reload)
Backend API at http://localhost:8080

## API Endpoints

- `GET /api/live-context` - Get current match context
- `GET /api/live-scores` - Get live scores from Cricbuzz
- `GET /api/tactical-insights` - Get AI-generated tactical insights
- `GET /api/win-probability-history` - Get win probability chart data
- `POST /api/tactical-chat` - Ask tactical questions (NEW)
- `GET /api/health` - Check API health and configuration

## Next Steps

1. Get your Gemini API key and configure it
2. Build and deploy the frontend
3. Start the server
4. Test the tactical chat feature
5. (Optional) Configure Cricbuzz API for real live data
