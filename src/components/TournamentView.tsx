import React, { useState, useEffect } from 'react';
import { TournamentState, PoolGroup, KnockoutMatch } from '../core/types';
import {
  createTournament,
  recordPoolMatchResult,
  generateKnockoutFromPools,
  recordKnockoutMatchResult,
  calculateStandings,
} from '../core/tournament';
import { saveTournament, loadTournament, clearTournament } from '../services/storage';
import { exportStandingsToCsv, downloadFile } from '../services/export';
import { apiSaveTournament } from '../services/api';

interface TournamentViewProps {
  onLoadMatchForScoring?: (
    player1: string,
    player2: string,
    legsToWin: number,
    onFinish: (p1Legs: number, p2Legs: number) => void,
  ) => void;
}

export const TournamentView: React.FC<TournamentViewProps> = ({ onLoadMatchForScoring }) => {
  const [tournament, setTournament] = useState<TournamentState | null>(() => loadTournament());

  // Setup form states
  const [tourneyName, setTourneyName] = useState('Intramurals Darts Championship');
  const [playerInput, setPlayerInput] = useState(
    'Alex Carter\nJordan Smith\nSam Taylor\nChris Evans\nPat Morgan\nTaylor Green\nCasey Brooks\nRiley Vance',
  );
  const [poolLegs, setPoolLegs] = useState(2);
  const [semiLegs, setSemiLegs] = useState(3);
  const [finalLegs, setFinalLegs] = useState(5);

  // Active sub-tab: 'pools' | 'bracket'
  const [activeTab, setActiveTab] = useState<'pools' | 'bracket'>('pools');

  useEffect(() => {
    if (tournament) {
      saveTournament(tournament);
      apiSaveTournament(tournament).catch(() => {});
    }
  }, [tournament]);

  const handleCreateTournament = (e: React.FormEvent) => {
    e.preventDefault();
    const players = playerInput
      .split('\n')
      .map((p) => p.trim())
      .filter(Boolean);

    if (players.length < 4) {
      alert('Please enter at least 4 players.');
      return;
    }

    const newTourney = createTournament({
      name: tourneyName,
      players,
      poolLegsToWin: poolLegs,
      koSemiLegsToWin: semiLegs,
      koFinalLegsToWin: finalLegs,
    });

    setTournament(newTourney);
    setActiveTab('pools');
  };

  const handleResetTournament = () => {
    if (window.confirm('Reset this tournament and erase progress?')) {
      clearTournament();
      setTournament(null);
    }
  };

  const handleQuickPoolScore = (poolId: string, fixtureId: string) => {
    const pool = tournament?.pools.find((p) => p.id === poolId);
    const fix = pool?.fixtures.find((f) => f.id === fixtureId);
    if (!pool || !fix || !tournament) return;

    if (onLoadMatchForScoring) {
      onLoadMatchForScoring(fix.player1, fix.player2, fix.legsToWin, (p1Legs, p2Legs) => {
        const updated = recordPoolMatchResult(tournament, poolId, fixtureId, {
          player1Legs: p1Legs,
          player2Legs: p2Legs,
        });
        setTournament(updated);
      });
      return;
    }

    // Fallback prompt for quick score entry
    const p1Score = prompt(`Legs won by ${fix.player1}:`, `${fix.legsToWin}`);
    if (p1Score === null) return;
    const p2Score = prompt(`Legs won by ${fix.player2}:`, '0');
    if (p2Score === null) return;

    const updated = recordPoolMatchResult(tournament, poolId, fixtureId, {
      player1Legs: parseInt(p1Score, 10) || 0,
      player2Legs: parseInt(p2Score, 10) || 0,
    });
    setTournament(updated);
  };

  const handleGenerateBracket = () => {
    if (!tournament) return;
    const updated = generateKnockoutFromPools(tournament);
    setTournament(updated);
    setActiveTab('bracket');
  };

  const handleScoreKnockoutMatch = (match: KnockoutMatch) => {
    if (!tournament || match.completed || !match.player1 || !match.player2) return;

    if (onLoadMatchForScoring) {
      onLoadMatchForScoring(match.player1, match.player2, match.legsToWin, (p1Legs, p2Legs) => {
        const updated = recordKnockoutMatchResult(tournament, match.id, {
          player1Legs: p1Legs,
          player2Legs: p2Legs,
        });
        setTournament(updated);
      });
      return;
    }

    const p1Score = prompt(`Legs won by ${match.player1}:`, `${match.legsToWin}`);
    if (p1Score === null) return;
    const p2Score = prompt(`Legs won by ${match.player2}:`, '0');
    if (p2Score === null) return;

    const updated = recordKnockoutMatchResult(tournament, match.id, {
      player1Legs: parseInt(p1Score, 10) || 0,
      player2Legs: parseInt(p2Score, 10) || 0,
    });
    setTournament(updated);
  };

  const handleExportPoolCsv = (pool: PoolGroup) => {
    const csv = exportStandingsToCsv(pool);
    downloadFile(csv, `${pool.name.replace(/\s+/g, '_')}_standings.csv`);
  };

  if (!tournament) {
    return (
      <div className="card-panel" style={{ maxWidth: '640px', margin: '2vh auto' }}>
        <h2>Create Tournament</h2>
        <p style={{ color: 'var(--muted)' }}>
          Set up round-robin pools of 4 players, top 2 advance to single-elimination knockout.
        </p>

        <form onSubmit={handleCreateTournament}>
          <div className="f-group">
            <label htmlFor="tname">Tournament Name</label>
            <input
              type="text"
              id="tname"
              value={tourneyName}
              onChange={(e) => setTourneyName(e.target.value)}
              required
            />
          </div>

          <div className="f-group">
            <label htmlFor="players">Players (one per line, min 4 players)</label>
            <textarea
              id="players"
              rows={8}
              value={playerInput}
              onChange={(e) => setPlayerInput(e.target.value)}
              style={{
                background: 'var(--ink)',
                border: '2px solid var(--line)',
                borderRadius: '8px',
                padding: '10px',
                color: 'var(--cream)',
                width: '100%',
                fontFamily: 'monospace',
                fontSize: '0.95rem',
              }}
              required
            />
          </div>

          <div className="row-grid">
            <div className="f-group">
              <label htmlFor="poolLegs">Pool Match (First to)</label>
              <select
                id="poolLegs"
                value={poolLegs}
                onChange={(e) => setPoolLegs(Number(e.target.value))}
              >
                <option value={2}>2 legs (First to 2)</option>
                <option value={3}>3 legs (First to 3)</option>
              </select>
            </div>

            <div className="f-group">
              <label htmlFor="semiLegs">Semis (First to)</label>
              <select
                id="semiLegs"
                value={semiLegs}
                onChange={(e) => setSemiLegs(Number(e.target.value))}
              >
                <option value={2}>2 legs</option>
                <option value={3}>3 legs</option>
                <option value={4}>4 legs</option>
              </select>
            </div>
          </div>

          <div className="f-group">
            <label htmlFor="finalLegs">Final (First to)</label>
            <select
              id="finalLegs"
              value={finalLegs}
              onChange={(e) => setFinalLegs(Number(e.target.value))}
            >
              <option value={3}>3 legs</option>
              <option value={4}>4 legs</option>
              <option value={5}>5 legs (Standard)</option>
            </select>
          </div>

          <button type="submit" className="btn pri" style={{ width: '100%', marginTop: '10px' }}>
            Generate Tournament & Pools
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>{tournament.name}</h2>
          <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
            Pools: First to {tournament.poolLegsToWin} | Semis: First to {tournament.koSemiLegsToWin} |
            Final: First to {tournament.koFinalLegsToWin}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`btn ${activeTab === 'pools' ? 'pri' : 'sec'}`}
            onClick={() => setActiveTab('pools')}
          >
            Pools & Fixtures
          </button>
          <button
            className={`btn ${activeTab === 'bracket' ? 'pri' : 'sec'}`}
            onClick={() => setActiveTab('bracket')}
          >
            Knockout Bracket
          </button>
          <button className="btn danger" onClick={handleResetTournament}>
            Reset
          </button>
        </div>
      </div>

      {tournament.champion && (
        <div
          className="card-panel"
          style={{
            borderColor: 'var(--brass)',
            textAlign: 'center',
            marginBottom: '20px',
            background: 'linear-gradient(180deg, #153d35 0%, #102d26 100%)',
          }}
        >
          <h1 style={{ color: 'var(--brass)', margin: '0 0 6px', fontSize: '3rem' }}>
            🏆 TOURNAMENT CHAMPION 🏆
          </h1>
          <h2 style={{ fontSize: '2.5rem', margin: 0 }}>{tournament.champion}</h2>
        </div>
      )}

      {activeTab === 'pools' && (
        <div style={{ display: 'grid', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn pri" onClick={handleGenerateBracket}>
              Generate / Update Knockout Bracket &rarr;
            </button>
          </div>

          {tournament.pools.map((pool) => {
            const standings = calculateStandings(pool);

            return (
              <div key={pool.id} className="card-panel">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px',
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: '1.8rem' }}>{pool.name}</h3>
                  <button className="btn sec" onClick={() => handleExportPoolCsv(pool)}>
                    Export CSV
                  </button>
                </div>

                <div className="table-wrap">
                  <table className="standings-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Player</th>
                        <th>Played</th>
                        <th>Won</th>
                        <th>Lost</th>
                        <th>Legs +/-</th>
                        <th>Leg Diff</th>
                        <th>3-Dart Avg</th>
                        <th>High Out</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((p, idx) => (
                        <tr key={p.name} className={idx < 2 ? 'top2' : ''}>
                          <td>
                            {idx + 1}
                            {idx < 2 && (
                              <span
                                style={{
                                  marginLeft: '6px',
                                  fontSize: '0.75rem',
                                  color: 'var(--brass)',
                                  fontWeight: 800,
                                }}
                              >
                                ADVANCE
                              </span>
                            )}
                          </td>
                          <td>
                            <strong>{p.name}</strong>
                          </td>
                          <td>{p.played}</td>
                          <td>{p.wins}</td>
                          <td>{p.losses}</td>
                          <td>
                            {p.legsFor} - {p.legsAgainst}
                          </td>
                          <td style={{ color: p.legDiff > 0 ? '#48c78e' : p.legDiff < 0 ? '#ff857a' : 'inherit' }}>
                            {p.legDiff > 0 ? `+${p.legDiff}` : p.legDiff}
                          </td>
                          <td>{p.threeDartAvg.toFixed(1)}</td>
                          <td>{p.highFinish || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <h4 style={{ margin: '20px 0 10px', color: 'var(--muted)' }}>Pool Fixtures</h4>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: '10px',
                  }}
                >
                  {pool.fixtures.map((fix) => (
                    <div
                      key={fix.id}
                      className="match-box"
                      style={{
                        borderColor: fix.played ? 'var(--green)' : 'var(--line)',
                        background: fix.played ? 'rgba(42, 138, 92, 0.15)' : 'var(--baize2)',
                      }}
                    >
                      <div className="match-box-player">
                        <span className={fix.winner === fix.player1 ? 'winner' : ''}>
                          {fix.player1}
                        </span>
                        <span>{fix.player1Score ?? '-'}</span>
                      </div>
                      <div className="match-box-player">
                        <span className={fix.winner === fix.player2 ? 'winner' : ''}>
                          {fix.player2}
                        </span>
                        <span>{fix.player2Score ?? '-'}</span>
                      </div>

                      <button
                        className="btn"
                        style={{ width: '100%', marginTop: '8px', minHeight: '36px' }}
                        onClick={() => handleQuickPoolScore(pool.id, fix.id)}
                      >
                        {fix.played ? 'Re-Score Match' : 'Score Match'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'bracket' && (
        <div className="card-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.8rem' }}>Knockout Stage</h3>
            {tournament.knockoutMatches.length === 0 && (
              <button className="btn pri" onClick={handleGenerateBracket}>
                Generate Bracket From Pools
              </button>
            )}
          </div>

          {tournament.knockoutMatches.length === 0 ? (
            <p style={{ color: 'var(--muted)', marginTop: '16px' }}>
              No bracket generated yet. Play pool fixtures first and click "Generate / Update Knockout Bracket".
            </p>
          ) : (
            <div className="bracket-tree">
              {['Quarter-Final', 'Semi-Final', 'Final'].map((roundName) => {
                const roundMatches = tournament.knockoutMatches.filter(
                  (m) => m.round === roundName,
                );
                if (roundMatches.length === 0) return null;

                return (
                  <div key={roundName} className="round-col">
                    <h4 style={{ margin: '0 0 14px', textAlign: 'center', color: 'var(--brass)' }}>
                      {roundName}
                    </h4>

                    {roundMatches.map((m) => (
                      <div
                        key={m.id}
                        className={`match-box ${m.completed ? 'completed' : ''}`}
                      >
                        <div
                          style={{
                            fontSize: '0.8rem',
                            color: 'var(--muted)',
                            marginBottom: '4px',
                          }}
                        >
                          Match {m.matchNumber} (First to {m.legsToWin})
                        </div>

                        <div
                          className={`match-box-player ${
                            m.winner === m.player1 && m.player1 ? 'winner' : ''
                          }`}
                        >
                          <span>{m.player1 || 'TBD'}</span>
                          <span>{m.completed ? m.player1Legs : '-'}</span>
                        </div>

                        <div
                          className={`match-box-player ${
                            m.winner === m.player2 && m.player2 ? 'winner' : ''
                          }`}
                        >
                          <span>{m.player2 || 'TBD'}</span>
                          <span>{m.completed ? m.player2Legs : '-'}</span>
                        </div>

                        {m.player1 && m.player2 && (
                          <button
                            className="btn"
                            style={{ width: '100%', marginTop: '8px', minHeight: '34px' }}
                            onClick={() => handleScoreKnockoutMatch(m)}
                          >
                            {m.completed ? 'Edit Result' : 'Score Match'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
