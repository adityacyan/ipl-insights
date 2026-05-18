import { useEffect, useMemo, useState } from 'react';
import WinProbabilityChart from './components/WinProbabilityChart';

const fallbackData = {
  match: {
    title: 'IPL Tactical Command',
    team1: 'CSK',
    team2: 'MI',
    score: '184/4',
    overs: '18.2',
    runRate: '11.45',
    winPercent: 62,
    feedId: 'TF-001'
  },
  insights: [
    {
      label: 'Momentum Shift',
      text: 'Projected target reached 78% probability after over 17. High frequency boundaries detected.'
    },
    {
      label: 'Tactical Read',
      text: 'MI adjusting fields to wide-line yorker strategy. Gaikwad efficiency vs wide pace is 142.0.'
    }
  ],
  winHistory: {
    cskPeak: 82,
    miPeak: 44
  },
  matchup: {
    striker: {
      name: 'R. Gaikwad',
      role: 'LHB',
      team: 'CSK',
      stats: '50 (34)'
    },
    bowler: {
      name: 'J. Bumrah',
      role: 'RF',
      team: 'MI',
      stats: '3.2-0-21-2'
    },
    avgBallSpeed: 143.2,
    avgBallSpeedPercent: 76,
    matchupSR: 112.5,
    matchupSRPercent: 58
  },
  recommendation:
    'Target back-of-length to mitigate Gaikwad\'s current high-point drive efficiency.',
  prompt:
    'Commander, what is the win probability if Dhoni enters now vs waiting for over 19.4?'
};

const clampPercent = (value) => Math.min(100, Math.max(0, value));

const getTeamShortForm = (teamName) => {
  const teamMappings = {
    'Chennai Super Kings': 'CSK',
    'Delhi Capitals': 'DC',
    'Gujarat Titans': 'GT',
    'Kolkata Knight Riders': 'KKR',
    'Lucknow Super Giants': 'LSG',
    'Mumbai Indians': 'MI',
    'Punjab Kings': 'PBKS',
    'Rajasthan Royals': 'RR',
    'Royal Challengers Bengaluru': 'RCB',
    'Sunrisers Hyderabad': 'SRH',
    // Also handle variations and existing short forms
    'CSK': 'CSK',
    'DC': 'DC',
    'GT': 'GT',
    'KKR': 'KKR',
    'LSG': 'LSG',
    'MI': 'MI',
    'PBKS': 'PBKS',
    'RR': 'RR',
    'RCB': 'RCB',
    'SRH': 'SRH'
  };

  return teamMappings[teamName] || teamName;
};

const generateSVGPath = (dataPoints, width = 300, height = 90) => {
  if (!dataPoints || dataPoints.length === 0) {
    return {
      team1Path: "M0 45 L75 35 L150 55 L225 40 L300 45",
      team2Path: "M0 45 L75 55 L150 35 L225 50 L300 45",
      points: []
    };
  }

  const maxOver = Math.max(...dataPoints.map(d => d.over));
  const points = dataPoints.map(d => ({
    x: (d.over / maxOver) * width,
    y1: height - (d.team1Prob / 100) * height, // Team 1 line
    y2: height - (d.team2Prob / 100) * height, // Team 2 line
    over: d.over,
    team1Prob: d.team1Prob,
    team2Prob: d.team2Prob
  }));

  if (points.length === 0) return { team1Path: "", team2Path: "", points: [] };

  // Generate smooth paths for both teams
  let team1Path = `M${points[0].x} ${points[0].y1}`;
  let team2Path = `M${points[0].x} ${points[0].y2}`;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    // Team 1 path
    const cp1x1 = prev.x + (curr.x - prev.x) * 0.5;
    const cp1y1 = prev.y1;
    const cp2x1 = curr.x - (curr.x - prev.x) * 0.5;
    const cp2y1 = curr.y1;
    team1Path += ` C ${cp1x1} ${cp1y1}, ${cp2x1} ${cp2y1}, ${curr.x} ${curr.y1}`;

    // Team 2 path
    const cp1x2 = prev.x + (curr.x - prev.x) * 0.5;
    const cp1y2 = prev.y2;
    const cp2x2 = curr.x - (curr.x - prev.x) * 0.5;
    const cp2y2 = curr.y2;
    team2Path += ` C ${cp1x2} ${cp1y2}, ${cp2x2} ${cp2y2}, ${curr.x} ${curr.y2}`;
  }

  return { team1Path, team2Path, points };
};

