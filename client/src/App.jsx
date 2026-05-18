import { useEffect, useMemo, useState } from 'react';
import WinProbabilityChart from './components/WinProbabilityChart';

/**
 * API ENDPOINTS & UPDATE FREQUENCIES
 * ===================================
 * 
 * 1. /api/live-context
 *    - Updates: Once on component mount
 *    - Data: Current match context, active batter/bowler
 * 
 * 2. /api/live-scores
 *    - Updates: Every 20 seconds (20000ms)
 *    - Data: Live match scores, teams, status
 * 
 * 3. /api/insights/live (GEMINI - Batched Insights)
 *    - Updates: Every 2 minutes (120000ms) *** CHANGED FROM 30s ***
 *    - Data: Tactical, Momentum, Prediction insights
 *    - Endpoint: server/app.py -> /api/insights/live
 * 
 * 4. /api/tactical-insights (GEMINI - Tactical Analysis)
 *    - Updates: Every 2 minutes (120000ms) *** CHANGED FROM 20s ***
 *    - Data: Momentum Shift, Tactical Read
 *    - Endpoint: server/app.py -> /api/tactical-insights
 * 
 * 5. /api/win-probability-history
 *    - Updates: Every 2 minutes (120000ms)
 *    - Data: Win probability chart data
 * 
 * 6. /api/tactical-chat (User-triggered)
 *    - Updates: On user question submission
 *    - Data: AI response to tactical questions
 */

