import { describe, it, expect } from 'vitest';
import {
  createTournament,
  recordPoolMatchResult,
  calculateStandings,
  generateKnockoutFromPools,
  recordKnockoutMatchResult,
  createChallongeTournament,
  recordChallongeMatchResult,
  areAllPoolMatchesCompleted,
  getPlayableTournamentMatches,
  advanceTournamentProgression,
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

  describe('Challonge-Style Bracket Engine', () => {
    it('creates a 4-player single elimination bracket with Semi-Finals and Final', () => {
      const tourney = createChallongeTournament({
        name: 'Challonge Cup 4',
        players: ['Alice', 'Bob', 'Charlie', 'Dave'],
        legsToWin: 3,
      });

      expect(tourney.format).toBe('challonge_single_elim');
      expect(tourney.challongeMatches).toBeDefined();
      const matches = tourney.challongeMatches!;
      // 2 Semis + 1 Final = 3 matches
      expect(matches).toHaveLength(3);

      const semis = matches.filter((m) => m.roundName === 'Semi-Final');
      const finalMatch = matches.find((m) => m.roundName === 'Championship Final');
      expect(semis).toHaveLength(2);
      expect(finalMatch).toBeDefined();

      // Seed pairings: #1 Alice vs #4 Dave, #2 Bob vs #3 Charlie
      expect(semis[0].player1).toBe('Alice');
      expect(semis[0].player1Seed).toBe(1);
      expect(semis[0].player2).toBe('Dave');
      expect(semis[0].player2Seed).toBe(4);

      expect(semis[1].player1).toBe('Bob');
      expect(semis[1].player1Seed).toBe(2);
      expect(semis[1].player2).toBe('Charlie');
      expect(semis[1].player2Seed).toBe(3);
    });

    it('assigns byes to top seeds when player count is not a power of 2 (e.g. 6 players in size-8 bracket)', () => {
      const tourney = createChallongeTournament({
        name: 'Challonge 6 Players',
        players: ['Seed 1', 'Seed 2', 'Seed 3', 'Seed 4', 'Seed 5', 'Seed 6'],
        legsToWin: 3,
      });

      const matches = tourney.challongeMatches!;
      // 4 QFs + 2 Semis + 1 Final = 7 matches
      expect(matches).toHaveLength(7);

      // Seed 1 and Seed 2 receive Byes in QF and advance directly to Semis
      const qfWithByes = matches.filter((m) => m.isBye && m.completed);
      expect(qfWithByes).toHaveLength(2);

      const semi1 = matches.find((m) => m.roundName === 'Semi-Final' && m.matchNumber === 1);
      const semi2 = matches.find((m) => m.roundName === 'Semi-Final' && m.matchNumber === 2);

      expect(semi1?.player1).toBe('Seed 1');
      expect(semi2?.player1).toBe('Seed 2');
    });

    it('advances winners through rounds and crowns the champion upon final victory', () => {
      let tourney = createChallongeTournament({
        name: 'Title Match',
        players: ['Alice', 'Bob', 'Charlie', 'Dave'],
        legsToWin: 3,
      });

      const matches = tourney.challongeMatches!;
      const semi1 = matches.find((m) => m.roundName === 'Semi-Final' && m.matchNumber === 1)!;
      const semi2 = matches.find((m) => m.roundName === 'Semi-Final' && m.matchNumber === 2)!;

      // Alice beats Dave 3-1 in Semi 1
      tourney = recordChallongeMatchResult(tourney, semi1.id, 3, 1);
      // Bob beats Charlie 3-2 in Semi 2
      tourney = recordChallongeMatchResult(tourney, semi2.id, 3, 2);

      const finalMatch = tourney.challongeMatches!.find((m) => m.roundName === 'Championship Final')!;
      expect(finalMatch.player1).toBe('Alice');
      expect(finalMatch.player2).toBe('Bob');
      expect(finalMatch.completed).toBe(false);
      expect(tourney.champion).toBeNull();

      // Alice beats Bob 3-0 in Championship Final
      tourney = recordChallongeMatchResult(tourney, finalMatch.id, 3, 0);
      const completedFinal = tourney.challongeMatches!.find((m) => m.roundName === 'Championship Final')!;
      expect(completedFinal.completed).toBe(true);
      expect(completedFinal.winner).toBe('Alice');
      expect(tourney.champion).toBe('Alice');
    });

    it('supports 1 leg on early rounds and pool stages', () => {
      // 1. Pools format
      const poolTourney = createTournament({
        name: 'Fast 1-Leg Pools',
        players: ['P1', 'P2', 'P3', 'P4'],
        poolLegsToWin: 1,
      });
      expect(poolTourney.poolLegsToWin).toBe(1);
      expect(poolTourney.pools[0].fixtures.every((f) => f.legsToWin === 1)).toBe(true);

      // 2. Challonge single elim format
      const challongeTourney = createChallongeTournament({
        name: 'Fast 1-Leg Challonge',
        players: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
        legsToWin: 1, // early rounds
        semiLegsToWin: 2,
        finalLegsToWin: 3,
      });

      const qfMatches = challongeTourney.challongeMatches!.filter((m) => m.roundName === 'Quarter-Final');
      expect(qfMatches.length).toBe(4);
      expect(qfMatches.every((m) => m.legsToWin === 1)).toBe(true);

      const semiMatches = challongeTourney.challongeMatches!.filter((m) => m.roundName === 'Semi-Final');
      expect(semiMatches.every((m) => m.legsToWin === 2)).toBe(true);

      const finalMatch = challongeTourney.challongeMatches!.find((m) => m.roundName === 'Championship Final')!;
      expect(finalMatch.legsToWin).toBe(3);
    });

    it('automatically advances progression from 2 round-robin pools to semifinals, final and champion', () => {
      let tourney = createTournament({
        name: 'Auto-Advance Darts',
        players: ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'],
        poolLegsToWin: 1,
        koSemiLegsToWin: 2,
        koFinalLegsToWin: 3,
      });

      expect(areAllPoolMatchesCompleted(tourney)).toBe(false);

      // Initially, getPlayableTournamentMatches returns all 12 pool matches (6 in Pool A, 6 in Pool B)
      const initialMatches = getPlayableTournamentMatches(tourney);
      expect(initialMatches).toHaveLength(12);
      expect(initialMatches[0].stage).toBe('pool');
      expect(initialMatches[0].legsToWin).toBe(1);

      // Play all 6 matches in Pool A:
      // Make A1 win all matches (3-0), A2 win 2 matches (2-1), A3 win 1, A4 win 0
      for (const fix of tourney.pools[0].fixtures) {
        let p1Wins = true;
        if (fix.player1 === 'A1' || fix.player2 === 'A1') {
          p1Wins = fix.player1 === 'A1';
        } else if (fix.player1 === 'A2' || fix.player2 === 'A2') {
          p1Wins = fix.player1 === 'A2';
        }
        tourney = recordPoolMatchResult(tourney, 'pool-a', fix.id, {
          player1Legs: p1Wins ? 1 : 0,
          player2Legs: p1Wins ? 0 : 1,
        });
      }

      // Pool A finished, but Pool B still pending
      expect(areAllPoolMatchesCompleted(tourney)).toBe(false);

      // Play all 6 matches in Pool B:
      // Make B1 win 3 matches, B2 win 2 matches
      for (const fix of tourney.pools[1].fixtures) {
        let p1Wins = true;
        if (fix.player1 === 'B1' || fix.player2 === 'B1') {
          p1Wins = fix.player1 === 'B1';
        } else if (fix.player1 === 'B2' || fix.player2 === 'B2') {
          p1Wins = fix.player1 === 'B2';
        }
        tourney = recordPoolMatchResult(tourney, 'pool-b', fix.id, {
          player1Legs: p1Wins ? 1 : 0,
          player2Legs: p1Wins ? 0 : 1,
        });
      }

      // Now all pool matches are complete!
      expect(areAllPoolMatchesCompleted(tourney)).toBe(true);

      // Advance progression automatically
      const adv1 = advanceTournamentProgression(tourney);
      expect(adv1.stageEvent).toBe('pools_completed');
      tourney = adv1.updatedTournament;

      // Knockout bracket must be automatically generated with Semifinals:
      // 1A (A1) vs 2B (B2) and 1B (B1) vs 2A (A2)
      expect(tourney.knockoutMatches.length).toBeGreaterThanOrEqual(3);
      const semi1 = tourney.knockoutMatches.find((m) => m.id === 'ko-semi-1')!;
      const semi2 = tourney.knockoutMatches.find((m) => m.id === 'ko-semi-2')!;
      expect(semi1.player1).toBe('A1');
      expect(semi1.player2).toBe('B2');
      expect(semi2.player1).toBe('B1');
      expect(semi2.player2).toBe('A2');

      // Now getPlayableTournamentMatches should include the unlocked Semifinals!
      const activeSemis = getPlayableTournamentMatches(tourney).filter((m) => m.stage === 'knockout');
      expect(activeSemis).toHaveLength(2);
      expect(activeSemis[0].legsToWin).toBe(2);

      // Play Semi 1: A1 beats B2 (2-0)
      tourney = recordKnockoutMatchResult(tourney, 'ko-semi-1', {
        player1Legs: 2,
        player2Legs: 0,
      });

      // Play Semi 2: B1 beats A2 (2-1)
      tourney = recordKnockoutMatchResult(tourney, 'ko-semi-2', {
        player1Legs: 2,
        player2Legs: 1,
      });

      // Advance progression after Semis
      const adv2 = advanceTournamentProgression(tourney);
      tourney = adv2.updatedTournament;

      // Final should now be populated with A1 vs B1!
      const finalMatch = tourney.knockoutMatches.find((m) => m.id === 'ko-final')!;
      expect(finalMatch.player1).toBe('A1');
      expect(finalMatch.player2).toBe('B1');
      expect(finalMatch.completed).toBe(false);

      // Play Championship Final: A1 beats B1 (3-1)
      tourney = recordKnockoutMatchResult(tourney, 'ko-final', {
        player1Legs: 3,
        player2Legs: 1,
      });

      // Final progression
      const adv3 = advanceTournamentProgression(tourney);
      expect(adv3.stageEvent).toBe('champion_crowned');
      expect(adv3.updatedTournament.champion).toBe('A1');
    });
  });
});

