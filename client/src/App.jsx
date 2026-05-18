import { useEffect, useMemo, useState } from 'react';
import WinProbabilityChart from './components/WinProbabilityChart';

const fallbackData = {
    match: {
        title: 'IPL companion',
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

const formatStatusWithShortForms = (status) => {
    if (!status) return status;

    // Replace team names with short forms in status messages
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
        'Sunrisers Hyderabad': 'SRH'
    };

    let formattedStatus = status;
    Object.entries(teamMappings).forEach(([fullName, shortName]) => {
        formattedStatus = formattedStatus.replace(new RegExp(fullName, 'g'), shortName);
    });

    return formattedStatus;
};

function App() {
    const [context, setContext] = useState(null);
    const [liveScores, setLiveScores] = useState(null);
    const [aiInsights, setAiInsights] = useState(null);
    const [tacticalInsights, setTacticalInsights] = useState(null);
    const [winProbabilityHistory, setWinProbabilityHistory] = useState(null);
    const [chatQuestion, setChatQuestion] = useState('');
    const [chatResponse, setChatResponse] = useState('');
    const [isLoadingChat, setIsLoadingChat] = useState(false);

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
        const interval = setInterval(loadLiveScores, 20000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    // OPTION 1: Fetch insights separately (current approach)
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

    // Fetch tactical insights (momentum shift & tactical read) periodically
    useEffect(() => {
        let isMounted = true;

        const loadTacticalInsights = () => {
            fetch('/api/tactical-insights')
                .then(res => res.json())
                .then(data => {
                    if (isMounted) {
                        setTacticalInsights(data);
                    }
                })
                .catch(() => null);
        };

        // Load tactical insights initially and then every 20 seconds for more dynamic updates
        loadTacticalInsights();
        const interval = setInterval(loadTacticalInsights, 20000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    // OPTION 2: Fetch ALL insights in parallel (FASTER - uncomment to use)
    // This makes 2 API calls simultaneously for minimum latency
    /*
    useEffect(() => {
        let isMounted = true;

        const loadAllInsightsParallel = () => {
            fetch('/api/insights/all-parallel')
                .then(res => res.json())
                .then(data => {
                    if (isMounted && data.parallel) {
                        // Extract general and tactical insights from parallel response
                        if (data.general) {
                            setAiInsights(data.general);
                        }
                        if (data.tactical) {
                            setTacticalInsights(data.tactical);
                        }
                    }
                })
                .catch(() => null);
        };

        // Load all insights in parallel - faster than separate calls
        loadAllInsightsParallel();
        const interval = setInterval(loadAllInsightsParallel, 30000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);
    */

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

        // Load history initially and then every 2 minutes (120 seconds)
        loadWinProbabilityHistory();
        const interval = setInterval(loadWinProbabilityHistory, 120000);

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
            team1: getTeamShortForm(battingTeam),
            team2: getTeamShortForm(bowlingTeam),
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
            runRate: liveScoreSummary.runRate,
            status: liveScoreSummary.status,
            isLive: liveScoreSummary.isLive
        }
        : match;

    // Determine if match is completed and who won
    const isMatchCompleted = liveScoreSummary?.status &&
        (liveScoreSummary.status.toLowerCase().includes('won') ||
            liveScoreSummary.status.toLowerCase().includes('win'));

    // Extract winner from status
    let winningTeam = null;
    if (isMatchCompleted && liveScoreSummary?.status) {
        const status = liveScoreSummary.status;
        if (status.includes(liveMatch.team1)) {
            winningTeam = liveMatch.team1;
        } else if (status.includes(liveMatch.team2)) {
            winningTeam = liveMatch.team2;
        }
        // Also check for short forms in status
        const team1Short = getTeamShortForm(liveMatch.team1);
        const team2Short = getTeamShortForm(liveMatch.team2);
        if (status.includes(team1Short)) {
            winningTeam = liveMatch.team1;
        } else if (status.includes(team2Short)) {
            winningTeam = liveMatch.team2;
        }
    }

    const matchup = useMemo(() => {
        const striker = context?.activeBatter
            ? {
                ...fallbackData.matchup.striker,
                name: context.activeBatter.name,
                role: context.activeBatter.role,
                team: getTeamShortForm(context.activeBatter.team)
            }
            : fallbackData.matchup.striker;

        const bowler = context?.activeBowler
            ? {
                ...fallbackData.matchup.bowler,
                name: context.activeBowler.name,
                role: context.activeBowler.role,
                team: getTeamShortForm(context.activeBowler.team)
            }
            : fallbackData.matchup.bowler;

        return { ...fallbackData.matchup, striker, bowler };
    }, [context]);

    // Calculate win probability - adjust to 100% if match is completed
    let winPercent = match.winPercent;
    let losePercent = 100 - winPercent;

    if (isMatchCompleted && winningTeam) {
        if (winningTeam === liveMatch.team1) {
            winPercent = 100;
            losePercent = 0;
        } else if (winningTeam === liveMatch.team2) {
            winPercent = 0;
            losePercent = 100;
        }
    }

    winPercent = clampPercent(winPercent);
    losePercent = clampPercent(losePercent);

    // Generate dynamic chart data
    const team1Peak = winProbabilityHistory?.team1Peak || fallbackData.winHistory.cskPeak;
    const team2Peak = winProbabilityHistory?.team2Peak || fallbackData.winHistory.miPeak;

    // Handle chat submission
    const handleChatSubmit = async (e) => {
        e.preventDefault();
        if (!chatQuestion.trim() || isLoadingChat) return;

        setIsLoadingChat(true);
        setChatResponse('Thinking...');

        try {
            const response = await fetch('/api/tactical-chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ question: chatQuestion }),
            });

            const data = await response.json();
            setChatResponse(data.response || 'No response received.');
        } catch (error) {
            setChatResponse('Error: Unable to get response. Please try again.');
        } finally {
            setIsLoadingChat(false);
        }
    };

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
                            <span className="header-eyebrow">IPL companion</span>
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
                                {isMatchCompleted ? 'Match Completed' : (liveScoreSummary?.isLive ? 'Live Match' : 'Latest Match')}
                            </span>
                            <span className="live-feed">Tactical Feed ID: {match.feedId}</span>
                        </div>
                        <div className="score-row">
                            <div className="score-team">
                                {liveMatch.team1} {liveMatch.score}
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
                                    <div className="team-name-large">{liveMatch.team2}</div>
                                    <div className="team-percentage blue">{losePercent}%</div>
                                </div>
                                <div className="team-right">
                                    <div className="team-name-large">{liveMatch.team1}</div>
                                    <div className="team-percentage red">{winPercent}%</div>
                                </div>
                            </div>
                            <div className="win-probability-bar">
                                <div className="bar-left" style={{ width: `${losePercent}%` }}></div>
                                <div className="bar-right" style={{ width: `${winPercent}%` }}></div>
                            </div>
                        </div>

                        {liveScoreSummary?.status && (
                            <div className="live-row" style={{ marginTop: '10px' }}>
                                <span className="live-tag">Status</span>
                                <span className="live-feed">{formatStatusWithShortForms(liveScoreSummary.status)}</span>
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
                        {(tacticalInsights?.insights || fallbackData.insights).map((item, index) => (
                            <div key={item.id || item.label || index} className={`insight-card ${index === 1 ? 'accent' : ''}`}>
                                <div className="insight-label">
                                    {item.label}
                                    {tacticalInsights && (
                                        <span style={{ fontSize: '0.8em', opacity: 0.7, marginLeft: '8px' }}>
                                            AI Generated
                                        </span>
                                    )}
                                </div>
                                <p>{item.text}</p>
                            </div>
                        ))}
                        {tacticalInsights && (
                            <div className="live-row" style={{ marginTop: '10px', fontSize: '0.8em', opacity: 0.7 }}>
                                <span className="live-tag">Updated</span>
                                <span className="live-feed">
                                    {new Date(tacticalInsights.lastUpdated).toLocaleTimeString()}
                                </span>
                            </div>
                        )}
                    </section>

                    <section className="history-card">
                        <div className="section-title">
                            <span>Win Probability History</span>
                            <span className="section-icon" />
                        </div>
                        {winProbabilityHistory ? (
                            <>
                                <WinProbabilityChart
                                    data={winProbabilityHistory}
                                    team1Name={liveMatch.team1}
                                    team2Name={liveMatch.team2}
                                />
                                <div className="peak-row">
                                    <div className="peak-item">
                                        <span>{liveMatch.team1} Peak</span>
                                        <strong style={{ color: '#4285f4' }}>{team1Peak}%</strong>
                                    </div>
                                    <div className="peak-item">
                                        <span>{liveMatch.team2} Peak</span>
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
                                        {matchup.striker.team} • {matchup.striker.role} | {matchup.striker.stats}
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
                                        {matchup.bowler.team} • {matchup.bowler.role} | {matchup.bowler.stats}
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
                    {chatResponse && (
                        <div className="prompt-box" style={{ marginBottom: '10px', backgroundColor: '#1a1f2e' }}>
                            {chatResponse}
                        </div>
                    )}
                    <form onSubmit={handleChatSubmit} className="footer-input">
                        <input
                            type="text"
                            placeholder="Ask a tactical question"
                            value={chatQuestion}
                            onChange={(e) => setChatQuestion(e.target.value)}
                            disabled={isLoadingChat}
                        />
                        <button type="submit" disabled={isLoadingChat || !chatQuestion.trim()}>
                            {isLoadingChat ? 'Sending...' : 'Send'}
                        </button>
                    </form>
                    <div className="footer-time">19:42:01</div>
                </div>
            </div>
        </div>
    );
}

export default App;