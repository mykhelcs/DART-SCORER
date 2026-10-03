import { describe, it, expect } from 'vitest';
import {
  createTournament,
  recordPoolMatchResult,
  calculateStandings,
  generateKnockoutFromPools,
  recordKnockoutMatchResult,
} from '../tournament';

describe('Tournament Engine (Pools and Knockout)', () => {
  const players = [
    'Player A', 'Player B', 'Player C', 'Player D',
    'Player E', 'Player F', 'Player G', 'Player H',
  ];

  it('creates tournament with pools of 4 and scheduled round-robin fixtures', () => {
    const tournament = createTournament({
      name: 'Intramurals 2026',
      players,
      poolLegsToWin: 2,
    });

    expect(tournament.name).toBe('Intramurals 2026');
    expect(tournament.pools).toHaveLength(2); // 8 players = 2 pools of 4
    expect(tournament.pools[0].name).toBe('Pool A');
    expect(tournament.pools[1].name).toBe('Pool B');
    expect(tournament.pools[0].players).toHaveLength(4);
    // In a 4-player pool, total round robin matches = 4 * 3 / 2 = 6 matches
    expect(tournament.pools[0].fixtures).toHaveLength(6);
    expect(tournament.pools[0].standings).toHaveLength(4);
  });

  it('correctly updates standings and ranks players by: wins, then leg diff, then 3-dart average', () => {
    const tournament = createTournament({
      name: 'Test Tournament',
      players: ['P1', 'P2', 'P3', 'P4'],
      poolLegsToWin: 2,
    });

    const pool = tournament.pools[0];
    const fixture1 = pool.fixtures[0]; // P1 vs P2

    // P1 wins 2-0 against P2 with 100 points, 6 darts (50.0 avg)
    const updatedTournament = recordPoolMatchResult(tournament, pool.id, fixture1.id, {
      player1Legs: 2,
      player2Legs: 0,
      player1Stats: { points: 100, darts: 6, highFinish: 40 },
      player2Stats: { points: 60, darts: 6, highFinish: 0 },
    });

    const standings = calculateStandings(updatedTournament.pools[0]);
    expect(standings[0].name).toBe('P1');
    expect(standings[0].wins).toBe(1);
    expect(standings[0].legsFor).toBe(2);
    expect(standings[0].legsAgainst).toBe(0);
    expect(standings[0].legDiff).toBe(2);
    expect(standings[0].threeDartAvg).toBe(50.0);

    expect(standings[3].name).toBe('P2');
    expect(standings[3].wins).toBe(0);
    expect(standings[3].legDiff).toBe(-2);
  });

  it('generates knockout bracket when pool matches complete with top 2 advancing', () => {
    let tournament = createTournament({
      name: 'Championship',
      players,
      poolLegsToWin: 2,
    });

    // Simulate completion of all fixtures in Pool A and Pool B
    for (const pool of tournament.pools) {
      for (let i = 0; i < pool.fixtures.length; i++) {
        const f = pool.fixtures[i];
        // player1 always wins 2-0
        tournament = recordPoolMatchResult(tournament, pool.id, f.id, {
          player1Legs: 2,
          player2Legs: 0,
          player1Stats: { points: 120, darts: 6, highFinish: 32 },
          player2Stats: { points: 60, darts: 6, highFinish: 0 },
        });
      }
    }

    const tournamentWithKO = generateKnockoutFromPools(tournament);
    expect(tournamentWithKO.knockoutMatches.length).toBeGreaterThan(0);

    // Semis & Final for 4 advancing players (top 2 from 2 pools = 4 players)
    const semis = tournamentWithKO.knockoutMatches.filter((m) => m.round === 'Semi-Final');
    expect(semis).toHaveLength(2);
    expect(semis[0].player1).toBeDefined();
    expect(semis[0].player2).toBeDefined();
  });

  it('records knockout match progress and awards championship', () => {
    let tournament = createTournament({
      name: 'Fast KO',
      players: ['A', 'B', 'C', 'D'],
      poolLegsToWin: 2,
    });

    // Force knockout generation with A, B, C, D
    tournament.pools[0].standings[0].wins = 3;
    tournament.pools[0].standings[1].wins = 2;
    tournament = generateKnockoutFromPools(tournament);

    // Semis
    const semi1 = tournament.knockoutMatches.find((m) => m.round === 'Semi-Final' && m.matchNumber === 1);
    expect(semi1).toBeDefined();

    tournament = recordKnockoutMatchResult(tournament, semi1!.id, {
      player1Legs: 3,
      player2Legs: 1,
    });

    const finalMatch = tournament.knockoutMatches.find((m) => m.round === 'Final');
    expect(finalMatch).toBeDefined();

    // Final
    tournament = recordKnockoutMatchResult(tournament, finalMatch!.id, {
      player1Legs: 5,
      player2Legs: 2,
    });
    const updatedFinal = tournament.knockoutMatches.find((m) => m.round === 'Final');
    expect(tournament.champion).toBe(updatedFinal!.winner);
    expect(tournament.champion).toBe('A');
  });

  it('supports 16 players across 4 pools with 8 advancing to Quarter-Finals', () => {
    const sixteenPlayers = Array.from({ length: 16 }, (_, i) => `Player ${i + 1}`);
    let tournament = createTournament({
      name: 'Big 16 Tourney',
      players: sixteenPlayers,
      poolLegsToWin: 2,
    });

    expect(tournament.pools).toHaveLength(4);
    tournament = generateKnockoutFromPools(tournament);
    const qfs = tournament.knockoutMatches.filter((m) => m.round === 'Quarter-Final');
    expect(qfs).toHaveLength(4);

    // Play QF 1
    tournament = recordKnockoutMatchResult(tournament, qfs[0].id, {
      player1Legs: 3,
      player2Legs: 0,
    });
    const semi1 = tournament.knockoutMatches.find((m) => m.round === 'Semi-Final' && m.matchNumber === 1);
    expect(semi1?.player1).toBe(qfs[0].player1);
  });
});
