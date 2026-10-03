import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import {
  saveTournamentDb,
  getTournamentDb,
  listTournamentsDb,
  saveMatchDb,
  getMatchDb,
  listMatchesDb,
  saveMatchLogsDb,
  getMatchLogsDb,
  saveAuditLogDb,
  listAuditLogsDb,
} from './db/database';
import { createTournament } from '../../src/core/tournament';
import { TournamentState, MatchState, AuditLog } from '../../src/core/types';

export function createServerApp(
  db: Database.Database,
  options?: { bodyLimit?: string },
): express.Express {
  const app = express();
  const limit = options?.bodyLimit || '50mb';

  app.use(cors());
  app.use(express.json({ limit }));
  app.use(express.urlencoded({ extended: true, limit }));

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  });

  // Tournaments
  app.get('/api/tournaments', (_req: Request, res: Response) => {
    try {
      const tournaments = listTournamentsDb(db);
      res.json({ tournaments });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.post('/api/tournaments', (req: Request, res: Response) => {
    try {
      const { name, players, poolLegsToWin, koSemiLegsToWin, koFinalLegsToWin } = req.body;
      if (!name || !Array.isArray(players) || players.length === 0) {
        res.status(400).json({ error: 'Name and players list are required.' });
        return;
      }

      const tourney = createTournament({
        name,
        players,
        poolLegsToWin,
        koSemiLegsToWin,
        koFinalLegsToWin,
      });

      saveTournamentDb(db, tourney);
      saveAuditLogDb(db, {
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        action: 'CREATE_TOURNAMENT',
        entityType: 'tournament',
        entityId: tourney.id,
        details: `Tournament "${tourney.name}" created with ${tourney.pools.length} pools`,
        timestamp: new Date().toISOString(),
      });
      res.status(201).json({ tournament: tourney });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.get('/api/tournaments/:id', (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const tourney = getTournamentDb(db, id);
      if (!tourney) {
        res.status(404).json({ error: 'Tournament not found.' });
        return;
      }
      res.json({ tournament: tourney });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.put('/api/tournaments/:id', (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const tourney = req.body as TournamentState;
      if (!tourney || tourney.id !== id) {
        res.status(400).json({ error: 'Invalid tournament payload or ID mismatch.' });
        return;
      }
      saveTournamentDb(db, tourney);
      saveAuditLogDb(db, {
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        action: 'UPDATE_TOURNAMENT',
        entityType: 'tournament',
        entityId: tourney.id,
        details: `Tournament "${tourney.name}" updated${tourney.champion ? ` (Champion: ${tourney.champion})` : ''}`,
        timestamp: new Date().toISOString(),
      });
      res.json({ tournament: tourney });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Matches
  app.get('/api/matches', (_req: Request, res: Response) => {
    try {
      const matches = listMatchesDb(db);
      res.json({ matches });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.get('/api/matches/:id', (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const match = getMatchDb(db, id);
      if (!match) {
        res.status(404).json({ error: 'Match not found.' });
        return;
      }
      res.json({ match });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.get('/api/matches/:id/logs', (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const logs = getMatchLogsDb(db, id);
      res.json({ logs });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.post('/api/matches', (req: Request, res: Response) => {
    try {
      const { id, match, tournamentId } = req.body as {
        id?: string;
        match: MatchState;
        tournamentId?: string;
      };
      const matchId = id || `match-${Date.now()}`;
      saveMatchDb(db, matchId, match, tournamentId);
      if (match && Array.isArray(match.logs) && match.logs.length > 0) {
        saveMatchLogsDb(db, matchId, match.logs);
      }
      saveAuditLogDb(db, {
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        action: match?.over ? 'MATCH_COMPLETED' : 'SAVE_MATCH',
        entityType: 'match',
        entityId: matchId,
        details: `Match saved. Status: ${match?.over ? `Won by ${match.winner}` : 'In progress'}`,
        timestamp: new Date().toISOString(),
      });
      res.json({ id: matchId, match });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Audit Logs
  app.get('/api/audit-logs', (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const entityType = req.query.entityType ? String(req.query.entityType) : undefined;
      const entityId = req.query.entityId ? String(req.query.entityId) : undefined;

      const auditLogs = listAuditLogsDb(db, { limit, entityType, entityId });
      res.json({ auditLogs });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.post('/api/audit-logs', (req: Request, res: Response) => {
    try {
      const { action, entityType, entityId, details } = req.body;
      if (!action || !entityType) {
        res.status(400).json({ error: 'Action and entityType are required.' });
        return;
      }
      const log: AuditLog = {
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        action: String(action),
        entityType,
        entityId: entityId ? String(entityId) : undefined,
        details: details ? String(details) : undefined,
        timestamp: new Date().toISOString(),
      };
      saveAuditLogDb(db, log);
      res.status(201).json({ auditLog: log });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Error handling middleware (e.g., PayloadTooLargeError)
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const errorObj = err as { type?: string; status?: number; message?: string };
    if (errorObj && (errorObj.type === 'entity.too.large' || errorObj.status === 413)) {
      try {
        saveAuditLogDb(db, {
          id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          action: 'PAYLOAD_TOO_LARGE',
          entityType: 'system',
          details: JSON.stringify({ message: errorObj.message, status: 413 }),
          timestamp: new Date().toISOString(),
        });
      } catch (logErr) {
        console.error('Failed to record audit log for payload too large:', logErr);
      }
      res.status(413).json({ error: 'Payload too large', message: errorObj.message });
      return;
    }
    next(err);
  });

  return app;
}
