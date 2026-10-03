import React from 'react';
import { MatchState } from '../core/types';
import { getVisitSum } from '../core/scoring';
import { getCheckout, formatCheckoutText } from '../core/checkout';

interface CheckoutHintProps {
  state: MatchState;
}

export const CheckoutHint: React.FC<CheckoutHintProps> = ({ state }) => {
  const p = state.players[state.cur];
  if (!p || state.over) return null;

  const currentVisitSum = getVisitSum(state.visit);
  const remaining = p.score - currentVisitSum;
  const dartsLeft = 3 - state.visit.length;

  const checkoutDarts = getCheckout(remaining, dartsLeft, state.doubleOut);

  return (
    <div className="hint-banner" role="region" aria-label="Checkout suggestion">
      {checkoutDarts ? (
        <>
          <span>{p.name} can finish with:</span>
          <strong>{formatCheckoutText(checkoutDarts)}</strong>
        </>
      ) : (
        <span>
          {p.name} to throw. {dartsLeft} {dartsLeft === 1 ? 'dart' : 'darts'} left in visit,{' '}
          {remaining} to go.
        </span>
      )}
    </div>
  );
};
