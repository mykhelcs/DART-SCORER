import React, { useState, useEffect, useRef } from 'react';
import {
  exportPlayerStatsToCsv,
  exportGameLogsToCsv,
  exportStandingsToCsv,
  exportChallongeBracketToCsv,
  exportAuditLogsToCsv,
  exportMatchReportToPdf,
  exportTournamentBracketToPdf,
  downloadFile,
} from '../services/export';
import {
  loadCurrentMatch,
  saveCurrentMatch,
  loadTournament,
  saveTournament,
} from '../services/storage';
import {
  checkBackendHealth,
  apiGetAuditLogs,
  apiSaveMatch,
  apiSaveTournament,
} from '../services/api';
import { AuditLog } from '../core/types';

export const ExportView: React.FC = () => {
  const match = loadCurrentMatch();
  const tournament = loadTournament();
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const logs = await apiGetAuditLogs({ limit: 50 });
      setAuditLogs(logs);
    } catch {
      setAuditLogs([]);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    checkBackendHealth().then((isHealthy) => {
      setBackendConnected(isHealthy);
      if (isHealthy) {
        fetchAuditLogs();
      }
    });
  }, []);

  // Match exports
  const handleExportMatchStatsCsv = () => {
    if (!match) {
      alert('No active match records found to export.');
      return;
    }
    const csv = exportPlayerStatsToCsv(match.players);
    downloadFile(csv, `match_players_${Date.now()}.csv`);
  };

  const handleExportMatchLogsCsv = () => {
    if (!match || !match.logs || match.logs.length === 0) {
      alert('No round logs recorded for the active match yet.');
      return;
    }
    const csv = exportGameLogsToCsv(match.logs);
    downloadFile(csv, `match_round_logs_${Date.now()}.csv`);
  };

  const handleExportMatchPdf = () => {
    if (!match) {
      alert('No active match available to generate report.');
      return;
    }
    exportMatchReportToPdf(match);
  };

  // Tournament exports
  const handleExportTournamentCsv = () => {
    if (!tournament) {
      alert('No tournament records found to export.');
      return;
    }

    if (tournament.format === 'challonge_single_elim') {
      const csv = exportChallongeBracketToCsv(tournament);
      downloadFile(csv, `${tournament.name.replace(/\s+/g, '_')}_challonge_bracket.csv`);
    } else {
      if (tournament.pools.length === 0) {
        alert('No tournament pools found to export.');
        return;
      }
      const fullCsv = tournament.pools
        .map((pool) => `--- ${pool.name} ---\n` + exportStandingsToCsv(pool))
        .join('\n\n');
      downloadFile(fullCsv, `${tournament.name.replace(/\s+/g, '_')}_pools.csv`);
    }
  };

  const handleExportTournamentPdf = () => {
    if (!tournament) {
      alert('No active tournament found to export.');
      return;
    }
    exportTournamentBracketToPdf(tournament);
  };

  // Full backup and restore
  const handleExportJsonBackup = () => {
    const backupData = {
      timestamp: new Date().toISOString(),
      match,
      tournament,
    };
    downloadFile(
      JSON.stringify(backupData, null, 2),
      `darts_scorer_backup_${Date.now()}.json`,
      'application/json',
    );
  };

  const handleTriggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        let restoredCount = 0;
        if (parsed.match && parsed.match.players && Array.isArray(parsed.match.players)) {
          saveCurrentMatch(parsed.match);
          if (backendConnected) {
            const matchId = parsed.match.id || `match-${Date.now()}`;
            await apiSaveMatch(matchId, parsed.match).catch(() => {});
          }
          restoredCount++;
        }

        if (parsed.tournament && parsed.tournament.name) {
          saveTournament(parsed.tournament);
          if (backendConnected) {
            await apiSaveTournament(parsed.tournament).catch(() => {});
          }
          restoredCount++;
        }

        if (restoredCount > 0) {
          setRestoreMessage(`✓ Restored backup successfully (${restoredCount} dataset(s) imported).`);
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          alert('Could not find valid match or tournament records in this backup file.');
        }
      } catch (err) {
        alert(`Failed to parse backup JSON file: ${(err as Error).message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportAuditLogsCsv = () => {
    if (!auditLogs || auditLogs.length === 0) {
      alert('No audit logs available to export.');
      return;
    }
    const csv = exportAuditLogsToCsv(auditLogs);
    downloadFile(csv, `audit_logs_${Date.now()}.csv`);
  };

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        style={{ display: 'none' }}
      />

      {restoreMessage && (
        <div
          style={{
            background: '#14532d',
            color: '#bbf7d0',
            border: '1px solid #22c55e',
            borderRadius: '6px',
            padding: '12px 16px',
            fontWeight: 600,
          }}
        >
          {restoreMessage}
        </div>
      )}

      {/* Match Exports Panel */}
      <div className="card-panel">
        <h2>Match Data & Reports</h2>
        <p style={{ color: 'var(--muted)' }}>
          Active match:{' '}
          <strong style={{ color: 'var(--cream)' }}>
            {match ? match.players.map((p) => p.name).join(' vs ') : 'No active match'}
          </strong>
        </p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px' }}>
          <button className="btn pri" onClick={handleExportMatchStatsCsv} disabled={!match}>
            Export Match Stats (CSV)
          </button>
          <button className="btn pri" onClick={handleExportMatchLogsCsv} disabled={!match || !match.logs?.length}>
            Export Round Logs (CSV)
          </button>
          <button
            className="btn"
            style={{ background: '#1e293b', border: '1px solid #475569', color: '#f8fafc' }}
            onClick={handleExportMatchPdf}
            disabled={!match}
          >
            📄 Export Match Report (PDF)
          </button>
        </div>
      </div>

      {/* Tournament Exports Panel */}
      <div className="card-panel">
        <h2>Tournament Data & Brackets</h2>
        <p style={{ color: 'var(--muted)' }}>
          Active tournament:{' '}
          <strong style={{ color: 'var(--cream)' }}>
            {tournament
              ? `${tournament.name} (${
                  tournament.format === 'challonge_single_elim'
                    ? 'Challonge Elimination'
                    : `${tournament.pools.length} Pools`
                })`
              : 'No active tournament'}
          </strong>
        </p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px' }}>
          <button className="btn pri" onClick={handleExportTournamentCsv} disabled={!tournament}>
            {tournament?.format === 'challonge_single_elim'
              ? 'Export Challonge Matches (CSV)'
              : 'Export Tournament Pools (CSV)'}
          </button>
          <button
            className="btn"
            style={{ background: '#1e293b', border: '1px solid #475569', color: '#f8fafc' }}
            onClick={handleExportTournamentPdf}
            disabled={!tournament}
          >
            📄 Export Tournament Bracket (PDF)
          </button>
        </div>
      </div>

      {/* System Backup & Restore Panel */}
      <div className="card-panel">
        <h2>JSON System Backup & Restore</h2>
        <p style={{ color: 'var(--muted)' }}>
          Create full backups of your current matches and tournament state, or restore from a previously exported backup file.
        </p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px' }}>
          <button className="btn sec" onClick={handleExportJsonBackup}>
            💾 Download Full JSON Backup
          </button>
          <button
            className="btn"
            style={{ background: '#0f766e', border: '1px solid #14b8a6', color: '#ccfbf1' }}
            onClick={handleTriggerFileInput}
          >
            📤 Restore / Import JSON Backup
          </button>
          <button className="btn sec" onClick={handleExportAuditLogsCsv} disabled={auditLogs.length === 0}>
            Export Audit Logs (CSV)
          </button>
        </div>
      </div>

      {/* Audit Logs Panel */}
      <div className="card-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h3 style={{ margin: 0 }}>System & Tournament Audit Logs</h3>
            <p style={{ color: 'var(--muted)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
              Official immutable record of matches, undos, and tournament events for dispute verification.
            </p>
          </div>
          <button
            className="btn sec"
            onClick={fetchAuditLogs}
            disabled={loadingAudit || !backendConnected}
            style={{ fontSize: '13px', padding: '6px 12px' }}
          >
            {loadingAudit ? 'Refreshing...' : '↻ Refresh Logs'}
          </button>
        </div>

        {!backendConnected ? (
          <div style={{ padding: '16px', background: '#1c1f26', borderRadius: '6px', color: '#8b949e', fontSize: '14px' }}>
            Backend API offline. Connect backend to view centralized SQLite audit logs.
          </div>
        ) : auditLogs.length === 0 ? (
          <div style={{ padding: '16px', background: '#1c1f26', borderRadius: '6px', color: '#8b949e', fontSize: '14px' }}>
            No audit events recorded yet. Match saves and tournament events will appear here automatically.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '350px', border: '1px solid #30363d', borderRadius: '6px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#21262d', borderBottom: '1px solid #30363d', color: '#e6edf3' }}>
                  <th style={{ padding: '8px 12px' }}>Timestamp</th>
                  <th style={{ padding: '8px 12px' }}>Action</th>
                  <th style={{ padding: '8px 12px' }}>Type</th>
                  <th style={{ padding: '8px 12px' }}>Entity ID</th>
                  <th style={{ padding: '8px 12px' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #21262d' }}>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: '#8b949e', fontSize: '12px' }}>
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: '#f0883e' }}>
                      {log.action}
                    </td>
                    <td style={{ padding: '8px 12px', color: '#58a6ff' }}>
                      {log.entityType}
                    </td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#8b949e' }}>
                      {log.entityId || '-'}
                    </td>
                    <td style={{ padding: '8px 12px', color: '#c9d1d9' }}>
                      {log.details || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Storage and backend health status */}
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
            Tournament:{' '}
            <strong>
              {tournament
                ? `${tournament.name} (${
                    tournament.format === 'challonge_single_elim'
                      ? 'Challonge Elimination'
                      : `${tournament.pools.length} pools`
                  })`
                : 'None'}
            </strong>
          </li>
        </ul>
      </div>
    </div>
  );
};
