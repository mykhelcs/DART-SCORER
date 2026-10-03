import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Dart, GameMode, MatchState } from '../core/types';
import {
  createInitialMatchState,
  throwDart,
  startNextLeg,
  undo,
} from '../core/scoring';
import { Scoreboard } from './Scoreboard';
import { Dartboard } from './Dartboard';
import { VisitTray } from './VisitTray';
import { CheckoutHint } from './CheckoutHint';
import { Toast } from './Toast';
import { VictoryModal } from './VictoryModal';
import { GameLogView } from './GameLogView';
import { PostGameReportModal } from './PostGameReportModal';
import { saveCurrentMatch, loadCurrentMatch, clearCurrentMatch } from '../services/storage';
import { apiSaveMatch, apiSaveAuditLog } from '../services/api';
import { exportGameLogsToCsv } from '../services/export';

interface MatchViewProps {
  onOpenProjector?: (state: MatchState) => void;
  presetMatch?: MatchState | null;
  onMatchComplete?: (state: MatchState) => void;
}

export const MatchView: React.FC<MatchViewProps> = ({
  onOpenProjector,
  presetMatch,
  onMatchComplete,
}) => {
  const [match, setMatch] = useState<MatchState | null>(() => {
    return presetMatch ?? loadCurrentMatch();
  });

  // Setup form states
  const [p1, setP1] = useState('Player 1');
  const [p2, setP2] = useState('Player 2');
  const [p3, setP3] = useState('');
  const [p4, setP4] = useState('');
  const [mode, setMode] = useState<GameMode>(501);
  const [legs, setLegs] = useState(3);
  const [doubleOut, setDoubleOut] = useState(true);

  // Modal & Toast states
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'good' | 'bad' | 'neutral'>('neutral');
  const [victoryModal, setVictoryModal] = useState<{
    show: boolean;
    isMatchWin: boolean;
    winnerName: string;
  } | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save whenever match state changes (localStorage + debounced backend SQLite)
  useEffect(() => {
    if (!match) return;
    saveCurrentMatch(match);
    const timer = setTimeout(() => {
      apiSaveMatch('active', match).catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [match]);

  const showToast = useCallback((msg: string, type: 'good' | 'bad' | 'neutral' = 'neutral') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMsg(msg);
    setToastType(type);
    toastTimerRef.current = setTimeout(() => {
      setToastMsg(null);
    }, 2200);
  }, []);

  const handleStartMatch = (e: React.FormEvent) => {
    e.preventDefault();
    const playerNames = [p1, p2, p3, p4].map((n) => n.trim()).filter(Boolean);
    const newMatch = createInitialMatchState({
      mode,
      doubleOut,
      legsToWin: legs,
      playerNames,
    });
    setMatch(newMatch);
    setVictoryModal(null);
  };

  const handleThrowDarts = (darts: Dart[]) => {
    if (!match || match.over || victoryModal?.show) return;

    let currentState = match;
    let lastResult: ReturnType<typeof throwDart> | null = null;

    for (const dart of darts) {
      if (currentState.over) break;
      lastResult = throwDart(currentState, dart);
      currentState = lastResult.state;
      if (
        lastResult.event === 'bust' ||
        lastResult.event === 'leg_won' ||
        lastResult.event === 'match_won'
      ) {
        break;
      }
    }

    if (!lastResult) return;
    setMatch(currentState);

    if (lastResult.event === 'bust') {
      showToast(lastResult.message || 'Bust!', 'bad');
    } else if (lastResult.event === 'turn_end' && lastResult.message) {
      showToast(lastResult.message, 'good');
    } else if (lastResult.event === 'leg_won') {
      setVictoryModal({
        show: true,
        isMatchWin: false,
        winnerName: lastResult.state.players[lastResult.state.cur].name,
      });
    } else if (lastResult.event === 'match_won') {
      setVictoryModal({
        show: true,
        isMatchWin: true,
        winnerName: lastResult.state.winner || 'Winner',
      });
      apiSaveAuditLog({
        action: 'MATCH_WON',
        entityType: 'match',
        entityId: 'active',
        details: `Match completed. Winner: ${lastResult.state.winner}`,
      }).catch(() => {});
      if (onMatchComplete) {
        onMatchComplete(lastResult.state);
      }
    }
  };

  const handleThrow = (dart: Dart) => {
    handleThrowDarts([dart]);
  };

  const handleMiss = () => {
    handleThrow({ m: 0, n: 0 });
  };

  const handleUndo = () => {
    if (!match || match.history.length === 0 || victoryModal?.show) return;
    const previous = undo(match);
    setMatch(previous);
    apiSaveAuditLog({
      action: 'MATCH_UNDO',
      entityType: 'scorer',
      entityId: 'active',
      details: 'Scorer undid last throw',
    }).catch(() => {});
  };

  const handleNextLeg = () => {
    if (!match) return;
    const nextState = startNextLeg(match);
    setMatch(nextState);
    setVictoryModal(null);
  };

  const handleNewMatch = () => {
    if (window.confirm('Abandon this match and start a new match?')) {
      clearCurrentMatch();
      setMatch(null);
      setVictoryModal(null);
    }
  };

  // Quick Score helper (translates single number like 100 into 3 darts e.g. T20, S20, D10)
  const handleQuickScore = (total: number) => {
    if (!match || match.visit.length > 0 || match.over) return;
    // Dispatches approximate darts to match score atomically
    if (total === 180) {
      handleThrowDarts([{ m: 3, n: 20 }, { m: 3, n: 20 }, { m: 3, n: 20 }]);
    } else if (total === 140) {
      handleThrowDarts([{ m: 3, n: 20 }, { m: 3, n: 20 }, { m: 1, n: 20 }]);
    } else if (total === 100) {
      handleThrowDarts([{ m: 3, n: 20 }, { m: 1, n: 20 }, { m: 1, n: 20 }]);
    } else if (total === 85) {
      handleThrowDarts([{ m: 3, n: 19 }, { m: 1, n: 14 }, { m: 1, n: 14 }]);
    } else if (total === 60) {
      handleThrowDarts([{ m: 3, n: 20 }, { m: 0, n: 0 }, { m: 0, n: 0 }]);
    } else if (total === 45) {
      handleThrowDarts([{ m: 1, n: 15 }, { m: 1, n: 15 }, { m: 1, n: 15 }]);
    } else if (total === 41) {
      handleThrowDarts([{ m: 1, n: 20 }, { m: 1, n: 1 }, { m: 1, n: 20 }]);
    } else if (total === 26) {
      handleThrowDarts([{ m: 1, n: 20 }, { m: 1, n: 1 }, { m: 1, n: 5 }]);
    }
  };

  if (!match) {
    return (
      <section className="card-panel" style={{ maxWidth: '580px', margin: '2vh auto' }}>
        <h2>Set up the match</h2>
        <div style={{ color: 'var(--muted)', marginBottom: '16px' }}>
          Enter 2 to 4 players. Leave extra slots blank for singles.
        </div>

        <form onSubmit={handleStartMatch}>
          <div className="f-group">
            <label htmlFor="p1">Player 1</label>
            <input
              type="text"
              id="p1"
              value={p1}
              onChange={(e) => setP1(e.target.value)}
              maxLength={20}
              required
            />
          </div>

          <div className="f-group">
            <label htmlFor="p2">Player 2</label>
            <input
              type="text"
              id="p2"
              value={p2}
              onChange={(e) => setP2(e.target.value)}
              maxLength={20}
              required
            />
          </div>

          <div className="row-grid">
            <div className="f-group">
              <label htmlFor="p3">Player 3 (optional)</label>
              <input
                type="text"
                id="p3"
                value={p3}
                onChange={(e) => setP3(e.target.value)}
                maxLength={20}
              />
            </div>
            <div className="f-group">
              <label htmlFor="p4">Player 4 (optional)</label>
              <input
                type="text"
                id="p4"
                value={p4}
                onChange={(e) => setP4(e.target.value)}
                maxLength={20}
              />
            </div>
          </div>

          <div className="row-grid">
            <div className="f-group">
              <label htmlFor="mode">Game</label>
              <select
                id="mode"
                value={mode}
                onChange={(e) => setMode(Number(e.target.value) as GameMode)}
              >
                <option value={301}>301</option>
                <option value={501}>501</option>
                <option value={701}>701</option>
              </select>
            </div>

            <div className="f-group">
              <label htmlFor="legs">Match Length</label>
              <select
                id="legs"
                value={legs}
                onChange={(e) => setLegs(Number(e.target.value))}
              >
                <option value={1}>First to 1 leg</option>
                <option value={2}>First to 2 legs (Pools default)</option>
                <option value={3}>First to 3 legs (Quarters/Semis)</option>
                <option value={5}>First to 5 legs (Final)</option>
              </select>
            </div>
          </div>

          <label className="chk-label">
            <input
              type="checkbox"
              checked={doubleOut}
              onChange={(e) => setDoubleOut(e.target.checked)}
            />
            Must finish on a double or the inner bull (Double-Out)
          </label>

          <button type="submit" className="btn pri" style={{ width: '100%' }}>
            Game On
          </button>
        </form>
      </section>
    );
  }

  const metaText = `${match.mode}, ${
    match.doubleOut ? 'double out' : 'straight out'
  }, first to ${match.legsToWin} ${match.legsToWin > 1 ? 'legs' : 'leg'}`;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>{metaText}</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn sec"
            onClick={() => {
              if (!match.logs || match.logs.length === 0) {
                showToast('No logs to export yet', 'neutral');
                return;
              }
              const csv = exportGameLogsToCsv(match.logs);
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.setAttribute('download', `darts_match_logs_${Date.now()}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
              showToast('Match logs exported to CSV', 'good');
            }}
          >
            Export CSV
          </button>
          <button
            className="btn sec"
            onClick={() => {
              if (!match.logs || match.logs.length === 0) {
                showToast('No logs recorded yet', 'neutral');
                return;
              }
              setShowReportModal(true);
            }}
          >
            📄 Report & PDF
          </button>
          {onOpenProjector && (
            <button className="btn sec" onClick={() => onOpenProjector(match)}>
              Projector View
            </button>
          )}
          <button className="btn" onClick={handleNewMatch}>
            New Match
          </button>
        </div>
      </div>

      <div className="match-grid">
        <div>
          <Scoreboard state={match} />
          <CheckoutHint state={match} />
        </div>

        <div className="play-area">
          <Dartboard onThrow={handleThrow} disabled={match.over || !!victoryModal?.show} />
          <VisitTray
            visit={match.visit}
            onMiss={handleMiss}
            onUndo={handleUndo}
            canUndo={match.history.length > 0}
            onQuickScore={handleQuickScore}
          />
        </div>
      </div>

      <GameLogView logs={match.logs || []} />

      <Toast message={toastMsg} type={toastType} />

      {victoryModal?.show && (
        <VictoryModal
          state={match}
          isMatchWin={victoryModal.isMatchWin}
          winnerName={victoryModal.winnerName}
          onNextLeg={handleNextLeg}
          onNewMatch={handleNewMatch}
        />
      )}

      {showReportModal && (
        <PostGameReportModal
          match={match}
          onClose={() => setShowReportModal(false)}
          onNewMatch={handleNewMatch}
        />
      )}
    </div>
  );
};
