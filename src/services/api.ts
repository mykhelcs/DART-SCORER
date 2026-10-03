import { MatchState, TournamentState, AuditLog } from '../core/types';

const API_BASE = 'http://localhost:3001/api';

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: 'GET' });
    if (!res.ok) return false;
    const data = await res.json();
    return data.status === 'ok';
  } catch {
    return false;
  }
}

export async function apiSaveTournament(tournament: TournamentState): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/tournaments/${tournament.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tournament),
    });
    if (res.status === 404) {
      // Create if doesn't exist
      const createRes = await fetch(`${API_BASE}/tournaments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tournament.name,
          players: tournament.pools.flatMap((p) => p.players),
          poolLegsToWin: tournament.poolLegsToWin,
          koSemiLegsToWin: tournament.koSemiLegsToWin,
          koFinalLegsToWin: tournament.koFinalLegsToWin,
        }),
      });
      return createRes.ok;
    }
    return res.ok;
  } catch {
    return false;
  }
}

export async function apiLoadTournaments(): Promise<TournamentState[]> {
  try {
    const res = await fetch(`${API_BASE}/tournaments`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.tournaments || [];
  } catch {
    return [];
  }
}

export async function apiSaveMatch(id: string, match: MatchState): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/matches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, match }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function apiLoadMatch(id: string): Promise<MatchState | null> {
  try {
    const res = await fetch(`${API_BASE}/matches/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.match || null;
  } catch {
    return null;
  }
}

export async function apiSaveAuditLog(
  log: Omit<AuditLog, 'id' | 'timestamp'> & { id?: string; timestamp?: string },
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/audit-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function apiGetAuditLogs(options?: {
  limit?: number;
  entityType?: string;
  entityId?: string;
}): Promise<AuditLog[]> {
  try {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.entityType) params.set('entityType', options.entityType);
    if (options?.entityId) params.set('entityId', options.entityId);

    const queryString = params.toString();
    const url = `${API_BASE}/audit-logs${queryString ? `?${queryString}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.auditLogs || [];
  } catch {
    return [];
  }
}

