import React from 'react';
import { MatchState } from '../core/types';
import { getVisitSum } from '../core/scoring';

interface ScoreboardProps {
  state: MatchState;
}

export const Scoreboard: React.FC<ScoreboardProps> = ({ state }) => {
  const visitSum = getVisitSum(state.visit);

  return (
    <div className="player-list">
      {state.players.map((p, i) => {
        const isActive = i === state.cur && !state.over;
        const liveScore = isActive ? p.score - visitSum : p.score;
        const avg = p.darts ? ((p.points / p.darts) * 3).toFixed(1) : '0.0';

        return (
          <div key={p.name + i} className={`pl-tile ${isActive ? 'active' : ''}`}>
            <div>
              <div className="pl-name">{p.name}</div>
              <div className="pips" aria-label={`${p.legs} legs won out of ${state.legsToWin}`}>
                {Array.from({ length: state.legsToWin }, (_, k) => (
                  <span
                    key={k}
                    className={`pip ${k < p.legs ? 'won' : ''}`}
                    title={k < p.legs ? 'Won' : 'Not won'}
                  />
                ))}
              </div>
            </div>

            <div className="pl-score">
              {liveScore < 0 ? p.score : liveScore}
              <small>{i === state.starter ? 'Throws first' : 'Remaining'}</small>
            </div>

            <div className="pl-stats">
              <span>
                3-dart avg <b>{avg}</b>
              </span>
              <span>
                Last <b>{p.lastVisit}</b>
              </span>
              <span>
                High <b>{p.high}</b>
              </span>
              <span>
                100+ <b>{p.ton}</b>
              </span>
              <span>
                140+ <b>{p.t40}</b>
              </span>
              {p.one80 > 0 && (
                <span>
                  180s <b>{p.one80}</b>
                </span>
              )}
              <span>
                Best out <b>{p.bestOut || '-'}</b>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
