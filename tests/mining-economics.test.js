'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  contributionMultiplier,
  calculateBaseRate,
  quoteSession,
  SESSION_SECONDS
} = require('../src/mining-economics');

test('base multiplier has no bonuses', () => {
  assert.equal(contributionMultiplier(), 1);
});

test('security circle adds 20 percent per validated member, capped at five', () => {
  assert.equal(contributionMultiplier({ verifiedSecurityMembers: 1 }), 1.2);
  assert.equal(contributionMultiplier({ verifiedSecurityMembers: 5 }), 2);
  assert.equal(contributionMultiplier({ verifiedSecurityMembers: 9 }), 2);
});

test('active direct referrals add 25 percent each and combine multiplicatively', () => {
  assert.equal(contributionMultiplier({ activeDirectReferrals: 2 }), 1.5);
  assert.equal(contributionMultiplier({ verifiedSecurityMembers: 1, activeDirectReferrals: 2 }), 1.8);
});

test('missing budget disables issuance instead of inventing a rate', () => {
  assert.equal(calculateBaseRate({}).enabled, false);
  assert.equal(calculateBaseRate({}).reason, 'CROWN_BUDGET_NOT_CONFIGURED');
});

test('daily budget is distributed across forecast weighted miner-hours', () => {
  const result = calculateBaseRate({ dailyCrownBudget: 2400, totalForecastWeightedHours: 1200 });
  assert.equal(result.enabled, true);
  assert.equal(result.baseRatePerWeightedHour, 2);
});

test('24-hour quote applies the miner contribution multiplier', () => {
  const quote = quoteSession({
    baseRatePerWeightedHour: 1,
    verifiedSecurityMembers: 5,
    activeDirectReferrals: 2,
    activeSeconds: SESSION_SECONDS
  });
  assert.equal(quote.multiplier, 3);
  assert.equal(quote.estimatedCrown, 72);
});

test('invalid counts, negative values and sessions longer than 24 hours are rejected', () => {
  assert.throws(() => contributionMultiplier({ verifiedSecurityMembers: -1 }), TypeError);
  assert.throws(() => contributionMultiplier({ activeDirectReferrals: 1.5 }), TypeError);
  assert.throws(() => calculateBaseRate({ dailyCrownBudget: -1, totalForecastWeightedHours: 2 }), TypeError);
  assert.throws(() => quoteSession({ baseRatePerWeightedHour: 1, activeSeconds: SESSION_SECONDS + 1 }), RangeError);
});
