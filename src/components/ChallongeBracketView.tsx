import React from 'react';
import { TournamentState, ChallongeMatch } from '../core/types';
import { recordChallongeMatchResult } from '../core/tournament';

import { syncTournamentToMatchesCatalog } from '../services/tournamentSync';

interface ChallongeBracketViewProps {
  tournament: TournamentState;
  onUpdateTournament: (updated: TournamentState) => void;
  onLoadMatchForScoring?: (
    player1: string,
    player2: string,
    legsToWin: number,
    onFinish: (p1Legs: number, p2Legs: number) => void,
    matchId?: string,
  ) => void;
}

export const ChallongeBracketView: React.FC<ChallongeBracketViewProps> = ({
  tournament,
  onUpdateTournament,
  onLoadMatchForScoring,
}) => {
  const matches = tournament.challongeMatches || [];

  // Group matches by roundIndex
  const roundsMap = new Map<number, ChallongeMatch[]>();
  for (const m of matches) {
    if (!roundsMap.has(m.roundIndex)) {
      roundsMap.set(m.roundIndex, []);
    }
    roundsMap.get(m.roundIndex)!.push(m);
  }

  const sortedRoundIndices = Array.from(roundsMap.keys()).sort((a, b) => a - b);

  const handleScoreMatch = (match: ChallongeMatch) => {
    if (!match.player1 || !match.player2 || match.completed) return;
    const matchId = `${tournament.id}-${match.id}`;

    if (onLoadMatchForScoring) {
      onLoadMatchForScoring(match.player1, match.player2, match.legsToWin, () => {}, matchId);
      return;
    }

    // Quick score prompt fallback
    const p1 = prompt(`Legs won by ${match.player1}:`, `${match.legsToWin}`);
    if (p1 === null) return;
    const p2 = prompt(`Legs won by ${match.player2}:`, '0');
    if (p2 === null) return;

    const updated = recordChallongeMatchResult(
      tournament,
      match.id,
      parseInt(p1, 10) || 0,
      parseInt(p2, 10) || 0,
    );
    onUpdateTournament(updated);
    syncTournamentToMatchesCatalog(updated).catch(() => {});
  };

  const handleQuickManualResult = (match: ChallongeMatch, winner: 1 | 2) => {
    const p1Legs = winner === 1 ? match.legsToWin : 0;
    const p2Legs = winner === 2 ? match.legsToWin : 0;
    const updated = recordChallongeMatchResult(tournament, match.id, p1Legs, p2Legs);
    onUpdateTournament(updated);
    syncTournamentToMatchesCatalog(updated).catch(() => {});
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Champion Banner */}
      {tournament.champion && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.25), rgba(245, 158, 11, 0.1))',
            border: '2px solid #d97706',
            borderRadius: '10px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ color: '#f59e0b', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Tournament Champion
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#fef3c7', margin: '2px 0' }}>
              👑 {tournament.champion}
            </div>
            <div style={{ color: '#d1d5db', fontSize: '13px' }}>
              Winner of the {tournament.name} Championship Bracket!
            </div>
          </div>
          <span style={{ fontSize: '36px' }}>🏆</span>
        </div>
      )}

      {/* Bracket Columns Container */}
      <div
        style={{
          display: 'flex',
          gap: '24px',
          overflowX: 'auto',
          paddingBottom: '16px',
          alignItems: 'stretch',
        }}
      >
        {sortedRoundIndices.map((roundIdx) => {
          const roundMatches = roundsMap.get(roundIdx) || [];
          const roundTitle = roundMatches[0]?.roundName || `Round ${roundIdx + 1}`;
          const isFinal = roundTitle === 'Championship Final';

          return (
            <div
              key={roundIdx}
              style={{
                flex: '0 0 280px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Round Title Header */}
              <div
                style={{
                  background: isFinal ? '#21262d' : '#161b22',
                  border: `1px solid ${isFinal ? '#e3b341' : '#30363d'}`,
                  borderRadius: '6px',
                  padding: '10px',
                  textAlign: 'center',
                  fontWeight: 700,
                  fontSize: '14px',
                  color: isFinal ? '#f1e05a' : '#58a6ff',
                  marginBottom: '16px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {roundTitle}
              </div>

              {/* Match Cards Stack */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-around',
                  flex: 1,
                  gap: '16px',
                }}
              >
                {roundMatches.map((match) => {
                  const isPlayable = Boolean(match.player1 && match.player2 && !match.completed);
                  const isBye = match.isBye;

                  return (
                    <div
                      key={match.id}
                      style={{
                        background: '#161b22',
                        border: `1px solid ${
                          match.completed
                            ? '#238636'
                            : isPlayable
                            ? '#388bfd'
                            : '#30363d'
                        }`,
                        borderRadius: '8px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        boxShadow: isPlayable ? '0 4px 12px rgba(56, 139, 253, 0.15)' : 'none',
                        position: 'relative',
                      }}
                    >
                      {/* Match Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#8b949e', borderBottom: '1px solid #21262d', paddingBottom: '4px' }}>
                        <span>Match #{match.matchNumber}</span>
                        <span>First to {match.legsToWin} legs</span>
                      </div>

                      {/* Player 1 Row */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 8px',
                          borderRadius: '4px',
                          background:
                            match.completed && match.winner === match.player1 && match.player1
                              ? 'rgba(35, 134, 54, 0.25)'
                              : '#0d1117',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
                          {match.player1Seed && (
                            <span style={{ fontSize: '10px', background: '#21262d', color: '#8b949e', padding: '1px 5px', borderRadius: '3px' }}>
                              #{match.player1Seed}
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: match.winner === match.player1 && match.player1 ? 700 : 500,
                              color: match.winner === match.player1 && match.player1 ? '#3fb950' : match.player1 ? '#f0f6fc' : '#6b7280',
                              whiteSpace: 'nowrap',
                              textOverflow: 'ellipsis',
                              overflow: 'hidden',
                            }}
                          >
                            {match.player1 || (isBye ? 'BYE' : 'TBD')}
                          </span>
                        </div>
                        <span style={{ fontWeight: 700, fontSize: '13px', color: '#f0f6fc' }}>
                          {match.completed && !isBye ? match.player1Legs : '-'}
                        </span>
                      </div>

                      {/* Player 2 Row */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 8px',
                          borderRadius: '4px',
                          background:
                            match.completed && match.winner === match.player2 && match.player2
                              ? 'rgba(35, 134, 54, 0.25)'
                              : '#0d1117',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
                          {match.player2Seed && (
                            <span style={{ fontSize: '10px', background: '#21262d', color: '#8b949e', padding: '1px 5px', borderRadius: '3px' }}>
                              #{match.player2Seed}
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: match.winner === match.player2 && match.player2 ? 700 : 500,
                              color: match.winner === match.player2 && match.player2 ? '#3fb950' : match.player2 ? '#f0f6fc' : '#6b7280',
                              whiteSpace: 'nowrap',
                              textOverflow: 'ellipsis',
                              overflow: 'hidden',
                            }}
                          >
                            {match.player2 || (isBye ? 'BYE' : 'TBD')}
                          </span>
                        </div>
                        <span style={{ fontWeight: 700, fontSize: '13px', color: '#f0f6fc' }}>
                          {match.completed && !isBye ? match.player2Legs : '-'}
                        </span>
                      </div>

                      {/* Action / Status footer */}
                      {isPlayable && (
                        <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                          <button
                            className="btn pri"
                            onClick={() => handleScoreMatch(match)}
                            style={{ flex: 1, fontSize: '12px', padding: '5px 8px' }}
                          >
                            Score Match
                          </button>
                          <button
                            className="btn sec"
                            title={`Quick win for ${match.player1}`}
                            onClick={() => handleQuickManualResult(match, 1)}
                            style={{ fontSize: '11px', padding: '4px 6px' }}
                          >
                            1W
                          </button>
                          <button
                            className="btn sec"
                            title={`Quick win for ${match.player2}`}
                            onClick={() => handleQuickManualResult(match, 2)}
                            style={{ fontSize: '11px', padding: '4px 6px' }}
                          >
                            2W
                          </button>
                        </div>
                      )}

                      {isBye && (
                        <div style={{ fontSize: '11px', color: '#8b949e', textAlign: 'center', fontStyle: 'italic' }}>
                          &bull; Bye: {match.winner} advances &bull;
                        </div>
                      )}

                      {match.completed && !isBye && (
                        <div style={{ fontSize: '11px', color: '#3fb950', fontWeight: 600, textAlign: 'center' }}>
                          ✓ Won by {match.winner} ({match.player1Legs}-{match.player2Legs})
                        </div>
                      )}

                      {!isPlayable && !match.completed && !isBye && (
                        <div style={{ fontSize: '11px', color: '#6b7280', textAlign: 'center', fontStyle: 'italic' }}>
                          Waiting for previous round
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
