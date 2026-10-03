import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createServerApp } from '../app';
import { initDb, listAuditLogsDb } from '../db/database';
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

  it('saves and fetches match logs via /api/matches/:id/logs', async () => {
    const matchData = {
      id: 'm-logs-1',
      match: {
        mode: 501,
        doubleOut: true,
        legsToWin: 3,
        cur: 0,
        currentLeg: 1,
        starter: 0,
        visit: [],
        over: false,
        winner: null,
        players: [{ name: 'P1', score: 501, legs: 0, darts: 0, points: 0, high: 0, ton: 0, t40: 0, one80: 0, bestOut: 0, lastVisit: '-' }],
        history: [],
        logs: [
          {
            id: 'log-1',
            leg: 1,
            playerIndex: 0,
            playerName: 'P1',
            darts: [{ m: 3, n: 20 }],
            visitTotal: 60,
            scoreBefore: 501,
            scoreAfter: 441,
            isBust: false,
            isCheckout: false,
            timestamp: new Date().toISOString(),
          },
        ],
      },
    };

    const postRes = await request(app).post('/api/matches').send(matchData);
    expect(postRes.status).toBe(200);

    const logRes = await request(app).get('/api/matches/m-logs-1/logs');
    expect(logRes.status).toBe(200);
    expect(logRes.body.logs).toHaveLength(1);
    expect(logRes.body.logs[0].visitTotal).toBe(60);
    expect(logRes.body.logs[0].playerName).toBe('P1');
  });

  it('records audit logs automatically on tournament creation and match saves, and exposes /api/audit-logs', async () => {
    // Create a tournament
    await request(app)
      .post('/api/tournaments')
      .send({
        name: 'Audit Cup',
        players: ['Player A', 'Player B'],
      });

    // Query audit logs
    const auditRes = await request(app).get('/api/audit-logs');
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.auditLogs.length).toBeGreaterThanOrEqual(1);
    expect(auditRes.body.auditLogs[0].action).toBe('CREATE_TOURNAMENT');

    // Post custom audit log
    const postAuditRes = await request(app)
      .post('/api/audit-logs')
      .send({
        action: 'MATCH_UNDO',
        entityType: 'scorer',
        entityId: 'match-1',
        details: 'Scorer undid last dart due to caller confirmation',
      });
    expect(postAuditRes.status).toBe(201);
    expect(postAuditRes.body.auditLog.action).toBe('MATCH_UNDO');

    // Verify filter
    const scorerOnly = await request(app).get('/api/audit-logs?entityType=scorer');
    expect(scorerOnly.status).toBe(200);
    expect(scorerOnly.body.auditLogs).toHaveLength(1);
    expect(scorerOnly.body.auditLogs[0].action).toBe('MATCH_UNDO');
  });

  it('accepts payloads larger than default 100kb without PayloadTooLargeError', async () => {
    // Generate a payload ~ 300KB
    const largeLogs = [];
    for (let i = 0; i < 2000; i++) {
      largeLogs.push({
        id: `large-log-${i}`,
        leg: 1,
        playerIndex: 0,
        playerName: `LongPlayerName_${i}`,
        scoreBefore: 501,
        scoreAfter: 481,
        darts: [{ m: 1, n: 20 }],
        visitTotal: 20,
        isBust: false,
        isCheckout: false,
        timestamp: new Date().toISOString(),
      });
    }

    const largeMatch = {
      id: 'match-large',
      match: {
        mode: 501,
        doubleOut: true,
        legsToWin: 5,
        cur: 0,
        starter: 0,
        visit: [],
        over: false,
        winner: null,
        players: [{ name: 'Player 1', score: 501, legs: 0, darts: 0, points: 0, high: 0, ton: 0, t40: 0, one80: 0, bestOut: 0, lastVisit: '-' }],
        history: [],
        logs: largeLogs,
      },
    };

    const res = await request(app).post('/api/matches').send(largeMatch);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('match-large');
  });

  it('catches and audits PayloadTooLargeError when payload exceeds threshold', async () => {
    const tinyApp = createServerApp(db, { bodyLimit: '100b' });
    const payload = { data: 'x'.repeat(300) };

    const res = await request(tinyApp).post('/api/matches').send(payload);
    expect(res.status).toBe(413);
    expect(res.body.error).toBe('Payload too large');

    // Verify it recorded an audit log in SQLite
    const auditLogs = listAuditLogsDb(db, { entityType: 'system' });
    expect(auditLogs.length).toBeGreaterThanOrEqual(1);
    expect(auditLogs[0].action).toBe('PAYLOAD_TOO_LARGE');
  });
});



