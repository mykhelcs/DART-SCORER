import { PoolGroup, PlayerStats } from '../core/types';
import { calculateStandings } from '../core/tournament';

export function exportStandingsToCsv(pool: PoolGroup): string {
  const standings = calculateStandings(pool);
  const headers = [
    'Rank',
    'Player',
    'Played',
    'Won',
    'Lost',
    'Legs For',
    'Legs Against',
    'Leg Diff',
    '3-Dart Avg',
    'High Finish',
  ];

  const rows = standings.map((p, index) => [
    index + 1,
    `"${p.name.replace(/"/g, '""')}"`,
    p.played,
    p.wins,
    p.losses,
    p.legsFor,
    p.legsAgainst,
    p.legDiff,
    p.threeDartAvg.toFixed(1),
    p.highFinish,
  ]);

  return [
    headers.join(','),
    ...rows.map((r) => r.join(',')),
  ].join('\n');
}

export function exportPlayerStatsToCsv(players: PlayerStats[]): string {
  const headers = [
    'Player',
    'Legs Won',
    'Darts Thrown',
    'Points Scored',
    '3-Dart Avg',
    'Highest Score',
    '100+',
    '140+',
    '180s',
    'Best Checkout',
  ];

  const rows = players.map((p) => {
    const avg = p.darts ? ((p.points / p.darts) * 3).toFixed(1) : '0.0';
    return [
      `"${p.name.replace(/"/g, '""')}"`,
      p.legs,
      p.darts,
      p.points,
      avg,
      p.high,
      p.ton,
      p.t40,
      p.one80,
      p.bestOut || '-',
    ];
  });

  return [
    headers.join(','),
    ...rows.map((r) => r.join(',')),
  ].join('\n');
}

export function downloadFile(content: string, filename: string, mimeType: string = 'text/csv;charset=utf-8;'): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
