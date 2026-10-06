import React from 'react';
import { TournamentFormat } from '../core/types';

interface BracketPreviewProps {
  format: TournamentFormat;
  players: string[];
}

export const BracketPreview: React.FC<BracketPreviewProps> = ({ format, players }) => {
  const cleanPlayers = players.map((p) => p.trim()).filter(Boolean);
  const count = cleanPlayers.length;

  if (count < 2) {
    return (
      <div style={{ padding: '16px', background: '#0d1117', border: '1px dashed #30363d', borderRadius: '8px', color: '#8b949e', fontSize: '13px', textAlign: 'center' }}>
        Enter at least 2 player names above to see the live bracket preview.
      </div>
    );
  }

  if (format === 'pools_knockout') {
    let numPools = 1;
    if (count >= 6) {
      numPools = Math.max(1, Math.round(count / 4));
    }
    const poolLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const baseCount = Math.floor(count / numPools);
    const remainder = count % numPools;

    let playerCursor = 0;
    const poolGroups = Array.from({ length: numPools }).map((_, pIdx) => {
      const letter = poolLetters[pIdx % poolLetters.length];
      const groupSize = baseCount + (pIdx < remainder ? 1 : 0);
      const pGroup = cleanPlayers.slice(playerCursor, playerCursor + groupSize);
      playerCursor += groupSize;
      return { letter, pGroup };
    });

    return (
      <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '16px', marginTop: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#f0883e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Preview: Group Stage + Knockout ({count} Players)
          </span>
          <span style={{ fontSize: '12px', color: '#8b949e' }}>
            {numPools} {numPools === 1 ? 'Pool' : 'Pools'} &rarr; {numPools === 1 ? 'Top 4 Advance' : 'Top 2 Advance'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))`, gap: '12px', marginBottom: '14px' }}>
          {poolGroups.map(({ letter, pGroup }) => {
            return (
              <div
                key={letter}
                style={{
                  background: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  padding: '10px',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '13px', color: '#58a6ff', marginBottom: '6px', borderBottom: '1px solid #21262d', paddingBottom: '4px' }}>
                  Pool {letter}
                </div>
                <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: '#c9d1d9' }}>
                  {pGroup.map((name, i) => (
                    <li key={i} style={{ marginBottom: '2px' }}>
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div style={{ background: 'rgba(56, 139, 253, 0.1)', border: '1px solid rgba(56, 139, 253, 0.3)', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', color: '#8b949e' }}>
          &bull; Stage 1: Round-robin inside each pool &bull; Stage 2: Top 2 from each pool advance to Single Elimination Knockout
        </div>
      </div>
    );
  }

  // Challonge format preview
  let bracketSize = 4;
  while (bracketSize < count) {
    bracketSize *= 2;
  }
  const byesCount = Math.max(0, bracketSize - count);
  const totalRounds = Math.log2(bracketSize);

  const roundNames: string[] = [];
  for (let r = 0; r < totalRounds; r++) {
    const dist = totalRounds - 1 - r;
    if (dist === 0) roundNames.push('Championship Final');
    else if (dist === 1) roundNames.push('Semi-Finals');
    else if (dist === 2) roundNames.push('Quarter-Finals');
    else if (dist === 3) roundNames.push('Round of 16');
    else roundNames.push(`Round ${r + 1}`);
  }

  return (
    <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '16px', marginTop: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#f0883e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Preview: Challonge Single-Elimination Bracket ({count} Players)
        </span>
        <span style={{ fontSize: '12px', color: '#8b949e' }}>
          Bracket Size: {bracketSize} slots {byesCount > 0 ? `(${byesCount} Byes for Top Seeds)` : '(Full Bracket)'}
        </span>
      </div>

      {/* Rounds preview flow */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
        {roundNames.map((rName, idx) => {
          const matchCount = bracketSize / Math.pow(2, idx + 1);

          return (
            <div
              key={rName}
              style={{
                flex: '1 0 140px',
                background: '#161b22',
                border: '1px solid #30363d',
                borderRadius: '6px',
                padding: '10px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: idx === roundNames.length - 1 ? '#e3b341' : '#58a6ff', marginBottom: '6px' }}>
                {rName}
              </div>
              <div style={{ fontSize: '11px', color: '#8b949e' }}>
                {matchCount} {matchCount === 1 ? 'Match' : 'Matches'}
              </div>
              {idx === 0 && byesCount > 0 && (
                <div style={{ marginTop: '6px', fontSize: '10px', background: 'rgba(210, 153, 34, 0.2)', color: '#d29922', padding: '2px 4px', borderRadius: '4px' }}>
                  {byesCount} {byesCount === 1 ? 'Bye' : 'Byes'} auto-advance
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: '10px', fontSize: '12px', color: '#8b949e' }}>
        &bull; Seed 1: <strong>{cleanPlayers[0]}</strong> &bull; Seed 2: <strong>{cleanPlayers[1] || 'TBD'}</strong>
        {count >= 3 && <> &bull; Seed 3: <strong>{cleanPlayers[2]}</strong></>}
        {count >= 4 && <> &bull; Seed 4: <strong>{cleanPlayers[3]}</strong></>}
      </div>
    </div>
  );
};
