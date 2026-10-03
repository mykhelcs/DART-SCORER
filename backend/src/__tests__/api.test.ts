import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createServerApp } from '../app';
import { initDb } from '../db/database';
import Database from 'better-sqlite3';

describe('Backend REST API', () => {
  let db: Database.Database;
  let app: ReturnType<typeof createServerApp>;

  beforeEach(() => {
    db = initDb(':memory:');
    app = createServerApp(db);
  });

  afterEach(() => {
    db.close();
  });

  it('responds with 200 on /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('connected');
  });

  it('creates and lists tournaments via POST and GET /api/tournaments', async () => {
    const createRes = await request(app)
      .post('/api/tournaments')
      .send({
        name: 'Spring Cup 2026',
        players: ['Player 1', 'Player 2', 'Player 3', 'Player 4'],
        poolLegsToWin: 2,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.tournament.name).toBe('Spring Cup 2026');
    const tourneyId = createRes.body.tournament.id;

    // List tournaments
    const listRes = await request(app).get('/api/tournaments');
    expect(listRes.status).toBe(200);
    expect(listRes.body.tournaments).toHaveLength(1);

    // Get specific tournament
    const getRes = await request(app).get(`/api/tournaments/${tourneyId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.tournament.name).toBe('Spring Cup 2026');

    // Update tournament via PUT
    const updatedTourney = { ...getRes.body.tournament, champion: 'Player 1' };
    const putRes = await request(app).put(`/api/tournaments/${tourneyId}`).send(updatedTourney);
    expect(putRes.status).toBe(200);
    expect(putRes.body.tournament.champion).toBe('Player 1');

    // 404 on non-existent tournament
    const notFoundRes = await request(app).get('/api/tournaments/non-existent');
    expect(notFoundRes.status).toBe(404);

    // Validation failure on missing name
    const badRes = await request(app).post('/api/tournaments').send({});
    expect(badRes.status).toBe(400);
  });

  it('saves, fetches, and lists match state via /api/matches', async () => {
    const matchData = {
      id: 'm-123',
      match: {
        mode: 501,
        doubleOut: true,
        legsToWin: 3,
        cur: 0,
        starter: 0,
        visit: [],
        over: false,
        winner: null,
        players: [{ name: 'P1', score: 501, legs: 0, darts: 0, points: 0, high: 0, ton: 0, t40: 0, one80: 0, bestOut: 0, lastVisit: '-' }],
        history: [],
      },
    };

    const postRes = await request(app).post('/api/matches').send(matchData);
    expect(postRes.status).toBe(200);

    const getRes = await request(app).get('/api/matches/m-123');
    expect(getRes.status).toBe(200);
    expect(getRes.body.match.players[0].name).toBe('P1');

    const listRes = await request(app).get('/api/matches');
    expect(listRes.status).toBe(200);
    expect(listRes.body.matches.length).toBeGreaterThanOrEqual(1);

    // 404 for missing match
    const missingRes = await request(app).get('/api/matches/non-existent');
    expect(missingRes.status).toBe(404);
  });
});