const generateAxisLabels = (dataPoints) => {
  if (!dataPoints || dataPoints.length === 0) {
    return ['0', '5', '10', '15', '20'];
  }

  const maxOver = Math.max(...dataPoints.map(d => d.over));
  const step = Math.ceil(maxOver / 4);
  return [0, step, step * 2, step * 3, Math.ceil(maxOver)].map(over => `${over}`);
};

const parseOversToFloat = (oversValue) => {
  if (oversValue == null) {
    return null;
  }
  const text = `${oversValue}`.trim();
  if (!text) {
    return null;
  }
  if (!text.includes('.')) {
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const [oversPart, ballsPart] = text.split('.');
  const overs = Number(oversPart);
  const balls = Number(ballsPart);
  if (!Number.isFinite(overs) || !Number.isFinite(balls)) {
    return null;
  }
  return overs + balls / 6;
};

const computeRunRate = (innings) => {
  if (!innings) {
    return null;
  }
  const runs = innings.runs ?? innings.score;
  const oversValue = innings.overs ?? innings.ovr;
  const overs = parseOversToFloat(oversValue);
  if (!Number.isFinite(runs) || !Number.isFinite(overs) || overs <= 0) {
    return null;
  }
  return (runs / overs).toFixed(2);
};

const initialsFor = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .map(part => part[0].toUpperCase())
    .slice(0, 2)
    .join('');

function App() {
  const [context, setContext] = useState(null);
  const [liveScores, setLiveScores] = useState(null);
  const [aiInsights, setAiInsights] = useState(null);
  const [winProbabilityHistory, setWinProbabilityHistory] = useState(null);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/live-context')
      .then(res => res.json())
      .then(data => {
        if (isMounted) {
          setContext(data);
        }
      })
      .catch(() => null);

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadLiveScores = () => {
      fetch('/api/live-scores')
        .then(res => res.json())
        .then(data => {
          if (isMounted) {
            setLiveScores(data);
          }
        })
        .catch(() => null);
    };

    loadLiveScores();
    const interval = setInterval(loadLiveScores, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Fetch AI insights periodically
  useEffect(() => {
    let isMounted = true;

    const loadAiInsights = () => {
      fetch('/api/insights/live')
        .then(res => res.json())
        .then(data => {
          if (isMounted) {
            setAiInsights(data);
          }
        })
        .catch(() => null);
    };

    // Load insights initially and then every 30 seconds
    loadAiInsights();
    const interval = setInterval(loadAiInsights, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Fetch win probability history
  useEffect(() => {
    let isMounted = true;

    const loadWinProbabilityHistory = () => {
      fetch('/api/win-probability-history')
        .then(res => res.json())
        .then(data => {
          if (isMounted) {
            setWinProbabilityHistory(data);
          }
        })
        .catch(() => null);
    };

    // Load history initially and then every 60 seconds
    loadWinProbabilityHistory();
    const interval = setInterval(loadWinProbabilityHistory, 60000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const match = useMemo(() => {
    if (!context?.match) {
      return fallbackData.match;
    }

    return {
      ...fallbackData.match,
      team1: context.match.team1 || fallbackData.match.team1,
      team2: context.match.team2 || fallbackData.match.team2
    };
  }, [context]);

  const liveScoreSummary = useMemo(() => {
    if (!liveScores?.matches?.length) {
      return null;
    }

    const primary = liveScores.matches[0];

    // Use the improved data structure from our enhanced API
    const currentInnings = primary.currentInnings || {};
    const battingTeam = primary.battingTeam || primary.teams;
    const bowlingTeam = primary.bowlingTeam || primary.opponent;

    // Format the current score
    const runs = currentInnings.runs || 0;
    const wickets = currentInnings.wickets || 0;
    const overs = currentInnings.overs || 0;

    const scoreText = `${runs}/${wickets}`;
    const oversText = `${overs}`;

    // Calculate run rate
    const runRate = overs > 0 ? (runs / parseOversToFloat(overs)).toFixed(2) : "0.00";

    return {
      team1: battingTeam,
      team2: bowlingTeam,
      score: scoreText,
      overs: oversText,
      status: primary.status,
      runRate: runRate,
      isLive: primary.isLive,
      description: primary.description,
      venue: primary.venue,
      matchFormat: primary.matchFormat
    };
  }, [liveScores, match]);

  const liveMatch = liveScoreSummary
    ? {
      ...match,
      team1: liveScoreSummary.team1,
      team2: liveScoreSummary.team2,
      score: liveScoreSummary.score,
      overs: liveScoreSummary.overs,
      runRate: liveScoreSummary.runRate
    }
    : match;

  const matchup = useMemo(() => {
    const striker = context?.activeBatter
      ? {
        ...fallbackData.matchup.striker,
        name: context.activeBatter.name,
        role: context.activeBatter.role,
        team: context.activeBatter.team
      }
      : fallbackData.matchup.striker;

    const bowler = context?.activeBowler
      ? {
        ...fallbackData.matchup.bowler,
        name: context.activeBowler.name,
        role: context.activeBowler.role,
        team: context.activeBowler.team
      }
      : fallbackData.matchup.bowler;

    return { ...fallbackData.matchup, striker, bowler };
  }, [context]);

  const winPercent = clampPercent(match.winPercent);
  const losePercent = 100 - winPercent;

  // Generate dynamic chart data
  const team1Peak = winProbabilityHistory?.team1Peak || fallbackData.winHistory.cskPeak;
  const team2Peak = winProbabilityHistory?.team2Peak || fallbackData.winHistory.miPeak;

  return (
    <div className="app-shell">
      <div className="tactical-panel">
        <header className="panel-header">
          <div className="header-left">
            <div className="header-dots">
              <span />
              <span />
              <span />
            </div>
            <div className="header-text">
              <span className="header-eyebrow">IPL Tactical Command</span>
            </div>
          </div>
          <div className="header-right">
            <div className="signal">
              <div className="signal-bars">
                <span />
                <span />
                <span />
                <span />
              </div>
              <span className="signal-label">889</span>
            </div>
          </div>
        </header>

        <div className="panel-content">
          <section className="live-card">
            <div className="live-row">
              <span className="live-tag">
                {liveScoreSummary?.isLive ? 'Live Match' : 'Latest Match'}
              </span>
              <span className="live-feed">Tactical Feed ID: {match.feedId}</span>
            </div>
            <div className="score-row">
              <div className="score-team">
                {getTeamShortForm(liveMatch.team1)} {liveMatch.score}
                <span className="score-overs">({liveMatch.overs})</span>
              </div>
              <div className="score-rate">{liveMatch.runRate}</div>
            </div>
            <div className="win-probability-section">
              <div className="win-probability-header">
                LIVE WIN PROBABILITY
              </div>
              <div className="win-probability-teams">
                <div className="team-left">
                  <div className="team-name-large">{getTeamShortForm(liveMatch.team2)}</div>
                  <div className="team-percentage blue">{losePercent}%</div>
                </div>
                <div className="team-right">
                  <div className="team-name-large">{getTeamShortForm(liveMatch.team1)}</div>
                  <div className="team-percentage red">{winPercent}%</div>
                </div>
              </div>
              <div className="win-probability-bar">
                <div className="bar-left" style={{ width: `${losePercent}%` }}></div>
                <div className="bar-right" style={{ width: `${winPercent}%` }}></div>
              </div>
            </div>

            {/* Status information */}
            {liveScoreSummary?.status && (
              <div className="live-row" style={{ marginTop: '10px' }}>
                <span className="live-tag">Status</span>
                <span className="live-feed">{liveScoreSummary.status}</span>
              </div>
            )}

            {liveScoreSummary?.venue && (
              <div className="live-row" style={{ marginTop: '5px' }}>
                <span className="live-tag">Venue</span>
                <span className="live-feed">{liveScoreSummary.venue}</span>
              </div>
            )}

            {liveScoreSummary?.matchFormat && (
              <div className="live-row" style={{ marginTop: '5px' }}>
                <span className="live-tag">Format</span>
                <span className="live-feed">{liveScoreSummary.matchFormat}</span>
              </div>
            )}
          </section>

          <section className="insight-stack">
            {(aiInsights?.insights || fallbackData.insights).slice(0, 2).map((item, index) => (
              <div key={item.id || item.label || index} className={`insight-card ${index === 1 ? 'accent' : ''}`}>
                <div className="insight-label">
                  {item.title || item.label}
                  {item.confidence && (
                    <span style={{ fontSize: '0.8em', opacity: 0.7, marginLeft: '8px' }}>
                      ({Math.round(item.confidence * 100)}%)
                    </span>
                  )}
                </div>
                <p>{item.content || item.text}</p>
              </div>
            ))}
          </section>

          <section className="history-card">
            <div className="section-title">
              <span>Win Probability History</span>
              <span className="section-icon" />
            </div>
            {winProbabilityHistory ? (
              <>
                <div className="chart-wrap-enhanced">
                  <svg viewBox="0 0 320 140" role="img" aria-label="Win probability trend">
                    <defs>
                      <linearGradient id="team1Gradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#4285f4" />
                        <stop offset="100%" stopColor="#64b5f6" />
                      </linearGradient>
                      <linearGradient id="team2Gradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#ea4335" />
                        <stop offset="100%" stopColor="#ff7043" />
                      </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    <g className="grid-lines">
                      <line x1="20" y1="20" x2="20" y2="100" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                      <line x1="20" y1="100" x2="300" y2="100" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                      <line x1="20" y1="80" x2="300" y2="80" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                      <line x1="20" y1="60" x2="300" y2="60" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                      <line x1="20" y1="40" x2="300" y2="40" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                      <line x1="20" y1="20" x2="300" y2="20" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                    </g>

                    {/* Y-axis labels */}
                    <g className="y-axis-labels">
                      <text x="15" y="105" fill="rgba(255,255,255,0.6)" fontSize="10" textAnchor="end">0%</text>
                      <text x="15" y="85" fill="rgba(255,255,255,0.6)" fontSize="10" textAnchor="end">25%</text>
                      <text x="15" y="65" fill="rgba(255,255,255,0.6)" fontSize="10" textAnchor="end">50%</text>
                      <text x="15" y="45" fill="rgba(255,255,255,0.6)" fontSize="10" textAnchor="end">75%</text>
                      <text x="15" y="25" fill="rgba(255,255,255,0.6)" fontSize="10" textAnchor="end">100%</text>
                    </g>

                    {/* Team lines */}
                    <path
                      d={chartData.team1Path ? `M20,${100 - (50 * 0.8)} ${chartData.team1Path.replace(/M\d+\s+\d+/, '').replace(/(\d+)/g, (match, num) => {
                        const val = parseInt(num);
                        return val <= 90 ? (20 + (val / 300) * 280) : (20 + ((val - 20) * 0.8));
                      })}` : "M20 60 L90 50 L160 70 L230 55 L300 60"}
                      fill="none"
                      stroke="url(#team1Gradient)"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <path
                      d={chartData.team2Path ? `M20,${100 - (50 * 0.8)} ${chartData.team2Path.replace(/M\d+\s+\d+/, '').replace(/(\d+)/g, (match, num) => {
                        const val = parseInt(num);
                        return val <= 90 ? (20 + (val / 300) * 280) : (20 + ((val - 20) * 0.8));
                      })}` : "M20 40 L90 50 L160 30 L230 45 L300 40"}
                      fill="none"
                      stroke="url(#team2Gradient)"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />

                    {/* Data points */}
                    {chartData.points && chartData.points.map((point, index) => (
                      <g key={index}>
                        <circle
                          cx={20 + (point.x / 300) * 280}
                          cy={20 + ((100 - point.team1Prob) * 0.8)}
                          r="4"
                          fill="#4285f4"
                          stroke="white"
                          strokeWidth="2"
                        />
                        <circle
                          cx={20 + (point.x / 300) * 280}
                          cy={20 + ((100 - point.team2Prob) * 0.8)}
                          r="4"
                          fill="#ea4335"
                          stroke="white"
                          strokeWidth="2"
                        />
                        {/* Hover labels */}
                        <text
                          x={20 + (point.x / 300) * 280}
                          y={15}
                          fill="rgba(255,255,255,0.8)"
                          fontSize="9"
                          textAnchor="middle"
                          className="over-label"
                        >
                          {point.over}
                        </text>
                      </g>
                    ))}

                    {/* Legend */}
                    <g className="chart-legend">
                      <rect x="220" y="110" width="12" height="3" fill="#4285f4" rx="1" />
                      <text x="237" y="118" fill="rgba(255,255,255,0.8)" fontSize="10">{getTeamShortForm(liveMatch.team1)}</text>
                      <rect x="270" y="110" width="12" height="3" fill="#ea4335" rx="1" />
                      <text x="287" y="118" fill="rgba(255,255,255,0.8)" fontSize="10">{getTeamShortForm(liveMatch.team2)}</text>
                    </g>
                  </svg>

                  <div className="chart-axis-enhanced">
                    <span>Overs</span>
                    {axisLabels.map((label, index) => (
                      <span key={index}>{label}</span>
                    ))}
                  </div>
                </div>
                <div className="peak-row">
                  <div className="peak-item">
                    <span>{getTeamShortForm(liveMatch.team1)} Peak</span>
                    <strong style={{ color: '#4285f4' }}>{team1Peak}%</strong>
                  </div>
                  <div className="peak-item">
                    <span>{getTeamShortForm(liveMatch.team2)} Peak</span>
                    <strong style={{ color: '#ea4335' }}>{team2Peak}%</strong>
                  </div>
                </div>
                <div className="live-row" style={{ marginTop: '10px', fontSize: '0.8em', opacity: 0.7 }}>
                  <span className="live-tag">Updated</span>
                  <span className="live-feed">
                    {new Date(winProbabilityHistory.lastUpdated).toLocaleTimeString()}
                  </span>
                </div>
              </>
            ) : (
              <div className="chart-loading">
                <div className="loading-text">Generating win probability history...</div>
              </div>
            )}
          </section>

          <section className="matchup-card">
            <div className="section-title">
              <span>Active Matchup</span>
              <span className="critical-tag">Critical</span>
            </div>
            <div className="matchup-grid">
              <div className="player-tile">
                <div className="player-portrait">
                  <span>{initialsFor(matchup.striker.name)}</span>
                </div>
                <div className="player-meta">
                  <div className="player-name">{matchup.striker.name}</div>
                  <div className="player-sub">
                    {getTeamShortForm(matchup.striker.team)} • {matchup.striker.role} | {matchup.striker.stats}
                  </div>
                </div>
              </div>
              <div className="player-tile highlight">
                <div className="player-portrait alt">
                  <span>{initialsFor(matchup.bowler.name)}</span>
                </div>
                <div className="player-meta">
                  <div className="player-name">{matchup.bowler.name}</div>
                  <div className="player-sub">
                    {getTeamShortForm(matchup.bowler.team)} • {matchup.bowler.role} | {matchup.bowler.stats}
                  </div>
                </div>
              </div>
            </div>

            <div className="metric-block">
              <div className="metric-row">
                <span>Avg Ball Speed</span>
                <strong>{matchup.avgBallSpeed} KPH</strong>
              </div>
              <div className="metric-track">
                <div
                  className="metric-fill"
                  style={{ width: `${clampPercent(matchup.avgBallSpeedPercent)}%` }}
                />
              </div>
            </div>

            <div className="metric-block">
              <div className="metric-row">
                <span>Matchup SR</span>
                <strong>{matchup.matchupSR}</strong>
              </div>
              <div className="metric-track">
                <div
                  className="metric-fill muted"
                  style={{ width: `${clampPercent(matchup.matchupSRPercent)}%` }}
                />
              </div>
            </div>

            <div className="recommendation">
              <span className="recommendation-label">AI Recommendation</span>
              <p>{fallbackData.recommendation}</p>
            </div>
          </section>
        </div>

        <div className="panel-footer">
          <div className="footer-header">
            <span className="footer-title">Tactical AI</span>
            <span className="footer-status">
              <span className="status-dot" /> Online
            </span>
          </div>
          <div className="prompt-box">{fallbackData.prompt}</div>
          <div className="footer-input">
            <input type="text" placeholder="Ask a tactical question" />
            <button type="button">Send</button>
          </div>
          <div className="footer-time">19:42:01</div>
        </div>
      </div>
    </div>
  );
}

export default App;
