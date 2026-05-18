import React from 'react';

const WinProbabilityChart = ({ data, team1Name, team2Name }) => {
    if (!data || !data.dataPoints || data.dataPoints.length === 0) {
        return (
            <div className="probability-chart">
                <div className="chart-header">
                    <div className="team-legend">
                        <div className="legend-item">
                            <div className="legend-color team1"></div>
                            <span>{team1Name}</span>
                        </div>
                        <div className="legend-item">
                            <div className="legend-color team2"></div>
                            <span>{team2Name}</span>
                        </div>
                    </div>
                </div>

                <div className="chart-container">
                    <div className="y-axis">
                        <span>100%</span>
                        <span>75%</span>
                        <span>50%</span>
                        <span>25%</span>
                        <span>0%</span>
                    </div>

                    <div className="chart-area">
                        <div className="grid-lines">
                            <div className="grid-line"></div>
                            <div className="grid-line"></div>
                            <div className="grid-line"></div>
                            <div className="grid-line"></div>
                        </div>

                        <svg viewBox="0 0 280 100" className="probability-svg">
                            {/* Demo lines */}
                            <polyline
                                points="0,50 70,40 140,60 210,45 280,50"
                                fill="none"
                                stroke="#4285f4"
                                strokeWidth="3"
                                strokeLinecap="round"
                            />
                            <polyline
                                points="0,50 70,60 140,40 210,55 280,50"
                                fill="none"
                                stroke="#ea4335"
                                strokeWidth="3"
                                strokeLinecap="round"
                            />

                            {/* Demo points */}
                            <circle cx="0" cy="50" r="4" fill="#4285f4" stroke="white" strokeWidth="2" />
                            <circle cx="70" cy="40" r="4" fill="#4285f4" stroke="white" strokeWidth="2" />
                            <circle cx="140" cy="60" r="4" fill="#4285f4" stroke="white" strokeWidth="2" />
                            <circle cx="210" cy="45" r="4" fill="#4285f4" stroke="white" strokeWidth="2" />
                            <circle cx="280" cy="50" r="4" fill="#4285f4" stroke="white" strokeWidth="2" />

                            <circle cx="0" cy="50" r="4" fill="#ea4335" stroke="white" strokeWidth="2" />
                            <circle cx="70" cy="60" r="4" fill="#ea4335" stroke="white" strokeWidth="2" />
                            <circle cx="140" cy="40" r="4" fill="#ea4335" stroke="white" strokeWidth="2" />
                            <circle cx="210" cy="55" r="4" fill="#ea4335" stroke="white" strokeWidth="2" />
                            <circle cx="280" cy="50" r="4" fill="#ea4335" stroke="white" strokeWidth="2" />
                        </svg>
                    </div>
                </div>

                <div className="x-axis">
                    <span>Over 0</span>
                    <span>5</span>
                    <span>10</span>
                    <span>15</span>
                    <span>20</span>
                </div>
            </div>
        );
    }

    const maxOver = Math.max(...data.dataPoints.map(d => d.over));

    return (
        <div className="probability-chart">
            <div className="chart-header">
                <div className="team-legend">
                    <div className="legend-item">
                        <div className="legend-color team1"></div>
                        <span>{team1Name}</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-color team2"></div>
                        <span>{team2Name}</span>
                    </div>
                </div>
            </div>

            <div className="chart-container">
                <div className="y-axis">
                    <span>100%</span>
                    <span>75%</span>
                    <span>50%</span>
                    <span>25%</span>
                    <span>0%</span>
                </div>

                <div className="chart-area">
                    <div className="grid-lines">
                        <div className="grid-line"></div>
                        <div className="grid-line"></div>
                        <div className="grid-line"></div>
                        <div className="grid-line"></div>
                    </div>

                    <svg viewBox="0 0 280 100" className="probability-svg">
                        {/* Team 1 line */}
                        <polyline
                            points={data.dataPoints.map(p => `${(p.over / maxOver) * 280},${100 - p.team1Prob}`).join(' ')}
                            fill="none"
                            stroke="#4285f4"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />

                        {/* Team 2 line */}
                        <polyline
                            points={data.dataPoints.map(p => `${(p.over / maxOver) * 280},${100 - p.team2Prob}`).join(' ')}
                            fill="none"
                            stroke="#ea4335"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />

                        {/* Data points */}
                        {data.dataPoints.map((point, index) => (
                            <g key={index}>
                                <circle
                                    cx={(point.over / maxOver) * 280}
                                    cy={100 - point.team1Prob}
                                    r="4"
                                    fill="#4285f4"
                                    stroke="white"
                                    strokeWidth="2"
                                />
                                <circle
                                    cx={(point.over / maxOver) * 280}
                                    cy={100 - point.team2Prob}
                                    r="4"
                                    fill="#ea4335"
                                    stroke="white"
                                    strokeWidth="2"
                                />

                                {/* Value labels on hover */}
                                <text
                                    x={(point.over / maxOver) * 280}
                                    y={100 - point.team1Prob - 8}
                                    fill="#4285f4"
                                    fontSize="10"
                                    textAnchor="middle"
                                    className="value-label"
                                >
                                    {point.team1Prob}%
                                </text>
                                <text
                                    x={(point.over / maxOver) * 280}
                                    y={100 - point.team2Prob + 15}
                                    fill="#ea4335"
                                    fontSize="10"
                                    textAnchor="middle"
                                    className="value-label"
                                >
                                    {point.team2Prob}%
                                </text>
                            </g>
                        ))}
                    </svg>
                </div>
            </div>

            <div className="x-axis">
                <span>Over 0</span>
                <span>{Math.floor(maxOver * 0.25)}</span>
                <span>{Math.floor(maxOver * 0.5)}</span>
                <span>{Math.floor(maxOver * 0.75)}</span>
                <span>{maxOver}</span>
            </div>
        </div>
    );
};

export default WinProbabilityChart;