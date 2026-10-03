import { PoolGroup, PlayerStats, VisitLog, AuditLog, MatchState, TournamentState } from '../core/types';
import { calculateStandings } from '../core/tournament';
import { formatDartLabel } from '../core/checkout';

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

export function exportGameLogsToCsv(logs: VisitLog[]): string {
  const headers = [
    'Leg',
    'Player',
    'Darts',
    'Round Score',
    'Score Before',
    'Score After',
    'Status',
    'Timestamp',
  ];

  const rows = logs.map((log) => {
    const dartsText = log.darts.map(formatDartLabel).join(' ');
    let status = 'Scored';
    if (log.isBust) status = 'Bust';
    else if (log.isCheckout) status = 'Checkout';

    return [
      log.leg,
      `"${log.playerName.replace(/"/g, '""')}"`,
      `"${dartsText}"`,
      log.visitTotal,
      log.scoreBefore,
      log.scoreAfter,
      status,
      `"${log.timestamp}"`,
    ];
  });

  return [
    headers.join(','),
    ...rows.map((r) => r.join(',')),
  ].join('\n');
}

export function exportAuditLogsToCsv(logs: AuditLog[]): string {
  const headers = [
    'ID',
    'Timestamp',
    'Action',
    'Entity Type',
    'Entity ID',
    'Details',
  ];

  const rows = logs.map((log) => [
    `"${log.id.replace(/"/g, '""')}"`,
    `"${log.timestamp.replace(/"/g, '""')}"`,
    `"${log.action.replace(/"/g, '""')}"`,
    `"${log.entityType.replace(/"/g, '""')}"`,
    `"${(log.entityId || '').replace(/"/g, '""')}"`,
    `"${(log.details || '').replace(/"/g, '""')}"`,
  ]);

  return [
    headers.join(','),
    ...rows.map((r) => r.join(',')),
  ].join('\n');
}

export function exportChallongeBracketToCsv(tournament: TournamentState): string {
  const headers = [
    'Round',
    'Match',
    'Player 1',
    'Seed 1',
    'Score 1',
    'Score 2',
    'Player 2',
    'Seed 2',
    'Winner',
    'Status',
  ];

  const matches = tournament.challongeMatches || [];
  const rows = matches.map((m) => {
    let status = 'Pending';
    if (m.isBye) status = 'Bye';
    else if (m.completed) status = 'Finished';

    return [
      `"${(m.roundName || '').replace(/"/g, '""')}"`,
      m.matchNumber,
      `"${(m.player1 || 'TBD').replace(/"/g, '""')}"`,
      m.player1Seed ?? '',
      m.completed ? m.player1Legs : '',
      m.completed ? m.player2Legs : '',
      `"${(m.player2 || 'TBD').replace(/"/g, '""')}"`,
      m.player2Seed ?? '',
      `"${(m.winner || '').replace(/"/g, '""')}"`,
      status,
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

export function printHtmlDocument(html: string): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return true;
  }
  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return false;

    doc.open();
    doc.write(html);
    doc.close();

    iframe.contentWindow?.focus();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (iframe.parentNode) {
          document.body.removeChild(iframe);
        }
      }, 2000);
    }, 300);

    return true;
  } catch {
    return false;
  }
}

