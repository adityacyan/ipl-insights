// Mock Data Engine for IPL Agent

const players = [
  {
    id: "p1",
    name: "Virat Kohli",
    team: "RCB",
    role: "Batter",
    currentSeasonRuns: 640,
    allTimeRuns: 7850,
    milestones: [
      { name: "Orange Cap", threshold: 660, current: 640, unit: "Runs" },
      { name: "8000 IPL Runs", threshold: 8000, current: 7850, unit: "Runs" }
    ],
    image: "https://ui-avatars.com/api/?name=Virat+Kohli&background=ef4444&color=fff&size=128"
  },
  {
    id: "p2",
    name: "Jasprit Bumrah",
    team: "MI",
    role: "Bowler",
    currentSeasonWickets: 20,
    allTimeWickets: 165,
    milestones: [
      { name: "Purple Cap", threshold: 22, current: 20, unit: "Wickets" },
      { name: "170 IPL Wickets", threshold: 170, current: 165, unit: "Wickets" }
    ],
    image: "https://ui-avatars.com/api/?name=Jasprit+Bumrah&background=3b82f6&color=fff&size=128"
  }
];

const teams = [
  { id: "RR", name: "Rajasthan Royals", points: 16, nrr: 0.622, baseProb: 95 },
  { id: "KKR", name: "Kolkata Knight Riders", points: 16, nrr: 1.453, baseProb: 98 },
  { id: "CSK", name: "Chennai Super Kings", points: 14, nrr: 0.528, baseProb: 65 },
  { id: "RCB", name: "Royal Challengers Bengaluru", points: 12, nrr: 0.387, baseProb: 30 },
  { id: "DC", name: "Delhi Capitals", points: 12, nrr: -0.377, baseProb: 25 },
  { id: "LSG", name: "Lucknow Super Giants", points: 12, nrr: -0.769, baseProb: 15 },
  { id: "GT", name: "Gujarat Titans", points: 10, nrr: -1.063, baseProb: 5 },
  { id: "PBKS", name: "Punjab Kings", points: 8, nrr: -0.509, baseProb: 0 },
  { id: "MI", name: "Mumbai Indians", points: 8, nrr: -0.318, baseProb: 0 }
];

// Helper to simulate probability shifts based on winner
const getShiftedProbabilities = (winnerId, loserId) => {
    return teams.map(team => {
        let prob = team.baseProb;
        if (team.id === winnerId) prob += 20; // boost winner
        if (team.id === loserId) prob -= 15; // penalize loser
        
        // Indirect effects
        if (team.id !== winnerId && team.id !== loserId) {
            // Very simplified: if RCB wins, it hurts CSK slightly, etc.
            if (winnerId === 'RCB' && team.points > 12) prob -= 5;
            if (winnerId === 'CSK' && team.points < 14) prob -= 5;
        }

        // Clamp between 0 and 100
        prob = Math.max(0, Math.min(100, prob));
        return { ...team, projectedProb: prob };
    }).sort((a, b) => b.projectedProb - a.projectedProb);
};

module.exports = { players, teams, getShiftedProbabilities };
