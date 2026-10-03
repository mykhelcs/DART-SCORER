import React from 'react';
import { Dart } from '../core/types';

interface DartboardProps {
  onThrow: (dart: Dart) => void;
  disabled?: boolean;
}

const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const RINGS: [number, number, number][] = [
  [17.8, 110.6, 1], // Inner single
  [110.6, 119.6, 3], // Treble
  [119.6, 181, 1],   // Outer single
  [181, 190, 2],     // Double
];

function pt(r: number, a: number): [number, number] {
  const t = ((a - 90) * Math.PI) / 180;
  return [200 + r * Math.cos(t), 200 + r * Math.sin(t)];
}

function arc(r0: number, r1: number, a0: number, a1: number): string {
  const [x1, y1] = pt(r1, a0);
  const [x2, y2] = pt(r1, a1);
  const [x3, y3] = pt(r0, a1);
  const [x4, y4] = pt(r0, a0);
  return `M${x1.toFixed(1)} ${y1.toFixed(1)}A${r1} ${r1} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}L${x3.toFixed(1)} ${y3.toFixed(1)}A${r0} ${r0} 0 0 0 ${x4.toFixed(1)} ${y4.toFixed(1)}Z`;
}

export const Dartboard: React.FC<DartboardProps> = ({ onThrow, disabled = false }) => {
  const handleClick = (m: number, n: number) => {
    if (disabled) return;
    onThrow({ m, n });
  };

  return (
    <div className="svg-board-wrap">
      <svg
        className="dartboard-svg"
        viewBox="-24 -24 448 448"
        role="group"
        aria-label="Dartboard. Tap a segment to record a throw."
      >
        {/* Background circle */}
        <circle cx="200" cy="200" r="214" fill="#050c09" />

        {/* 20 Segments with 4 rings each */}
        {ORDER.map((n, i) => {
          const a0 = i * 18 - 9;
          const a1 = i * 18 + 9;
          const even = i % 2 === 0;
          const [textX, textY] = pt(206, i * 18);

          return (
            <React.Fragment key={n}>
              {RINGS.map(([r0, r1, m]) => {
                const color =
                  m === 1
                    ? even
                      ? '#14100d'
                      : '#efe6cf'
                    : even
                    ? '#d8392e'
                    : '#2a8a5c';

                return (
                  <path
                    key={`${n}-${m}-${r0}`}
                    className="seg"
                    d={arc(r0, r1, a0, a1)}
                    fill={color}
                    stroke="#7a6a45"
                    strokeWidth="0.8"
                    onClick={() => handleClick(m, n)}
                    role="button"
                    aria-label={`${m === 3 ? 'Treble' : m === 2 ? 'Double' : 'Single'} ${n}`}
                  />
                );
              })}

              <text
                x={textX.toFixed(1)}
                y={(textY + 5).toFixed(1)}
                textAnchor="middle"
                fill="#efe6cf"
                fontFamily="Big Shoulders Display, Arial Narrow, sans-serif"
                fontWeight="800"
                fontSize="19"
              >
                {n}
              </text>
            </React.Fragment>
          );
        })}

        {/* Outer Bull (25) */}
        <circle
          className="seg"
          cx="200"
          cy="200"
          r="17.8"
          fill="#2a8a5c"
          stroke="#7a6a45"
          strokeWidth="0.8"
          onClick={() => handleClick(1, 25)}
          role="button"
          aria-label="Outer Bull 25"
        />

        {/* Inner Bull (50) */}
        <circle
          className="seg"
          cx="200"
          cy="200"
          r="7.1"
          fill="#d8392e"
          stroke="#7a6a45"
          strokeWidth="0.8"
          onClick={() => handleClick(2, 25)}
          role="button"
          aria-label="Inner Bull 50"
        />
      </svg>
    </div>
  );
};
