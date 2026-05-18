// Mock Data Engine for IPL Agent

const players = [
  {
    id: "p1",
    name: "Batter One",
    team: "Team A",
    role: "Batter",
    currentSeasonRuns: 420,
    allTimeRuns: 2600,
    milestones: [
      { name: "Season Runs", threshold: 500, current: 420, unit: "Runs" },
      { name: "Career Runs", threshold: 3000, current: 2600, unit: "Runs" }
    ],
    image: "https://ui-avatars.com/api/?name=Batter+One&background=ef4444&color=fff&size=128"
  },
  {
    id: "p2",
    name: "Bowler One",
    team: "Team B",
    role: "Bowler",
    currentSeasonWickets: 14,
    allTimeWickets: 90,
    milestones: [
      { name: "Season Wickets", threshold: 18, current: 14, unit: "Wickets" },
      { name: "Career Wickets", threshold: 100, current: 90, unit: "Wickets" }
    ],
    image: "https://ui-avatars.com/api/?name=Bowler+One&background=3b82f6&color=fff&size=128"
  }
];

const teams = [
  { id: "Team A", name: "Team A", points: 16, nrr: 0.62, baseProb: 92 },
  { id: "Team B", name: "Team B", points: 15, nrr: 0.48, baseProb: 78 },
  { id: "Team C", name: "Team C", points: 13, nrr: 0.21, baseProb: 52 },
  { id: "Team D", name: "Team D", points: 12, nrr: 0.08, baseProb: 40 },
  { id: "Team E", name: "Team E", points: 12, nrr: -0.12, baseProb: 32 },
  { id: "Team F", name: "Team F", points: 10, nrr: -0.35, baseProb: 18 },
  { id: "Team G", name: "Team G", points: 8, nrr: -0.62, baseProb: 6 },
  { id: "Team H", name: "Team H", points: 6, nrr: -0.88, baseProb: 2 }
];

// Helper to simulate probability shifts based on winner
const getShiftedProbabilities = (winnerId, loserId) => {
  return teams.map(team => {
    let prob = team.baseProb;
    if (team.id === winnerId) prob += 20; // boost winner
    if (team.id === loserId) prob -= 15; // penalize loser

    // Indirect effects
    if (team.id !== winnerId && team.id !== loserId) {
      // Light generic adjustments based on standings position
      if (team.points >= 14) prob -= 3;
      if (team.points <= 10) prob += 2;
    }

    // Clamp between 0 and 100
    prob = Math.max(0, Math.min(100, prob));
    return { ...team, projectedProb: prob };
  }).sort((a, b) => b.projectedProb - a.projectedProb);
};

module.exports = { players, teams, getShiftedProbabilities };
