import React from 'react';
import { MatchState } from '../core/types';
import { getVisitSum } from '../core/scoring';
import { getCheckout, formatCheckoutText } from '../core/checkout';

interface ProjectorViewProps {
  state: MatchState;
  onClose: () => void;
}

export const ProjectorView: React.FC<ProjectorViewProps> = ({ state, onClose }) => {
  const visitSum = getVisitSum(state.visit);
  const curPlayer = state.players[state.cur];
  const remaining = curPlayer ? curPlayer.score - visitSum : 0;
  const dartsLeft = 3 - state.visit.length;
  const checkoutDarts = getCheckout(remaining, dartsLeft, state.doubleOut);

  return (
    <div className="projector-mode">
      <div className="projector-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '3rem', margin: 0 }}>Intramurals Darts Live Scoreboard</h1>
            <div style={{ color: 'var(--brass)', fontSize: '1.4rem', fontWeight: 700 }}>
              {state.mode} | {state.doubleOut ? 'Double-Out' : 'Straight-Out'} | First to {state.legsToWin} legs
            </div>
          </div>
          <button className="btn pri" onClick={onClose} style={{ fontSize: '1.2rem' }}>
            Exit Projector Mode
          </button>
        </div>
      </div>

      <div className="projector-scores">
        {state.players.map((p, idx) => {
          const isActive = idx === state.cur && !state.over;
          const liveScore = isActive ? p.score - visitSum : p.score;
          const avg = p.darts ? ((p.points / p.darts) * 3).toFixed(1) : '0.0';

          return (
            <div key={p.name} className={`projector-tile ${isActive ? 'active' : ''}`}>
              <h2 style={{ fontSize: '3.2rem', margin: '0 0 10px', color: isActive ? 'var(--brass)' : 'inherit' }}>
                {p.name}
              </h2>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '12px',
                  marginBottom: '16px',
                }}
              >
                {Array.from({ length: state.legsToWin }, (_, k) => (
                  <span
                    key={k}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: k < p.legs ? 'var(--brass)' : 'transparent',
                      border: '3px solid var(--brass)',
                      display: 'inline-block',
                    }}
                  />
                ))}
              </div>

              <div className="big-score">{liveScore < 0 ? p.score : liveScore}</div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-around',
                  marginTop: '20px',
                  fontSize: '1.3rem',
                  color: 'var(--muted)',
                }}
              >
                <div>
                  Avg: <strong style={{ color: 'var(--cream)' }}>{avg}</strong>
                </div>
                <div>
                  Last: <strong style={{ color: 'var(--cream)' }}>{p.lastVisit}</strong>
                </div>
                <div>
                  100+: <strong style={{ color: 'var(--cream)' }}>{p.ton}</strong>
                </div>
                <div>
                  High: <strong style={{ color: 'var(--cream)' }}>{p.high}</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          background: 'var(--ink)',
          border: '3px solid var(--brass)',
          borderRadius: '16px',
          padding: '20px',
          textAlign: 'center',
          marginTop: '24px',
        }}
      >
        {checkoutDarts ? (
          <div style={{ fontSize: '2rem' }}>
            <span style={{ color: 'var(--muted)', marginRight: '16px' }}>Checkout Available:</span>
            <strong style={{ color: 'var(--brass)', fontSize: '2.5rem' }}>
              {formatCheckoutText(checkoutDarts)}
            </strong>
          </div>
        ) : (
          <div style={{ fontSize: '1.8rem', color: 'var(--muted)' }}>
            {curPlayer?.name} to throw &bull; {dartsLeft} {dartsLeft === 1 ? 'dart' : 'darts'} left &bull; {remaining} remaining
          </div>
        )}
      </div>
    </div>
  );
};