const fallbackData = {
    match: {
        title: 'IPL companion',
        team1: 'Team A',
        team2: 'Team B',
        score: '162/5',
        overs: '17.4',
        runRate: '9.18',
        winPercent: 58,
        feedId: 'TF-001'
    },
    insights: [
        {
            label: 'Momentum Shift',
            text: 'Projected target probability moved to 58% after a late surge. Boundary rate ticked up in the last two overs.'
        },
        {
            label: 'Tactical Read',
            text: 'Bowling side shifting to wide-line yorkers with a sweeper out. Batter scoring rate versus wide pace is trending up.'
        }
    ],
    winHistory: {
        team1Peak: 78,
        team2Peak: 64
    },
    matchup: {
        striker: {
            name: 'Striker One',
            role: 'RHB',
            team: 'Team A',
            stats: '42 (30)'
        },
        bowler: {
            name: 'Bowler One',
            role: 'RF',
            team: 'Team B',
            stats: '3.0-0-24-1'
        },
        avgBallSpeed: 143.2,
        avgBallSpeedPercent: 72,
        matchupSR: 118.4,
        matchupSRPercent: 61
    },
    recommendation:
        'Use back-of-length with a deep third to slow the scoring rate outside off.',
    prompt:
        'What is the win probability if the finisher enters now versus after the next over?'
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

const formatInningsScore = (innings) => {
    if (!innings) {
        return null;
    }
    const runs = innings.r ?? innings.runs ?? innings.score;
    const wickets = innings.w ?? innings.wkts ?? innings.wickets;
    if (!Number.isFinite(runs)) {
        return null;
    }
    if (Number.isFinite(wickets)) {
        return `${runs}/${wickets}`;
    }
    return `${runs}`;
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

    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

    const isMatchCompleted = useMemo(() => {
        const primary = liveScores?.matches?.[0];
        if (!primary) {
            return false;
        }

        return Boolean(primary.hideScore || primary.matchEnded || !primary.isLive);
    }, [liveScores]);

    const showActiveMatchup = useMemo(() => {
        if (context?.isLive === true) {
            return true;
        }
        const primary = liveScores?.matches?.[0];
        return Boolean(primary?.isLive);
    }, [context, liveScores]);

    useEffect(() => {
        let isMounted = true;
        let timeoutId = null;

        const scheduleNext = (delayMs) => {
            if (!isMounted) {
                return;
            }
            timeoutId = setTimeout(loadLiveScores, delayMs);
        };

        const loadLiveScores = () => {
            fetch('/api/live-scores')
                .then(res => res.json())
                .then(data => {
                    if (!isMounted) {
                        return;
                    }

                    setLiveScores(data);

                    const primary = data?.matches?.[0];
                    const completed = Boolean(primary?.hideScore || primary?.matchEnded || !primary?.isLive);
                    const delay = completed ? TWO_HOURS_MS : 20000;
                    scheduleNext(delay);
                })
                .catch(() => {
                    scheduleNext(20000);
                });
        };

        loadLiveScores();

        return () => {
            isMounted = false;
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, []);

    // OPTION 1: Fetch insights separately (current approach)
    // Fetch AI insights periodically
    // UPDATED EVERY 2 MINUTES (120 seconds) from /api/insights/live endpoint
    // STOPS POLLING when match is completed (backed off by live score polling)
    useEffect(() => {
        let isMounted = true;
        let interval = null;

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

        if (!isMatchCompleted) {
            loadAiInsights();
            interval = setInterval(loadAiInsights, 120000);
        }

        return () => {
            isMounted = false;
            if (interval) clearInterval(interval);
        };
    }, [isMatchCompleted]);

    // Fetch tactical insights (momentum shift & tactical read) periodically
    // UPDATED EVERY 2 MINUTES (120 seconds) from /api/tactical-insights endpoint
    // STOPS POLLING when match is completed (backed off by live score polling)
    useEffect(() => {
        let isMounted = true;
        let interval = null;

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

        if (!isMatchCompleted) {
            loadTacticalInsights();
            interval = setInterval(loadTacticalInsights, 120000);
        }

        return () => {
            isMounted = false;
            if (interval) clearInterval(interval);
        };
    }, [isMatchCompleted]);

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
    // STOPS POLLING when match is completed (backed off by live score polling)
    useEffect(() => {
        let isMounted = true;
        let interval = null;

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

        if (!isMatchCompleted) {
            loadWinProbabilityHistory();
            interval = setInterval(loadWinProbabilityHistory, 120000);
        }

        return () => {
            isMounted = false;
            if (interval) clearInterval(interval);
        };
    }, [isMatchCompleted]);

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
        const team1Innings = primary.team1?.score || null;
        const team2Innings = primary.team2?.score || null;
        const battingTeam = primary.battingTeam || primary.teams;
        const bowlingTeam = primary.bowlingTeam || primary.opponent;

        // Check if match is completed (hideScore flag or no currentInnings data)
        const isCompleted = primary.hideScore || primary.matchEnded || !primary.isLive;

        // Format the current score - hide for completed matches
        let scoreText = "0/0";
        let oversText = "0";
        let runRate = "0.00";

        if (!isCompleted && currentInnings && Object.keys(currentInnings).length > 0) {
            const runs = currentInnings.r || currentInnings.runs || 0;
            const wickets = currentInnings.w || currentInnings.wickets || 0;
            const overs = currentInnings.o || currentInnings.overs || 0;

            scoreText = `${runs}/${wickets}`;
            oversText = `${overs}`;

            // Calculate run rate
            runRate = overs > 0 ? (runs / parseOversToFloat(overs)).toFixed(2) : "0.00";
        }

        return {
            team1: getTeamShortForm(battingTeam),
            team2: getTeamShortForm(bowlingTeam),
            score: scoreText,
            overs: oversText,
            status: primary.status,
            runRate: runRate,
            isLive: primary.isLive,
            isCompleted: isCompleted,
            description: primary.description,
            venue: primary.venue,
            matchFormat: primary.matchFormat,
            team1Innings,
            team2Innings
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
    const isStatusCompleted = liveScoreSummary?.status &&
        (liveScoreSummary.status.toLowerCase().includes('won') ||
            liveScoreSummary.status.toLowerCase().includes('win'));

    // Extract winner from status
    let winningTeam = null;
    if (isStatusCompleted && liveScoreSummary?.status) {
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

    const completedScoreTeam1 = liveScoreSummary?.isCompleted
        ? formatInningsScore(liveScoreSummary.team1Innings)
        : null;
    const completedScoreTeam2 = liveScoreSummary?.isCompleted
        ? formatInningsScore(liveScoreSummary.team2Innings)
        : null;

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

    if (isStatusCompleted && winningTeam) {
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
    const team1Peak = winProbabilityHistory?.team1Peak || fallbackData.winHistory.team1Peak;
    const team2Peak = winProbabilityHistory?.team2Peak || fallbackData.winHistory.team2Peak;

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
                                {isMatchCompleted
                                    ? (formatStatusWithShortForms(liveScoreSummary?.status) || 'Match Completed')
                                    : (liveScoreSummary?.isLive ? 'Live Match' : 'Latest Match')}
                            </span>
                            <span className="live-feed">Tactical Feed ID: {match.feedId}</span>
                        </div>

                        {/* Only show score for live matches */}
                        {!liveScoreSummary?.isCompleted && (
                            <>
                                <div className="score-row">
                                    <div className="score-team">
                                        {liveMatch.team1} {liveMatch.score}
                                        <span className="score-overs">({liveMatch.overs})</span>
                                    </div>
                                    <div className="score-rate">{liveMatch.runRate}</div>
                                </div>
                            </>
                        )}

                        {/* For completed matches, show team names without score */}
                        {liveScoreSummary?.isCompleted && (
                            <div className="score-row">
                                <div className="score-team">
                                    {liveMatch.team1} {completedScoreTeam1 || '--'}
                                    <span style={{ margin: '0 10px' }}>|</span>
                                    {liveMatch.team2} {completedScoreTeam2 || '--'}
                                </div>
                            </div>
                        )}

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

                        {liveScoreSummary?.status && !isMatchCompleted && (
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

                    {showActiveMatchup && (
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
                    )}
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