import React, { useState, useEffect } from 'react';
import '../LiveReactions.css';

const REACTIONS = [
  { icon: '🔥', text: 'On Fire!' },
  { icon: '😱', text: 'Unbelievable' },
  { icon: '👏', text: 'Great Shot' },
  { icon: '☝️', text: 'WICKET!' }
];

const LiveReactions = () => {
  const [floatingItems, setFloatingItems] = useState([]);

  // Simulate incoming reactions from other users
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.5) {
        const randomReaction = REACTIONS[Math.floor(Math.random() * REACTIONS.length)];
        spawnReaction(randomReaction, false);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const spawnReaction = (reaction, isMe) => {
    const id = Date.now() + Math.random();
    const newItem = {
      id,
      ...reaction,
      isMe,
      leftOffset: Math.random() * 40 - 20 // random horizontal offset
    };
    
    setFloatingItems(prev => [...prev, newItem]);

    // Remove after animation completes
    setTimeout(() => {
      setFloatingItems(prev => prev.filter(item => item.id !== id));
    }, 3000);
  };

  return (
    <div className="live-reactions-container">
      <div className="floating-area">
        {floatingItems.map(item => (
          <div 
            key={item.id} 
            className={`floating-item ${item.isMe ? 'is-me' : ''}`}
            style={{ marginLeft: `${item.leftOffset}px` }}
          >
            <span className="reaction-icon">{item.icon}</span>
            <span className="reaction-text">{item.text}</span>
          </div>
        ))}
      </div>
      
      <div className="reaction-buttons">
        {REACTIONS.map((r, idx) => (
          <button 
            key={idx} 
            className="reaction-btn"
            onClick={() => spawnReaction(r, true)}
          >
            {r.icon}
          </button>
        ))}
      </div>
    </div>
  );
};

export default LiveReactions;
