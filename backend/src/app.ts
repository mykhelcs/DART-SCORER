import express, { Request, Response } from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import {
  saveTournamentDb,
  getTournamentDb,
  listTournamentsDb,
  saveMatchDb,
  getMatchDb,
  listMatchesDb,
} from './db/database';
import { createTournament } from '../../src/core/tournament';
import { TournamentState, MatchState } from '../../src/core/types';

export function createServerApp(db: Database.Database): express.Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

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

  app.post('/api/matches', (req: Request, res: Response) => {
    try {
      const { id, match, tournamentId } = req.body as {
        id?: string;
        match: MatchState;
        tournamentId?: string;
      };
      const matchId = id || `match-${Date.now()}`;
      saveMatchDb(db, matchId, match, tournamentId);
      res.json({ id: matchId, match });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  return app;
}
