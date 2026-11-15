'use strict';

const { randomUUID } = require('node:crypto');
const { SESSION_SECONDS, contributionMultiplier } = require('./mining-economics');

/**
 * In-memory reference implementation of server-side CROWN sessions and ledger.
 * Inject durable storage and authenticated identity before any public deployment.
 * This module deliberately does not create wallet tokens or claimable payouts.
 */
function createMiningLedgerService({ baseRatePerWeightedHour, getContribution = () => ({}), now = Date.now, id = randomUUID } = {}) {
  if (typeof baseRatePerWeightedHour !== 'number' || !Number.isFinite(baseRatePerWeightedHour) || baseRatePerWeightedHour <= 0) {
    throw new TypeError('A positive owner-configured base reward rate is required');
  }
  if (typeof getContribution !== 'function' || typeof now !== 'function' || typeof id !== 'function') {
    throw new TypeError('getContribution, now and id must be functions');
  }

  const sessions = new Map();
  const activeByAccount = new Map();
  const ledger = [];
  const settled = new Set();

  function accountIdOf(principal) {
    if (!principal || typeof principal.accountId !== 'string' || principal.accountId.trim().length < 8) {
      throw new TypeError('An authenticated principal with a stable accountId is required');
    }
    return principal.accountId;
  }

  function startSession(principal) {
    const accountId = accountIdOf(principal);
    if (activeByAccount.has(accountId)) {
      const error = new Error('This account already has an active CROWN session');
      error.code = 'SESSION_ALREADY_ACTIVE';
      throw error;
    }
    const startedAt = now();
    if (!Number.isFinite(startedAt)) throw new TypeError('Clock must return a finite timestamp');
    const session = {
      sessionId: id(),
      accountId,
      startedAt,
      endsAt: startedAt + SESSION_SECONDS * 1000,
      status: 'active'
    };
    sessions.set(session.sessionId, session);
    activeByAccount.set(accountId, session.sessionId);
    ledger.push({ entryId: id(), type: 'SESSION_STARTED', accountId, sessionId: session.sessionId, occurredAt: startedAt });
    return { ...session };
  }

  function settleSession(principal, sessionId) {
    const accountId = accountIdOf(principal);
    if (typeof sessionId !== 'string' || !sessions.has(sessionId)) {
      const error = new Error('Mining session was not found');
      error.code = 'SESSION_NOT_FOUND';
      throw error;
    }
    const session = sessions.get(sessionId);
    if (session.accountId !== accountId) {
      const error = new Error('Mining session does not belong to this account');
      error.code = 'SESSION_FORBIDDEN';
      throw error;
    }
    if (settled.has(sessionId)) {
      const error = new Error('Mining session has already been settled');
      error.code = 'SESSION_ALREADY_SETTLED';
      throw error;
    }
    const endedAt = Math.min(now(), session.endsAt);
    if (!Number.isFinite(endedAt) || endedAt < session.startedAt) throw new TypeError('Clock returned an invalid timestamp');
    const activeSeconds = Math.floor((endedAt - session.startedAt) / 1000);
    const contribution = getContribution(accountId, endedAt) || {};
    const multiplier = contributionMultiplier({
      verifiedSecurityMembers: contribution.verifiedSecurityMembers || 0,
      activeDirectReferrals: contribution.activeDirectReferrals || 0
    });
    const amount = Number((baseRatePerWeightedHour * multiplier * activeSeconds / 3600).toFixed(12));
    const entry = {
      entryId: id(),
      type: 'CROWN_REWARD_ACCRUED',
      accountId,
      sessionId,
      amount,
      activeSeconds,
      multiplier,
      occurredAt: endedAt
    };
    ledger.push(entry);
    settled.add(sessionId);
    session.status = 'settled';
    session.endedAt = endedAt;
    session.reward = amount;
    activeByAccount.delete(accountId);
    return { ...entry };
  }

  function getBalance(principal) {
    const accountId = accountIdOf(principal);
    return ledger
      .filter(entry => entry.accountId === accountId && entry.type === 'CROWN_REWARD_ACCRUED')
      .reduce((total, entry) => total + entry.amount, 0);
  }

  function getLedger(principal) {
    const accountId = accountIdOf(principal);
    return ledger.filter(entry => entry.accountId === accountId).map(entry => ({ ...entry }));
  }

  return { startSession, settleSession, getBalance, getLedger };
}

module.exports = { createMiningLedgerService };
