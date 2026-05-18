import React from 'react';

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

const PlayerInsights = ({ player }) => {
  return (
    <div>
      <div className="player-card">
        <img src={player.image} alt={player.name} className="player-image" onError={(e) => { e.target.src = 'https://via.placeholder.com/80/334155/FFFFFF?text=' + player.name[0] }} />
        <div className="player-info">
          <h3>{player.name}</h3>
          <span className="player-role">{getTeamShortForm(player.team)} • {player.role}</span>
        </div>
      </div>

      <div className="milestones-list">
        {player.milestones.map((m, idx) => {
          const percent = Math.min(100, (m.current / m.threshold) * 100);
          const remaining = m.threshold - m.current;
          return (
            <div key={idx} className="milestone-item">
              <div className="milestone-header">
                <span>{m.name}</span>
                <span className="milestone-target">{m.threshold} {m.unit}</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${percent}%` }}></div>
              </div>
              <div className="distance">
                Needs <strong>{remaining}</strong> more {m.unit.toLowerCase()}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
};

export default PlayerInsights;
