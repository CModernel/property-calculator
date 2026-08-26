import { describe, it, expect } from 'vitest';
import { stressTestDisplay, bufferDisplay, bufferShortfallAction, stabilizedArrow } from './healthCheckDisplay';

// TODO-156 extracted these from App.jsx so the Advanced panel, Simple mode and
// RiskToleranceProfiles stop each keeping their own copy. Before that, the
// arrow branches were exercised nowhere in the tree (the only ↗ in the repo was
// a hard-coded prop in HealthCheckIndicator.test.jsx) and the buffer/stress
// wordings were only ever asserted through a full <App/> render.

describe('stressTestDisplay', () => {
  it('reports the largest surviving rise when there is one', () => {
    expect(stressTestDisplay(3, false)).toBe('Survives +3%');
    expect(stressTestDisplay(1, false)).toBe('Survives +1%');
  });

  // TODO-148: calculateStressTestSurvivedDelta returns 0 for two different
  // situations and never separately probes +0, so the caller's own net-balance
  // flag is what separates them.
  it('separates "already underwater today" from "fails once rates rise"', () => {
    expect(stressTestDisplay(0, true)).toBe('Already in deficit');
    expect(stressTestDisplay(0, false)).toBe('Fails at +1%');
  });

  // The invariant TODO-153 restored: a positive delta means the scenario is
  // not in deficit, so the flag cannot apply. If a caller ever contradicts
  // itself again, the survival reading wins and the contradiction is visible
  // rather than silently reworded.
  it('ignores the deficit flag when a rise is survived', () => {
    expect(stressTestDisplay(2, true)).toBe('Survives +2%');
  });
});

describe('bufferDisplay', () => {
  it('renders a month count to one decimal', () => {
    expect(bufferDisplay(6.28, 28000)).toBe('6.3 months');
  });

  // TODO-149: a settlement that can't be funded at all produces a negative
  // "months" figure, which reads as merely thin rather than unfundable.
  it('replaces a negative month count with the shortfall wording', () => {
    expect(bufferDisplay(-0.33, -2000)).toBe("Can't cover settlement");
  });

  it('treats exactly-zero liquid savings as covered, matching the Health Check panel', () => {
    expect(bufferDisplay(0, 0)).toBe('0.0 months');
  });

  it('renders infinite runway as a symbol rather than "Infinity months"', () => {
    expect(bufferDisplay(Infinity, 28000)).toBe('∞');
  });
});

describe('bufferShortfallAction', () => {
  it('states the shortfall as a positive dollar figure', () => {
    expect(bufferShortfallAction(-9937)).toContain('Short by $9,937 at settlement');
  });
});

describe('stabilizedArrow', () => {
  // Direction is the caller's, because the band tables are not consistently
  // ordered by severity - so the same numeric movement means opposite things
  // for Emergency Buffer and Housing Cost Ratio.
  it('points up when the Stabilized reading is better, in the caller\'s own direction', () => {
    expect(stabilizedArrow(6, 8, 'higherIsBetter')).toBe('↗');
    expect(stabilizedArrow(44, 39, 'higherIsWorse')).toBe('↗');
  });

  it('points down when the Stabilized reading is worse', () => {
    expect(stabilizedArrow(8, 6, 'higherIsBetter')).toBe('↘');
    expect(stabilizedArrow(39, 44, 'higherIsWorse')).toBe('↘');
  });

  it('is flat when the two readings are identical, in either direction', () => {
    expect(stabilizedArrow(6, 6, 'higherIsBetter')).toBe('→');
    expect(stabilizedArrow(44, 44, 'higherIsWorse')).toBe('→');
  });
});
