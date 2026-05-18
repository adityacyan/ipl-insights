import React, { useState, useEffect } from 'react';

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

const PlayoffPredictor = ({ match }) => {
  const [scenario, setScenario] = useState(null); // null = current, 'team1' = team1 wins, etc
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    let url = '/api/probabilities';
    if (scenario) {
      url += `?winner=${scenario}`;
    }
    fetch(url)
      .then(res => res.json())
      .then(data => setTeams(data))
      .catch(err => console.error(err));
  }, [scenario]);

  return (
    <div>
      <div className="scenario-toggles">
        <button
          className={`toggle-btn ${scenario === match.team1 ? 'active' : ''}`}
          onClick={() => setScenario(scenario === match.team1 ? null : match.team1)}
        >
          If {getTeamShortForm(match.team1)} Wins
        </button>
        <button
          className={`toggle-btn ${scenario === match.team2 ? 'active' : ''}`}
          onClick={() => setScenario(scenario === match.team2 ? null : match.team2)}
        >
          If {getTeamShortForm(match.team2)} Wins
        </button>
      </div>

      <table className="prob-table">
        <thead>
          <tr>
            <th>Team</th>
            <th>Pts</th>
            <th>Playoff %</th>
          </tr>
        </thead>
        <tbody>
          {teams.map(team => {
            const diff = team.projectedProb - team.baseProb;
            return (
              <tr key={team.id}>
                <td className="team-name">{team.id}</td>
                <td>{team.points}</td>
                <td>
                  <span className="prob-value">{team.projectedProb}%</span>
                  {scenario && diff !== 0 && (
                    <span className={`prob-change ${diff > 0 ? 'up' : 'down'}`}>
                      {diff > 0 ? '▲' : '▼'} {Math.abs(diff)}%
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  );
};

export default PlayoffPredictor;
