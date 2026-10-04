import React, { useState, useEffect, useCallback } from 'react';
import { MatchState, SavedMatchRecord, GameMode } from '../core/types';
import { createInitialMatchState } from '../core/scoring';
import { findDuplicateMatch } from '../core/duplicateGuard';
import {
  listStoredMatches,
  saveStoredMatch,
  deleteStoredMatch,
  saveCurrentMatch,
  loadCurrentMatchId,
  clearCurrentMatch,
} from '../services/storage';
import {
  apiListMatches,
  apiSaveMatch,
  apiDeleteMatch,
  checkBackendHealth,
  apiSaveAuditLog,
} from '../services/api';
import { PostGameReportModal } from './PostGameReportModal';
import { Toast } from './Toast';

interface MatchesDashboardProps {
  onLoadMatchForScoring: (match: MatchState, matchId: string) => void;
  onOpenProjector?: (match: MatchState) => void;
}

interface DuplicateApprovalState {
  candidatePlayers: string[];
  mode: GameMode;
  doubleOut: boolean;
  legsToWin: number;
  startImmediately: boolean;
  existingMatch: SavedMatchRecord;
  isCloneAction?: boolean;
}

export const MatchesDashboard: React.FC<MatchesDashboardProps> = ({
  onLoadMatchForScoring,
  onOpenProjector,
}) => {
  const [matches, setMatches] = useState<SavedMatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBackendOnline, setIsBackendOnline] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'completed'>('all');

  // Modals & Popups
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<SavedMatchRecord | null>(null);
  const [viewReportMatch, setViewReportMatch] = useState<MatchState | null>(null);
  const [duplicateApproval, setDuplicateApproval] = useState<DuplicateApprovalState | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'good' | 'bad' | 'neutral'>('neutral');

  // New Match Form State
  const [p1, setP1] = useState('Player 1');
  const [p2, setP2] = useState('Player 2');
  const [p3, setP3] = useState('');
  const [p4, setP4] = useState('');
  const [gameMode, setGameMode] = useState<GameMode>(501);
  const [legsToWin, setLegsToWin] = useState(3);
  const [doubleOut, setDoubleOut] = useState(true);

  const showToast = useCallback((msg: string, type: 'good' | 'bad' | 'neutral' = 'neutral') => {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => {
      setToastMsg(null);
    }, 2400);
  }, []);

  // Fetch matches from local storage and backend SQLite
  const loadAllMatches = useCallback(async () => {
    setLoading(true);
    const localMatches = listStoredMatches();
    const online = await checkBackendHealth();
    setIsBackendOnline(online);

    if (online) {
      try {
        const remoteMatches = await apiListMatches();
        // Merge local and remote by ID, prioritizing the most recent updatedAt
        const matchMap = new Map<string, SavedMatchRecord>();
        for (const m of localMatches) {
          matchMap.set(m.id, m);
        }
        for (const rm of remoteMatches) {
          const existing = matchMap.get(rm.id);
          if (!existing) {
            matchMap.set(rm.id, rm);
            saveStoredMatch(rm.id, rm.match, rm.tournamentId);
          } else {
            const remoteTime = rm.updatedAt ? new Date(rm.updatedAt).getTime() : 0;
            const localTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
            if (remoteTime > localTime) {
              matchMap.set(rm.id, rm);
              saveStoredMatch(rm.id, rm.match, rm.tournamentId);
            }
          }
        }
        const merged = Array.from(matchMap.values()).sort((a, b) => {
          const tA = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const tB = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return tB - tA;
        });
        setMatches(merged);
      } catch {
        setMatches(localMatches);
      }
    } else {
      setMatches(localMatches);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAllMatches();
  }, [loadAllMatches]);

  // Handle Match Creation
  const handleCreateMatch = async (startImmediately: boolean) => {
    const playerNames = [p1, p2, p3, p4].map((n) => n.trim()).filter(Boolean);
    if (playerNames.length < 2) {
      showToast('Please enter at least 2 player names.', 'bad');
      return;
    }

    // STRICT POLICY: Never duplicate a match, unless approved
    const existingDuplicate = findDuplicateMatch(
      { playerNames, mode: gameMode, legsToWin },
      matches,
    );

    if (existingDuplicate) {
      setDuplicateApproval({
        candidatePlayers: playerNames,
        mode: gameMode,
        doubleOut,
        legsToWin,
        startImmediately,
        existingMatch: existingDuplicate,
        isCloneAction: false,
      });
      return;
    }

    await executeCreateMatch(playerNames, gameMode, doubleOut, legsToWin, startImmediately, false);
  };

  const executeCreateMatch = async (
    playerNames: string[],
    mode: GameMode,
    isDoubleOut: boolean,
    legs: number,
    startImmediately: boolean,
    wasApprovedDuplicate: boolean,
  ) => {
    const newMatch = createInitialMatchState({
      mode,
      doubleOut: isDoubleOut,
      legsToWin: legs,
      playerNames,
    });

    const matchId = `match-${Date.now()}`;
    saveStoredMatch(matchId, newMatch);

    if (isBackendOnline) {
      await apiSaveMatch(matchId, newMatch);
      await apiSaveAuditLog({
        action: wasApprovedDuplicate ? 'DUPLICATE_MATCH_APPROVED' : 'CREATE_MATCH',
        entityType: 'match',
        entityId: matchId,
        details: wasApprovedDuplicate
          ? `User approved duplicate match between ${playerNames.join(', ')} (${mode}, legs: ${legs})`
          : `Match created between ${playerNames.join(', ')} (${mode}, legs: ${legs})`,
      });
    }

    setShowCreateModal(false);
    setDuplicateApproval(null);
    showToast(
      wasApprovedDuplicate
        ? `Duplicate match approved & created: ${playerNames.join(' vs ')}`
        : `Match created: ${playerNames.join(' vs ')}`,
      'good',
    );

    if (startImmediately) {
      saveCurrentMatch(newMatch, matchId);
      onLoadMatchForScoring(newMatch, matchId);
    } else {
      await loadAllMatches();
    }
  };

  const handleRequestDuplicateMatch = (targetRecord: SavedMatchRecord) => {
    const targetMatch = targetRecord.match;
    setDuplicateApproval({
      candidatePlayers: targetMatch.players.map((p) => p.name),
      mode: targetMatch.mode,
      doubleOut: targetMatch.doubleOut,
      legsToWin: targetMatch.legsToWin,
      startImmediately: false,
      existingMatch: targetRecord,
      isCloneAction: true,
    });
  };

  const handleApproveDuplicate = async () => {
    if (!duplicateApproval) return;
    const { candidatePlayers, mode, doubleOut: isDoubleOut, legsToWin: legs, startImmediately } = duplicateApproval;
    await executeCreateMatch(candidatePlayers, mode, isDoubleOut, legs, startImmediately, true);
  };

  const handleRejectDuplicate = () => {
    setDuplicateApproval(null);
    showToast('Match duplication cancelled: not approved.', 'neutral');
  };

  // Handle Match Deletion
  const confirmDeleteMatch = async () => {
    if (!deleteConfirmTarget) return;

    const id = deleteConfirmTarget.id;
    deleteStoredMatch(id);
    if (loadCurrentMatchId() === id) {
      clearCurrentMatch();
    }

    if (isBackendOnline) {
      await apiDeleteMatch(id);
      await apiSaveAuditLog({
        action: 'DELETE_MATCH',
        entityType: 'match',
        entityId: id,
        details: `Deleted match ${id}`,
      });
    }

    setDeleteConfirmTarget(null);
    showToast('Match deleted successfully.', 'neutral');
    await loadAllMatches();
  };

  // Filtering matches
  const filteredMatches = matches.filter((item) => {
    const match = item.match;
    // Status filter
    if (statusFilter === 'completed' && !match.over) return false;
    if (statusFilter === 'in_progress' && match.over) return false;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const idMatch = item.id.toLowerCase().includes(q);
      const playerMatch = match.players.some((p) => p.name.toLowerCase().includes(q));
      if (!idMatch && !playerMatch) return false;
    }

    return true;
  });

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      {toastMsg && <Toast message={toastMsg} type={toastType} />}

      {/* Top Header Card */}
      <div className="card-panel">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: '1.8rem' }}>Matches Dashboard</h2>
            <div style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>
              Create, manage, resume and review all standalone and tournament matches
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem',
                padding: '4px 10px',
                borderRadius: '6px',
                background: isBackendOnline ? 'rgba(42, 138, 92, 0.2)' : 'rgba(216, 57, 46, 0.2)',
                color: isBackendOnline ? 'var(--brass)' : '#ff857a',
                border: `1px solid ${isBackendOnline ? 'var(--line)' : 'var(--red)'}`,
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: isBackendOnline ? '#38d39f' : 'var(--red)',
                }}
              />
              {isBackendOnline ? 'SQLite Synced' : 'Offline Storage'}
            </span>

            <button className="btn sec" onClick={loadAllMatches} title="Refresh matches list">
              ↻ Refresh
            </button>

            <button className="btn pri" onClick={() => setShowCreateModal(true)}>
              + New Match
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            marginTop: '16px',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <div style={{ flex: '1 1 240px' }}>
            <input
              type="text"
              placeholder="Search by player name or match ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                background: 'var(--baize)',
                border: '2px solid var(--line)',
                color: 'var(--cream)',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {(['all', 'in_progress', 'completed'] as const).map((filter) => (
              <button
                key={filter}
                className={`btn ${statusFilter === filter ? 'pri' : 'sec'}`}
                style={{ padding: '6px 14px', fontSize: '0.9rem', minHeight: '36px' }}
                onClick={() => setStatusFilter(filter)}
              >
                {filter === 'all'
                  ? `All (${matches.length})`
                  : filter === 'in_progress'
                  ? `In Progress (${matches.filter((m) => !m.match.over).length})`
                  : `Completed (${matches.filter((m) => m.match.over).length})`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Matches Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
          Loading matches...
        </div>
      ) : filteredMatches.length === 0 ? (
        <div
          className="card-panel"
          style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--muted)' }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🎯</div>
          <h3 style={{ margin: '0 0 8px', color: 'var(--cream)' }}>No matches found</h3>
          <p style={{ margin: '0 0 16px' }}>
            {searchQuery || statusFilter !== 'all'
              ? 'No matches match your filter criteria.'
              : 'There are no saved matches yet. Click "+ New Match" to create one.'}
          </p>
          <button className="btn pri" onClick={() => setShowCreateModal(true)}>
            + Create New Match
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '16px',
          }}
        >
          {filteredMatches.map((item) => {
            const match = item.match;
            const isCompleted = match.over;
            const formattedDate = item.updatedAt
              ? new Date(item.updatedAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Recently';

            return (
              <div
                key={item.id}
                className="card-panel"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: isCompleted ? '2px solid var(--line)' : '2px solid var(--brass)',
                  position: 'relative',
                  padding: '20px',
                }}
              >
                <div>
                  {/* Top Bar of Card */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '12px',
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: '0.8rem',
                          background: 'rgba(255,255,255,0.06)',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          color: 'var(--muted)',
                          fontFamily: 'monospace',
                        }}
                      >
                        {item.id}
                      </span>
                      <div
                        style={{
                          fontSize: '0.82rem',
                          color: 'var(--muted)',
                          marginTop: '4px',
                        }}
                      >
                        {formattedDate}
                      </div>
                    </div>

                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        background: isCompleted ? 'rgba(209, 168, 75, 0.15)' : 'rgba(42, 138, 92, 0.25)',
                        color: isCompleted ? 'var(--brass)' : '#38d39f',
                        border: `1px solid ${isCompleted ? 'var(--brass)' : '#2a8a5c'}`,
                      }}
                    >
                      {isCompleted ? '🏆 Completed' : '🎯 In Progress'}
                    </span>
                  </div>

                  {/* Mode & Rule badges */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '6px',
                      flexWrap: 'wrap',
                      marginBottom: '14px',
                      fontSize: '0.8rem',
                      color: 'var(--muted)',
                    }}
                  >
                    <span style={{ background: 'var(--baize)', padding: '2px 8px', borderRadius: '4px' }}>
                      {match.mode}
                    </span>
                    <span style={{ background: 'var(--baize)', padding: '2px 8px', borderRadius: '4px' }}>
                      {match.doubleOut ? 'Double-Out' : 'Straight-Out'}
                    </span>
                    <span style={{ background: 'var(--baize)', padding: '2px 8px', borderRadius: '4px' }}>
                      First to {match.legsToWin} legs
                    </span>
                    {item.tournamentId && (
                      <span
                        style={{
                          background: 'rgba(209, 168, 75, 0.2)',
                          color: 'var(--brass)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                        }}
                      >
                        Tournament Match
                      </span>
                    )}
                  </div>

                  {/* Head to Head Players */}
                  <div
                    style={{
                      background: 'var(--baize)',
                      borderRadius: '8px',
                      padding: '12px',
                      marginBottom: '14px',
                      display: 'grid',
                      gap: '8px',
                    }}
                  >
                    {match.players.map((p, idx) => {
                      const isWinner = isCompleted && match.winner === p.name;
                      const isCurrentTurn = !isCompleted && match.cur === idx;
                      const avg = p.darts > 0 ? ((p.points / p.darts) * 3).toFixed(1) : '-';

                      return (
                        <div
                          key={p.name + idx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontWeight: isWinner ? 800 : 500,
                            color: isWinner ? 'var(--brass)' : 'var(--cream)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {isCurrentTurn && (
                              <span
                                style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  background: 'var(--brass)',
                                }}
                              />
                            )}
                            <span>{p.name}</span>
                            {isWinner && <span>👑</span>}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                              Avg: {avg}
                            </span>
                            <span
                              style={{
                                font: '700 1.25rem var(--display)',
                                color: isWinner ? 'var(--brass)' : 'var(--cream)',
                                minWidth: '40px',
                                textAlign: 'right',
                              }}
                            >
                              {p.legs} <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>({p.score})</span>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button
                    className="btn pri"
                    style={{ flex: 1, padding: '8px 12px', fontSize: '0.95rem' }}
                    onClick={() => {
                      saveCurrentMatch(match, item.id);
                      onLoadMatchForScoring(match, item.id);
                    }}
                  >
                    {isCompleted ? 'Review Scorer' : '▶ Resume Scoring'}
                  </button>

                  <button
                    className="btn sec"
                    style={{ padding: '8px 12px' }}
                    onClick={() => setViewReportMatch(match)}
                    title="View match report and round logs"
                  >
                    📊 Stats
                  </button>

                  {onOpenProjector && (
                    <button
                      className="btn sec"
                      style={{ padding: '8px 12px' }}
                      onClick={() => onOpenProjector(match)}
                      title="Spectator Projector View"
                    >
                      📺
                    </button>
                  )}

                  <button
                    className="btn sec"
                    style={{ padding: '8px 12px' }}
                    onClick={() => handleRequestDuplicateMatch(item)}
                    title="Duplicate match (requires approval)"
                  >
                    📋 Duplicate
                  </button>

                  <button
                    className="btn danger"
                    style={{ padding: '8px 12px' }}
                    onClick={() => setDeleteConfirmTarget(item)}
                    title="Delete match"
                  >
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Match Modal */}
      {showCreateModal && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div
            className="card-panel"
            style={{
              width: '100%',
              maxWidth: '520px',
              background: 'var(--baize2)',
              border: '2px solid var(--brass)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1.6rem' }}>Create New Match</h3>
              <button
                className="btn sec"
                style={{ padding: '4px 10px', minHeight: 'auto' }}
                onClick={() => setShowCreateModal(false)}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateMatch(true);
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="f-group">
                  <label>Player 1 (Required)</label>
                  <input
                    type="text"
                    required
                    value={p1}
                    onChange={(e) => setP1(e.target.value)}
                    style={{
                      padding: '8px',
                      background: 'var(--baize)',
                      border: '2px solid var(--line)',
                      color: 'var(--cream)',
                      borderRadius: '6px',
                    }}
                  />
                </div>

                <div className="f-group">
                  <label>Player 2 (Required)</label>
                  <input
                    type="text"
                    required
                    value={p2}
                    onChange={(e) => setP2(e.target.value)}
                    style={{
                      padding: '8px',
                      background: 'var(--baize)',
                      border: '2px solid var(--line)',
                      color: 'var(--cream)',
                      borderRadius: '6px',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="f-group">
                  <label>Player 3 (Optional)</label>
                  <input
                    type="text"
                    placeholder="Optional"
                    value={p3}
                    onChange={(e) => setP3(e.target.value)}
                    style={{
                      padding: '8px',
                      background: 'var(--baize)',
                      border: '2px solid var(--line)',
                      color: 'var(--cream)',
                      borderRadius: '6px',
                    }}
                  />
                </div>

                <div className="f-group">
                  <label>Player 4 (Optional)</label>
                  <input
                    type="text"
                    placeholder="Optional"
                    value={p4}
                    onChange={(e) => setP4(e.target.value)}
                    style={{
                      padding: '8px',
                      background: 'var(--baize)',
                      border: '2px solid var(--line)',
                      color: 'var(--cream)',
                      borderRadius: '6px',
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  marginTop: '10px',
                }}
              >
                <div className="f-group">
                  <label>Game Mode</label>
                  <select
                    value={gameMode}
                    onChange={(e) => setGameMode(Number(e.target.value) as GameMode)}
                    style={{
                      padding: '8px',
                      background: 'var(--baize)',
                      border: '2px solid var(--line)',
                      color: 'var(--cream)',
                      borderRadius: '6px',
                    }}
                  >
                    <option value={301}>301 (Fast)</option>
                    <option value={501}>501 (Standard)</option>
                    <option value={701}>701 (Long)</option>
                  </select>
                </div>

                <div className="f-group">
                  <label>First to Legs</label>
                  <select
                    value={legsToWin}
                    onChange={(e) => setLegsToWin(Number(e.target.value))}
                    style={{
                      padding: '8px',
                      background: 'var(--baize)',
                      border: '2px solid var(--line)',
                      color: 'var(--cream)',
                      borderRadius: '6px',
                    }}
                  >
                    <option value={1}>1 Leg</option>
                    <option value={2}>2 Legs</option>
                    <option value={3}>3 Legs (Best of 5)</option>
                    <option value={4}>4 Legs (Best of 7)</option>
                    <option value={5}>5 Legs (Best of 9)</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="doubleOutCheck"
                  checked={doubleOut}
                  onChange={(e) => setDoubleOut(e.target.checked)}
                />
                <label htmlFor="doubleOutCheck" style={{ cursor: 'pointer' }}>
                  Require Double-Out to finish leg (Official Tournament Rules)
                </label>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  marginTop: '24px',
                }}
              >
                <button
                  type="button"
                  className="btn sec"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn sec"
                  onClick={() => handleCreateMatch(false)}
                >
                  Save to Catalog
                </button>
                <button type="submit" className="btn pri">
                  ▶ Start Scoring Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmTarget && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
            padding: '16px',
          }}
        >
          <div
            className="card-panel"
            style={{
              width: '100%',
              maxWidth: '440px',
              background: 'var(--baize2)',
              border: '2px solid var(--red)',
            }}
          >
            <h3 style={{ margin: '0 0 10px', color: '#ff857a', fontSize: '1.5rem' }}>
              Delete Match?
            </h3>
            <p style={{ margin: '0 0 16px', color: 'var(--cream)', lineHeight: 1.5 }}>
              Are you sure you want to delete match{' '}
              <strong>{deleteConfirmTarget.id}</strong> (
              {deleteConfirmTarget.match.players.map((p) => p.name).join(' vs ')})?
              <br />
              <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                This will delete the match and its associated visit logs. This action cannot be undone.
              </span>
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="btn sec"
                onClick={() => setDeleteConfirmTarget(null)}
              >
                Cancel
              </button>
              <button
                className="btn danger"
                onClick={confirmDeleteMatch}
              >
                Yes, Delete Match
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Match Report Modal */}
      {viewReportMatch && (
        <PostGameReportModal
          match={viewReportMatch}
          onClose={() => setViewReportMatch(null)}
        />
      )}

      {/* Duplicate Approval Modal */}
      {duplicateApproval && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 120,
            padding: '16px',
          }}
        >
          <div
            className="card-panel"
            style={{
              maxWidth: '520px',
              width: '100%',
              border: '2px solid var(--brass)',
              boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
              background: 'var(--baize2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <span style={{ fontSize: '1.8rem' }}>⚠️</span>
              <div>
                <h3 style={{ margin: 0, color: 'var(--brass)', fontSize: '1.4rem' }}>
                  {duplicateApproval.isCloneAction ? 'Approve Duplicate Match' : 'Duplicate Match Detected'}
                </h3>
                <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                  Policy: Never duplicate a match unless explicitly approved
                </div>
              </div>
            </div>

            <div
              style={{
                background: 'var(--baize)',
                border: '1px solid var(--line)',
                borderRadius: '8px',
                padding: '12px 14px',
                marginBottom: '16px',
                fontSize: '0.9rem',
                lineHeight: 1.5,
              }}
            >
              <div style={{ marginBottom: '4px', color: 'var(--muted)' }}>
                An existing match with this exact player roster already exists:
              </div>
              <div style={{ fontWeight: 700, color: 'var(--cream)', fontSize: '1rem' }}>
                👥 {duplicateApproval.existingMatch.match.players.map((p) => p.name).join(' vs ')}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '6px' }}>
                Match ID: <code style={{ color: 'var(--brass)' }}>{duplicateApproval.existingMatch.id}</code>
                {' • '}
                Status: <strong>{duplicateApproval.existingMatch.match.over ? 'Completed' : 'In Progress'}</strong>
                {' • '}
                Format: {duplicateApproval.existingMatch.match.mode} (First to {duplicateApproval.existingMatch.match.legsToWin})
              </div>
            </div>

            <p style={{ fontSize: '0.92rem', color: 'var(--cream)', marginBottom: '20px', lineHeight: 1.5 }}>
              {duplicateApproval.isCloneAction
                ? 'Are you sure you want to approve creating a new duplicate of this match?'
                : 'A match between these players is already recorded in the system. Do you approve creating this duplicate match?'}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn sec"
                onClick={handleRejectDuplicate}
                style={{ padding: '8px 16px' }}
              >
                Cancel / Do Not Duplicate
              </button>
              <button
                type="button"
                className="btn pri"
                onClick={handleApproveDuplicate}
                style={{
                  padding: '8px 16px',
                  background: 'var(--brass)',
                  color: '#000',
                  fontWeight: 700,
                }}
              >
                ✓ Approve Duplicate Match
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
