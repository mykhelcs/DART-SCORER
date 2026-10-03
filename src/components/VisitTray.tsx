import React from 'react';
import { Dart } from '../core/types';
import { formatDartLabel } from '../core/checkout';

interface VisitTrayProps {
  visit: Dart[];
  onMiss: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onQuickScore?: (score: number) => void;
}

export const VisitTray: React.FC<VisitTrayProps> = ({
  visit,
  onMiss,
  onUndo,
  canUndo,
  onQuickScore,
}) => {
  return (
    <div style={{ display: 'grid', gap: '10px' }}>
      <div className="visit-tray">
        {[0, 1, 2].map((idx) => {
          const d = visit[idx];
          const isHit = !!d;
          const isMiss = d && d.m === 0;

          return (
            <div
              key={idx}
              className={`dart-slot ${isHit ? 'hit' : ''} ${isMiss ? 'miss' : ''}`}
            >
              {d ? formatDartLabel(d) : '-'}
            </div>
          );
        })}

        <button
          className="btn"
          onClick={onMiss}
          disabled={visit.length >= 3}
          title="Record a miss (0 points)"
        >
          Miss
        </button>

        <button
          className="btn"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo previous dart throw"
        >
          Undo
        </button>
      </div>

      {/* Quick Score helper presets */}
      {onQuickScore && visit.length === 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 600 }}>
            Quick 3-Dart Visits:
          </span>
          {[26, 41, 45, 60, 85, 100, 140, 180].map((score) => (
            <button
              key={score}
              className="btn sec"
              style={{ minHeight: '34px', padding: '4px 10px', fontSize: '0.9rem' }}
              onClick={() => onQuickScore(score)}
            >
              {score}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
