import React, { useState, useEffect } from 'react';
import { exportPlayerStatsToCsv, exportStandingsToCsv, downloadFile } from '../services/export';
import { loadCurrentMatch, loadTournament } from '../services/storage';
import { checkBackendHealth } from '../services/api';

export const ExportView: React.FC = () => {
  const match = loadCurrentMatch();
  const tournament = loadTournament();
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);

  useEffect(() => {
    checkBackendHealth().then((isHealthy) => setBackendConnected(isHealthy));
  }, []);

  const handleExportMatchCsv = () => {
    if (!match) {
      alert('No active match records found to export.');
      return;
    }
    const csv = exportPlayerStatsToCsv(match.players);
    downloadFile(csv, `match_players_${Date.now()}.csv`);
  };

  const handleExportTournamentCsv = () => {
    if (!tournament || tournament.pools.length === 0) {
      alert('No tournament pools found to export.');
      return;
    }
    const fullCsv = tournament.pools
      .map((pool) => `--- ${pool.name} ---\n` + exportStandingsToCsv(pool))
      .join('\n\n');
    downloadFile(fullCsv, `${tournament.name.replace(/\s+/g, '_')}_pools.csv`);
  };

  const handleExportJsonBackup = () => {
    const backupData = {
      timestamp: new Date().toISOString(),
      match,
      tournament,
    };
    downloadFile(
      JSON.stringify(backupData, null, 2),
      `darts_tournament_backup_${Date.now()}.json`,
      'application/json',
    );
  };

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      <div className="card-panel">
        <h2>Data & Statistical Export</h2>
        <p style={{ color: 'var(--muted)' }}>
          Export match scoresheets, player averages, and tournament standings as CSV files for spreadsheet reporting or printouts.
        </p>

        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginTop: '20px' }}>
          <button className="btn pri" onClick={handleExportMatchCsv}>
            Export Match Stats (CSV)
          </button>
          <button className="btn pri" onClick={handleExportTournamentCsv}>
            Export Tournament Pools (CSV)
          </button>
          <button className="btn sec" onClick={handleExportJsonBackup}>
            Download Full JSON Backup
          </button>
        </div>
      </div>

      <div className="card-panel">
        <h3>Storage & Database Status</h3>
        <p style={{ color: 'var(--muted)' }}>
          Matches and tournament brackets are saved automatically in your browser's offline storage and SQLite database.
        </p>
        <ul style={{ lineHeight: '1.8' }}>
          <li>
            Backend REST API (Port 3001):{' '}
            <strong
              style={{
                color: backendConnected ? '#48c78e' : '#ff857a',
              }}
            >
              {backendConnected === null
                ? 'Checking...'
                : backendConnected
                ? '● Connected (SQLite: backend/data/darts.db)'
                : '○ Offline (Using Browser LocalStorage)'}
            </strong>
          </li>
          <li>
            Active Match: <strong>{match ? `${match.players.map((p) => p.name).join(' vs ')}` : 'None'}</strong>
          </li>
          <li>
            Tournament: <strong>{tournament ? `${tournament.name} (${tournament.pools.length} pools)` : 'None'}</strong>
          </li>
        </ul>
      </div>
    </div>
  );
};
