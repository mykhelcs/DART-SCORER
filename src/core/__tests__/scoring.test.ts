import { describe, it, expect } from 'vitest';
import {
  createInitialMatchState,
  getVisitSum,
  throwDart,
  startNextLeg,
  undo,
} from '../scoring';

describe('Scoring Engine', () => {
  it('creates initial match state with valid defaults', () => {
    const state = createInitialMatchState({
      mode: 501,
      doubleOut: true,
      legsToWin: 3,
      playerNames: ['Alice', 'Bob'],
    });

    expect(state.mode).toBe(501);
    expect(state.doubleOut).toBe(true);
    expect(state.legsToWin).toBe(3);
    expect(state.players).toHaveLength(2);
    expect(state.players[0].name).toBe('Alice');
    expect(state.players[0].score).toBe(501);
    expect(state.cur).toBe(0);
    expect(state.starter).toBe(0);
    expect(state.visit).toEqual([]);
    expect(state.over).toBe(false);
  });

  it('calculates visit sums accurately', () => {
    const visit = [
      { m: 3, n: 20 },
      { m: 3, n: 20 },
      { m: 3, n: 20 },
    ];
    expect(getVisitSum(visit)).toBe(180);
  });

  it('scores standard 3-dart visits and advances turn', () => {
    let state = createInitialMatchState({ playerNames: ['Alice', 'Bob'] });

    // Alice throws 180: T20, T20, T20
    const res1 = throwDart(state, { m: 3, n: 20 });
    state = res1.state;
    expect(state.visit).toHaveLength(1);
    expect(res1.event).toBe('none');

    const res2 = throwDart(state, { m: 3, n: 20 });
    state = res2.state;
    expect(state.visit).toHaveLength(2);

    const res3 = throwDart(state, { m: 3, n: 20 });
    state = res3.state;
    expect(res3.event).toBe('turn_end');
    expect(res3.message).toBe('One hundred and eighty!');
    expect(state.players[0].score).toBe(321);
    expect(state.players[0].high).toBe(180);
    expect(state.players[0].one80).toBe(1);
    expect(state.players[0].ton).toBe(1);
    expect(state.players[0].t40).toBe(1);
    expect(state.cur).toBe(1); // Turned to Bob
    expect(state.visit).toEqual([]);
  });

  it('handles bust when remaining score drops below 0', () => {
    let state = createInitialMatchState({ playerNames: ['Alice', 'Bob'] });
    state.players[0].score = 40;

    // Alice throws T20 (60) from 40 => remaining -20 => BUST
    const res = throwDart(state, { m: 3, n: 20 });
    state = res.state;

    expect(res.event).toBe('bust');
    expect(res.message).toContain('Bust!');
    expect(state.players[0].score).toBe(40); // Score remains 40
    expect(state.players[0].lastVisit).toBe('Bust');
    expect(state.cur).toBe(1); // Turn passed to Bob
    expect(state.visit).toEqual([]);
  });

  it('handles bust when remaining score equals 1 with doubleOut', () => {
    let state = createInitialMatchState({ doubleOut: true, playerNames: ['Alice', 'Bob'] });
    state.players[0].score = 21;

    // Alice throws S20 (20) leaving 1 => BUST because minimum double is 2
    const res = throwDart(state, { m: 1, n: 20 });
    state = res.state;

    expect(res.event).toBe('bust');
    expect(state.players[0].score).toBe(21);
    expect(state.cur).toBe(1);
  });

  it('handles bust when reaching 0 without a double in doubleOut mode', () => {
    let state = createInitialMatchState({ doubleOut: true, playerNames: ['Alice', 'Bob'] });
    state.players[0].score = 20;

    // Alice throws S20 (single 20) reaching 0 => not double => BUST
    const res = throwDart(state, { m: 1, n: 20 });
    state = res.state;

    expect(res.event).toBe('bust');
    expect(state.players[0].score).toBe(20);
    expect(state.cur).toBe(1);
  });

  it('wins leg with a double checkout', () => {
    let state = createInitialMatchState({ legsToWin: 3, playerNames: ['Alice', 'Bob'] });
    state.players[0].score = 40;

    // Alice throws D20 => remaining 0 on double => Leg won
    const res = throwDart(state, { m: 2, n: 20 });
    state = res.state;

    expect(res.event).toBe('leg_won');
    expect(state.players[0].legs).toBe(1);
    expect(state.players[0].bestOut).toBe(40);
    expect(state.over).toBe(false);
  });

  it('wins match when player reaches required legs', () => {
    let state = createInitialMatchState({ legsToWin: 1, playerNames: ['Alice', 'Bob'] });
    state.players[0].score = 50;

    // Alice throws Bull (50) => remaining 0 => Match won!
    const res = throwDart(state, { m: 2, n: 25 });
    state = res.state;

    expect(res.event).toBe('match_won');
    expect(state.over).toBe(true);
    expect(state.winner).toBe('Alice');
    expect(state.players[0].legs).toBe(1);
  });

  it('alternates starter on startNextLeg', () => {
    let state = createInitialMatchState({ mode: 501, playerNames: ['Alice', 'Bob'] });
    expect(state.starter).toBe(0);
    expect(state.cur).toBe(0);

    state.players[0].legs = 1;
    state = startNextLeg(state);

    expect(state.starter).toBe(1); // Bob starts leg 2
    expect(state.cur).toBe(1);
    expect(state.players[0].score).toBe(501);
    expect(state.players[1].score).toBe(501);
  });

  it('supports exact deterministic multi-level undo', () => {
    let state = createInitialMatchState({ playerNames: ['Alice', 'Bob'] });
    const initialSnapshot = JSON.stringify(state);

    state = throwDart(state, { m: 3, n: 20 }).state;
    expect(state.visit).toHaveLength(1);

    state = throwDart(state, { m: 3, n: 20 }).state;
    expect(state.visit).toHaveLength(2);

    // Undo second dart
    state = undo(state);
    expect(state.visit).toHaveLength(1);

    // Undo first dart
    state = undo(state);
    expect(state.visit).toHaveLength(0);
    expect(JSON.stringify(state)).toBe(initialSnapshot);
  });

  it('records detailed round logs with visit total scores and score before/after', () => {
    let state = createInitialMatchState({ playerNames: ['Alice', 'Bob'] });
    expect(state.currentLeg).toBe(1);
    expect(state.logs).toEqual([]);

    // Alice throws 140 (T20, T20, S20)
    state = throwDart(state, { m: 3, n: 20 }).state;
    state = throwDart(state, { m: 3, n: 20 }).state;
    state = throwDart(state, { m: 1, n: 20 }).state;

    expect(state.logs).toHaveLength(1);
    const log1 = state.logs[0];
    expect(log1.playerName).toBe('Alice');
    expect(log1.leg).toBe(1);
    expect(log1.scoreBefore).toBe(501);
    expect(log1.visitTotal).toBe(140);
    expect(log1.scoreAfter).toBe(361);
    expect(log1.isBust).toBe(false);
    expect(log1.isCheckout).toBe(false);
    expect(log1.darts).toHaveLength(3);

    // Bob busts from 40 with T20
    state.players[1].score = 40;
    state = throwDart(state, { m: 3, n: 20 }).state; // Bust!

    expect(state.logs).toHaveLength(2);
    const log2 = state.logs[1];
    expect(log2.playerName).toBe('Bob');
    expect(log2.scoreBefore).toBe(40);
    expect(log2.visitTotal).toBe(0);
    expect(log2.scoreAfter).toBe(40);
    expect(log2.isBust).toBe(true);

    // Undo should restore logs back to 1
    state = undo(state);
    expect(state.logs).toHaveLength(1);
  });

  it('prevents exponential snapshot history growth and keeps payload size bounded across many throws', () => {
    let state = createInitialMatchState({ playerNames: ['Alice', 'Bob'] });

    // Throw 30 darts (Alice and Bob alternating visits)
    for (let i = 0; i < 30; i++) {
      state = throwDart(state, { m: 1, n: 20 }).state;
    }

    const serialized = JSON.stringify(state);
    // 30 throws should be small (< 100 KB), NOT megabytes or exponential
    expect(serialized.length).toBeLessThan(100 * 1024);

    // Verify undo still functions correctly through history stack
    for (let i = 0; i < 5; i++) {
      state = undo(state);
    }
    expect(state.history.length).toBe(25);
  });
});

