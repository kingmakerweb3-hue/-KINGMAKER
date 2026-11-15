'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { contributionMultiplier, calculateBaseRate, quoteSession, SESSION_SECONDS } = require('../src/mining-economics');
test('base multiplier has no bonuses', () => assert.equal(contributionMultiplier(), 1));
test('security circle adds 20 percent per verified member, capped at five', () => {
  assert.equal(contributionMultiplier({ verifiedSecurityMembers: 1 }), 1.2);
  assert.equal(contributionMultiplier({ verifiedSecurityMembers: 5 }), 2);
  assert.equal(contributionMultiplier({ verifiedSecurityMembers: 9 }), 2);
});
test('active direct referrals add 25 percent each and combine multiplicatively', () => {
  assert.equal(contributionMultiplier({ activeDirectReferrals: 2 }), 1.5);
  assert.equal(contributionMultiplier({ verifiedSecurityMembers: 1, activeDirectReferrals: 2 }), 1.8);
});
test('unlimited total supply needs no pool or daily cap', () => {
  assert.equal(calculateBaseRate({}).enabled, false);
  assert.equal(calculateBaseRate({}).reason, 'BASE_RATE_NOT_CONFIGURED');
  assert.equal(calculateBaseRate({}).supplyPolicy, 'unlimited');
  const configured = calculateBaseRate({ baseRatePerWeightedHour: 2 });
  assert.equal(configured.enabled, true);
  assert.equal(configured.baseRatePerWeightedHour, 2);
});
test('6-hour quote applies contribution multiplier under unlimited supply policy', () => {
  const quote = quoteSession({ baseRatePerWeightedHour: 1, verifiedSecurityMembers: 5, activeDirectReferrals: 2, activeSeconds: SESSION_SECONDS });
  assert.equal(quote.multiplier, 3);
  assert.equal(quote.estimatedCrown, 72);
  assert.equal(quote.supplyPolicy, 'unlimited');
});
test('invalid counts, negative values and sessions longer than 6 hours are rejected', () => {
  assert.throws(() => contributionMultiplier({ verifiedSecurityMembers: -1 }), TypeError);
  assert.throws(() => contributionMultiplier({ activeDirectReferrals: 1.5 }), TypeError);
  assert.throws(() => calculateBaseRate({ baseRatePerWeightedHour: -1 }), TypeError);
  assert.throws(() => quoteSession({ baseRatePerWeightedHour: 1, activeSeconds: SESSION_SECONDS + 1 }), RangeError);
});
