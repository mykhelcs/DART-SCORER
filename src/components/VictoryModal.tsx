import React from 'react';
import { MatchState } from '../core/types';

interface VictoryModalProps {
  state: MatchState;
  isMatchWin: boolean;
  winnerName: string;
  onNextLeg: () => void;
  onNewMatch: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  state,
  isMatchWin,
  winnerName,
  onNextLeg,
  onNewMatch,
}) => {
  const tally = state.players.map((x) => `${x.name} (${x.legs})`).join('  vs  ');
  const winner = state.players.find((p) => p.name === winnerName);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <h2>{isMatchWin ? `${winnerName} wins the match!` : `${winnerName} takes the leg!`}</h2>
        <p>
          Score: {tally}.
          {winner && winner.bestOut > 0 ? ` Checkout: ${winner.bestOut}.` : ''}
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {isMatchWin ? (
            <button className="btn pri" onClick={onNewMatch}>
              Start New Match
            </button>
          ) : (
            <button className="btn pri" onClick={onNextLeg}>
              Next Leg
            </button>
          )}
          <button className="btn sec" onClick={onNewMatch}>
            Match Setup
          </button>
        </div>
      </div>
    </div>
  );
};
