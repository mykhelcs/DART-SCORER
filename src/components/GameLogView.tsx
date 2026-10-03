import React, { useState } from 'react';
import { VisitLog } from '../core/types';
import { formatDartLabel } from '../core/checkout';

interface GameLogViewProps {
  logs: VisitLog[];
}

export const GameLogView: React.FC<GameLogViewProps> = ({ logs }) => {
  const [selectedPlayer, setSelectedPlayer] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const uniquePlayers = Array.from(new Set(logs.map((l) => l.playerName)));

  const filteredLogs = logs.filter((log) => {
    if (selectedPlayer === 'all') return true;
    return log.playerName === selectedPlayer;
  });

  const sortedLogs = [...filteredLogs].sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    if (sortOrder === 'desc') {
      return timeB - timeA;
    }
    return timeA - timeB;
  });

  return (
    <div
      style={{
        background: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '8px',
        padding: '16px',
        marginTop: '16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '14px',
          borderBottom: '1px solid #30363d',
          paddingBottom: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h3
            style={{
              margin: 0,
              fontFamily: "'Big Shoulders Display', sans-serif",
              fontSize: '22px',
              letterSpacing: '1px',
              color: '#f0883e',
              textTransform: 'uppercase',
            }}
          >
            Match Round Logs ({logs.length} Rounds)
          </h3>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {uniquePlayers.length > 1 && (
            <select
              value={selectedPlayer}
              onChange={(e) => setSelectedPlayer(e.target.value)}
              style={{
                background: '#0d1117',
                color: '#e6edf3',
                border: '1px solid #30363d',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '13px',
              }}
            >
              <option value="all">All Players</option>
              {uniquePlayers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
            style={{
              background: '#21262d',
              color: '#8b949e',
              border: '1px solid #30363d',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            {sortOrder === 'desc' ? '▼ Newest First' : '▲ Oldest First'}
          </button>
        </div>
      </div>

      {sortedLogs.length === 0 ? (
        <div
          style={{
            padding: '24px',
            textAlign: 'center',
            color: '#8b949e',
            fontSize: '14px',
            fontStyle: 'italic',
          }}
        >
          No round logs recorded yet. Throw darts on the board to track all visit scores!
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxHeight: '400px',
            overflowY: 'auto',
            paddingRight: '4px',
          }}
        >
          {sortedLogs.map((log) => {
            const isHighTon = log.visitTotal >= 100;
            const is180 = log.visitTotal === 180;

            let badgeColor = '#238636';
            let badgeText = `+${log.visitTotal}`;

            if (log.isBust) {
              badgeColor = '#da3633';
              badgeText = 'BUST (0)';
            } else if (log.isCheckout) {
              badgeColor = '#d29922';
              badgeText = `CHECKOUT (${log.visitTotal})`;
            } else if (is180) {
              badgeColor = '#f1e05a';
              badgeText = '★ 180 ★';
            }

            return (
              <div
                key={log.id}
                style={{
                  background: '#0d1117',
                  border: `1px solid ${
                    log.isBust
                      ? '#da363340'
                      : log.isCheckout
                      ? '#d2992260'
                      : isHighTon
                      ? '#23863660'
                      : '#30363d'
                  }`,
                  borderRadius: '6px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                {/* Left side: Leg & Round badges, Player */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '170px' }}>
                  <span
                    style={{
                      background: '#21262d',
                      color: '#8b949e',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontFamily: "'Big Shoulders Display', sans-serif",
                      letterSpacing: '0.5px',
                    }}
                  >
                    LEG {log.leg}
                  </span>
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: '14px',
                      color: '#e6edf3',
                    }}
                  >
                    {log.playerName}
                  </span>
                </div>

                {/* Middle: Thrown Darts */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontFamily: 'monospace',
                    fontSize: '13px',
                  }}
                >
                  {log.darts.map((d, i) => (
                    <span
                      key={i}
                      style={{
                        background: '#161b22',
                        border: '1px solid #30363d',
                        borderRadius: '4px',
                        padding: '3px 7px',
                        color:
                          d.m === 0
                            ? '#8b949e'
                            : d.m === 3
                            ? '#f0883e'
                            : d.m === 2
                            ? '#58a6ff'
                            : '#e6edf3',
                        fontWeight: d.m > 1 ? 600 : 400,
                      }}
                    >
                      {formatDartLabel(d)}
                    </span>
                  ))}
                </div>

                {/* Right: Round Total & Score Progression */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ textAlign: 'right', fontSize: '12px', color: '#8b949e' }}>
                    <span>{log.scoreBefore}</span>
                    <span style={{ margin: '0 4px', color: '#58a6ff' }}>&rarr;</span>
                    <span
                      style={{
                        color: log.isCheckout ? '#3fb950' : '#e6edf3',
                        fontWeight: 600,
                      }}
                    >
                      {log.scoreAfter}
                    </span>
                  </div>

                  <div
                    style={{
                      background: badgeColor,
                      color: is180 ? '#0d1117' : '#ffffff',
                      fontWeight: 700,
                      fontSize: '13px',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      minWidth: '60px',
                      textAlign: 'center',
                      fontFamily: "'Big Shoulders Display', sans-serif",
                      letterSpacing: '0.5px',
                    }}
                  >
                    {badgeText}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
