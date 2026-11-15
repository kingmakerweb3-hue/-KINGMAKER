'use strict';

/**
 * KINGMAKER CROWN contribution-based mining economics.
 *
 * Pi-inspired mechanics, independently implemented:
 * - 24-hour, server-authoritative participation sessions
 * - +20% per validated security-circle member (maximum five)
 * - +25% per concurrently active, eligible direct referral (one level)
 * - a dynamically calculated base rate that distributes, but never exceeds,
 *   the configured daily CROWN budget when actual weighted hours match forecast.
 *
 * Sponsorship revenue is company revenue and is deliberately NOT part of the
 * miner reward formula. No CROWN pool/budget is assumed by this module.
 */

const SESSION_SECONDS = 24 * 60 * 60;
const MAX_SECURITY_CIRCLE = 5;
const SECURITY_BONUS = 0.20;
const DIRECT_REFERRAL_BONUS = 0.25;

function finiteNonNegative(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new TypeError(name + ' must be a finite, non-negative number');
  }
  return value;
}

function contributionMultiplier({ verifiedSecurityMembers = 0, activeDirectReferrals = 0 } = {}) {
  const security = finiteNonNegative(verifiedSecurityMembers, 'verifiedSecurityMembers');
  const referrals = finiteNonNegative(activeDirectReferrals, 'activeDirectReferrals');
  if (!Number.isInteger(security) || !Number.isInteger(referrals)) {
    throw new TypeError('Member and referral counts must be integers');
  }
  const securityFactor = 1 + SECURITY_BONUS * Math.min(security, MAX_SECURITY_CIRCLE);
  const referralFactor = 1 + DIRECT_REFERRAL_BONUS * referrals;
  return securityFactor * referralFactor;
}

/**
 * Calculate the network base rate in CROWN per weighted miner-hour.
 * totalForecastWeightedHours is the sum of all eligible miners' expected
 * contribution multipliers multiplied by expected active hours in the day.
 */
function calculateBaseRate({ dailyCrownBudget, totalForecastWeightedHours }) {
  if (dailyCrownBudget === null || dailyCrownBudget === undefined ||
      totalForecastWeightedHours === null || totalForecastWeightedHours === undefined) {
    return { enabled: false, reason: 'CROWN_BUDGET_NOT_CONFIGURED', baseRatePerWeightedHour: 0 };
  }
  const budget = finiteNonNegative(dailyCrownBudget, 'dailyCrownBudget');
  const weightedHours = finiteNonNegative(totalForecastWeightedHours, 'totalForecastWeightedHours');
  if (budget === 0 || weightedHours === 0) {
    return { enabled: false, reason: budget === 0 ? 'DAILY_BUDGET_IS_ZERO' : 'NO_ELIGIBLE_MINING_HOURS', baseRatePerWeightedHour: 0 };
  }
  return { enabled: true, reason: null, baseRatePerWeightedHour: budget / weightedHours };
}

function quoteSession({ baseRatePerWeightedHour, verifiedSecurityMembers = 0, activeDirectReferrals = 0, activeSeconds = SESSION_SECONDS }) {
  const rate = finiteNonNegative(baseRatePerWeightedHour, 'baseRatePerWeightedHour');
  const seconds = finiteNonNegative(activeSeconds, 'activeSeconds');
  if (seconds > SESSION_SECONDS) throw new RangeError('A mining session cannot exceed 24 hours');
  const multiplier = contributionMultiplier({ verifiedSecurityMembers, activeDirectReferrals });
  const hours = seconds / 3600;
  return {
    multiplier,
    activeSeconds: seconds,
    estimatedCrown: rate * multiplier * hours
  };
}

module.exports = {
  SESSION_SECONDS,
  MAX_SECURITY_CIRCLE,
  SECURITY_BONUS,
  DIRECT_REFERRAL_BONUS,
  contributionMultiplier,
  calculateBaseRate,
  quoteSession
};
