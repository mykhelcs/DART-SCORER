import React from 'react';

export const RulesGuide: React.FC = () => {
  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      <div className="card-panel">
        <h2>Official Rules & Board Specifications</h2>
        <div style={{ color: 'var(--muted)', marginBottom: '16px' }}>
          Post these at every board during tournament play.
        </div>

        <ol style={{ paddingLeft: '20px', lineHeight: '1.8', fontSize: '1.05rem' }}>
          <li>
            <strong>Oche (Throw Line):</strong> Exactly <strong>237 cm</strong> (7 ft 9.25 in) from the board face; bull is <strong>173 cm</strong> (5 ft 8 in) from the floor.
          </li>
          <li>
            <strong>Three Darts per Visit:</strong> Thrown in turn. Scored on the dart's tip position when it lands and stays in the board.
          </li>
          <li>
            <strong>Bust Rule:</strong> Score below 0, exactly 1 left (with double-out), or reaching 0 without a double. The visit scores nothing and the score returns to its value before the visit.
          </li>
          <li>
            <strong>Bounce-outs:</strong> A dart that bounces out or falls out before retrieved scores 0 and still counts as thrown.
          </li>
          <li>
            <strong>Winning Dart:</strong> Must be a double or the inner bull (50).
          </li>
          <li>
            <strong>Disputed Dart:</strong> Leave the dart in the board! The scorer and marshal decide. Decision is final.
          </li>
          <li>
            <strong>Pulling Darts:</strong> Pull darts only after the scorer announces and confirms the visit.
          </li>
          <li>
            <strong>No-Show:</strong> 10-minute forfeit rule results in a 2-0 walkover.
          </li>
        </ol>
      </div>

      <div className="card-panel">
        <h2>Scoring Reference & Impossible Finishes</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          <div>
            <h4 style={{ color: 'var(--brass)' }}>Rings & Values</h4>
            <ul style={{ paddingLeft: '18px', lineHeight: '1.6' }}>
              <li>Single Ring = Face value (1-20)</li>
              <li>Outer Ring = <strong>Double (2x)</strong></li>
              <li>Inner Ring = <strong>Treble (3x)</strong></li>
              <li>Outer Bull = 25</li>
              <li>Inner Bull = 50 (counts as Double)</li>
              <li>Maximum Visit = <strong>180</strong> (T20 + T20 + T20)</li>
              <li>Highest Possible Finish = <strong>170</strong> (T20 + T20 + Bull)</li>
            </ul>
          </div>

          <div>
            <h4 style={{ color: 'var(--red)' }}>Impossible Finishes (Under 170)</h4>
            <p style={{ color: 'var(--muted)' }}>
              These scores cannot be checked out with 3 darts:
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[169, 168, 166, 165, 163, 162, 159].map((val) => (
                <span
                  key={val}
                  style={{
                    background: 'var(--ink)',
                    border: '1px solid var(--line)',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontWeight: 700,
                  }}
                >
                  {val}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card-panel">
        <h2>Tournament Roles & Day-of Checklist</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          <div>
            <h4 style={{ color: 'var(--brass)' }}>Key Roles</h4>
            <ul style={{ paddingLeft: '18px', lineHeight: '1.6' }}>
              <li><strong>Tournament Director:</strong> Schedule owner and rulings.</li>
              <li><strong>Scorer (one per board):</strong> Operates this app, calls score aloud ("One hundred and eighty!"), verifies checkouts.</li>
              <li><strong>Marshal:</strong> Handles disputes, board care, player rotation.</li>
              <li><strong>Registrar:</strong> Pool draw, master bracket sheet.</li>
            </ul>
          </div>

          <div>
            <h4 style={{ color: 'var(--brass)' }}>Checklist</h4>
            <ul style={{ listStyle: 'none', paddingLeft: 0, lineHeight: '1.8' }}>
              <li>✔ Boards hung at 173 cm, oche taped at 237 cm</li>
              <li>✔ Device per board charged with offline app loaded</li>
              <li>✔ Printed finish charts and paper score sheets as backup</li>
              <li>✔ Pools drawn and posted 24 hours earlier</li>
              <li>✔ Scorers briefed on bust rule and double-out confirmation</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
