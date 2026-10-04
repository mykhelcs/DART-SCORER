import React, { useState, useEffect } from 'react';
import { TournamentState, PoolGroup, KnockoutMatch, TournamentFormat } from '../core/types';
import {
  createTournament,
  createChallongeTournament,
  generateKnockoutFromPools,
  calculateStandings,
  areAllPoolMatchesCompleted,
} from '../core/tournament';
import {
  saveTournament,
  loadTournament,
  clearTournament,
  clearCurrentMatch,
} from '../services/storage';
import { exportStandingsToCsv, exportTournamentBracketToPdf, downloadFile } from '../services/export';
import { apiSaveTournament } from '../services/api';
import {
  syncTournamentToMatchesCatalog,
  handleTournamentMatchCompleted,
} from '../services/tournamentSync';
import { createInitialMatchState } from '../core/scoring';
import { BracketPreview } from './BracketPreview';
import { ChallongeBracketView } from './ChallongeBracketView';
import { Toast } from './Toast';

interface TournamentViewProps {
  onLoadMatchForScoring?: (
    player1: string,
    player2: string,
    legsToWin: number,
    onFinish: (p1Legs: number, p2Legs: number) => void,
    matchId?: string,
  ) => void;
}

export const TournamentView: React.FC<TournamentViewProps> = ({ onLoadMatchForScoring }) => {
  const [tournament, setTournament] = useState<TournamentState | null>(() => loadTournament());

  // Setup form states
  const [tourneyName, setTourneyName] = useState('Intramurals Darts Championship');
  const [format, setFormat] = useState<TournamentFormat>('pools_knockout');
  const [playerInput, setPlayerInput] = useState(
    'Alex Carter\nJordan Smith\nSam Taylor\nChris Evans\nPat Morgan\nTaylor Green\nCasey Brooks\nRiley Vance',
  );
  const [poolLegs, setPoolLegs] = useState(2);
  const [semiLegs, setSemiLegs] = useState(3);
  const [finalLegs, setFinalLegs] = useState(5);

  // Active sub-tab: 'pools' | 'bracket'
  const [activeTab, setActiveTab] = useState<'pools' | 'bracket'>('pools');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'good' | 'bad' | 'neutral'>('good');

  const showToast = (msg: string, type: 'good' | 'bad' | 'neutral' = 'good') => {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => setToastMsg(null), 4500);
  };

  useEffect(() => {
    setTournament(loadTournament());
  }, []);

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

    let newTourney: TournamentState;
    if (format === 'challonge_single_elim') {
      newTourney = createChallongeTournament({
        name: tourneyName,
        players,
        legsToWin: poolLegs,
        semiLegsToWin: semiLegs,
        finalLegsToWin: finalLegs,
      });
    } else {
      newTourney = createTournament({
        name: tourneyName,
        players,
        poolLegsToWin: poolLegs,
        koQuarterLegsToWin: poolLegs,
        koSemiLegsToWin: semiLegs,
        koFinalLegsToWin: finalLegs,
      });
    }

    setTournament(newTourney);
    syncTournamentToMatchesCatalog(newTourney).catch(() => {});
    setActiveTab(format === 'challonge_single_elim' ? 'bracket' : 'pools');
    showToast(
      format === 'challonge_single_elim'
        ? 'Challonge bracket created! Matches added to Matches Hub.'
        : 'Tournament created! First round pool matches automatically generated in Matches Hub.',
      'good',
    );
  };

  const handleResetTournament = () => {
    if (window.confirm('Reset this tournament and erase progress?')) {
      clearTournament();
      clearCurrentMatch();
      setTournament(null);
    }
  };

  const handleQuickPoolScore = async (poolId: string, fixtureId: string) => {
    const pool = tournament?.pools.find((p) => p.id === poolId);
    const fix = pool?.fixtures.find((f) => f.id === fixtureId);
    if (!pool || !fix || !tournament) return;

    const deterministicMatchId = `${tournament.id}-${fix.id}`;

    if (onLoadMatchForScoring) {
      onLoadMatchForScoring(
        fix.player1,
        fix.player2,
        fix.legsToWin,
        () => {},
        deterministicMatchId,
      );
      return;
    }

    // Fallback prompt for quick score entry
    const p1Score = prompt(`Legs won by ${fix.player1}:`, `${fix.legsToWin}`);
    if (p1Score === null) return;
    const p2Score = prompt(`Legs won by ${fix.player2}:`, '0');
    if (p2Score === null) return;

    const p1Legs = parseInt(p1Score, 10) || 0;
    const p2Legs = parseInt(p2Score, 10) || 0;

    const matchState = createInitialMatchState({
      playerNames: [fix.player1, fix.player2],
      mode: 501,
      legsToWin: fix.legsToWin,
      doubleOut: true,
    });
    matchState.players[0].legs = p1Legs;
    matchState.players[1].legs = p2Legs;
    matchState.winner = p1Legs > p2Legs ? fix.player1 : p2Legs > p1Legs ? fix.player2 : null;
    matchState.over = !!matchState.winner;

    const res = await handleTournamentMatchCompleted(tournament, deterministicMatchId, matchState);
    setTournament(res.updatedTournament);
    if (res.stageEvent === 'pools_completed') {
      setActiveTab('bracket');
      showToast('🎉 All pool matches complete! Knockout Semifinals are automatically generated.', 'good');
    }
  };

  const handleGenerateBracket = () => {
    if (!tournament) return;
    const updated = generateKnockoutFromPools(tournament);
    setTournament(updated);
    syncTournamentToMatchesCatalog(updated).catch(() => {});
    setActiveTab('bracket');
  };

  const handleScoreKnockoutMatch = async (match: KnockoutMatch) => {
    if (!tournament || match.completed || !match.player1 || !match.player2) return;

    const deterministicMatchId = `${tournament.id}-${match.id}`;

    if (onLoadMatchForScoring) {
      onLoadMatchForScoring(
        match.player1,
        match.player2,
        match.legsToWin,
        () => {},
        deterministicMatchId,
      );
      return;
    }

    const p1Score = prompt(`Legs won by ${match.player1}:`, `${match.legsToWin}`);
    if (p1Score === null) return;
    const p2Score = prompt(`Legs won by ${match.player2}:`, '0');
    if (p2Score === null) return;

    const p1Legs = parseInt(p1Score, 10) || 0;
    const p2Legs = parseInt(p2Score, 10) || 0;

    const matchState = createInitialMatchState({
      playerNames: [match.player1, match.player2],
      mode: 501,
      legsToWin: match.legsToWin,
      doubleOut: true,
    });
    matchState.players[0].legs = p1Legs;
    matchState.players[1].legs = p2Legs;
    matchState.winner = p1Legs > p2Legs ? match.player1 : match.player2;
    matchState.over = !!matchState.winner;

    const res = await handleTournamentMatchCompleted(tournament, deterministicMatchId, matchState);
    setTournament(res.updatedTournament);
    if (res.stageEvent === 'finalists_set') {
      showToast('🏆 Semifinals complete! Championship Final match generated.', 'good');
    } else if (res.stageEvent === 'champion_crowned') {
      showToast(`🎉 Champion Crowned: ${res.updatedTournament.champion}!`, 'good');
    }
  };

  const handleExportPoolCsv = (pool: PoolGroup) => {
    const csv = exportStandingsToCsv(pool);
    downloadFile(csv, `${pool.name.replace(/\s+/g, '_')}_standings.csv`);
  };

  if (!tournament) {
    const parsedPlayers = playerInput
      .split('\n')
      .map((p) => p.trim())
      .filter(Boolean);

    return (
      <div className="card-panel" style={{ maxWidth: '780px', margin: '2vh auto' }}>
        <h2>Create Tournament</h2>
        <p style={{ color: 'var(--muted)' }}>
          Configure your tournament format, players, and match lengths with live bracket preview.
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
            <label>Tournament Bracket Format</label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '12px',
                marginTop: '6px',
              }}
            >
              <button
                type="button"
                className={`btn ${format === 'pools_knockout' ? 'pri' : 'sec'}`}
                style={{
                  padding: '12px 14px',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  border: format === 'pools_knockout' ? '2px solid var(--accent)' : '1px solid var(--line)',
                }}
                onClick={() => setFormat('pools_knockout')}
              >
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>🏁 Round-Robin Pools + Knockout</span>
                <span style={{ fontSize: '0.8rem', opacity: 0.85, lineHeight: 1.3 }}>
                  Groups of 4 round-robin, top 2 advance to single elimination.
                </span>
              </button>

              <button
                type="button"
                className={`btn ${format === 'challonge_single_elim' ? 'pri' : 'sec'}`}
                style={{
                  padding: '12px 14px',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  border: format === 'challonge_single_elim' ? '2px solid var(--accent)' : '1px solid var(--line)',
                }}
                onClick={() => setFormat('challonge_single_elim')}
              >
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>⚡ Challonge Elimination Bracket</span>
                <span style={{ fontSize: '0.8rem', opacity: 0.85, lineHeight: 1.3 }}>
                  Pure tournament tree with seeded bracket pairings & byes.
                </span>
              </button>
            </div>
          </div>

          <div className="f-group">
            <label htmlFor="players">Players (one per line, min 4 players)</label>
            <textarea
              id="players"
              rows={7}
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

          <div style={{ margin: '14px 0 20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 600 }}>
              Live Format Preview ({parsedPlayers.length} Players Entered)
            </label>
            <BracketPreview format={format} players={parsedPlayers} />
          </div>

          <div className="row-grid">
            <div className="f-group">
              <label htmlFor="poolLegs">
                {format === 'challonge_single_elim' ? 'Early Rounds (First to)' : 'Pool Match (First to)'}
              </label>
              <select
                id="poolLegs"
                value={poolLegs}
                onChange={(e) => setPoolLegs(Number(e.target.value))}
              >
                <option value={1}>1 leg (Sudden Death / Fast)</option>
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
                <option value={1}>1 leg</option>
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
              <option value={1}>1 leg</option>
              <option value={2}>2 legs</option>
              <option value={3}>3 legs</option>
              <option value={4}>4 legs</option>
              <option value={5}>5 legs (Standard)</option>
            </select>
          </div>

          <button type="submit" className="btn pri" style={{ width: '100%', marginTop: '10px' }}>
            {format === 'challonge_single_elim'
              ? 'Generate Challonge Elimination Bracket'
              : 'Generate Tournament & Pools'}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>{tournament.name}</h2>
            <span
              style={{
                fontSize: '0.75rem',
                background: tournament.format === 'challonge_single_elim' ? '#1e3a8a' : '#14532d',
                color: '#bfdbfe',
                padding: '2px 8px',
                borderRadius: '12px',
                fontWeight: 600,
              }}
            >
              {tournament.format === 'challonge_single_elim' ? '⚡ Challonge Elimination' : '🏁 Pools & Knockout'}
            </span>
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '2px' }}>
            {tournament.format === 'challonge_single_elim'
              ? `Rounds: First to ${tournament.poolLegsToWin} | Semis: First to ${tournament.koSemiLegsToWin} | Final: First to ${tournament.koFinalLegsToWin}`
              : `Pools: First to ${tournament.poolLegsToWin} | Semis: First to ${tournament.koSemiLegsToWin} | Final: First to ${tournament.koFinalLegsToWin}`}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn"
            style={{ background: '#1e293b', border: '1px solid #475569', color: '#f8fafc' }}
            onClick={() => exportTournamentBracketToPdf(tournament)}
            title="Print or export tournament bracket as PDF"
          >
            📄 Export Tournament PDF
          </button>
          {tournament.format !== 'challonge_single_elim' && (
            <>
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
            </>
          )}
          <button className="btn danger" onClick={handleResetTournament}>
            Reset
          </button>
        </div>
      </div>

      {toastMsg && <Toast message={toastMsg} type={toastType} />}

      {/* Stage Progression Ribbon for Pools + Knockout */}
      {tournament.format !== 'challonge_single_elim' && (() => {
        const poolsDone = areAllPoolMatchesCompleted(tournament);
        const semiMatches = tournament.knockoutMatches.filter((m) => m.round === 'Semi-Final');
        const finalMatch = tournament.knockoutMatches.find((m) => m.round === 'Final');
        const semisDone = semiMatches.length > 0 && semiMatches.every((m) => m.completed);
        const finalDone = !!(finalMatch && finalMatch.completed);

        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--card)',
              borderRadius: '10px',
              padding: '12px 18px',
              marginBottom: '18px',
              border: '1px solid var(--line)',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            {/* Step 1: Pools */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', opacity: poolsDone ? 0.75 : 1 }}>
              <span
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: poolsDone ? '#10b981' : '#3b82f6',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                }}
              >
                {poolsDone ? '✓' : '1'}
              </span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Stage 1: Pool Stage</div>
                <div style={{ fontSize: '0.75rem', color: poolsDone ? '#10b981' : '#60a5fa' }}>
                  {poolsDone ? 'All Fixtures Completed' : 'In Progress (Round-Robin)'}
                </div>
              </div>
            </div>

            <span style={{ color: 'var(--muted)', fontWeight: 'bold' }}>&rarr;</span>

            {/* Step 2: Semifinals */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                opacity: !poolsDone ? 0.45 : semisDone ? 0.75 : 1,
              }}
            >
              <span
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: semisDone ? '#10b981' : poolsDone ? '#3b82f6' : '#475569',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                }}
              >
                {semisDone ? '✓' : '2'}
              </span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Stage 2: Knockout Semifinals</div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: semisDone ? '#10b981' : poolsDone ? '#60a5fa' : 'var(--muted)',
                  }}
                >
                  {semisDone ? 'Finalists Qualified' : poolsDone ? 'In Progress' : 'Awaiting Pool Results'}
                </div>
              </div>
            </div>

            <span style={{ color: 'var(--muted)', fontWeight: 'bold' }}>&rarr;</span>

            {/* Step 3: Championship Final */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                opacity: !semisDone ? 0.45 : finalDone ? 0.75 : 1,
              }}
            >
              <span
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: finalDone ? '#10b981' : semisDone ? '#3b82f6' : '#475569',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                }}
              >
                {finalDone ? '✓' : '3'}
              </span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Stage 3: Championship Final</div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: finalDone ? '#10b981' : semisDone ? '#60a5fa' : 'var(--muted)',
                  }}
                >
                  {finalDone ? 'Champion Crowned' : semisDone ? 'Championship Match Ready' : 'Awaiting Semifinals'}
                </div>
              </div>
            </div>

            {tournament.champion && (
              <>
                <span style={{ color: 'var(--muted)', fontWeight: 'bold' }}>&rarr;</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.3rem' }}>🏆</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--brass)' }}>
                      {tournament.champion}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--brass)' }}>Champion!</div>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })()}

      {tournament.format === 'challonge_single_elim' ? (
        <ChallongeBracketView
          tournament={tournament}
          onUpdateTournament={setTournament}
          onLoadMatchForScoring={onLoadMatchForScoring}
        />
      ) : (
        <>
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
        </>
      )}
    </div>
  );
};