export function generateMatchReportHtml(match: MatchState, title?: string): string {
  const matchTitle = title || `Darts Match Report: ${match.players.map((p) => p.name).join(' vs ')}`;
  const dateStr = new Date().toLocaleString();

  const playersRows = match.players
    .map((p) => {
      const avg = p.darts ? ((p.points / p.darts) * 3).toFixed(1) : '0.0';
      return `
        <tr>
          <td style="font-weight:bold; padding:8px 12px; border:1px solid #ddd;">${p.name}</td>
          <td style="text-align:center; padding:8px 12px; border:1px solid #ddd;">${p.legs}</td>
          <td style="text-align:center; padding:8px 12px; border:1px solid #ddd;">${p.darts}</td>
          <td style="text-align:center; padding:8px 12px; border:1px solid #ddd;">${p.points}</td>
          <td style="text-align:center; font-weight:bold; padding:8px 12px; border:1px solid #ddd;">${avg}</td>
          <td style="text-align:center; padding:8px 12px; border:1px solid #ddd;">${p.high}</td>
          <td style="text-align:center; padding:8px 12px; border:1px solid #ddd;">${p.ton}</td>
          <td style="text-align:center; padding:8px 12px; border:1px solid #ddd;">${p.t40}</td>
          <td style="text-align:center; font-weight:bold; color:#d97706; padding:8px 12px; border:1px solid #ddd;">${p.one80}</td>
          <td style="text-align:center; padding:8px 12px; border:1px solid #ddd;">${p.bestOut || '-'}</td>
        </tr>
      `;
    })
    .join('');

  const logs = match.logs || [];
  const logsRows = logs
    .map((log, idx) => {
      const dartsText = log.darts.map(formatDartLabel).join(' ');
      let badge = `<span style="background:#e5e7eb; color:#374151; padding:2px 6px; border-radius:4px; font-size:11px;">Scored</span>`;
      if (log.isCheckout) {
        badge = `<span style="background:#dcfce7; color:#15803d; font-weight:bold; padding:2px 6px; border-radius:4px; font-size:11px;">Checkout (${log.visitTotal})</span>`;
      } else if (log.isBust) {
        badge = `<span style="background:#fee2e2; color:#b91c1c; font-weight:bold; padding:2px 6px; border-radius:4px; font-size:11px;">Bust (0)</span>`;
      } else if (log.visitTotal === 180) {
        badge = `<span style="background:#fef3c7; color:#b45309; font-weight:bold; padding:2px 6px; border-radius:4px; font-size:11px;">★ 180 ★</span>`;
      }

      return `
        <tr>
          <td style="text-align:center; padding:6px 10px; border:1px solid #ddd;">${idx + 1}</td>
          <td style="text-align:center; padding:6px 10px; border:1px solid #ddd;">Leg ${log.leg}</td>
          <td style="font-weight:600; padding:6px 10px; border:1px solid #ddd;">${log.playerName}</td>
          <td style="font-family:monospace; font-size:13px; padding:6px 10px; border:1px solid #ddd;">${dartsText}</td>
          <td style="text-align:center; font-weight:bold; padding:6px 10px; border:1px solid #ddd;">${log.visitTotal}</td>
          <td style="text-align:center; padding:6px 10px; border:1px solid #ddd;">${log.scoreBefore} &rarr; <strong>${log.scoreAfter}</strong></td>
          <td style="text-align:center; padding:6px 10px; border:1px solid #ddd;">${badge}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${matchTitle}</title>
      <style>
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #1f2937;
          background: #ffffff;
          margin: 0;
          padding: 20px;
          line-height: 1.5;
        }
        h1 { margin: 0 0 4px 0; font-size: 24px; color: #111827; }
        .meta { color: #6b7280; font-size: 13px; margin-bottom: 20px; }
        .section-title { font-size: 16px; font-weight: bold; margin: 20px 0 8px 0; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px; }
        th { background: #f3f4f6; color: #374151; font-weight: 700; text-align: left; padding: 8px 12px; border: 1px solid #ddd; }
      </style>
    </head>
    <body>
      <div style="border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin-bottom: 16px;">
        <h1>${matchTitle}</h1>
        <div class="meta">
          <strong>Mode:</strong> ${match.mode} 501 (${match.doubleOut ? 'Double-Out' : 'Single-Out'}) &bull;
          <strong>First to:</strong> ${match.legsToWin} legs &bull;
          <strong>Winner:</strong> <span style="color:#15803d; font-weight:bold;">${match.winner || 'In Progress'}</span> &bull;
          <strong>Generated:</strong> ${dateStr}
        </div>
      </div>

      <div class="section-title">Player Statistics</div>
      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th style="text-align:center;">Legs Won</th>
            <th style="text-align:center;">Darts</th>
            <th style="text-align:center;">Points</th>
            <th style="text-align:center;">3-Dart Avg</th>
            <th style="text-align:center;">High Score</th>
            <th style="text-align:center;">100+</th>
            <th style="text-align:center;">140+</th>
            <th style="text-align:center;">180s</th>
            <th style="text-align:center;">Best Out</th>
          </tr>
        </thead>
        <tbody>
          ${playersRows}
        </tbody>
      </table>

      <div class="section-title">Complete Round Logs (${logs.length} Rounds Recorded)</div>
      ${
        logs.length === 0
          ? '<p style="color:#6b7280; font-style:italic;">No visits recorded for this match.</p>'
          : `
        <table>
          <thead>
            <tr>
              <th style="text-align:center; width:40px;">#</th>
              <th style="text-align:center; width:60px;">Leg</th>
              <th>Player</th>
              <th>Darts Thrown</th>
              <th style="text-align:center; width:60px;">Total</th>
              <th style="text-align:center; width:120px;">Score Progression</th>
              <th style="text-align:center; width:120px;">Outcome</th>
            </tr>
          </thead>
          <tbody>
            ${logsRows}
          </tbody>
        </table>
      `
      }
    </body>
    </html>
  `;
}

export function generateTournamentBracketHtml(tournament: TournamentState): string {
  const dateStr = new Date().toLocaleString();
  let contentHtml = '';

  if (tournament.format === 'challonge_single_elim' && tournament.challongeMatches) {
    const roundsMap = new Map<string, typeof tournament.challongeMatches>();
    for (const m of tournament.challongeMatches) {
      if (!roundsMap.has(m.roundName)) roundsMap.set(m.roundName, []);
      roundsMap.get(m.roundName)!.push(m);
    }

    contentHtml = `
      <div class="section-title">Challonge Single-Elimination Bracket</div>
      <div style="display:flex; flex-direction:column; gap:16px;">
        ${Array.from(roundsMap.entries())
          .map(([rName, matches]) => `
            <div>
              <h3 style="margin:8px 0 6px 0; font-size:15px; color:#1d4ed8;">${rName}</h3>
              <table>
                <thead>
                  <tr>
                    <th style="text-align:center; width:50px;">Match</th>
                    <th>Player 1</th>
                    <th style="text-align:center; width:80px;">Score</th>
                    <th>Player 2</th>
                    <th style="text-align:center; width:120px;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${matches
                    .map((m) => `
                      <tr>
                        <td style="text-align:center; padding:6px 10px; border:1px solid #ddd;">#${m.matchNumber}</td>
                        <td style="padding:6px 10px; border:1px solid #ddd; ${m.winner === m.player1 && m.player1 ? 'font-weight:bold; color:#15803d;' : ''}">
                          ${m.player1Seed ? `[${m.player1Seed}] ` : ''}${m.player1 || 'TBD'}
                        </td>
                        <td style="text-align:center; font-weight:bold; padding:6px 10px; border:1px solid #ddd;">
                          ${m.completed ? `${m.player1Legs} - ${m.player2Legs}` : 'vs'}
                        </td>
                        <td style="padding:6px 10px; border:1px solid #ddd; ${m.winner === m.player2 && m.player2 ? 'font-weight:bold; color:#15803d;' : ''}">
                          ${m.player2Seed ? `[${m.player2Seed}] ` : ''}${m.player2 || 'TBD'}
                        </td>
                        <td style="text-align:center; padding:6px 10px; border:1px solid #ddd;">
                          ${m.isBye ? '<span style="color:#6b7280;">Bye</span>' : m.completed ? `<strong style="color:#15803d;">Won by ${m.winner}</strong>` : '<span style="color:#d97706;">Pending</span>'}
                        </td>
                      </tr>
                    `)
                    .join('')}
                </tbody>
              </table>
            </div>
          `)
          .join('')}
      </div>
    `;
  } else {
    // Pools & Knockout format
    const poolsHtml = tournament.pools
      .map((pool) => {
        const standings = calculateStandings(pool);
        return `
          <div style="margin-bottom:16px;">
            <h3 style="margin:4px 0 8px 0; font-size:15px; color:#1d4ed8;">${pool.name} Standings</h3>
            <table>
              <thead>
                <tr>
                  <th style="text-align:center; width:40px;">Rank</th>
                  <th>Player</th>
                  <th style="text-align:center;">Played</th>
                  <th style="text-align:center;">Won</th>
                  <th style="text-align:center;">Lost</th>
                  <th style="text-align:center;">Leg Diff</th>
                  <th style="text-align:center;">3-Dart Avg</th>
                  <th style="text-align:center;">High Finish</th>
                </tr>
              </thead>
              <tbody>
                ${standings
                  .map(
                    (p, idx) => `
                  <tr>
                    <td style="text-align:center; font-weight:bold; padding:6px 8px; border:1px solid #ddd;">${idx + 1}</td>
                    <td style="font-weight:600; padding:6px 8px; border:1px solid #ddd;">${p.name}</td>
                    <td style="text-align:center; padding:6px 8px; border:1px solid #ddd;">${p.played}</td>
                    <td style="text-align:center; padding:6px 8px; border:1px solid #ddd;">${p.wins}</td>
                    <td style="text-align:center; padding:6px 8px; border:1px solid #ddd;">${p.losses}</td>
                    <td style="text-align:center; padding:6px 8px; border:1px solid #ddd;">${p.legDiff}</td>
                    <td style="text-align:center; font-weight:bold; padding:6px 8px; border:1px solid #ddd;">${p.threeDartAvg.toFixed(1)}</td>
                    <td style="text-align:center; padding:6px 8px; border:1px solid #ddd;">${p.highFinish}</td>
                  </tr>
                `,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        `;
      })
      .join('');

    contentHtml = `
      <div class="section-title">Tournament Pools & Standings</div>
      ${poolsHtml}
    `;
  }

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${tournament.name} - Tournament Scoresheet</title>
      <style>
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #1f2937;
          background: #ffffff;
          margin: 0;
          padding: 20px;
          line-height: 1.5;
        }
        h1 { margin: 0 0 4px 0; font-size: 24px; color: #111827; }
        .meta { color: #6b7280; font-size: 13px; margin-bottom: 20px; }
        .section-title { font-size: 16px; font-weight: bold; margin: 20px 0 8px 0; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px; }
        th { background: #f3f4f6; color: #374151; font-weight: 700; text-align: left; padding: 8px 12px; border: 1px solid #ddd; }
      </style>
    </head>
    <body>
      <div style="border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin-bottom: 16px;">
        <h1>${tournament.name}</h1>
        <div class="meta">
          <strong>Format:</strong> ${tournament.format === 'challonge_single_elim' ? 'Challonge Elimination Bracket' : 'Pools & Knockout'} &bull;
          <strong>Game:</strong> ${tournament.gameMode} (${tournament.doubleOut ? 'Double-Out' : 'Single-Out'}) &bull;
          <strong>Champion:</strong> <span style="color:#15803d; font-weight:bold;">${tournament.champion || 'Undecided'}</span> &bull;
          <strong>Generated:</strong> ${dateStr}
        </div>
      </div>

      ${contentHtml}
    </body>
    </html>
  `;
}

export function exportMatchReportToPdf(match: MatchState, title?: string): boolean {
  const html = generateMatchReportHtml(match, title);
  return printHtmlDocument(html);
}

export function exportTournamentBracketToPdf(tournament: TournamentState): boolean {
  const html = generateTournamentBracketHtml(tournament);
  return printHtmlDocument(html);
}

