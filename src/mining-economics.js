'use strict';
/** KINGMAKER CROWN contribution-based mining economics.
 * Supply policy: unlimited total supply, with an owner-configured reward rate.
 * No browser-side minting; real rewards require authenticated server sessions
 * and validated contributions. Sponsorship is company revenue, not miner rewards.
 */
const SESSION_SECONDS = 21600;
const MAX_SECURITY_CIRCLE = 5;
const SECURITY_BONUS = 0.20;
const DIRECT_REFERRAL_BONUS = 0.25;
function finiteNonNegative(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new TypeError(name + ' must be a finite, non-negative number');
  return value;
}
function contributionMultiplier({ verifiedSecurityMembers = 0, activeDirectReferrals = 0 } = {}) {
  const security = finiteNonNegative(verifiedSecurityMembers, 'verifiedSecurityMembers');
  const referrals = finiteNonNegative(activeDirectReferrals, 'activeDirectReferrals');
  if (!Number.isInteger(security) || !Number.isInteger(referrals)) throw new TypeError('Member and referral counts must be integers');
  const multiplier = (1 + SECURITY_BONUS * Math.min(security, MAX_SECURITY_CIRCLE)) * (1 + DIRECT_REFERRAL_BONUS * referrals);\n  return Number(multiplier.toFixed(12));
}
/** Unlimited supply has no pool or daily cap; only the reward rate is configured. */
function calculateBaseRate({ baseRatePerWeightedHour } = {}) {
  if (baseRatePerWeightedHour === null || baseRatePerWeightedHour === undefined) return { enabled: false, reason: 'BASE_RATE_NOT_CONFIGURED', baseRatePerWeightedHour: 0, supplyPolicy: 'unlimited' };
  const rate = finiteNonNegative(baseRatePerWeightedHour, 'baseRatePerWeightedHour');
  if (rate === 0) return { enabled: false, reason: 'BASE_RATE_IS_ZERO', baseRatePerWeightedHour: 0, supplyPolicy: 'unlimited' };
  return { enabled: true, reason: null, baseRatePerWeightedHour: rate, supplyPolicy: 'unlimited' };
}
function quoteSession({ baseRatePerWeightedHour, verifiedSecurityMembers = 0, activeDirectReferrals = 0, activeSeconds = SESSION_SECONDS }) {
  const rate = finiteNonNegative(baseRatePerWeightedHour, 'baseRatePerWeightedHour');
  const seconds = finiteNonNegative(activeSeconds, 'activeSeconds');
  if (seconds > SESSION_SECONDS) throw new RangeError('A mining session cannot exceed 6 hours');
  const multiplier = contributionMultiplier({ verifiedSecurityMembers, activeDirectReferrals });
  return { multiplier, activeSeconds: seconds, estimatedCrown: Number((rate * multiplier * (seconds / 3600)).toFixed(12)), supplyPolicy: 'unlimited' };
}
module.exports = { SESSION_SECONDS, MAX_SECURITY_CIRCLE, SECURITY_BONUS, DIRECT_REFERRAL_BONUS, contributionMultiplier, calculateBaseRate, quoteSession };
