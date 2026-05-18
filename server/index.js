const express = require('express');
const cors = require('cors');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const { players, teams, getShiftedProbabilities } = require('./data/mockDB');
const geminiService = require('./services/geminiService');

const app = express();
const server = createServer(app);

// Configure CORS for both Express and Socket.IO
const corsOptions = {
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Initialize Socket.IO with CORS
const io = new Server(server, {
  cors: corsOptions
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-match', (matchId) => {
    socket.join(`match-${matchId}`);
    console.log(`Client ${socket.id} joined match ${matchId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// API: Get live match context
app.get('/api/live-context', (req, res) => {
  // Simulating a live match between RCB and MI
  res.json({
    match: { team1: 'RCB', team2: 'MI', venue: 'Wankhede Stadium' },
    activeBatter: players.find(p => p.id === 'p1'), // Virat Kohli
    activeBowler: players.find(p => p.id === 'p2')  // Jasprit Bumrah
  });
});

// API: Get playoff probabilities
app.get('/api/probabilities', (req, res) => {
  const winner = req.query.winner; // 'RCB' or 'MI'
  const currentMatch = { team1: 'RCB', team2: 'MI' };
  const loser = winner === currentMatch.team1 ? currentMatch.team2 : currentMatch.team1;

  if (!winner) {
    // Return base probabilities
    return res.json(teams.map(t => ({ ...t, projectedProb: t.baseProb })).sort((a, b) => b.baseProb - a.baseProb));
  }

  const shifted = getShiftedProbabilities(winner, loser);
  res.json(shifted);
});

// API: Generate AI insight
app.post('/api/insights', async (req, res) => {
  try {
    const { matchContext, insightType } = req.body;
    const insight = await geminiService.generateInsight(matchContext, insightType);
    res.json(insight);
  } catch (error) {
    console.error('Error generating insight:', error);
    res.status(500).json({ error: 'Failed to generate insight' });
  }
});

// API: Get win probability
app.post('/api/win-probability', async (req, res) => {
  try {
    const { matchState } = req.body;
    const probability = await geminiService.calculateWinProbability(matchState);
    res.json(probability);
  } catch (error) {
    console.error('Error calculating win probability:', error);
    res.status(500).json({ error: 'Failed to calculate win probability' });
  }
});

// API: Get win probability history
app.get('/api/win-probability-history', async (req, res) => {
  try {
    const matchId = req.query.matchId || 'current';
    const history = await geminiService.generateWinProbabilityHistory(matchId);
    res.json(history);
  } catch (error) {
    console.error('Error generating win probability history:', error);
    res.status(500).json({ error: 'Failed to generate win probability history' });
  }
});

// API: Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY
  });
});

// Serve static React files in production
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Gemini API configured: ${!!process.env.GEMINI_API_KEY}`);
});
