import React, { useState } from 'react';
import { MatchState } from '../core/types';
import { formatDartLabel } from '../core/checkout';
import { exportMatchReportToPdf, exportGameLogsToCsv, downloadFile } from '../services/export';

interface PostGameReportModalProps {
  match: MatchState;
  onClose: () => void;
  onNewMatch?: () => void;
}

export const PostGameReportModal: React.FC<PostGameReportModalProps> = ({
  match,
  onClose,
  onNewMatch,
}) => {
  const [selectedPlayer, setSelectedPlayer] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const logs = match.logs || [];
  const uniquePlayers = Array.from(new Set(logs.map((l) => l.playerName)));

  const filteredLogs = logs.filter((l) => {
    if (selectedPlayer === 'all') return true;
    return l.playerName === selectedPlayer;
  });

  const sortedLogs = [...filteredLogs].sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
  });

  const handleExportPdf = () => {
    exportMatchReportToPdf(match);
  };

  const handleExportCsv = () => {
    if (logs.length === 0) {
      alert('No round logs recorded to export.');
      return;
    }
    const csv = exportGameLogsToCsv(logs);
    downloadFile(csv, `darts_match_logs_${Date.now()}.csv`);
  };

  const winner = match.winner || 'Winner';

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      style={{
        zIndex: 1000,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto',
      }}
    >
      <div
        className="modal-card"
        style={{
          maxWidth: '820px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          textAlign: 'left',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ borderBottom: '1px solid #30363d', paddingBottom: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ color: '#f0883e', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Match Summary & Official Records
              </div>
              <h2 style={{ margin: '4px 0', fontSize: '26px', color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: '10px' }}>
                🏆 {winner} Wins!
              </h2>
              <div style={{ color: '#8b949e', fontSize: '13px' }}>
                {match.mode} {match.doubleOut ? 'Double-Out' : 'Single-Out'} &bull; First to {match.legsToWin} legs &bull; Total visits: {logs.length}
              </div>
            </div>

            {/* Top action buttons */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                className="btn pri"
                onClick={handleExportPdf}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '7px 14px' }}
              >
                📄 Export PDF
              </button>
              <button
                className="btn sec"
                onClick={handleExportCsv}
                style={{ fontSize: '13px', padding: '7px 12px' }}
              >
                Export CSV
              </button>
              <button
                className="btn sec"
                onClick={onClose}
                style={{ fontSize: '13px', padding: '7px 12px' }}
              >
                ✕ Close
              </button>
            </div>
          </div>

          {/* Final Leg Score Tally */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '14px', flexWrap: 'wrap' }}>
            {match.players.map((p) => {
              const isWinner = p.name === match.winner;
              return (
                <div
                  key={p.name}
                  style={{
                    background: isWinner ? 'rgba(35, 134, 54, 0.2)' : '#0d1117',
                    border: `1px solid ${isWinner ? '#238636' : '#30363d'}`,
                    padding: '8px 14px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <span style={{ fontWeight: 600, color: isWinner ? '#3fb950' : '#c9d1d9' }}>{p.name}</span>
                  <span
                    style={{
                      background: isWinner ? '#238636' : '#21262d',
                      color: '#ffffff',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '13px',
                    }}
                  >
                    {p.legs} {p.legs === 1 ? 'Leg' : 'Legs'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scrollable content: Stats & Logs */}
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
          {/* Player Statistics Table */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '15px', color: '#58a6ff', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Player Performance Summary
            </h3>
            <div style={{ overflowX: 'auto', border: '1px solid #30363d', borderRadius: '6px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#21262d', borderBottom: '1px solid #30363d', color: '#8b949e' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Player</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Legs</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Darts</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Points</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', color: '#58a6ff' }}>3-Dart Avg</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>High</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>100+</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>140+</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', color: '#f0883e' }}>180s</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', color: '#3fb950' }}>Best Out</th>
                  </tr>
                </thead>
                <tbody>
                  {match.players.map((p) => {
                    const avg = p.darts ? ((p.points / p.darts) * 3).toFixed(1) : '0.0';
                    return (
                      <tr key={p.name} style={{ borderBottom: '1px solid #21262d' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: '#f0f6fc' }}>{p.name}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>{p.legs}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>{p.darts}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>{p.points}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#58a6ff' }}>{avg}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>{p.high}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>{p.ton}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>{p.t40}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#f0883e' }}>{p.one80}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, color: '#3fb950' }}>{p.bestOut || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Complete Round Logs Header & Filter */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <h3 style={{ fontSize: '15px', color: '#58a6ff', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Complete Round Logs ({sortedLogs.length} of {logs.length} Rounds)
              </h3>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                      fontSize: '12px',
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
                  onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
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
                  {sortOrder === 'asc' ? '▲ Chronological (1 &rarr; N)' : '▼ Newest First'}
                </button>
              </div>
            </div>

            {/* List of Round Logs */}
            {sortedLogs.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#8b949e', fontStyle: 'italic', background: '#0d1117', borderRadius: '6px' }}>
                No round visit logs recorded.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {sortedLogs.map((log, index) => {
                  let badgeBg = '#238636';
                  let badgeText = `+${log.visitTotal}`;

                  if (log.isBust) {
                    badgeBg = '#da3633';
                    badgeText = 'BUST (0)';
                  } else if (log.isCheckout) {
                    badgeBg = '#d29922';
                    badgeText = `CHECKOUT (${log.visitTotal})`;
                  } else if (log.visitTotal === 180) {
                    badgeBg = '#f1e05a';
                    badgeText = '★ 180 ★';
                  }

                  return (
                    <div
                      key={log.id || index}
                      style={{
                        background: '#0d1117',
                        border: `1px solid ${
                          log.isBust
                            ? 'rgba(218, 54, 51, 0.4)'
                            : log.isCheckout
                            ? 'rgba(210, 153, 34, 0.5)'
                            : log.visitTotal >= 100
                            ? 'rgba(35, 134, 54, 0.4)'
                            : '#30363d'
                        }`,
                        borderRadius: '6px',
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '8px',
                        fontSize: '13px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ background: '#21262d', color: '#8b949e', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                          LEG {log.leg}
                        </span>
                        <span style={{ fontWeight: 600, color: '#f0f6fc' }}>{log.playerName}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'monospace' }}>
                        {log.darts.map((d, i) => (
                          <span
                            key={i}
                            style={{
                              background: '#161b22',
                              border: '1px solid #30363d',
                              borderRadius: '4px',
                              padding: '2px 6px',
                              color: d.m === 3 ? '#f0883e' : d.m === 2 ? '#58a6ff' : d.m === 0 ? '#8b949e' : '#e6edf3',
                              fontWeight: d.m > 1 ? 600 : 400,
                            }}
                          >
                            {formatDartLabel(d)}
                          </span>
                        ))}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ textAlign: 'right', fontSize: '12px', color: '#8b949e' }}>
                          <span>{log.scoreBefore}</span>
                          <span style={{ margin: '0 4px', color: '#58a6ff' }}>&rarr;</span>
                          <span style={{ fontWeight: 700, color: log.isCheckout ? '#3fb950' : '#f0f6fc' }}>{log.scoreAfter}</span>
                        </div>

                        <span
                          style={{
                            background: badgeBg,
                            color: log.visitTotal === 180 ? '#0d1117' : '#ffffff',
                            fontWeight: 700,
                            fontSize: '12px',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            minWidth: '55px',
                            textAlign: 'center',
                          }}
                        >
                          {badgeText}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #30363d', paddingTop: '16px', marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          {onNewMatch && (
            <button className="btn sec" onClick={onNewMatch}>
              Start New Match
            </button>
          )}
          <button className="btn pri" onClick={handleExportPdf}>
            Print / Save PDF
          </button>
        </div>
      </div>
    </div>
  );
};
